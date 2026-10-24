"""Runtime settings for the agent. Secrets and model ID come from the environment / project .env."""
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent if Path(__file__).resolve().parent.name == "backend" else Path(__file__).resolve().parent
load_dotenv(ROOT / ".env", override=False)

MODEL_ID = os.getenv("GEMINI_MODEL") or "gemini-3.5-flash-lite"
DB_PATH = os.getenv("PHISHTRACE_DB") or str(ROOT / "phishtrace.db")

MAX_TOOL_CALLS = 6
PER_CALL_TIMEOUT_S = 20
TOTAL_BUDGET_S = 60


def api_key() -> str | None:
    return os.getenv("GEMINI_API_KEY") or None
