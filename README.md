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

This folder currently contains backend foundations, not a runnable Streamlit
application. Agent orchestration, playbook retrieval, and the UI remain to be built.

## Evidence and approval integration

Evidence records are immutable, and the complete evidence set freezes when the
first assessment is saved. Identical retries are accepted; changed evidence is
rejected. Do not overwrite historical evidence when changing parser versions.
Initialize existing databases with `init_db()` to install these safeguards.

Link analysis is capped at 20 entries. Omitted or malformed links are recorded
as incomplete analysis and cannot support a `no_strong_indicators` closure.
Malformed links do not prevent investigation of the remaining links.

The future UI must pass the authenticated server-side session's username to
`decide()`. A caller-supplied username is not proof of authentication. Keep this
service and user provisioning unavailable to the agent and unauthenticated clients.

## Layout
- schemas.py     shared data contract (Evidence, Assessment, label->action policy)
- emailparse.py  .eml -> citable evidence (no network)
- validate.py    deterministic checks on model output (code, not an LLM)
- db.py          SQLite + approval/execution service (role check, versioning, unique execution key)
- config.json    own domains, allowed queues, upload limit
- scripts/smoke_test.py   checks API key, structured output, tool call
- fixtures/dev   three synthetic dev emails
