import socket
import sqlite3
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import db  # noqa: E402
from emailparse import build_evidence, content_hash, parse_eml, registrable_domain  # noqa: E402
from schemas import Assessment, Finding, Evidence  # noqa: E402

FIX = ROOT / "fixtures" / "dev"


def load(name):
    raw = (FIX / name).read_bytes()
    p = parse_eml(raw)
    return raw, p, build_evidence(p)


def kinds(ev):
    return {e.kind for e in ev}


@pytest.fixture
def conn(tmp_path):
    c = db.connect(str(tmp_path / "t.db"))
    db.init_db(c)
    db.create_user(c, "rita", "pw1", "reporter")
    db.create_user(c, "ravi", "pw2", "reviewer")
    return c


def make_assessment(eid, label="likely_phishing"):
    action = {"likely_phishing": "create_incident", "needs_investigation": "route_manual_investigation",
              "no_strong_indicators": "reviewed_closure"}[label]
    queue = {"create_incident": "security-incidents", "route_manual_investigation": "manual-investigation",
             "reviewed_closure": "closed-reviewed"}[action]
    return Assessment(label=label, findings=[Finding(statement="Reply-To differs", evidence_ids=[eid])],
                      unknowns=["Link destination not visited"], proposed_action=action, queue=queue)


def intake_with_assessment(conn, name="phish_reset.eml"):
    raw, p, ev = load(name)
    iid, _ = db.create_intake(conn, "rita", raw, p, content_hash(raw))
    db.add_evidence(conn, iid, ev)
    aid, v = db.save_assessment(conn, iid, make_assessment(ev[0].id), "test-model", "pb-1")
    return iid, aid, v, ev


# ---- parsing / evidence ----
def test_phish_signals_found():
    _, _, ev = load("phish_reset.eml")
    assert {"reply_to_mismatch", "link_text_mismatch", "hidden_text", "instruction_like_text",
            "auth_header_reported", "lookalike_domain"} <= kinds(ev)


def test_auth_header_is_marked_unverified():
    _, _, ev = load("phish_reset.eml")
    a = [e for e in ev if e.kind == "auth_header_reported"][0]
    assert "not independently verified" in a.note


def test_benign_has_no_mismatch_signals():
    _, _, ev = load("benign_newsletter.eml")
    assert not ({"reply_to_mismatch", "link_text_mismatch", "lookalike_domain",
                 "instruction_like_text"} & kinds(ev))


def test_third_party_link_is_a_signal_not_a_verdict():
    _, _, ev = load("ambiguous_shipping.eml")
    link = [e for e in ev if e.kind == "link"][0]
    assert "differs from sender domain" in link.note and "signal" in link.note


def test_empty_oversized_and_non_email_fail_cleanly():
    with pytest.raises(ValueError):
        parse_eml(b"")
    with pytest.raises(ValueError):
        parse_eml(b"x" * 2_000_000)
    with pytest.raises(ValueError):
        parse_eml(b"just some text with no headers")


def test_parsing_never_opens_a_network_connection(monkeypatch):
    def boom(*a, **k):
        raise AssertionError("network used")
    monkeypatch.setattr(socket.socket, "connect", boom)
    load("phish_reset.eml")


# ---- intake ----
def test_duplicate_upload_detected(conn):
    raw, p, _ = load("phish_reset.eml")
    i1, d1 = db.create_intake(conn, "rita", raw, p, content_hash(raw))
    i2, d2 = db.create_intake(conn, "rita", raw, p, content_hash(raw))
    assert i1 == i2 and not d1 and d2


# ---- validation ----
def test_unknown_evidence_id_rejected(conn):
    raw, p, ev = load("phish_reset.eml")
    iid, _ = db.create_intake(conn, "rita", raw, p, content_hash(raw))
    db.add_evidence(conn, iid, ev)
    with pytest.raises(ValueError, match="Unknown evidence"):
        db.save_assessment(conn, iid, make_assessment("E999"), "m", "pb")


def test_disallowed_queue_rejected(conn):
    raw, p, ev = load("phish_reset.eml")
    iid, _ = db.create_intake(conn, "rita", raw, p, content_hash(raw))
    db.add_evidence(conn, iid, ev)
    bad = make_assessment(ev[0].id)
    bad.queue = "finance-payments"
    with pytest.raises(ValueError, match="not permitted"):
        db.save_assessment(conn, iid, bad, "m", "pb")


# ---- approval controls ----
def test_reporter_cannot_approve_even_by_direct_call(conn):
    _, aid, _, _ = intake_with_assessment(conn)
    with pytest.raises(PermissionError):
        db.decide(conn, "rita", aid, "approve")
    assert db.list_cases(conn) == []


def test_reviewer_approval_creates_one_case_and_audit(conn):
    _, aid, _, _ = intake_with_assessment(conn)
    assert db.decide(conn, "ravi", aid, "approve")["status"] == "executed"
    cases = db.list_cases(conn)
    assert len(cases) == 1 and cases[0]["case_type"] == "incident" and cases[0]["queue"] == "security-incidents"
    assert "approved_and_executed" in [e["event"] for e in db.list_audit(conn)]


def test_reviewer_override_executes_action_for_reviewed_label(conn):
    _, aid, _, _ = intake_with_assessment(conn)
    result = db.decide(conn, "ravi", aid, "approve", "Verified independently.",
                       reviewed_label="no_strong_indicators")
    assert result["status"] == "executed"
    (case,) = db.list_cases(conn)
    assert case["case_type"] == "closure"
    assert case["queue"] == "closed-reviewed"
    approval = conn.execute("SELECT * FROM approvals").fetchone()
    assert approval["reviewed_label"] == "no_strong_indicators"
    assert approval["reviewed_action"] == "reviewed_closure"


def test_double_approval_makes_one_case(conn):
    _, aid, _, _ = intake_with_assessment(conn)
    db.decide(conn, "ravi", aid, "approve")
    assert db.decide(conn, "ravi", aid, "approve")["status"] == "already_executed"
    assert len(db.list_cases(conn)) == 1


def test_stale_proposal_cannot_use_old_approval(conn):
    iid, aid1, _, ev = intake_with_assessment(conn)
    aid2, v2 = db.save_assessment(conn, iid, make_assessment(ev[0].id, "needs_investigation"), "m", "pb")
    assert v2 == 2
    with pytest.raises(db.StaleProposalError):
        db.decide(conn, "ravi", aid1, "approve")
    assert db.list_cases(conn) == []
    assert db.decide(conn, "ravi", aid2, "approve")["status"] == "executed"


def test_rejection_creates_no_case(conn):
    _, aid, _, _ = intake_with_assessment(conn)
    assert db.decide(conn, "ravi", aid, "reject", "not convinced")["status"] == "rejected"
    assert db.list_cases(conn) == []


def test_login(conn):
    assert db.authenticate(conn, "ravi", "pw2")["role"] == "reviewer"
    assert db.authenticate(conn, "ravi", "wrong") is None


def html_email(body):
    return ("From: sender@vendor.example\nSubject: Review\n"
            "Date: Sat, 24 Oct 2026 10:00:00 +0530\nMessage-ID: <test@vendor.example>\n"
            "Content-Type: text/html; charset=utf-8\n\n" + body).encode()


def test_bare_html_links_are_extracted_without_promoting_anchor_labels():
    p = parse_eml(html_email(
        '<p>Visit https://login-check.example/reset.</p>'
        '<a href="https://attack.example">https://acmecorp.example</a>'
        '<p>Again https://login-check.example/reset</p>'))
    assert {l['href'] for l in p['links']} == {
        'https://login-check.example/reset', 'https://attack.example'}
    assert len(p['links']) == 2
    assert 'link_text_mismatch' in kinds(build_evidence(p))


@pytest.mark.parametrize('url', ['http://[broken', 'https:///missing', 'https://host.example:invalid'])
def test_bad_url_is_evidence_and_does_not_abort_other_checks(url):
    p = parse_eml(html_email(f'<a href="{url}">Review</a>'
                            '<a href="https://attack.example">https://acmecorp.example</a>'))
    ev = build_evidence(p)
    assert {'malformed_link', 'link_text_mismatch'} <= kinds(ev)
    assert next(e for e in ev if e.kind == 'malformed_link').value == url


def test_omitted_links_are_reported_and_block_closure(conn):
    raw = html_email(''.join(f'<a href="https://vendor.example/{i}">Read</a>' for i in range(20))
                     + '<a href="https://attack.example">https://acmecorp.example</a>')
    p = parse_eml(raw)
    assert len(p['links']) == 20 and p['omitted_links'] == 1
    assert any('incomplete' in w for w in p['warnings'])
    ev = build_evidence(p)
    assert 'analysis_incomplete' in kinds(ev)
    iid, _ = db.create_intake(conn, 'rita', raw, p, content_hash(raw))
    db.add_evidence(conn, iid, ev)
    with pytest.raises(ValueError, match='requires investigation'):
        db.save_assessment(conn, iid, make_assessment(ev[0].id, 'no_strong_indicators'), 'm', 'pb')
    aid, _ = db.save_assessment(conn, iid, make_assessment(ev[0].id, 'needs_investigation'), 'm', 'pb')
    assert db.decide(conn, 'ravi', aid, 'approve')['status'] == 'executed'


def test_malformed_link_blocks_closure(conn):
    raw = html_email('<a href="http://[broken">Review</a>')
    p = parse_eml(raw)
    ev = build_evidence(p)
    iid, _ = db.create_intake(conn, 'rita', raw, p, content_hash(raw))
    db.add_evidence(conn, iid, ev)
    with pytest.raises(ValueError, match='requires investigation'):
        db.save_assessment(conn, iid, make_assessment(ev[0].id, 'no_strong_indicators'), 'm', 'pb')


@pytest.mark.parametrize('host,expected', [
    ('192.0.2.1', '192.0.2.1'), ('198.51.2.1', '198.51.2.1'),
    ('2001:0db8::1', '2001:db8::1'), ('[2001:db8::2]', '2001:db8::2'),
    ('mail.acmecorp.example', 'acmecorp.example'), ('mail.company.co.uk', 'company.co.uk'),
    ('a.b.unknownsuffix', 'a.b.unknownsuffix')])
def test_destination_identity_is_preserved(host, expected):
    assert registrable_domain(host) == expected


def test_distinct_ip_link_destinations_are_mismatches():
    p = parse_eml(html_email('<a href="http://198.51.2.1">http://192.0.2.1</a>'))
    assert 'link_text_mismatch' in kinds(build_evidence(p))


def test_cited_evidence_cannot_be_replaced_and_retry_is_safe(conn):
    iid, aid, _, ev = intake_with_assessment(conn)
    db.add_evidence(conn, iid, ev)  # same evidence is an idempotent retry
    replacement = ev[0].model_copy(update={'value': 'replaced observation'})
    with pytest.raises(ValueError, match='immutable'):
        db.add_evidence(conn, iid, [replacement])
    assert conn.execute('SELECT value FROM evidence WHERE intake_id=? AND eid=?',
                        (iid, ev[0].id)).fetchone()[0] == ev[0].value
    assert db.decide(conn, 'ravi', aid, 'approve')['status'] == 'executed'


@pytest.mark.parametrize('operation', ['update', 'delete', 'replace', 'append'])
def test_database_guards_freeze_assessed_evidence(conn, operation):
    iid, _, _, ev = intake_with_assessment(conn)
    before = [tuple(r) for r in conn.execute('SELECT * FROM evidence ORDER BY eid')]
    with pytest.raises(sqlite3.IntegrityError):
        if operation == 'update':
            conn.execute('UPDATE evidence SET value=? WHERE intake_id=?', ('changed', iid))
        elif operation == 'delete':
            conn.execute('DELETE FROM evidence WHERE intake_id=?', (iid,))
        elif operation == 'replace':
            conn.execute('INSERT OR REPLACE INTO evidence VALUES(?,?,?,?,?,?)',
                         (iid, ev[0].id, 'sender', 'header', 'changed', ''))
        else:
            db.add_evidence(conn, iid, [Evidence(id='E999', kind='sender', location='header', value='new')])
    assert [tuple(r) for r in conn.execute('SELECT * FROM evidence ORDER BY eid')] == before


def test_evidence_batch_rolls_back_on_conflict(conn):
    raw, p, ev = load('phish_reset.eml')
    iid, _ = db.create_intake(conn, 'rita', raw, p, content_hash(raw))
    db.add_evidence(conn, iid, ev[:1])
    with pytest.raises(ValueError, match='immutable'):
        db.add_evidence(conn, iid, [ev[1], ev[0].model_copy(update={'value': 'changed'})])
    assert conn.execute('SELECT COUNT(*) FROM evidence WHERE intake_id=?', (iid,)).fetchone()[0] == 1


def test_freeze_survives_database_reopen(tmp_path):
    path = str(tmp_path / 'persist.db')
    c = db.connect(path)
    db.init_db(c)
    iid, _, _, ev = intake_with_assessment(c)
    c.close()
    c = db.connect(path)
    db.init_db(c)  # safe on an existing initialized database
    try:
        with pytest.raises(sqlite3.IntegrityError):
            c.execute('DELETE FROM evidence WHERE intake_id=?', (iid,))
        db.add_evidence(c, iid, ev)
    finally:
        c.close()
