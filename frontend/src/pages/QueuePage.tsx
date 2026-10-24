import { BadgeCheck, Clock, Inbox, Layers, Mail, Search, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "../api/context";
import type { Assessment, ReviewStatus } from "../api/types";
import { CaseTable } from "../components/CaseTable";
import { UploadPanel } from "../components/UploadPanel";
import { Card, CardHeader, EmptyState, ErrorNotice, SkeletonRows } from "../components/ui";
import { useAsync } from "../lib/useAsync";

function StatTile({ label, value, icon: Icon, tone, hint }: { label: string; value: number | null; icon: LucideIcon; tone: string; hint?: string }) {
  return (
    <div className={`rounded-2xl p-4 ${tone}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</p>
        <Icon className="h-5 w-5 opacity-80" aria-hidden />
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value ?? "…"}</p>
      {hint && <p className="mt-0.5 text-xs opacity-75">{hint}</p>}
    </div>
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
  const filtering = query.trim() !== "" || assessment !== "all" || review !== "all";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Investigations</h1>
        <p className="mt-1 text-sm text-slate-600">Check a suspicious email, see why it was flagged, then record your decision.</p>
      </div>

      <UploadPanel onOpenCase={onOpenCase} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Summary">
        <StatTile label="Total reports" value={data ? stats.total : null} icon={Mail} tone="bg-accent-50 text-accent-700" />
        <StatTile label="Awaiting review" value={data ? stats.awaiting : null} icon={Clock} tone="bg-amber-50 text-amber-900" />
        <StatTile label="Related-report groups" value={data ? stats.groups : null} icon={Layers} tone="bg-indigo-50 text-indigo-800" hint="Similar emails" />
        <StatTile label="Reviewed cases" value={data ? stats.reviewed : null} icon={BadgeCheck} tone="bg-teal-50 text-teal-800" />
      </div>

      <Card aria-labelledby="cases-title">
        <CardHeader id="cases-title" title="Recent investigations" subtitle="The assessment is a proposal until a person reviews it." />
        <div className="flex flex-wrap items-end gap-3 px-5 pb-4">
          <div className="min-w-[14rem] flex-1">
            <label htmlFor="case-search" className="block text-xs font-medium text-slate-600">Search subject, sender or case ID</label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
              <input id="case-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm" />
            </div>
          </div>
          <div>
            <label htmlFor="f-assess" className="block text-xs font-medium text-slate-600">Assessment</label>
            <select id="f-assess" value={assessment} onChange={(e) => setAssessment(e.target.value as typeof assessment)} className="mt-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="all">All</option>
              <option value="suspicious">Suspicious</option>
              <option value="likely_benign">Likely benign</option>
              <option value="needs_review">Needs review</option>
            </select>
          </div>
          <div>
            <label htmlFor="f-review" className="block text-xs font-medium text-slate-600">Review status</label>
            <select id="f-review" value={review} onChange={(e) => setReview(e.target.value as typeof review)} className="mt-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="all">All</option>
              <option value="unreviewed">Unreviewed</option>
              <option value="reviewed">Reviewed</option>
            </select>
          </div>
        </div>

        <div className="border-t border-slate-100">
          {loading && <SkeletonRows label="Loading investigations…" />}
          {error && <div className="p-5"><ErrorNotice title="Could not load investigations" message={error} onRetry={reload} /></div>}
          {!loading && !error && cases.length === 0 && (
            <EmptyState icon={<Inbox className="h-7 w-7" aria-hidden />} title="No investigations yet">
              Upload an email above to get started. Each investigation appears here.
            </EmptyState>
          )}
          {!loading && !error && cases.length > 0 && filtered.length === 0 && (
            <EmptyState icon={<Search className="h-7 w-7" aria-hidden />} title="No investigations match">
              {filtering ? "Clear the search or filters to see all " : "There are "}{cases.length} investigations.
            </EmptyState>
          )}
          {!loading && !error && filtered.length > 0 && <CaseTable cases={filtered} onOpen={onOpenCase} />}
        </div>
      </Card>
    </div>
  );
}
