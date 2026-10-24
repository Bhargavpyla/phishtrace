"""Ingest glue: raw .eml bytes -> intake + frozen evidence. Raises ValueError on bad input (nothing is written)."""
import db
from emailparse import build_evidence, content_hash, parse_eml


def ingest(conn, raw: bytes, uploader: str) -> tuple[int, bool]:
    """Returns (intake_id, is_duplicate). Identical bytes never create a second intake or re-add evidence."""
    if conn.execute("SELECT 1 FROM users WHERE username=?", (uploader,)).fetchone() is None:
        raise PermissionError("Unknown user.")
    parsed = parse_eml(raw)               # may raise ValueError before any write
    evidence = build_evidence(parsed)
    iid, duplicate = db.create_intake(conn, uploader, raw, parsed, content_hash(raw))
    if not duplicate:
        db.add_evidence(conn, iid, evidence)
    return iid, duplicate
