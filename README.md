# PhishTrace (AgentOps 2026)

Governed phishing-triage workflow: reported .eml -> evidence -> agent proposal -> human approval -> recorded case.
Synthetic data only. Nothing here fetches links or opens attachments.

## Setup
    conda create -n phishtrace python=3.12 -y
    conda activate phishtrace
    pip install -r requirements.txt
    copy .env.example .env      # then add your own key; never commit .env
    python -m pytest            # core controls: approval, idempotency, stale proposals
    python scripts/smoke_test.py

Pytest stores temporary test databases in `.pytest-tmp` inside this project.
This avoids Windows permission problems in the user-level temporary directory.
The folder is ignored by Git.

The smoke test loads `.env` from the project folder. Existing environment
variables take precedence. Start with `GEMINI_API_KEY` set and `GEMINI_MODEL`
blank to list models; then set an available model ID and rerun. This makes real
API requests and may consume quota. Failed response/structured-output/tool-call
checks exit unsuccessfully; they are not evidence that the full agent works.

The backend is complete through the agent: `python run_one.py fixtures/dev/phish_reset.eml`
ingests an email, runs the agent, and saves a pending assessment (rules-only fallback if
`GEMINI_API_KEY` is unset). `python eval.py <folder> [--key labels.json] [--out results.json]`
prints a results table by label. The live Gemini path is
exercised only by `scripts/smoke_test.py`; the agent tests use a scripted fake model.

## Agent (Bhargav)
`pipeline.ingest()` parses and stores evidence; `agent.investigate(conn, intake_id, llm, playbook)` then
runs a bounded loop (max 6 tool calls, 20 s per call, 60 s total, one retry per model call). The model
may request only the five read-only tools in `tools.py`; anything else is logged as `tool_refused`.
It then makes one structured call, checked by `validate.check_agent_output` (evidence cited must have
been retrieved, no "safe" claims, `likely_phishing` must cite a strong indicator, `no_strong_indicators`
is refused when the parser found one). Two failed attempts, a model error or a timeout save a
`needs_investigation` assessment with `fallback=1` and `model_id='rules-only'`. Run stats are written to
`audit_events` (`model_call`, `tool_call`, `fallback_used`, `agent_run`).

Retrieved playbook passages (`playbook/`, version in `playbook/VERSION`) are stored as evidence with ids
like `PB-lookalike-domains`, so assessments can cite them. The evidence-freeze trigger exempts
`playbook_passage` rows only; run `init_db()` once on an existing database to pick up the change.

## Layout
- schemas.py     shared data contract (Evidence, Assessment, label->action policy)
- emailparse.py  .eml -> citable evidence (no network)
- validate.py    deterministic checks on model output (code, not an LLM)
- db.py          SQLite + approval/execution service (role check, versioning, unique execution key)
- pipeline.py    ingest glue (bytes -> intake + evidence)
- playbook.py, playbook/   trusted guidance (v1) with TF-IDF retrieval
- tools.py, agent.py       read-only tools and the bounded agent loop
- run_one.py, eval.py      one-email CLI and the evaluation table
- settings.py    model ID (`GEMINI_MODEL`), limits
- config.json    own domains, allowed queues, upload limit
- scripts/smoke_test.py   checks API key, structured output, tool call
- fixtures/dev   three synthetic dev emails

## Evidence and approval integration

Evidence records are immutable, and the complete evidence set freezes when the
first assessment is saved. Identical retries are accepted; changed evidence is
rejected. Do not overwrite historical evidence when changing parser versions.
Initialize existing databases with `init_db()` to install these safeguards.

Link analysis is capped at 20 entries. Omitted or malformed links are recorded
as incomplete analysis and cannot support a `no_strong_indicators` closure.
Malformed links do not prevent investigation of the remaining links.

The UI must pass the authenticated server-side session's username to
`decide()`. A caller-supplied username is not proof of authentication. Keep this
service and user provisioning unavailable to the agent and unauthenticated clients.
