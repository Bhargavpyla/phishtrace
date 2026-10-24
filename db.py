"""SQLite persistence plus the approval/execution service.

Rules enforced HERE (in code, not in the model):
  * only a user whose stored role is 'reviewer' can approve or reject
  * an approval only applies to the proposal version it was shown
  * executing an approved action is idempotent (unique execution key)
Local demo identity only; this is not enterprise SSO.
"""
import hashlib
import hmac
import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone

from schemas import Assessment, Evidence
from validate import validate_assessment

SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
  username TEXT PRIMARY KEY, role TEXT NOT NULL CHECK(role IN ('reporter','reviewer')),
  salt BLOB NOT NULL, pw_hash BLOB NOT NULL);
CREATE TABLE IF NOT EXISTS intakes(
  id INTEGER PRIMARY KEY, content_hash TEXT UNIQUE NOT NULL, uploader TEXT, received_at TEXT,
  subject TEXT, from_addr TEXT, parse_warnings TEXT);
CREATE TABLE IF NOT EXISTS evidence(
  intake_id INTEGER NOT NULL, eid TEXT NOT NULL, kind TEXT, location TEXT, value TEXT, note TEXT,
  PRIMARY KEY(intake_id, eid));
CREATE TABLE IF NOT EXISTS assessments(
  id INTEGER PRIMARY KEY, intake_id INTEGER NOT NULL, version INTEGER NOT NULL,
  label TEXT, proposed_action TEXT, queue TEXT, body_json TEXT,
  model_id TEXT, playbook_version TEXT, fallback INTEGER DEFAULT 0, created_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  UNIQUE(intake_id, version));
CREATE TABLE IF NOT EXISTS approvals(
  id INTEGER PRIMARY KEY, assessment_id INTEGER, version INTEGER, reviewer TEXT,
  decision TEXT, reason TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS cases(
  id INTEGER PRIMARY KEY, execution_key TEXT UNIQUE NOT NULL, intake_id INTEGER, assessment_id INTEGER,
  case_type TEXT, queue TEXT, summary TEXT, created_by TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS audit_events(
  id INTEGER PRIMARY KEY, ts TEXT, actor TEXT, event TEXT, intake_id INTEGER, assessment_id INTEGER, meta TEXT);
CREATE TRIGGER IF NOT EXISTS evidence_no_update BEFORE UPDATE ON evidence
BEGIN SELECT RAISE(ABORT, 'Evidence is immutable'); END;
CREATE TRIGGER IF NOT EXISTS evidence_no_delete BEFORE DELETE ON evidence
BEGIN SELECT RAISE(ABORT, 'Evidence is immutable'); END;
CREATE TRIGGER IF NOT EXISTS evidence_no_replace BEFORE INSERT ON evidence
WHEN EXISTS(SELECT 1 FROM evidence WHERE intake_id=NEW.intake_id AND eid=NEW.eid)
BEGIN SELECT RAISE(ABORT, 'Evidence is immutable'); END;
-- Email-derived evidence freezes at the first assessment. Trusted playbook passages are exempt so a
-- re-investigation can still record (and cite) a passage it retrieves; existing ids stay immutable.
DROP TRIGGER IF EXISTS evidence_no_insert_after_assessment;
CREATE TRIGGER evidence_no_insert_after_assessment BEFORE INSERT ON evidence
WHEN NEW.kind <> 'playbook_passage' AND EXISTS(SELECT 1 FROM assessments WHERE intake_id=NEW.intake_id)
BEGIN SELECT RAISE(ABORT, 'Evidence is frozen after assessment'); END;
"""

CASE_TYPE = {"create_incident": "incident", "route_manual_investigation": "manual_review",
             "reviewed_closure": "closure"}


class StaleProposalError(Exception):
    pass


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect(path="phishtrace.db"):
    conn = sqlite3.connect(path, isolation_level=None)  # autocommit; transactions are explicit
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db(conn):
    conn.executescript(SCHEMA)


@contextmanager
def tx(conn):
    conn.execute("BEGIN IMMEDIATE")
    try:
        yield
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise


def audit(conn, actor, event, intake_id=None, assessment_id=None, **meta):
    conn.execute(
        "INSERT INTO audit_events(ts,actor,event,intake_id,assessment_id,meta) VALUES(?,?,?,?,?,?)",
        (_now(), actor, event, intake_id, assessment_id, json.dumps(meta)))


# ---- users (local demo identities) ----
def _hash(password, salt):
    return hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)


def create_user(conn, username, password, role):
    salt = os.urandom(16)
    conn.execute("INSERT OR REPLACE INTO users VALUES(?,?,?,?)", (username, role, salt, _hash(password, salt)))


def authenticate(conn, username, password):
    r = conn.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
    if r and hmac.compare_digest(r["pw_hash"], _hash(password, r["salt"])):
        return {"username": r["username"], "role": r["role"]}
    return None


# ---- intake and evidence ----
def create_intake(conn, uploader, raw, parsed, content_hash):
    row = conn.execute("SELECT id FROM intakes WHERE content_hash=?", (content_hash,)).fetchone()
    if row:
        audit(conn, uploader, "duplicate_upload", intake_id=row["id"])
        return row["id"], True
    cur = conn.execute(
        "INSERT INTO intakes(content_hash,uploader,received_at,subject,from_addr,parse_warnings) VALUES(?,?,?,?,?,?)",
        (content_hash, uploader, _now(), parsed["subject"], parsed["from_addr"], json.dumps(parsed["warnings"])))
    audit(conn, uploader, "intake_created", intake_id=cur.lastrowid)
    return cur.lastrowid, False


def add_evidence(conn, intake_id, evidence):
    """Append immutable evidence atomically; identical retries are harmless.

    Once any assessment exists, the entire evidence set is frozen. A parser
    change must not silently replace the sources of an existing assessment.
    """
    with tx(conn):
        if not conn.execute("SELECT 1 FROM intakes WHERE id=?", (intake_id,)).fetchone():
            raise LookupError("No such intake.")
        for e in evidence:
            values = (e.kind, e.location, e.value, e.note)
            existing = conn.execute(
                "SELECT kind,location,value,note FROM evidence WHERE intake_id=? AND eid=?",
                (intake_id, e.id)).fetchone()
            if existing is not None:
                if tuple(existing) != values:
                    raise ValueError(f"Evidence {e.id} is immutable.")
                continue
            conn.execute("INSERT INTO evidence VALUES(?,?,?,?,?,?)", (intake_id, e.id, *values))


# ---- assessments (model proposals) ----
def save_assessment(conn, intake_id, a: Assessment, model_id, playbook_version, fallback=False):
    with tx(conn):
        if not conn.execute("SELECT 1 FROM intakes WHERE id=?", (intake_id,)).fetchone():
            raise LookupError("No such intake.")
        evidence = list(conn.execute("SELECT eid,kind FROM evidence WHERE intake_id=?", (intake_id,)))
        problems = validate_assessment(a, {r["eid"] for r in evidence})
        if a.label == "no_strong_indicators" and any(
                r["kind"] in ("analysis_incomplete", "malformed_link") for r in evidence):
            problems.append("Incomplete link analysis requires investigation, not closure.")
        if problems:
            raise ValueError("; ".join(problems))
        v = conn.execute("SELECT COALESCE(MAX(version),0) FROM assessments WHERE intake_id=?",
                         (intake_id,)).fetchone()[0] + 1
        conn.execute("UPDATE assessments SET status='superseded' WHERE intake_id=? AND status='pending'",
                     (intake_id,))
        cur = conn.execute(
            "INSERT INTO assessments(intake_id,version,label,proposed_action,queue,body_json,model_id,"
            "playbook_version,fallback,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
            (intake_id, v, a.label, a.proposed_action, a.queue, a.model_dump_json(), model_id,
             playbook_version, int(fallback), _now()))
        audit(conn, "agent", "assessment_proposed", intake_id, cur.lastrowid,
              version=v, model=model_id, fallback=fallback)
    return cur.lastrowid, v


# ---- approval + execution (the only write path to 'cases') ----
def decide(conn, reviewer, assessment_id, decision, reason=None):
    """Trusted backend entry point: reviewer must come from an authenticated
    server-side session, never a form field or a model-generated argument.
    """
    if decision not in ("approve", "reject"):
        raise ValueError("decision must be 'approve' or 'reject'")
    u = conn.execute("SELECT role FROM users WHERE username=?", (reviewer,)).fetchone()
    if not u or u["role"] != "reviewer":
        audit(conn, reviewer, "approval_denied", assessment_id=assessment_id)
        raise PermissionError("Only a reviewer can approve or reject.")
    key = f"assessment-{assessment_id}"
    try:
        with tx(conn):
            a = conn.execute("SELECT * FROM assessments WHERE id=?", (assessment_id,)).fetchone()
            if a is None:
                raise LookupError("No such assessment.")
            done = conn.execute("SELECT id FROM cases WHERE execution_key=?", (key,)).fetchone()
            if done:  # double click / retry: no second case
                return {"status": "already_executed", "case_id": done["id"]}
            if a["status"] != "pending":
                raise StaleProposalError(f"Proposal is {a['status']}; review the current proposal.")
            conn.execute("INSERT INTO approvals(assessment_id,version,reviewer,decision,reason,created_at) "
                         "VALUES(?,?,?,?,?,?)", (assessment_id, a["version"], reviewer, decision, reason, _now()))
            if decision == "reject":
                conn.execute("UPDATE assessments SET status='rejected' WHERE id=?", (assessment_id,))
                audit(conn, reviewer, "rejected", a["intake_id"], assessment_id, reason=reason)
                return {"status": "rejected"}
            subject = conn.execute("SELECT subject FROM intakes WHERE id=?", (a["intake_id"],)).fetchone()[0]
            cur = conn.execute(
                "INSERT INTO cases(execution_key,intake_id,assessment_id,case_type,queue,summary,created_by,created_at)"
                " VALUES(?,?,?,?,?,?,?,?)",
                (key, a["intake_id"], assessment_id, CASE_TYPE[a["proposed_action"]], a["queue"],
                 f"{a['label']}: {subject}", reviewer, _now()))
            conn.execute("UPDATE assessments SET status='approved' WHERE id=?", (assessment_id,))
            audit(conn, reviewer, "approved_and_executed", a["intake_id"], assessment_id, case_id=cur.lastrowid)
            return {"status": "executed", "case_id": cur.lastrowid}
    except StaleProposalError:
        audit(conn, reviewer, "stale_approval_rejected", assessment_id=assessment_id)
        raise


def get_evidence(conn, intake_id) -> list[Evidence]:
    return [Evidence(id=r["eid"], kind=r["kind"], location=r["location"], value=r["value"], note=r["note"] or "")
            for r in conn.execute("SELECT * FROM evidence WHERE intake_id=? ORDER BY rowid", (intake_id,))]


def get_assessment(conn, assessment_id):
    r = conn.execute("SELECT * FROM assessments WHERE id=?", (assessment_id,)).fetchone()
    return dict(r) if r else None


def latest_assessment(conn, intake_id):
    r = conn.execute("SELECT * FROM assessments WHERE intake_id=? ORDER BY version DESC LIMIT 1",
                     (intake_id,)).fetchone()
    return dict(r) if r else None


def list_intakes(conn):
    return [dict(r) for r in conn.execute("SELECT * FROM intakes ORDER BY id DESC")]


def list_cases(conn):
    return [dict(r) for r in conn.execute("SELECT * FROM cases ORDER BY id")]


def list_audit(conn, intake_id=None):
    q, args = "SELECT * FROM audit_events", ()
    if intake_id is not None:
        q, args = q + " WHERE intake_id=?", (intake_id,)
    return [dict(r) for r in conn.execute(q + " ORDER BY id", args)]
