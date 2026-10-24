import { Layers } from "lucide-react";
import { useApp } from "../api/context";
import type { CaseSummary } from "../api/types";
import { AssessmentBadge, ReviewBadge } from "../components/Badges";
import { Button, Card, EmptyState, ErrorNotice, Notice, SkeletonRows } from "../components/ui";
import { formatTime, orDash } from "../lib/format";
import { useAsync } from "../lib/useAsync";

interface Group { id: string; reason?: string; members: CaseSummary[] }

function groupCases(cases: CaseSummary[]): Group[] {
  const by = new Map<string, CaseSummary[]>();
  for (const c of cases) if (c.relatedGroupId) by.set(c.relatedGroupId, [...(by.get(c.relatedGroupId) ?? []), c]);
  return [...by.entries()]
    .filter(([, m]) => m.length > 1)
    .map(([id, members]) => ({
      id,
      reason: members.find((m) => m.relatedGroupReason)?.relatedGroupReason,
      members: [...members].sort((a, b) => (a.receivedAt ?? "").localeCompare(b.receivedAt ?? "")),
    }));
}

export function RelatedPage({ onOpenCase }: { onOpenCase: (id: string) => void }) {
  const { api, source, dataVersion } = useApp();
  const { data, error, loading, reload } = useAsync(() => api.listCases(), [api, dataVersion]);
  const groups = groupCases(data ?? []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Related reports</h1>
        <p className="mt-1 text-sm text-slate-600">Reports that share a sender, destination or wording. Open a later report to compare it with the earlier reviewed one.</p>
      </div>
      <Notice>Related reports are similarity groupings, not confirmed attack campaigns. Similar wording does not make an email safe, and an earlier verdict is never copied automatically.</Notice>

      {loading && <Card><SkeletonRows rows={3} label="Loading related reports…" /></Card>}
      {error && <ErrorNotice title="Could not load related reports" message={error} onRetry={reload} />}
      {!loading && !error && groups.length === 0 && (
        <Card>
          <EmptyState icon={<Layers className="h-7 w-7" aria-hidden />} title="No related reports yet">
            {source === "live"
              ? "The connected backend has not reported any groups. Grouping and evidence reuse are not implemented in the backend yet."
              : "When two reports share a sender or destination, they appear here together."}
          </EmptyState>
        </Card>
      )}
      {!loading && !error && groups.map((g) => (
        <Card key={g.id} aria-labelledby={`group-${g.id}`}>
          <div className="px-5 pt-5">
            <h2 id={`group-${g.id}`} className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><Layers className="h-4 w-4" aria-hidden /></span>
              Group {g.id} · {g.members.length} related reports
            </h2>
            {g.reason && <p className="mt-2 text-sm text-slate-600"><span className="font-medium text-slate-800">Why grouped:</span> {g.reason}</p>}
          </div>
          <ol className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
            {g.members.map((m, i) => (
              /* fixed columns so badges and buttons line up from row to row */
              <li key={m.id} className="grid items-center gap-x-4 gap-y-2 px-5 py-3 sm:grid-cols-[1.5rem_minmax(0,1fr)_8.5rem_7.5rem_10rem]">
                <span className="hidden text-xs text-slate-500 sm:block">{i + 1}.</span>
                <div className="min-w-0">
                  <p className="wrap-any text-sm font-medium text-slate-900">{orDash(m.subject, "(no subject)")}</p>
                  <p className="wrap-any text-xs text-slate-500">{m.id} · {orDash(m.sender)} · {formatTime(m.receivedAt)}</p>
                </div>
                <div className="flex sm:justify-start"><AssessmentBadge value={m.proposed} /></div>
                <div className="flex sm:justify-start"><ReviewBadge value={m.reviewStatus} /></div>
                <Button className="w-full" onClick={() => onOpenCase(m.id)} aria-label={`Open case ${m.id}: ${m.subject}`}>
                  {i === 0 ? "Open case" : "Open & compare"}
                </Button>
              </li>
            ))}
          </ol>
        </Card>
      ))}
    </div>
  );
}
