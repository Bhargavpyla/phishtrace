"""Run the whole pipeline on one .eml: python run_one.py fixtures/dev/phish_reset.eml [--db path]"""
import argparse
import json
import sys
from pathlib import Path

import db
import pipeline
import settings
from agent import GeminiLLM, investigate
from playbook import Playbook


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("eml")
    ap.add_argument("--db", default=settings.DB_PATH)
    args = ap.parse_args(argv)

    conn = db.connect(args.db)
    db.init_db(conn)
    if conn.execute("SELECT 1 FROM users WHERE username='cli'").fetchone() is None:
        db.create_user(conn, "cli", "cli-local-only", "reporter")   # CLI uploader; cannot approve
    try:
        iid, dup = pipeline.ingest(conn, Path(args.eml).read_bytes(), "cli")
    except ValueError as e:
        print(f"Rejected upload: {e}")
        return 2
    print(f"Intake #{iid}" + (" (duplicate upload; reusing the existing record)" if dup else ""))

    key = settings.api_key()
    if not key:
        print("GEMINI_API_KEY not set: running the rules-only fallback.")
    res = investigate(conn, iid, GeminiLLM(key) if key else None, Playbook())

    print("\nEvidence examined:")
    for e in db.list_audit(conn, iid):
        if e["event"] == "tool_call":
            m = json.loads(e["meta"])
            print(f"  {m['tool']}({m['args']}) -> {m['evidence_ids']}")
    print("\nAssessment" + (" [RULES-ONLY FALLBACK]" if res.fallback else "") + ":")
    print(res.assessment.model_dump_json(indent=2))
    print(f"\nModel calls: {res.model_calls}, tool calls: {res.tool_calls}, {res.elapsed_s}s")
    print(f"Saved as pending (assessment #{res.assessment_id}, v{res.version}); awaiting reviewer approval.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
