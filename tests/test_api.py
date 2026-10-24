import pytest
from fastapi.testclient import TestClient

from api import create_app
from conftest import FIX, FakeLLM, assessment_json, call


def scripted():
    return FakeLLM(rounds=[[call("inspect_links"), call("search_playbook", query="link text mismatch")]],
                   answers=[assessment_json(findings=[dict(
                       statement="Link text names a different domain than its destination.",
                       evidence_ids=["E5", "PB-link-text-mismatch"])])])


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.delenv("PHISHTRACE_REVIEW_USER", raising=False)
    return TestClient(create_app(str(tmp_path / "api.db"), llm_factory=scripted))


def upload(c, name="phish_reset.eml", data=None):
    raw = data if data is not None else (FIX / name).read_bytes()
    return c.post("/api/cases", files={"file": (name, raw, "message/rfc822")})


def test_health_and_policies(client, tmp_path, monkeypatch):
    assert client.get("/api/health").json() == {"status": "ok", "executionMode": "agent"}
    monkeypatch.setattr("settings.api_key", lambda: None)
    rules = TestClient(create_app(str(tmp_path / "r.db")))
    assert rules.get("/api/health").json()["executionMode"] == "rules_only"
    pol = client.get("/api/policies").json()[0]
    assert pol["version"] == "v1" and "acmecorp.example" in pol["ownDomains"]


def test_upload_investigates_and_lists_case(client):
    r = upload(client)
    assert r.status_code == 200 and r.json() == {"caseId": "C-1", "duplicate": False}
    (row,) = client.get("/api/cases").json()
    assert row["id"] == "C-1" and row["proposed"] == "suspicious" and row["reviewStatus"] == "unreviewed"
    assert row["investigationState"] == "complete" and row["receivedAt"]


def test_case_detail_matches_contract(client):
    upload(client)
    c = client.get("/api/cases/C-1").json()
    assert c["mode"] == "agent" and c["policyVersion"] == "v1" and c["toolLimit"] == 6 and c["fallback"] is False
    assert c["replyTo"] == "reset@mailbox-verify.example"
    assert "https://acme-corp-login.example/reset" in c["urls"]
    assert "AI reviewer" in c["preview"] and "hidden from readers" in c["preview"]
    assert "<" not in c["preview"].split("\n")[0]          # plain text, not HTML
    assert [t["tool"] for t in c["toolEvents"]] == ["inspect_links", "search_playbook"]
    assert all(t["status"] == "ok" for t in c["toolEvents"])
    ev = {e["id"]: e for e in c["evidence"]}
    assert "link_text_mismatch" not in ev["E5"]["observation"] and "acme-corp-login.example" in ev["E5"]["observation"]
    assert ev["E5"]["origin"] == "new" and ev["E5"]["method"].startswith("Parser")
    assert ev["PB-link-text-mismatch"]["method"] == "Tool: search_playbook"
    kinds = {f["type"] for f in c["findings"]}
    assert kinds == {"model_interpretation"} and c["findings"][0]["evidenceIds"] == ["E5", "PB-link-text-mismatch"]
    assert c["missingEvidence"] == ["Sender identity not independently verified"]
    assert any("not implemented" in x for x in c["limitations"])
    assert c["runtimeMs"] is not None and c["reviews"] == []


def test_duplicate_upload_creates_one_case(client):
    upload(client)
    again = upload(client)
    assert again.json() == {"caseId": "C-1", "duplicate": True}
    assert len(client.get("/api/cases").json()) == 1


@pytest.mark.parametrize("data", [b"", b"not an email at all"])
def test_bad_upload_is_a_clean_422_and_writes_nothing(client, data):
    r = upload(client, "bad.eml", data)
    assert r.status_code == 422 and r.json()["error"]
    assert client.get("/api/cases").json() == []


def test_oversized_upload_is_413(client):
    r = upload(client, "big.eml", b"From: a@b.example\n\n" + b"x" * 1_100_000)
    assert r.status_code == 413 and "too large" in r.json()["error"]


def test_rules_only_case_is_labelled_and_has_no_tool_events(tmp_path):
    c = TestClient(create_app(str(tmp_path / "r.db"), llm_factory=lambda: None))
    upload(c)
    case = c.get("/api/cases/C-1").json()
    assert case["mode"] == "rules_only" and case["fallback"] is True and case["toolEvents"] == []
    assert {f["type"] for f in case["findings"]} == {"observed_fact"}
    assert case["proposed"] == "needs_review"


def test_review_accepts_proposal_as_server_side_reviewer(client):
    upload(client)
    r = client.post("/api/cases/C-1/review", json={"assessment": "suspicious", "note": "Confirmed.", "policyVersion": "v1"})
    assert r.status_code == 200
    c = r.json()
    assert c["reviewStatus"] == "reviewed" and c["reviewedAssessment"] == "suspicious"
    (rev,) = c["reviews"]
    assert rev["reviewer"] == "reviewer" and rev["note"] == "Confirmed." and rev["originalAssessment"] == "suspicious"
    # double click / retry does not add a second review
    again = client.post("/api/cases/C-1/review", json={"assessment": "suspicious", "note": "Confirmed."})
    assert again.status_code == 200 and len(again.json()["reviews"]) == 1


def test_request_body_cannot_choose_the_reviewer(client):
    upload(client)
    client.post("/api/cases/C-1/review", json={"assessment": "suspicious", "reviewer": "reporter"})
    assert client.get("/api/cases/C-1").json()["reviews"][0]["reviewer"] == "reviewer"


def test_non_reviewer_identity_is_refused(tmp_path, monkeypatch):
    monkeypatch.setenv("PHISHTRACE_REVIEW_USER", "reporter")   # misconfigured: same account as the uploader
    c = TestClient(create_app(str(tmp_path / "x.db"), llm_factory=scripted))
    upload(c)
    r = c.post("/api/cases/C-1/review", json={"assessment": "suspicious"})
    assert r.status_code == 403 and "reviewer" in r.json()["error"]
    assert c.get("/api/cases/C-1").json()["reviewStatus"] == "unreviewed"


def test_reviewer_can_change_assessment(client):
    upload(client)
    r = client.post("/api/cases/C-1/review", json={
        "assessment": "likely_benign", "note": "Verified the sender through a separate channel."})
    assert r.status_code == 200
    case = r.json()
    assert case["proposed"] == "suspicious"
    assert case["reviewedAssessment"] == "likely_benign"
    assert case["reviews"][0]["originalAssessment"] == "suspicious"
    assert case["reviews"][0]["reviewedAssessment"] == "likely_benign"


def test_changing_assessment_requires_note(client):
    upload(client)
    r = client.post("/api/cases/C-1/review", json={"assessment": "likely_benign", "note": ""})
    assert r.status_code == 422 and "note is required" in r.json()["error"]
    assert client.get("/api/cases/C-1").json()["reviews"] == []
    assert client.post("/api/cases/C-1/review", json={"assessment": "nonsense"}).status_code == 422


def test_related_is_empty_and_marked_unsupported(client):
    upload(client)
    r = client.get("/api/cases/C-1/related")
    assert r.status_code == 200 and r.json() == [] and r.headers["X-PhishTrace-Not-Supported"] == "related-cases"


@pytest.mark.parametrize("path", ["/api/cases/C-99", "/api/cases/nope", "/api/cases/C-abc/related", "/api/cases/C-99/report"])
def test_unknown_cases_are_404_json(client, path):
    r = client.get(path)
    assert r.status_code == 404 and "error" in r.json()


def test_metrics_report_only_what_is_measured(client):
    assert client.get("/api/metrics").json()["reportsInvestigated"] == 0
    upload(client)
    m = client.get("/api/metrics").json()
    assert m["reportsInvestigated"] == 1 and m["casesReviewed"] == 0 and m["toolCalls"] == 2 and m["runtimeMs"] is not None
    assert m["reportsGrouped"] is None and m["evidenceReused"] is None and m["analystReviewMinutes"] is None
    client.post("/api/cases/C-1/review", json={"assessment": "suspicious"})
    assert client.get("/api/metrics").json()["casesReviewed"] == 1


def test_report_download(client):
    upload(client)
    r = client.get("/api/cases/C-1/report")
    assert r.status_code == 200 and "attachment" in r.headers["content-disposition"]
    doc = r.json()
    assert doc["source"] == "backend" and doc["case"]["id"] == "C-1" and "evidence reuse" in doc["notSupported"]
    assert "assessment changes by reviewers" not in doc["notSupported"]
    assert "tamper-proof" in doc["notice"]


def test_cors_allows_the_vite_origin(client):
    r = client.options("/api/cases", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"})
    assert r.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_investigation_crash_keeps_the_intake_and_lists_it_as_failed(tmp_path):
    class Bad:
        def next_tool_calls(self, t):
            raise RuntimeError("boom")
    import api as api_mod
    original = api_mod.investigate
    api_mod.investigate = lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom"))
    try:
        c = TestClient(create_app(str(tmp_path / "f.db"), llm_factory=lambda: Bad()))
        r = upload(c)
    finally:
        api_mod.investigate = original
    assert r.status_code == 500 and "C-1" in r.json()["error"]
    (row,) = c.get("/api/cases").json()
    assert row["investigationState"] == "failed"
