import { ArrowLeft, Mail } from "lucide-react";
import { useState } from "react";
import { useApp } from "../api/context";
import type { Case } from "../api/types";
import { AssessmentCard } from "../components/AssessmentCard";
import { EvidenceLedger } from "../components/EvidenceLedger";
import { FindingsList } from "../components/FindingsList";
import { RelatedComparisonPanel } from "../components/RelatedComparison";
import { ReviewPanel } from "../components/ReviewPanel";
import { ToolActivity } from "../components/ToolActivity";
import { Button, Card, CardHeader, CopyButton, Disclosure, ErrorNotice, Skeleton } from "../components/ui";
import { formatTime, orDash } from "../lib/format";
import { useAsync } from "../lib/useAsync";

function CaseView({ c, onOpenCase }: { c: Case; onOpenCase: (id: string) => void }) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [highlight, setHighlight] = useState<string | null>(null);
  const [current, setCurrent] = useState<Case>(c);

  const toggleEvidence = (id: string) => {
    const opening = !openIds.has(id);
    setOpenIds((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    setHighlight(opening ? id : null);
  };

  return (
    <div className="space-y-6">
      <AssessmentCard c={current} />
      <RelatedComparisonPanel current={current} onOpenCase={onOpenCase} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-6">
          <FindingsList findings={current.findings} evidence={current.evidence} openIds={openIds} onToggle={toggleEvidence} onOpenCase={onOpenCase} />
          <EvidenceLedger evidence={current.evidence} openIds={openIds} highlightedId={highlight} onToggle={toggleEvidence} onOpenCase={onOpenCase} />
        </div>

        <div className="min-w-0 space-y-6">
          <ReviewPanel c={current} onSaved={setCurrent} />

          <Card aria-labelledby="email-title" className="overflow-hidden">
            <CardHeader id="email-title" title="Email content" icon={<Mail className="h-4 w-4" aria-hidden />} subtitle="Shown as plain text. HTML is never rendered and links are never opened." />
            <div className="space-y-4 px-5 pb-5">
              <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-slate-500">Reply-To</dt><dd className="wrap-any text-slate-900">{orDash(current.replyTo, "Not present")}</dd>
                <dt className="text-slate-500">Received</dt><dd className="text-slate-900">{formatTime(current.receivedAt)}</dd>
              </dl>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Message</h3>
                <pre className="wrap-any mt-1 max-h-52 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">{current.preview || "No readable text body."}</pre>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Extracted URLs</h3>
                {current.urls.length === 0 ? <p className="mt-1 text-sm text-slate-600">No URLs extracted.</p> : (
                  <ul className="mt-1 space-y-1.5">
                    {current.urls.map((u) => (
                      <li key={u} className="flex items-start gap-2">
                        <code className="wrap-any min-w-0 flex-1 rounded-lg bg-slate-100 px-2 py-1 text-xs">{u}</code>
                        <CopyButton text={u} label={`Copy URL ${u}`} />
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-1 text-xs text-slate-500">Shown as text on purpose: these URLs were never visited.</p>
              </div>
            </div>
          </Card>

          <Disclosure title="Technical details: investigation activity">
            <ToolActivity c={current} />
          </Disclosure>
        </div>
      </div>
    </div>
  );
}

function CaseSkeleton() {
  return (
    <div role="status" aria-label="Loading case" className="space-y-6">
      <Skeleton className="h-36 w-full rounded-2xl" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6"><Skeleton className="h-56 w-full rounded-2xl" /><Skeleton className="h-56 w-full rounded-2xl" /></div>
        <div className="space-y-6"><Skeleton className="h-72 w-full rounded-2xl" /></div>
      </div>
      <span className="sr-only">Loading case…</span>
    </div>
  );
}

export function CasePage({ caseId, onOpenCase, onBack }: { caseId: string; onOpenCase: (id: string) => void; onBack: () => void }) {
  const { api } = useApp();
  // A saved review updates CaseView locally, so dataVersion is deliberately not a dependency (no reload flash).
  const { data, error, loading, reload } = useAsync(() => api.getCase(caseId), [api, caseId]);

  return (
    <div className="space-y-5">
      <Button variant="ghost" onClick={onBack} className="-ml-2"><ArrowLeft className="h-4 w-4" aria-hidden /> All investigations</Button>
      <header>
        <h1 className="wrap-any text-2xl font-semibold tracking-tight text-slate-900">{data ? orDash(data.subject, "(no subject)") : `Case ${caseId}`}</h1>
        <p className="wrap-any mt-1 text-sm text-slate-600">
          {data ? <>From <span className="font-medium text-slate-800">{orDash(data.sender)}</span> · Case {data.id}</> : "Loading…"}
        </p>
      </header>
      {loading && <CaseSkeleton />}
      {error && <ErrorNotice title="Could not load this case" message={error} onRetry={reload} />}
      {/* key remounts all case state (open evidence, review draft) so nothing leaks between emails */}
      {data && <CaseView key={data.id} c={data} onOpenCase={onOpenCase} />}
    </div>
  );
}
