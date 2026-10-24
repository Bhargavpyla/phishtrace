"""HTTP API for the PhishTrace frontend. Implements frontend/docs/FRONTEND_API.md on top of db, pipeline and agent.

Run:   uvicorn api:create_app --factory --host 127.0.0.1 --port 8000
Local demo only. There is NO authentication: the server decides who acts (PHISHTRACE_UPLOAD_USER /
PHISHTRACE_REVIEW_USER), db.decide() still checks that user's stored role, and the request body can never name
the reviewer. Bind to localhost; do not expose this to a network.

NOT SUPPORTED YET (returned as 501, empty, or null; see docs): related-report grouping and evidence reuse,
reviews that change the assessment, analyst review time, live "running" investigation state.
"""
import functools
import inspect
import json
import os
import secrets
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Callable

from fastapi import FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

import db
import emailparse
import pipeline
import settings
from agent import GeminiLLM, investigate
from playbook import Playbook
from validate import CONFIG

NOT_SUPPORTED_HEADER = "X-PhishTrace-Not-Supported"
PREVIEW_SCHEMA = """
CREATE TABLE IF NOT EXISTS api_preview(
  intake_id INTEGER PRIMARY KEY, preview TEXT, urls TEXT, reply_to TEXT, from_name TEXT);
"""
LIMITATIONS = [
    "Authentication headers are text inside the email and are not independently verified.",
    "Links were never visited and attachments were never opened.",
    "Related-report grouping and evidence reuse are not implemented in this backend yet.",
]
UI_LABEL = {"likely_phishing": "suspicious", "no_strong_indicators": "likely_benign"}
TOOL_EVENTS = ("tool_call", "tool_refused")


def ui_label(label: str) -> str:
    return UI_LABEL.get(label, "needs_review")


def case_id(intake_id: int) -> str:
    return f"C-{intake_id}"


def parse_case_id(raw: str) -> int:
    if raw.startswith("C-") and raw[2:].isdigit():
        return int(raw[2:])
    raise HTTPException(404, f"No case {raw!r}.")


class ReviewBody(BaseModel):
    assessment: str
    note: str = ""
    policyVersion: str | None = None


# ---------------------------------------------------------------- case assembly
def _meta(row: dict) -> dict:
    try:
        return json.loads(row["meta"] or "{}")
    except ValueError:
        return {}


def _reviews(conn, iid: int) -> list[dict]:
    rows = conn.execute(
        "SELECT ap.*, a.label, a.playbook_version FROM approvals ap JOIN assessments a ON a.id=ap.assessment_id "
        "WHERE a.intake_id=? ORDER BY ap.id", (iid,)).fetchall()
    out = []
    for r in rows:
        approved = r["decision"] == "approve"
        original = ui_label(r["label"])
        out.append({
            "id": f"R{r['id']}", "at": r["created_at"], "reviewer": r["reviewer"],
            "originalAssessment": original,
            # decide() cannot record a replacement assessment: approve keeps the proposal, reject reopens it.
            "reviewedAssessment": original if approved else "needs_review",
            "note": (r["reason"] or "") if approved else f"Proposal rejected. {r['reason'] or ''}".strip(),
            "policyVersion": r["playbook_version"] or "unknown",
        })
    return out


def _summary(conn, intake: dict, a: dict | None, reviews: list[dict]) -> dict:
    reviewed = bool(a) and a["status"] in ("approved", "rejected") and bool(reviews)
    return {
        "id": case_id(intake["id"]),
        "subject": intake["subject"] or "",
        "sender": intake["from_addr"] or "",
        "receivedAt": intake["received_at"],
        "proposed": ui_label(a["label"]) if a else "needs_review",
        "reviewStatus": "reviewed" if reviewed else "unreviewed",
        "reviewedAssessment": reviews[-1]["reviewedAssessment"] if reviewed else None,
        # An intake with no assessment never finished investigating (investigation is synchronous).
        "investigationState": "complete" if a else "failed",
    }


def _build_case(conn, iid: int) -> dict:
    intake = conn.execute("SELECT * FROM intakes WHERE id=?", (iid,)).fetchone()
    if intake is None:
        raise HTTPException(404, f"No case {case_id(iid)!r}.")
    intake = dict(intake)
    a = db.latest_assessment(conn, iid)
    reviews = _reviews(conn, iid)
    out = _summary(conn, intake, a, reviews)

    audit = db.list_audit(conn, iid)
    runs = [e for e in audit if e["event"] == "agent_run"]
    lo = runs[-2]["id"] if len(runs) > 1 else 0
    hi = runs[-1]["id"] if runs else float("inf")
    tool_events = [e for e in audit if e["event"] in TOOL_EVENTS and lo < e["id"] < hi]
    first_tool_for: dict[str, dict] = {}
    for e in audit:
        if e["event"] == "tool_call":
            for eid in _meta(e).get("evidence_ids", []):
                first_tool_for.setdefault(eid, e)

    evidence = []
    for ev in db.get_evidence(conn, iid):
        tool = first_tool_for.get(ev.id)
        if ev.kind == "playbook_passage":
            method = f"Tool: {_meta(tool).get('tool', 'search_playbook')}" if tool else "Tool: search_playbook"
            collected = tool["ts"] if tool else intake["received_at"]
        else:
            method, collected = "Parser: deterministic extraction at intake", intake["received_at"]
        evidence.append({"id": ev.id, "observation": ev.value, "source": ev.location, "method": method,
                         "collectedAt": collected, "origin": "new",   # evidence reuse is not implemented
                         "note": ev.note or None})
    by_id = {e["id"]: e for e in evidence}

    findings, unknowns, mode, policy_version, fallback, explanation = [], [], "agent", "unknown", False, ""
    if a:
        body = json.loads(a["body_json"])
        fallback = bool(a["fallback"])
        mode = "rules_only" if fallback else "agent"
        policy_version = a["playbook_version"] or "unknown"
        unknowns = body.get("unknowns", [])
        for i, f in enumerate(body.get("findings", []), 1):
            cited = [by_id[x] for x in f["evidence_ids"] if x in by_id]
            kind = ("policy_guidance" if cited and all(c["id"].startswith("PB-") for c in cited)
                    else "observed_fact" if fallback else "model_interpretation")
            findings.append({
                "id": f"F{i}", "title": f["statement"], "explanation": "", "type": kind,
                "evidenceIds": f["evidence_ids"],
                "sourceDetail": "\n".join(f"{c['id']}: {c['observation']}" for c in cited) or None,
            })
        explanation = " ".join(f["statement"] for f in body.get("findings", [])[:2])

    prev = conn.execute("SELECT * FROM api_preview WHERE intake_id=?", (iid,)).fetchone()
    warnings = json.loads(intake["parse_warnings"] or "[]")
    out.update({
        "replyTo": (prev["reply_to"] or None) if prev else None,
        "preview": prev["preview"] if prev else "",
        "urls": json.loads(prev["urls"]) if prev else [],
        "explanation": explanation, "mode": mode, "policyVersion": policy_version,
        "findings": findings, "evidence": evidence,
        "toolEvents": [{
            "id": f"T{e['id']}", "tool": _meta(e).get("tool", "unknown"),
            "status": "ok" if e["event"] == "tool_call" else "refused",
            "durationMs": _meta(e).get("latency_ms"),
            "resultSummary": (f"{len(_meta(e).get('evidence_ids', []))} evidence row(s): "
                              f"{', '.join(_meta(e).get('evidence_ids', [])) or 'none'}"
                              if e["event"] == "tool_call" else "Refused: tool is not on the allowlist"),
        } for e in tool_events],
        "toolLimit": settings.MAX_TOOL_CALLS,
        "missingEvidence": unknowns,
        "limitations": [*LIMITATIONS, *warnings],
        "reviews": reviews,
        "runtimeMs": round(float(_meta(runs[-1])["elapsed_s"]) * 1000) if runs and "elapsed_s" in _meta(runs[-1]) else None,
        "fallback": fallback,
    })
    return out


# ---------------------------------------------------------------- app
def create_app(db_path: str | None = None, llm_factory: Callable[[], object] | None = None) -> FastAPI:
    """llm_factory returns a model adapter (or None for rules-only). Defaults to Gemini when a key is set."""
    path = db_path or settings.DB_PATH
    upload_user = os.getenv("PHISHTRACE_UPLOAD_USER", "reporter")
    review_user = os.getenv("PHISHTRACE_REVIEW_USER", "reviewer")
    playbook = Playbook()

    boot = db.connect(path)
    db.init_db(boot)
    boot.executescript(PREVIEW_SCHEMA)
    for user, role in ((upload_user, "reporter"), (review_user, "reviewer")):
        if boot.execute("SELECT 1 FROM users WHERE username=?", (user,)).fetchone() is None:
            db.create_user(boot, user, secrets.token_urlsafe(24), role)   # no login endpoint; identity is server-side
    boot.close()

    def default_llm():
        key = settings.api_key()
        return GeminiLLM(key) if key else None

    make_llm = llm_factory or default_llm

    app = FastAPI(title="PhishTrace API", version="0.1.0")
    origins = [o.strip() for o in os.getenv("PHISHTRACE_CORS_ORIGINS",
               "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST"],
                       allow_headers=["Content-Type"], expose_headers=[NOT_SUPPORTED_HEADER, "Content-Disposition"])

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException):
        return JSONResponse({"error": str(exc.detail)}, status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError):
        first = exc.errors()[0] if exc.errors() else {}
        loc = ".".join(str(p) for p in first.get("loc", []) if p != "body")
        return JSONResponse({"error": f"Invalid request: {loc} {first.get('msg', '')}".strip()}, status_code=422)

    @contextmanager
    def _conn_ctx():
        conn = db.connect(path)
        try:
            yield conn
        finally:
            conn.close()

    def with_conn(fn):
        """Open a connection inside the handler's own thread and hand it in as `conn` (hidden from FastAPI)."""
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            with _conn_ctx() as conn:
                return fn(*args, conn=conn, **kwargs)
        sig = inspect.signature(fn)
        wrapper.__signature__ = sig.replace(parameters=[q for q in sig.parameters.values() if q.name != "conn"])
        return wrapper

    @app.get("/api/health")
    def health():
        return {"status": "ok", "executionMode": "agent" if settings.api_key() or llm_factory else "rules_only"}

    @app.get("/api/policies")
    def policies():
        return [{"id": "default", "name": "Organization default", "version": playbook.version,
                 "ownDomains": CONFIG["own_domains"]}]

    @app.get("/api/cases")
    @with_conn
    def list_cases(conn=None):
        out = []
        for intake in db.list_intakes(conn):
            out.append(_summary(conn, intake, db.latest_assessment(conn, intake["id"]), _reviews(conn, intake["id"])))
        return out

    @app.post("/api/cases")
    @with_conn
    def upload(file: UploadFile = File(...), policyId: str | None = Form(None), conn=None):
        """Parse, store and investigate synchronously (up to the agent's 60 s budget). policyId is ignored: one policy."""
        limit = CONFIG["max_upload_bytes"]
        raw = file.file.read(limit + 1)
        if len(raw) > limit:
            raise HTTPException(413, f"File too large (limit {limit} bytes).")
        try:
            iid, duplicate = pipeline.ingest(conn, raw, upload_user)
        except ValueError as e:
            raise HTTPException(422, str(e))
        except PermissionError as e:
            raise HTTPException(403, str(e))
        if duplicate:
            return {"caseId": case_id(iid), "duplicate": True}
        p = emailparse.parse_eml(raw)
        body = p["visible_text"][:3000]
        if p["hidden_text"]:
            body += "\n\n[Text hidden from readers in the HTML part]\n" + p["hidden_text"][:500]
        conn.execute("INSERT OR IGNORE INTO api_preview VALUES(?,?,?,?,?)",
                     (iid, body, json.dumps([lk["href"] for lk in p["links"]]), p["reply_to"], p["from_name"]))
        try:
            investigate(conn, iid, make_llm(), playbook, actor="agent")
        except Exception as e:  # noqa: BLE001 - the intake is kept; the case lists as a failed investigation
            db.audit(conn, "agent", "investigation_error", iid, error=f"{type(e).__name__}: {str(e)[:200]}")
            raise HTTPException(500, f"Investigation failed: {type(e).__name__}. The upload was saved as {case_id(iid)}.")
        return {"caseId": case_id(iid), "duplicate": False}

    @app.get("/api/cases/{cid}")
    @with_conn
    def get_case(cid: str, conn=None):
        return _build_case(conn, parse_case_id(cid))

    @app.get("/api/cases/{cid}/related")
    @with_conn
    def related(cid: str, response: Response, conn=None):
        _build_case(conn, parse_case_id(cid))   # 404 for unknown cases
        response.headers[NOT_SUPPORTED_HEADER] = "related-cases"
        return []

    @app.post("/api/cases/{cid}/review")
    @with_conn
    def review(cid: str, body: ReviewBody, conn=None):
        iid = parse_case_id(cid)
        a = db.latest_assessment(conn, iid)
        if a is None:
            raise HTTPException(409, "This case has no assessment to review.")
        if body.assessment not in ("suspicious", "likely_benign", "needs_review"):
            raise HTTPException(422, "assessment must be suspicious, likely_benign or needs_review.")
        if body.assessment != ui_label(a["label"]):
            raise HTTPException(501, "Changing the assessment is not supported yet: the backend can only approve "
                                     "or reject the proposal. Accept the proposal, or reject it via db.decide.")
        try:
            db.decide(conn, review_user, a["id"], "approve", body.note.strip() or None)
        except PermissionError as e:
            raise HTTPException(403, str(e))
        except db.StaleProposalError as e:
            raise HTTPException(409, str(e))
        except LookupError as e:
            raise HTTPException(404, str(e))
        return _build_case(conn, iid)

    @app.get("/api/metrics")
    @with_conn
    def metrics(conn=None):
        count = lambda sql: conn.execute(sql).fetchone()[0]  # noqa: E731
        runs = [_meta(dict(r)) for r in conn.execute("SELECT meta FROM audit_events WHERE event='agent_run'")]
        return {
            "reportsInvestigated": count("SELECT COUNT(DISTINCT intake_id) FROM assessments"),
            "reportsGrouped": None,     # not supported: no grouping logic
            "casesReviewed": count("SELECT COUNT(DISTINCT a.intake_id) FROM approvals ap "
                                   "JOIN assessments a ON a.id=ap.assessment_id"),
            "evidenceReused": None,     # not supported: no reuse logic
            "toolCalls": count("SELECT COUNT(*) FROM audit_events WHERE event='tool_call'"),
            "runtimeMs": round(sum(float(r.get("elapsed_s", 0)) for r in runs) * 1000) if runs else None,
            "analystReviewMinutes": None,   # not recorded anywhere
        }

    @app.get("/api/cases/{cid}/report")
    @with_conn
    def report(cid: str, conn=None):
        c = _build_case(conn, parse_case_id(cid))
        doc = {
            "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "source": "backend",
            "notice": "Audit history, not a tamper-proof record. Evidence citations support but do not by "
                      "themselves prove a conclusion.",
            "notSupported": ["related-report grouping", "evidence reuse", "assessment changes by reviewers"],
            "case": {k: c[k] for k in ("id", "subject", "sender", "replyTo", "receivedAt", "mode", "policyVersion",
                                       "proposed", "reviewStatus", "reviewedAssessment", "explanation",
                                       "missingEvidence", "limitations")},
            "findings": c["findings"], "evidence": c["evidence"], "toolEvents": c["toolEvents"],
            "toolCallsUsed": len(c["toolEvents"]), "toolLimit": c["toolLimit"], "reviews": c["reviews"],
        }
        return JSONResponse(doc, headers={"Content-Disposition": f'attachment; filename="phishtrace-report-{cid}.json"'})

    return app


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(create_app(), host="127.0.0.1", port=8000)
