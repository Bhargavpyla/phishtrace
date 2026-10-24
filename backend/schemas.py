"""Shared data contract. Bhargav (agent/backend) and Nihaal (UI) both import from here."""
from typing import Literal

from pydantic import BaseModel

Label = Literal["likely_phishing", "needs_investigation", "no_strong_indicators"]
ActionType = Literal["create_incident", "route_manual_investigation", "reviewed_closure"]

# Fixed policy: the model proposes a label; code decides which action that label may lead to.
LABEL_TO_ACTION = {
    "likely_phishing": "create_incident",
    "needs_investigation": "route_manual_investigation",
    "no_strong_indicators": "reviewed_closure",
}


class Evidence(BaseModel):
    id: str            # stable within one intake: E1, E2, ...
    kind: str          # sender, link, link_text_mismatch, reply_to_mismatch, ...
    location: str      # where it came from, e.g. header:Reply-To, body:link#2
    value: str         # the observed value
    note: str = ""     # limits / provenance


class Finding(BaseModel):
    statement: str
    evidence_ids: list[str]


class Assessment(BaseModel):
    label: Label
    findings: list[Finding]
    unknowns: list[str] = []
    proposed_action: ActionType
    queue: str
