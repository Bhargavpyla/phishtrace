# Frontend ↔ backend contract

**Status:** implemented by `api.py` (FastAPI) on top of `db`, `pipeline` and `agent`. Items marked
**NOT SUPPORTED** below are not implemented in the backend; the API returns an empty value, `null` or HTTP 501 and
the UI shows "Not measured" or an explanatory state. Nothing is mocked.

```
pip install fastapi uvicorn python-multipart      # httpx is needed only for tests
uvicorn api:create_app --factory --host 127.0.0.1 --port 8000
cd frontend && npm run dev                        # choose "Live backend" in the top bar
```

Base URL: `VITE_API_BASE_URL` (default `http://localhost:8000`). CORS allows `http://localhost:5173` and
`http://127.0.0.1:5173` (override with `PHISHTRACE_CORS_ORIGINS`). The browser holds no credentials; the server
holds the model key (`GEMINI_API_KEY`; without it the API runs rules-only and `/api/health` says so).
Types: `src/api/types.ts`. Errors: non-2xx with `{"error": "message"}`, shown to the user as-is.

## Identity (local demo only)
There is **no authentication**. The server decides who acts: uploads run as `PHISHTRACE_UPLOAD_USER` (default
`reporter`) and reviews as `PHISHTRACE_REVIEW_USER` (default `reviewer`). Missing users are created on startup with an
unusable random password. `db.decide()` still checks that user's stored role, and the request body can never name the
reviewer. Bind to localhost; do not expose this to a network.

| Method & path | Purpose | Response / notes |
|---|---|---|
| `GET /api/health` | Liveness + execution mode | `{"status":"ok","executionMode":"agent"\|"rules_only"}` |
| `GET /api/policies` | Organization policies | One policy: `id=default`, `version` = playbook version, `ownDomains` from `config.json` |
| `GET /api/cases` | List cases | `CaseSummary[]`, newest first. An intake with no assessment is `investigationState: "failed"` |
| `POST /api/cases` | Multipart `file` (+ ignored `policyId`) | Parses, stores, investigates **synchronously** (up to the agent's 60 s budget). `{"caseId":"C-1","duplicate":false}`; 422 bad file, 413 over the size limit, 500 if the investigation crashes (intake is kept) |
| `GET /api/cases/{id}` | Full case | `Case`; ids look like `C-<intake id>` |
| `GET /api/cases/{id}/related` | Related earlier cases | **NOT SUPPORTED**: `[]` with header `X-PhishTrace-Not-Supported: related-cases` |
| `POST /api/cases/{id}/review` | `{assessment, note, policyVersion}` | Accepting the proposal calls `db.decide(..., "approve", note)`; idempotent. **Changing the assessment returns 501** |
| `GET /api/metrics` | Counts and measured times | Unmeasured values are `null` |
| `GET /api/cases/{id}/report` | JSON report download | `Content-Disposition: attachment`; includes a `notSupported` list |

## Mapping to the Python code
| Frontend | Backend source |
|---|---|
| Assessment `suspicious` / `likely_benign` / `needs_review` | `likely_phishing` / `no_strong_indicators` / `needs_investigation` |
| `Case.id`, `subject`, `sender`, `receivedAt` | `intakes` (`sender` is `from_addr`; `received_at` is upload time) |
| `Evidence` | `evidence` rows. `observation` = stored value, `source` = location. `method` is "Parser: deterministic extraction at intake", or "Tool: search_playbook" for playbook passages. `collectedAt` is intake time (parser rows) or the tool-call time (passages). `origin` is always `new` |
| `Finding` | `Assessment.findings`. `title` = the statement (the schema has no separate explanation). `type` is a heuristic: `policy_guidance` if every cited row is a playbook passage, `observed_fact` for rules-only runs, otherwise `model_interpretation` |
| `Case.explanation` | The first two finding statements (the schema has no free-text summary) |
| `Case.missingEvidence` | `Assessment.unknowns` |
| `Case.limitations` | Fixed system limitations plus the intake's parse warnings |
| `ToolEvent` | `audit_events` `tool_call` / `tool_refused` from the latest investigation run. `reason` is not recorded; `resultSummary` lists the evidence ids returned |
| `Case.mode`, `fallback` | `assessments.fallback` → `rules_only`, else `agent` |
| `Case.policyVersion` | `assessments.playbook_version` |
| `Case.runtimeMs` | `agent_run` audit event `elapsed_s` |
| `ReviewEvent` | `approvals` rows. Approve → reviewed assessment = original. Reject → `needs_review`, note prefixed "Proposal rejected." |
| `Case.preview`, `urls`, `replyTo` | Not stored by `db`. `api.py` re-parses the upload and keeps plain text (hidden text appended with a marker), URLs and Reply-To in its own `api_preview` table. Synthetic data only |

## NOT SUPPORTED yet
- **Related-report grouping, evidence reuse, `RelatedCaseComparison`, `relatedGroupId`.** No such logic exists in Python. Needs a new backend feature.
- **Reviewer-changed assessments.** `db.decide` can only approve or reject the proposal; the API returns 501 for a different assessment. A reject path exists in `db.decide` but the UI has no button for it.
- **Analyst review time** (`null`), **reports grouped** (`null`), **evidence reused** (`null`).
- **Live "running" state / progress.** Investigation is synchronous; the upload request simply stays open.
- **Authentication and per-user roles.** See Identity above.
- **Multiple policies.** One policy; `policyId` and `policyVersion` in requests are accepted and ignored.
- **Per-tool "reason".** Not recorded by the agent.
