import { ArrowLeft, FolderOpen, Info } from "lucide-react";
import { useState } from "react";
import { useApp } from "../api/context";
import type { Case } from "../api/types";
import { AssessmentBadge, ModeBadge, ReviewBadge } from "../components/Badges";
import { EvidenceLedger } from "../components/EvidenceLedger";
import { FindingsList } from "../components/FindingsList";
import { RelatedComparisonPanel } from "../components/RelatedComparison";
import { ReviewPanel } from "../components/ReviewPanel";
import { ToolActivity } from "../components/ToolActivity";
import { Button, Card, CardHeader, CopyButton, EmptyState, ErrorNotice, Spinner } from "../components/ui";
import { formatTime, orDash } from "../lib/format";
import { useAsync } from "../lib/useAsync";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<><dt className="text-slate-500">{label}</dt><dd className="wrap-any min-w-0 text-slate-900">{children}</dd></>);
}

function CaseView({ c, onOpenCase }: { c: Case; onOpenCase: (id: string) => void }) {
  const [highlight, setHighlight] = useState<string | null>(null);
  const [current, setCurrent] = useState<Case>(c);

  const select = (id: string) => {
    // Re-selecting the same id must retrigger the highlight effect.
    setHighlight(null);
    requestAnimationFrame(() => setHighlight(id));
  };

  return (
    <div className="space-y-6">
      <RelatedComparisonPanel current={current} onOpenCase={onOpenCase} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <Card aria-labelledby="email-title">
            <CardHeader id="email-title" title="Email details" />
            <div className="space-y-4 p-4">
              <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">
                <Field label="Subject">{orDash(current.subject, "(no subject)")}</Field>
                <Field label="Sender">{orDash(current.sender)}</Field>
                <Field label="Reply-To">{orDash(current.replyTo, "Not present")}</Field>
                <Field label="Received">{formatTime(current.receivedAt)}</Field>
              </dl>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Plain-text preview</h3>
                <pre className="wrap-any mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">{current.preview || "No readable text body."}</pre>
                <p className="mt-1 text-xs text-slate-500">Shown as text only. HTML from the email is never rendered.</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Extracted URLs</h3>
                {current.urls.length === 0 ? <p className="mt-1 text-sm text-slate-600">No URLs extracted.</p> : (
                  <ul className="mt-1 space-y-1.5">
                    {current.urls.map((u) => (
                      <li key={u} className="flex items-start gap-2">
                        <code className="wrap-any min-w-0 flex-1 rounded bg-slate-100 px-1.5 py-1 text-xs">{u}</code>
                        <CopyButton text={u} label={`Copy URL ${u}`} />
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-1 text-xs text-slate-500">URLs are not clickable and were never visited.</p>
              </div>
            </div>
          </Card>

          <Card aria-labelledby="assessment-title">
            <CardHeader id="assessment-title" title="Proposed assessment" />
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <AssessmentBadge value={current.proposed} />
                <ReviewBadge value={current.reviewStatus} />
                <ModeBadge mode={current.mode} />
                <span className="text-xs text-slate-600">Policy {current.policyVersion}</span>
              </div>
              {current.fallback && (
                <p role="note" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  Rules-only fallback: the model was unavailable, so this proposal comes from parser findings alone.
                </p>
              )}
              <p className="text-sm text-slate-800">{current.explanation}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Missing evidence</h3>
                  {current.missingEvidence.length === 0 ? <p className="mt-1 text-sm text-slate-600">None recorded.</p> :
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-slate-800">{current.missingEvidence.map((m) => <li key={m}>{m}</li>)}</ul>}
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Limitations</h3>
                  {current.limitations.length === 0 ? <p className="mt-1 text-sm text-slate-600">None recorded.</p> :
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-slate-800">{current.limitations.map((m) => <li key={m}>{m}</li>)}</ul>}
                </div>
              </div>
            </div>
          </Card>

          <FindingsList findings={current.findings} onSelectEvidence={select} />
          <ReviewPanel c={current} onSaved={setCurrent} />
        </div>

        <div className="min-w-0 space-y-6">
          <EvidenceLedger evidence={current.evidence} highlightedId={highlight} onOpenCase={onOpenCase} />
          <ToolActivity c={current} />
        </div>
      </div>
    </div>
  );
}

export function CasePage({ caseId, onOpenCase, onBack }: { caseId: string | null; onOpenCase: (id: string) => void; onBack: () => void }) {
  const { api, dataVersion } = useApp();
  // dataVersion is intentionally not a dependency: a saved review updates CaseView locally, without a reload flash.
  const { data, error, loading, reload } = useAsync(
    () => (caseId ? api.getCase(caseId) : Promise.reject(new Error("No case selected."))), [api, caseId]);
  void dataVersion;

  if (!caseId) {
    return (
      <Card>
        <EmptyState icon={<FolderOpen className="h-8 w-8" aria-hidden />} title="No case selected">
          Choose a case from the Investigation Queue to see its findings, evidence and related reports.
          <div className="mt-3"><Button variant="primary" onClick={onBack}>Go to Investigation Queue</Button></div>
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4" aria-hidden /> Queue</Button>
        <h1 className="wrap-any min-w-0 flex-1 text-xl font-semibold text-slate-900">
          Case Workspace · {caseId}{data ? ` · ${orDash(data.subject, "(no subject)")}` : ""}
        </h1>
      </div>
      <p className="flex items-center gap-1 text-xs text-slate-500"><Info className="h-3.5 w-3.5" aria-hidden /> Findings cite evidence; a citation alone does not prove a conclusion. A human reviewer decides.</p>
      {loading && <Spinner label="Loading case…" />}
      {error && <ErrorNotice title="Could not load this case" message={error} onRetry={reload} />}
      {/* key remounts all case state (highlight, review draft) so nothing leaks between emails */}
      {data && <CaseView key={data.id} c={data} onOpenCase={onOpenCase} />}
    </div>
  );
}
