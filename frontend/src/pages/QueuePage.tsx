import { Inbox, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "../api/context";
import type { Assessment, ReviewStatus } from "../api/types";
import { CaseTable } from "../components/CaseTable";
import { UploadPanel } from "../components/UploadPanel";
import { Card, CardHeader, EmptyState, ErrorNotice, Spinner } from "../components/ui";
import { useAsync } from "../lib/useAsync";

function Stat({ label, value, hint }: { label: string; value: number | null; hint?: string }) {
  return (
    <Card as="div" className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value ?? "…"}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}

export function QueuePage({ onOpenCase }: { onOpenCase: (id: string) => void }) {
  const { api, dataVersion } = useApp();
  const { data, error, loading, reload } = useAsync(() => api.listCases(), [api, dataVersion]);
  const [query, setQuery] = useState("");
  const [assessment, setAssessment] = useState<"all" | Assessment>("all");
  const [review, setReview] = useState<"all" | ReviewStatus>("all");

  const cases = data ?? [];
  const stats = useMemo(() => {
    const groups = new Map<string, number>();
    for (const c of cases) if (c.relatedGroupId) groups.set(c.relatedGroupId, (groups.get(c.relatedGroupId) ?? 0) + 1);
    return {
      total: cases.length,
      awaiting: cases.filter((c) => c.reviewStatus === "unreviewed").length,
      groups: [...groups.values()].filter((n) => n > 1).length,
      reviewed: cases.filter((c) => c.reviewStatus === "reviewed").length,
    };
  }, [cases]);

  const filtered = cases.filter((c) => {
    const q = query.trim().toLowerCase();
    return (!q || c.subject.toLowerCase().includes(q) || c.sender.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
      && (assessment === "all" || c.proposed === assessment)
      && (review === "all" || c.reviewStatus === review);
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Investigation Queue</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Queue overview">
        <Stat label="Total reports" value={data ? stats.total : null} />
        <Stat label="Awaiting review" value={data ? stats.awaiting : null} />
        <Stat label="Related-report groups" value={data ? stats.groups : null} hint="Similarity groupings, not confirmed campaigns" />
        <Stat label="Reviewed cases" value={data ? stats.reviewed : null} />
      </div>

      <UploadPanel onOpenCase={onOpenCase} />

      <Card aria-labelledby="cases-title">
        <CardHeader id="cases-title" title="Cases" subtitle="Assessment is the proposal; review status records whether a human has confirmed it." />
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-[14rem] flex-1">
            <label htmlFor="case-search" className="block text-xs font-medium text-slate-600">Search subject, sender or case ID</label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-slate-400" aria-hidden />
              <input id="case-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-md border border-slate-300 py-1.5 pl-8 pr-2 text-sm" />
            </div>
          </div>
          <div>
            <label htmlFor="f-assess" className="block text-xs font-medium text-slate-600">Assessment</label>
            <select id="f-assess" value={assessment} onChange={(e) => setAssessment(e.target.value as typeof assessment)} className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm">
              <option value="all">All</option>
              <option value="suspicious">Suspicious</option>
              <option value="likely_benign">Likely benign</option>
              <option value="needs_review">Needs review</option>
            </select>
          </div>
          <div>
            <label htmlFor="f-review" className="block text-xs font-medium text-slate-600">Review status</label>
            <select id="f-review" value={review} onChange={(e) => setReview(e.target.value as typeof review)} className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm">
              <option value="all">All</option>
              <option value="unreviewed">Unreviewed</option>
              <option value="reviewed">Reviewed</option>
            </select>
          </div>
        </div>

        {loading && <Spinner label="Loading cases…" />}
        {error && <div className="p-4"><ErrorNotice title="Could not load cases" message={error} onRetry={reload} /></div>}
        {!loading && !error && cases.length === 0 && (
          <EmptyState icon={<Inbox className="h-8 w-8" aria-hidden />} title="No reports yet">Upload an .eml file above to start an investigation.</EmptyState>
        )}
        {!loading && !error && cases.length > 0 && filtered.length === 0 && (
          <EmptyState title="No cases match these filters">Clear the search or filters to see all {cases.length} cases.</EmptyState>
        )}
        {!loading && !error && filtered.length > 0 && <CaseTable cases={filtered} onOpen={onOpenCase} />}
      </Card>
    </div>
  );
}
