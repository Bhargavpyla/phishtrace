import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useApp } from "../api/context";
import type { Case } from "../api/types";
import { EvidenceLedger } from "../components/EvidenceLedger";
import { FindingsList } from "../components/FindingsList";
import { RelatedComparisonPanel } from "../components/RelatedComparison";
import { ReviewPanel } from "../components/ReviewPanel";
import { ToolActivity } from "../components/ToolActivity";
import { VerdictCard } from "../components/VerdictCard";
import { Button, Card, CardHeader, CopyButton, ErrorNotice, Skeleton, Tabs } from "../components/ui";
import { formatTime, orDash } from "../lib/format";
import { useAsync } from "../lib/useAsync";

function EmailContent({ c }: { c: Case }) {
  return (
    <Card aria-labelledby="email-title" className="overflow-hidden">
      <CardHeader id="email-title" title="Email content" subtitle="Shown as plain text. Links are never opened." />
      <div className="space-y-4 px-5 pb-5">
        <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-slate-500">Reply-To</dt><dd className="wrap-any text-slate-900">{orDash(c.replyTo, "Not present")}</dd>
          <dt className="text-slate-500">Received</dt><dd className="text-slate-900">{formatTime(c.receivedAt)}</dd>
        </dl>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Message</h3>
          <pre className="wrap-any mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">{c.preview || "No readable text body."}</pre>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Extracted URLs</h3>
          {c.urls.length === 0 ? <p className="mt-1 text-sm text-slate-600">No URLs extracted.</p> : (
            <ul className="mt-1 space-y-1.5">
              {c.urls.map((u) => (
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
  );
}

function CaseView({ c, onOpenCase }: { c: Case; onOpenCase: (id: string) => void }) {
  const { api } = useApp();
  const [tab, setTab] = useState("flagged");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [highlight, setHighlight] = useState<string | null>(null);
  const [current, setCurrent] = useState<Case>(c);
  const related = useAsync(() => api.getRelated(c.id), [api, c.id]);

  const first = related.data?.[0];
  const showCompare = !!first || !!c.relatedGroupId;
  const tabs = [
    { id: "flagged", label: "Why flagged", badge: current.findings.length },
    { id: "evidence", label: "Evidence", badge: current.evidence.length },
    ...(showCompare ? [{ id: "compare", label: "Compare", badge: first ? related.data!.length : undefined, attention: !!first }] : []),
    { id: "email", label: "Email" },
    { id: "activity", label: "Activity" },
  ];

  const toggleEvidence = (id: string) => {
    const opening = !openIds.has(id);
    setOpenIds((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    setHighlight(opening ? id : null);
  };
  const goCompare = () => {
    setTab("compare");
    document.getElementById("case-tabs")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-5">
        <VerdictCard c={current} onCompare={goCompare}
          relatedTo={first ? { caseId: first.previousCaseId, reviewed: first.previousReviewStatus === "reviewed" } : null} />

        <div id="case-tabs" className="scroll-mt-20 space-y-4">
          <Tabs label="Case sections" tabs={tabs} active={tab} onChange={setTab} />
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === "flagged" && <FindingsList findings={current.findings} evidence={current.evidence} openIds={openIds} onToggle={toggleEvidence} onOpenCase={onOpenCase} />}
            {tab === "evidence" && <EvidenceLedger evidence={current.evidence} openIds={openIds} highlightedId={highlight} onToggle={toggleEvidence} onOpenCase={onOpenCase} />}
            {tab === "compare" && <RelatedComparisonPanel state={related} current={current} onOpenCase={onOpenCase} />}
            {tab === "email" && <EmailContent c={current} />}
            {tab === "activity" && (
              <Card aria-labelledby="activity-title" className="overflow-hidden">
                <CardHeader id="activity-title" title="Investigation activity" subtitle="What the system did, as reported by the backend." />
                <div className="px-5 pb-5"><ToolActivity c={current} /></div>
              </Card>
            )}
          </div>
        </div>
      </div>

      <div className="min-w-0 lg:sticky lg:top-20">
        <ReviewPanel c={current} onSaved={setCurrent} />
      </div>
    </div>
  );
}

function CaseSkeleton() {
  return (
    <div role="status" aria-label="Loading case" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-5"><Skeleton className="h-52 w-full rounded-3xl" /><Skeleton className="h-11 w-full rounded-2xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>
      <Skeleton className="h-80 w-full rounded-2xl" />
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
      {/* key remounts all case state (tab, open evidence, review draft) so nothing leaks between emails */}
      {data && <CaseView key={data.id} c={data} onOpenCase={onOpenCase} />}
    </div>
  );
}
