"""The five read-only tools the agent may request. Everything else is refused and logged."""
import time

import db
from playbook import Playbook

TOOL_SPECS = [
    {"name": "inspect_sender", "params": {},
     "description": "Reveal the From and Reply-To evidence: sender identity, lookalike and reply-to findings."},
    {"name": "inspect_links", "params": {},
     "description": "Reveal link evidence (visible text versus real destination) and body content findings: "
                    "hidden text, instruction-like text, urgency wording, parse warnings."},
    {"name": "inspect_auth_headers", "params": {},
     "description": "Reveal reported authentication headers (unverified text from the email itself)."},
    {"name": "inspect_attachments", "params": {},
     "description": "Reveal attachment metadata (content is never opened)."},
    {"name": "search_playbook",
     "params": {"query": "What to look up, e.g. 'link text mismatch' or 'urgency language'."},
     "description": "Retrieve trusted playbook passages relevant to a question."},
]
TOOL_NAMES = {t["name"] for t in TOOL_SPECS}

_BODY_KINDS = {"link", "link_text_mismatch", "malformed_link", "analysis_incomplete", "hidden_text",
               "instruction_like_text", "urgency_language", "parse_warning"}


def _is_sender(e) -> bool:
    return e.kind in ("sender", "reply_to_mismatch") or (e.kind == "lookalike_domain" and e.location.startswith("header:"))


def _is_body(e) -> bool:
    return e.kind in _BODY_KINDS or (e.kind == "lookalike_domain" and not e.location.startswith("header:"))


_SELECT = {
    "inspect_sender": (_is_sender, "No sender evidence."),
    "inspect_links": (_is_body, "No links or body findings."),
    "inspect_auth_headers": (lambda e: e.kind == "auth_header_reported",
                             "No authentication headers present (unknown, not evidence either way)."),
    "inspect_attachments": (lambda e: e.kind in ("attachment_metadata", "risky_attachment"),
                            "The email has no attachments."),
}


class ToolBox:
    def __init__(self, conn, intake_id: int, playbook: Playbook, actor: str = "agent"):
        self.conn, self.intake_id, self.playbook, self.actor = conn, intake_id, playbook, actor
        self.revealed: set[str] = set()   # evidence ids the agent has actually seen
        self.allowed_calls = 0

    def reveal(self, rows) -> None:
        self.revealed.update(r.id for r in rows)

    def call(self, name: str, args: dict | None) -> dict:
        """Run one tool -> {'evidence': [...], 'message': str}. Unknown tools are refused, never raised."""
        args = args or {}
        t0 = time.monotonic()
        if name not in TOOL_NAMES:
            db.audit(self.conn, self.actor, "tool_refused", self.intake_id, tool=str(name)[:60],
                     args=str(args)[:300])
            return {"error": f"Tool '{name}' is not available. Allowed: {sorted(TOOL_NAMES)}", "evidence": []}
        if name == "search_playbook":
            rows = [self.playbook.as_evidence(h) for h in self.playbook.search(str(args.get("query", "")))]
            if rows:
                db.add_evidence(self.conn, self.intake_id, rows)   # idempotent; lets assessments cite them
            msg = "" if rows else "No matching playbook passage."
        else:
            pick, empty = _SELECT[name]
            rows = [e for e in db.get_evidence(self.conn, self.intake_id) if pick(e)]
            msg = "" if rows else empty
        self.reveal(rows)
        self.allowed_calls += 1
        db.audit(self.conn, self.actor, "tool_call", self.intake_id, tool=name, args=args,
                 evidence_ids=[r.id for r in rows], latency_ms=round((time.monotonic() - t0) * 1000, 1))
        return {"evidence": [r.model_dump() for r in rows], "message": msg}
