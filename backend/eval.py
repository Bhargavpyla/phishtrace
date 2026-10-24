"""Run a folder of .eml files through the pipeline and print a table by label.

python eval.py fixtures/dev [--key labels.json] [--out results.json] [--rules-only]

The answer key is a JSON file {"file.eml": "likely_phishing" | "needs_investigation" | "no_strong_indicators"}.
It is read only here, after the agent has run; it is never passed to the model. Each email runs against a
fresh in-memory database so duplicates and earlier cases cannot affect results.
"""
import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

import db
import pipeline
import settings
from agent import GeminiLLM, investigate
from playbook import Playbook

LABELS = ["likely_phishing", "needs_investigation", "no_strong_indicators"]


def evaluate(folder: Path, key: dict | None, llm_factory, playbook: Playbook) -> list[dict]:
    rows = []
    for path in sorted(folder.glob("*.eml")):
        conn = db.connect(":memory:")
        db.init_db(conn)
        db.create_user(conn, "eval", "eval-local-only", "reporter")
        row = {"file": path.name, "expected": (key or {}).get(path.name), "got": None, "action": None,
               "fallback": False, "failures": [], "model_calls": 0, "tool_calls": 0, "seconds": 0.0}
        try:
            iid, _ = pipeline.ingest(conn, path.read_bytes(), "eval")
            res = investigate(conn, iid, llm_factory(), playbook, actor="eval")
            a = res.assessment
            row.update(got=a.label, action=a.proposed_action, fallback=res.fallback,
                       model_calls=res.model_calls, tool_calls=res.tool_calls, seconds=res.elapsed_s)
            if res.fallback:
                row["failures"].append(f"fallback: {res.fallback_reason}")
            if row["expected"] and a.label != row["expected"]:
                row["failures"].append(f"expected {row['expected']}, got {a.label}")
        except ValueError as e:
            row["failures"].append(f"parse error: {e}")
        except Exception as e:  # noqa: BLE001 - one bad email must not stop the run
            row["failures"].append(f"{type(e).__name__}: {str(e)[:150]}")
        conn.close()
        rows.append(row)
    return rows


def render(rows: list[dict], has_key: bool) -> str:
    out, groups = [], defaultdict(list)
    for r in rows:
        groups[r["expected"] or "(no key)"].append(r)
    head = f"{'file':28} {'expected':21} {'got':21} {'action':27} {'calls':>5} {'tools':>5} {'sec':>6}  failures"
    for label in [*LABELS, "(no key)"]:
        if label not in groups:
            continue
        out += [f"\n== expected: {label} ({len(groups[label])})", head, "-" * len(head)]
        for r in groups[label]:
            out.append(f"{r['file'][:28]:28} {str(r['expected'] or '-'):21} {str(r['got'] or '-'):21} "
                       f"{str(r['action'] or '-'):27} {r['model_calls']:>5} {r['tool_calls']:>5} {r['seconds']:>6.1f}  "
                       f"{'; '.join(r['failures']) or '-'}")
    n = len(rows)
    out.append(f"\nEmails: {n}   fallbacks: {sum(r['fallback'] for r in rows)}   "
               f"model calls: {sum(r['model_calls'] for r in rows)}   "
               f"total time: {sum(r['seconds'] for r in rows):.1f}s   "
               f"mean/email: {sum(r['seconds'] for r in rows) / max(n, 1):.1f}s")
    if has_key:
        keyed = [r for r in rows if r["expected"]]
        out.append(f"Matches expected label: {sum(r['got'] == r['expected'] for r in keyed)}/{len(keyed)} "
                   "(author labels, not ground truth)")
        # The costly errors are reported on their own rather than hidden in one accuracy figure.
        missed = [r["file"] for r in keyed if r["expected"] == "likely_phishing" and r["got"] == "no_strong_indicators"]
        alarms = [r["file"] for r in keyed if r["expected"] == "no_strong_indicators" and r["got"] == "likely_phishing"]
        out.append(f"Suspicious closed as no-indicators: {missed or 'none'}")
        out.append(f"Benign escalated to incident: {alarms or 'none'}")
    return "\n".join(out)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("folder")
    ap.add_argument("--key", help="answer-key JSON (default: <folder>/labels.json if present)")
    ap.add_argument("--out", help="save raw results as JSON")
    ap.add_argument("--rules-only", action="store_true", help="skip the model (fallback for every email)")
    args = ap.parse_args(argv)

    folder = Path(args.folder)
    key_path = Path(args.key) if args.key else folder / "labels.json"
    key = json.loads(key_path.read_text(encoding="utf-8-sig")) if key_path.exists() else None
    api = None if args.rules_only else settings.api_key()
    if not api:
        print("No model in use: every email will take the rules-only fallback.")
    playbook = Playbook()
    rows = evaluate(folder, key, (lambda: GeminiLLM(api)) if api else (lambda: None), playbook)
    model = settings.MODEL_ID if api else "rules-only"
    print(f"model: {model}   playbook: {playbook.version}   emails: {len(rows)}")
    print(render(rows, key is not None))
    if args.out:
        Path(args.out).write_text(json.dumps({"model": model, "playbook": playbook.version, "rows": rows},
                                             indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
