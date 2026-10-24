import { ChevronRight, CircleHelp, FlaskConical, Loader2, RefreshCw } from "lucide-react";
import { API_BASE_URL, useApp } from "../api/context";
import { ModeBadge } from "./Badges";
import { Button } from "./ui";

/** Status dot + text. Green only when the backend confirmed it is up. */
function Connection() {
  const { source, health, checkingHealth, recheck } = useApp();
  if (source === "demo")
    return <span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><span aria-hidden className="h-2 w-2 rounded-full bg-slate-300" />Backend: not used (demo data)</span>;
  if (checkingHealth || !health)
    return <span role="status" className="inline-flex items-center gap-1.5 text-xs text-slate-600"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Checking backend…</span>;
  if (health.connected)
    return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-800"><span aria-hidden className="h-2 w-2 rounded-full bg-teal-500 shadow-[0_0_0_3px] shadow-teal-500/20" />Backend connected</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-xs font-medium text-red-800" title={health.message}>
      <span aria-hidden className="h-2 w-2 rounded-full bg-red-500" />Backend not connected ({API_BASE_URL})
      <Button onClick={recheck} className="!rounded-lg !px-2 !py-0.5 text-xs"><RefreshCw className="h-3 w-3" aria-hidden /> Retry</Button>
    </span>
  );
}

export function TopBar({ crumbs }: { crumbs: string[] }) {
  const { source, setSource, health, policies, policy, setPolicyId } = useApp();

  const mode = source === "demo" ? <ModeBadge mode="demo" />
    : health?.connected && health.executionMode ? <ModeBadge mode={health.executionMode} />
    : <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700"><CircleHelp className="h-3.5 w-3.5" aria-hidden /> Mode: Unknown</span>;

  return (
    <header className="sticky top-0 z-20 border-b border-white/60 bg-white/70 py-2.5 shadow-[0_1px_0_rgba(15,29,54,0.04)] backdrop-blur-md">
      {/* same max width and side padding as <main>, so the bar lines up with the page content */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-6">
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex items-center gap-1 text-sm">
            <li className="text-slate-400">PhishTrace</li>
            {crumbs.map((c, i) => (
              <li key={c} className="flex min-w-0 items-center gap-1">
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />
                <span aria-current={i === crumbs.length - 1 ? "page" : undefined}
                  className={`truncate ${i === crumbs.length - 1 ? "font-semibold text-slate-900" : "text-slate-500"}`}>{c}</span>
              </li>
            ))}
          </ol>
        </nav>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {source === "demo" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-900">
              <FlaskConical className="h-3.5 w-3.5" aria-hidden /> Demo data
            </span>
          )}
          <fieldset>
            <legend className="sr-only">Data source</legend>
            <div className="flex rounded-full bg-slate-100 p-0.5">
              {(["demo", "live"] as const).map((s) => (
                <label key={s} className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors focus-within:ring-2 focus-within:ring-teal-600 ${source === s ? "bg-white text-teal-800 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                  <input type="radio" name="source" value={s} checked={source === s} onChange={() => setSource(s)} className="sr-only" />
                  {s === "demo" ? "Demo" : "Live backend"}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 shadow-sm">
            <label htmlFor="policy" className="hidden text-xs text-slate-500 md:inline">Organization policy</label>
            <select
              id="policy"
              aria-label="Organization policy"
              value={policy?.id ?? ""}
              onChange={(e) => setPolicyId(e.target.value)}
              disabled={policies.length === 0}
              className="max-w-[14rem] truncate bg-transparent text-xs font-medium text-slate-800 focus:outline-none disabled:text-slate-500"
            >
              {policies.length === 0 && <option value="">Unavailable</option>}
              {policies.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.version}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 shadow-sm">
            <Connection />
            <span aria-hidden className="h-4 w-px bg-slate-200" />
            {mode}
          </div>
        </div>
      </div>
    </header>
  );
}
