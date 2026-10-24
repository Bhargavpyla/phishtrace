import { BarChart3, Layers, Plus, SearchCheck, ShieldCheck, type LucideIcon } from "lucide-react";
import { useApp } from "../api/context";
import { useAsync } from "../lib/useAsync";

export type View = "investigations" | "related" | "impact";

export function Sidebar({ view, onNavigate, onNewInvestigation }: {
  view: View; onNavigate: (v: View) => void; onNewInvestigation: () => void;
}) {
  const { api, dataVersion, source } = useApp();
  // Real counts from the same source as the pages; nothing is shown until they arrive.
  const { data } = useAsync(() => api.listCases(), [api, dataVersion]);
  const cases = data ?? [];
  const awaiting = cases.filter((c) => c.reviewStatus === "unreviewed").length;
  const reviewed = cases.length - awaiting;
  const groupSizes = new Map<string, number>();
  for (const c of cases) if (c.relatedGroupId) groupSizes.set(c.relatedGroupId, (groupSizes.get(c.relatedGroupId) ?? 0) + 1);
  const groups = [...groupSizes.values()].filter((n) => n > 1).length;
  const pct = cases.length ? Math.round((reviewed / cases.length) * 100) : 0;

  const items: { view: View; label: string; icon: LucideIcon; badge?: { n: number; label: string; tone: string } }[] = [
    { view: "investigations", label: "Investigations", icon: SearchCheck,
      badge: data && awaiting > 0 ? { n: awaiting, label: "awaiting review", tone: "bg-amber-400 text-amber-950" } : undefined },
    { view: "related", label: "Related reports", icon: Layers,
      badge: data && groups > 0 ? { n: groups, label: groups === 1 ? "group" : "groups", tone: "bg-indigo-400/90 text-indigo-950" } : undefined },
    { view: "impact", label: "Review & impact", icon: BarChart3 },
  ];

  return (
    <aside className="on-dark relative overflow-hidden bg-gradient-to-b from-navy-950 via-navy-900 to-navy-900 text-slate-200 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-72 lg:shrink-0 lg:flex-col">
      {/* soft glow behind the logo */}
      <div aria-hidden className="pointer-events-none absolute -left-16 -top-20 h-64 w-64 rounded-full bg-teal-600/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-24 top-40 hidden h-64 w-64 rounded-full bg-accent-600/15 blur-3xl lg:block" />

      <div className="relative flex items-center gap-3 px-5 py-4 lg:px-6 lg:pb-6 lg:pt-7">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-600 to-accent-600 text-white shadow-lg shadow-teal-600/30 ring-1 ring-white/20">
          <ShieldCheck className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <p className="text-lg font-semibold leading-tight tracking-tight text-white">PhishTrace</p>
          <p className="text-xs text-slate-400">Evidence-led email triage</p>
        </div>
      </div>

      <div className="relative hidden px-4 lg:block">
        <button type="button" onClick={onNewInvestigation}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-900/40 transition-colors hover:bg-teal-700">
          <Plus className="h-4 w-4" aria-hidden /> New investigation
        </button>
      </div>

      <nav aria-label="Main" className="relative flex gap-1 overflow-x-auto px-3 pb-3 lg:mt-6 lg:flex-col lg:px-4 lg:pb-0">
        <p className="hidden px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 lg:block">Workspace</p>
        {items.map(({ view: v, label, icon: Icon, badge }) => {
          const active = v === view;
          return (
            <button
              key={v}
              type="button"
              aria-current={active ? "page" : undefined}
              aria-label={badge ? `${label}, ${badge.n} ${badge.label}` : label}
              onClick={() => onNavigate(v)}
              className={`group flex items-center gap-3 whitespace-nowrap rounded-xl px-2.5 py-2 text-sm font-medium transition-colors ${
                active ? "bg-white/[0.08] text-white ring-1 ring-inset ring-white/10" : "text-slate-300 hover:bg-white/[0.05] hover:text-white"}`}
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                active ? "bg-teal-600 text-white shadow-md shadow-teal-900/40" : "bg-white/[0.06] text-slate-300 group-hover:text-white"}`}>
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <span className="flex-1 text-left">{label}</span>
              {badge && <span aria-hidden className={`min-w-[1.5rem] rounded-full px-1.5 py-0.5 text-center text-xs font-semibold ${badge.tone}`}>{badge.n}</span>}
            </button>
          );
        })}
      </nav>

      <div className="relative mt-auto hidden p-4 lg:block">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Review progress</p>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${source === "demo" ? "bg-indigo-400/20 text-indigo-200" : "bg-teal-600/30 text-teal-100"}`}>
              {source === "demo" ? "Demo data" : "Live"}
            </span>
          </div>
          {data ? (
            <>
              <p className="mt-2 text-sm text-slate-200"><span className="text-2xl font-semibold text-white">{reviewed}</span> of {cases.length} reviewed</p>
              <div role="progressbar" aria-label="Cases reviewed" aria-valuemin={0} aria-valuemax={cases.length} aria-valuenow={reviewed}
                className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-teal-600 to-accent-500 transition-[width]" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-400">{awaiting === 0 ? "Nothing is waiting for review." : `${awaiting} waiting for a person to review.`}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-400">Counts appear once cases load.</p>
          )}
        </div>
      </div>
    </aside>
  );
}
