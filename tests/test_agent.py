import json
import shutil

import pytest

import db
import pipeline
from agent import investigate
from conftest import FIX, FakeLLM, assessment_json, call
from emailparse import build_evidence, parse_eml
from eval import evaluate, render
from schemas import Assessment, Finding
from validate import check_agent_output

LINKS = [[call("inspect_links")]]


def kinds_of(raw):
    return [e.kind for e in build_evidence(parse_eml(raw))]


def audit_events(conn, iid, event):
    return [json.loads(e["meta"]) for e in db.list_audit(conn, iid) if e["event"] == event]


# ---------------------------------------------------------------- parser additions
def test_summary_row_comes_first_and_is_counts_only(conn, phish):
    first = db.get_evidence(conn, phish)[0]
    assert first.kind == "message_summary" and first.id == "E1" and "links=" in first.value


def test_homoglyph_lookalike_detected():
    raw = (b"From: IT <it@acmec0rp.example>\nSubject: hi\nDate: Sat, 24 Oct 2026 10:00:00 +0530\n"
           b"Message-ID: <x@y>\n\nhello")
    assert "lookalike_domain" in kinds_of(raw)


def test_unrelated_domain_is_not_lookalike():
    assert "lookalike_domain" not in kinds_of((FIX / "benign_newsletter.eml").read_bytes())


def test_risky_attachment_and_urgency():
    raw = (b"From: a@x.example\nTo: b@y.example\nSubject: URGENT invoice\nDate: Sat, 24 Oct 2026 10:00:00 +0530\n"
           b"Message-ID: <x@y>\nMIME-Version: 1.0\nContent-Type: multipart/mixed; boundary=B\n\n--B\n"
           b"Content-Type: text/plain\n\nAct immediately: final notice.\n--B\nContent-Type: application/octet-stream\n"
           b"Content-Disposition: attachment; filename=\"inv.pdf.exe\"\n\nMZ\n--B--\n")
    k = kinds_of(raw)
    assert "risky_attachment" in k and "urgency_language" in k


# ---------------------------------------------------------------- validator (agent-level)
def _a(label="likely_phishing", statement="Link text mismatch.", ids=("E5",), unknowns=("unverified",)):
    action = {"likely_phishing": "create_incident", "needs_investigation": "route_manual_investigation",
              "no_strong_indicators": "reviewed_closure"}[label]
    queue = {"create_incident": "security-incidents", "route_manual_investigation": "manual-investigation",
             "reviewed_closure": "closed-reviewed"}[action]
    return Assessment(label=label, findings=[Finding(statement=statement, evidence_ids=list(ids))],
                      unknowns=list(unknowns), proposed_action=action, queue=queue)


def test_agent_checks_accept_good(conn, phish):
    assert check_agent_output(_a(), db.get_evidence(conn, phish), {"E5"}) == []


@pytest.mark.parametrize("kw,needle", [
    (dict(statement="This email is safe."), "safety"),
    (dict(unknowns=()), "unknown"),
    (dict(ids=("E2",)), "strong indicator"),                  # sender row is not a strong indicator
    (dict(label="no_strong_indicators"), "no_strong_indicators is not allowed"),
])
def test_agent_checks_reject(conn, phish, kw, needle):
    problems = check_agent_output(_a(**kw), db.get_evidence(conn, phish), {"E5", "E2"})
    assert any(needle in p for p in problems), problems


def test_unretrieved_evidence_rejected(conn, phish):
    problems = check_agent_output(_a(), db.get_evidence(conn, phish), {"E1"})
    assert any("never retrieved" in p for p in problems)


def test_not_safe_wording_allowed(conn, phish):
    assert check_agent_output(_a(statement="Not safe to open; the link is unsafe."),
                              db.get_evidence(conn, phish), {"E5"}) == []


# ---------------------------------------------------------------- agent loop
def test_happy_path_saves_pending_and_cites_passage(conn, phish, playbook):
    llm = FakeLLM(rounds=[[call("inspect_links"), call("search_playbook", query="link text mismatch")]],
                  answers=[assessment_json(findings=[dict(statement="Link text differs from destination.",
                                                          evidence_ids=["E5", "PB-link-text-mismatch"])])])
    res = investigate(conn, phish, llm, playbook)
    assert not res.fallback and res.tool_calls == 2 and res.model_calls == 3   # select, select(stop), assess
    assert db.latest_assessment(conn, phish)["status"] == "pending"
    assert any(e.id == "PB-link-text-mismatch" and e.kind == "playbook_passage" for e in db.get_evidence(conn, phish))
    assert [m["tool"] for m in audit_events(conn, phish, "tool_call")] == ["inspect_links", "search_playbook"]
    assert audit_events(conn, phish, "agent_run")[0]["model_calls"] == 3


def test_reinvestigation_can_still_record_new_passage(conn, phish, playbook):
    investigate(conn, phish, FakeLLM(rounds=LINKS, answers=[assessment_json()]), playbook)   # freezes email evidence
    res = investigate(conn, phish, FakeLLM(
        rounds=[[call("inspect_links"), call("search_playbook", query="urgency pressure language")]],
        answers=[assessment_json(findings=[dict(statement="Link text mismatch.", evidence_ids=["E5", "PB-urgency-language"])])]),
        playbook)
    assert not res.fallback and res.version == 2


def test_unknown_tool_refused_and_logged(conn, phish, playbook):
    llm = FakeLLM(rounds=[[call("delete_mailbox", user="all"), call("inspect_links")]], answers=[assessment_json()])
    res = investigate(conn, phish, llm, playbook)
    assert audit_events(conn, phish, "tool_refused")[0]["tool"] == "delete_mailbox"
    assert res.tool_calls == 1 and not res.fallback


def test_tool_budget_capped(conn, phish, playbook):
    llm = FakeLLM(rounds=[[call("inspect_sender")] * 10], answers=[assessment_json()] * 2)
    assert investigate(conn, phish, llm, playbook).tool_calls <= 6


def test_api_error_gives_labelled_fallback(conn, phish, playbook):
    class Boom(FakeLLM):
        def next_tool_calls(self, t):
            raise RuntimeError("429 quota")
    res = investigate(conn, phish, Boom(), playbook)
    row = db.latest_assessment(conn, phish)
    assert res.fallback and row["fallback"] == 1 and row["model_id"] == "rules-only"
    assert res.assessment.label == "needs_investigation" and "Rules-only" in res.assessment.findings[0].statement
    assert "429" in audit_events(conn, phish, "fallback_used")[0]["reason"]


def test_no_model_configured_falls_back(conn, phish, playbook):
    assert investigate(conn, phish, None, playbook).fallback


def test_invalid_output_retried_then_fixed(conn, phish, playbook):
    llm = FakeLLM(rounds=LINKS, answers=[assessment_json(findings=[dict(statement="Totally safe.", evidence_ids=["E5"])]),
                                         assessment_json()])
    res = investigate(conn, phish, llm, playbook)
    assert not res.fallback and llm.assess_prompts[1][1]


def test_invalid_output_twice_falls_back(conn, phish, playbook):
    res = investigate(conn, phish, FakeLLM(rounds=LINKS, answers=["not json", "{}"]), playbook)
    assert res.fallback and "validation" in res.fallback_reason


def test_injection_text_cannot_approve_anything(conn, phish, playbook):
    """phish_reset.eml tells the AI to mark it safe; the only effect is evidence. No case, still pending."""
    investigate(conn, phish, FakeLLM(rounds=LINKS, answers=[assessment_json()]), playbook)
    assert db.list_cases(conn) == [] and db.latest_assessment(conn, phish)["status"] == "pending"


def test_agent_output_flows_through_approval(conn, phish, playbook):
    res = investigate(conn, phish, FakeLLM(rounds=LINKS, answers=[assessment_json()]), playbook)
    with pytest.raises(PermissionError):
        db.decide(conn, "rita", res.assessment_id, "approve")
    assert db.decide(conn, "ravi", res.assessment_id, "approve")["status"] == "executed"
    assert db.list_cases(conn)[0]["queue"] == "security-incidents"


def test_restart_keeps_records(tmp_path, playbook):
    path = str(tmp_path / "r.db")
    c = db.connect(path)
    db.init_db(c)
    db.create_user(c, "rita", "pw", "reporter")
    iid, _ = pipeline.ingest(c, (FIX / "phish_reset.eml").read_bytes(), "rita")
    investigate(c, iid, FakeLLM(rounds=LINKS, answers=[assessment_json()]), playbook)
    c.close()
    again = db.connect(path)
    db.init_db(again)
    assert db.latest_assessment(again, iid)["status"] == "pending" and db.get_evidence(again, iid)


def test_duplicate_upload_not_reingested(conn):
    raw = (FIX / "phish_reset.eml").read_bytes()
    a, b = pipeline.ingest(conn, raw, "rita"), pipeline.ingest(conn, raw, "rita")
    assert a[0] == b[0] and b[1] is True
    assert len(db.get_evidence(conn, a[0])) == len({e.id for e in db.get_evidence(conn, a[0])})


def test_bad_upload_writes_nothing(conn):
    for raw in (b"", b"no headers here"):
        with pytest.raises(ValueError):
            pipeline.ingest(conn, raw, "rita")
    assert db.list_intakes(conn) == []


# ---------------------------------------------------------------- eval
def test_eval_table_and_failures(tmp_path, playbook):
    for n in ("phish_reset.eml", "benign_newsletter.eml"):
        shutil.copy(FIX / n, tmp_path / n)
    (tmp_path / "broken.eml").write_bytes(b"garbage")
    key = {"phish_reset.eml": "likely_phishing", "benign_newsletter.eml": "no_strong_indicators",
           "broken.eml": "needs_investigation"}

    def factory():   # always claims phishing citing E5: right for the phish, invalid for the newsletter
        return FakeLLM(rounds=LINKS, answers=[assessment_json()] * 2)

    rows = {r["file"]: r for r in evaluate(tmp_path, key, factory, playbook)}
    assert rows["phish_reset.eml"]["got"] == "likely_phishing" and not rows["phish_reset.eml"]["failures"]
    assert rows["benign_newsletter.eml"]["fallback"]
    assert "parse error" in rows["broken.eml"]["failures"][0]
    text = render(list(rows.values()), True)
    assert "expected: likely_phishing" in text and "Matches expected label: 1/3" in text
