"""Deterministic checks on a model-produced Assessment. Code, not an LLM.

Note: an evidence ID existing does not prove the claim follows from it.
Check semantic support by hand on the evaluation set.
"""
import json
import re
from pathlib import Path

from schemas import LABEL_TO_ACTION, Assessment, Evidence

CONFIG = json.loads((Path(__file__).parent / "config.json").read_text())


def queue_for(action: str) -> str:
    return CONFIG["queues"][action]


# Evidence kinds that justify escalation, and that forbid a "no strong indicators" closure.
STRONG_KINDS = {"link_text_mismatch", "reply_to_mismatch", "lookalike_domain", "instruction_like_text",
                "risky_attachment"}
# "safe" asserted without negation ("not safe", "unsafe" are fine).
_SAFE_CLAIM = re.compile(r"(?<!un)(?<!not )\bsafe(ly)?\b|\bharmless\b|\bguaranteed\b|\bno risk\b", re.I)


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


def check_agent_output(a: Assessment, evidence: list[Evidence], revealed: set[str]) -> list[str]:
    """Stricter checks for model-produced assessments (used by the agent, on top of validate_assessment).

    Citation existence still does not prove a claim follows from its source; spot-check by hand.
    """
    problems = validate_assessment(a, {e.id for e in evidence})
    kind_of = {e.id: e.kind for e in evidence}
    if not a.findings:
        problems.append("At least one finding is required")
    if not a.unknowns:
        problems.append("List at least one unknown (what could not be established)")
    cited = {i for f in a.findings for i in f.evidence_ids}
    for i in sorted(cited & kind_of.keys() - revealed):
        problems.append(f"Evidence {i} was cited but never retrieved in this investigation")
    if any(_SAFE_CLAIM.search(f.statement) for f in a.findings) or any(_SAFE_CLAIM.search(u) for u in a.unknowns):
        problems.append("Do not assert safety or certainty; state what was and was not found")
    if a.label == "likely_phishing" and not any(kind_of.get(i) in STRONG_KINDS for i in cited):
        problems.append("likely_phishing must cite at least one strong indicator "
                        f"({', '.join(sorted(STRONG_KINDS))})")
    if a.label == "no_strong_indicators" and STRONG_KINDS & set(kind_of.values()):
        problems.append("The parser found strong indicators in this email; no_strong_indicators is not allowed")
    return problems
