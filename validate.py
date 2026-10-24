"""Deterministic checks on a model-produced Assessment. Code, not an LLM.

Note: an evidence ID existing does not prove the claim follows from it.
Check semantic support by hand on the evaluation set.
"""
import json
from pathlib import Path

from schemas import LABEL_TO_ACTION, Assessment

CONFIG = json.loads((Path(__file__).parent / "config.json").read_text())


def queue_for(action: str) -> str:
    return CONFIG["queues"][action]


def validate_assessment(a: Assessment, evidence_ids: set[str]) -> list[str]:
    problems = []
    if LABEL_TO_ACTION[a.label] != a.proposed_action:
        problems.append(f"Action {a.proposed_action} not allowed for label {a.label}")
    if a.queue != queue_for(a.proposed_action):
        problems.append(f"Queue {a.queue!r} not permitted for {a.proposed_action}")
    if a.label == "likely_phishing" and not a.findings:
        problems.append("likely_phishing needs at least one cited finding")
    for f in a.findings:
        if not f.evidence_ids:
            problems.append(f"Finding has no evidence: {f.statement[:60]}")
        for e in f.evidence_ids:
            if e not in evidence_ids:
                problems.append(f"Unknown evidence ID {e}")
    return problems
