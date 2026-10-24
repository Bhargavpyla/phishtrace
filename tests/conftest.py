import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import db  # noqa: E402
import pipeline  # noqa: E402
from playbook import Playbook  # noqa: E402

FIX = ROOT / "fixtures" / "dev"


class FakeLLM:
    """Scripted model: `rounds` is a list of tool-call lists; `answers` are assess() outputs (str or Exception)."""

    def __init__(self, rounds=(), answers=()):
        self.rounds, self.answers = list(rounds), list(answers)
        self.assess_prompts = []

    def next_tool_calls(self, transcript):
        return (self.rounds.pop(0) if self.rounds else []), None

    def assess(self, context, problems):
        self.assess_prompts.append((context, problems))
        out = self.answers.pop(0)
        if isinstance(out, Exception):
            raise out
        return out


def assessment_json(**kw):
    """Valid model output for phish_reset.eml (E5 = link_text_mismatch)."""
    base = dict(label="likely_phishing",
                findings=[dict(statement="Link text names a different domain than its destination.", evidence_ids=["E5"])],
                unknowns=["Sender identity not independently verified"],
                proposed_action="create_incident", queue="security-incidents")
    base.update(kw)
    return json.dumps(base)


def call(name, **args):
    return {"name": name, "args": args}


@pytest.fixture
def conn():
    c = db.connect(":memory:")
    db.init_db(c)
    db.create_user(c, "rita", "pw1", "reporter")
    db.create_user(c, "ravi", "pw2", "reviewer")
    return c


@pytest.fixture(scope="session")
def playbook():
    return Playbook()


@pytest.fixture
def phish(conn):
    iid, _ = pipeline.ingest(conn, (FIX / "phish_reset.eml").read_bytes(), "rita")
    return iid
