# PhishTrace frontend

React + TypeScript + Tailwind CSS + Lucide, with Inter (`@fontsource-variable/inter`) as the typeface. It opens straight into the app (no login) and
talks to the backend only through `src/api/` (the `Api` interface), which has two implementations: a **demo adapter** (synthetic fixtures)
and a **live adapter** (HTTP, served by `api.py`; see `docs/FRONTEND_API.md`).

## Run
```
cd frontend
npm install
npm run dev          # http://localhost:5173, starts in Demo mode
npm run typecheck    # tsc --noEmit
npm test             # vitest + Testing Library (25 interaction tests)
npm run build        # typecheck + production build into dist/
```
For live data start the API (`uvicorn api:create_app --factory --host 127.0.0.1 --port 8000`), set `VITE_API_BASE_URL` in `.env.local`
if it is not on port 8000 (see `env.example`), and choose "Live backend" in the top bar. No model keys are used in the browser.

## Navigation
Three destinations: **Investigations** (upload, summary, recent investigations, and each case's details), **Related reports**
(groups with why they were grouped), **Review & impact** (measured metrics and the savings calculator).

## Layout
- `src/api/types.ts` entities and the `Api` interface · `live.ts` HTTP adapter · `demo.ts` + `fixtures.ts` demo adapter · `context.tsx` source/health/policy state
- `src/components/` Badges (status chips with icon + text), UploadPanel (stepper, drag-and-drop, real elapsed-time status), CaseTable,
  AssessmentCard, FindingsList, EvidenceLedger, RelatedComparison (side by side), ReviewPanel, ToolActivity, ui (Card, Button, Skeleton, Disclosure, …)
- `src/pages/` QueuePage (Investigations), CasePage, RelatedPage, ImpactPage
- `docs/FRONTEND_API.md` backend contract, what is implemented, and what is not supported yet

## Status
| Area | State |
|---|---|
| Upload → investigate → case opens automatically (live) | Working against `api.py`; processing shows genuine elapsed time (no invented progress) |
| Findings, evidence, review, report download | Working in demo and live |
| Related-report comparison, grouping, evidence reuse | UI complete; **backend has no grouping or reuse logic**, so only demo fixtures show it. Live shows an empty state that says so |
| Changing an assessment in review | Demo only; the backend returns 501 |
| Demo uploads | Validated, then reported as not analysed (no fake analysis) |
| Analyst review time, reports grouped, evidence reused (live) | "Not measured" |

## Demo walkthrough (about 3 minutes)
1. **Investigations**: the upload card with its four-step flow sits first. Below it are the summary tiles and the searchable table. Filter by *Needs review*.
2. **C-101** (reviewed, suspicious): the assessment card explains the result in plain language. *Why it was flagged* lists findings; select an evidence ID (E4) to expand its source inline. Technical detail (tool activity) stays collapsed. URLs are text with a Copy button.
3. **C-102**: the comparison shows what matches the reviewed case, three evidence rows *reused* (each links to C-101), and a *Fresh check required* for the changed authentication header.
4. **C-103**: same pattern, but the *Changed destination* is highlighted side by side with the old one. Nothing is reused and fresh checks are listed. Similarity is never treated as safety.
5. **Review** C-102 under *What needs your review*: accept, or change the assessment with a required note. The original proposal stays beside the reviewed decision; history is expandable and labelled *Demo-only*. Download the report.
6. **Related reports**: the group and why it was grouped; open a later report to compare.
7. **C-105**: rules-only fallback, no tool events, gaps listed. **C-104**: benign, explicitly "not a guarantee of safety".
8. **Review & impact**: system runtime and analyst time are separate; unmeasured values read "Not measured". Try the calculator (negative savings are shown).
9. Switch to **Live backend** with the API stopped: it reports "Backend not connected" and shows errors rather than mock data.
