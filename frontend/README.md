# PhishTrace frontend

React + TypeScript + Tailwind CSS + Lucide. Opens straight into the app (no login). It talks to the backend only through
`src/api/` (`Api` interface), with two implementations: a **demo adapter** (synthetic fixtures) and a **live adapter** (HTTP).

## Run
```
cd frontend
npm install
npm run dev          # http://localhost:5173, starts in Demo mode
npm run typecheck    # tsc --noEmit
npm test             # vitest + Testing Library (17 interaction tests)
npm run build        # typecheck + production build into dist/
```
Backend URL: copy `env.example` to `.env.local` and set `VITE_API_BASE_URL`. Switch between "Demo data" and
"Live backend" in the top bar. No model keys are used in the browser.

## Layout
- `src/api/types.ts` entities (Case, Finding, Evidence, ToolEvent, ReviewEvent, RelatedCaseComparison, Policy, Metrics) and the `Api` interface
- `src/api/live.ts` HTTP adapter (timeouts, actionable errors, label mapping) · `src/api/demo.ts` + `fixtures.ts` demo adapter · `context.tsx` source/health/policy state
- `src/components/` Badges (status chips with icon + text), CaseTable, UploadPanel, FindingsList, EvidenceLedger, ToolActivity, RelatedComparison, ReviewPanel, ui
- `src/pages/` QueuePage, CasePage, ImpactPage
- `docs/FRONTEND_API.md` proposed backend contract and how it maps to the Python code

## Status
| Area | State |
|---|---|
| UI, all three views, demo mode, review, report download, calculator | Working (demo data) |
| Live adapter | Written against a **proposed** contract; the Python backend exposes no HTTP API yet, so Live mode shows "Backend not connected" |
| Related-report grouping, evidence reuse | Frontend complete; **no backend logic exists** (demo fixtures only) |
| Upload in Demo mode | Validated, then reported as not analysed (no fake analysis) |
| Analyst review time | "Not measured" until the backend records it |

## Demo walkthrough (about 3 minutes)
1. **Queue**: note the overview counts and the expandable *Related reports (3)* group with its "why grouped" reason. Filter by *Needs review*.
2. **C-101** (reviewed, suspicious): findings tagged observed fact / policy guidance / model interpretation. Click an evidence ID (E4) to jump to its ledger entry. URLs are text with a Copy button.
3. **C-102**: the comparison panel shows three evidence rows *reused* from C-101 (click through to the source case) and a *Fresh check required* for the changed authentication header.
4. **C-103**: same pattern but *Changed destination*: nothing reused, fresh checks listed. Similarity is never treated as safety.
5. **Review** C-102: accept, or change the assessment with a required note. The original proposal stays beside the reviewed one; history is labelled *Demo-only*. Download the JSON report.
6. **C-105**: rules-only fallback, no tool events, missing evidence listed. **C-104**: benign, explicitly "not a safety verdict".
7. **Review & Impact**: system runtime and analyst time are separate; unmeasured values read "Not measured". Try the calculator (negative savings are shown). Clear demo reviews (confirmation dialog).
8. Switch to **Live backend**: it reports "Backend not connected" and shows errors rather than mock data.
