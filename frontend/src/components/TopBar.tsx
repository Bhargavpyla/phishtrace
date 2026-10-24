import { CircleCheck, CircleHelp, FlaskConical, Loader2, RefreshCw, ServerOff } from "lucide-react";
import { API_BASE_URL, useApp } from "../api/context";
import { ModeBadge } from "./Badges";
import { Button } from "./ui";

export function TopBar() {
  const { source, setSource, health, checkingHealth, recheck, policies, policy, setPolicyId } = useApp();

  const connection = (() => {
    if (source === "demo")
      return <span className="text-xs text-slate-500">Backend: not used (demo data)</span>;
    if (checkingHealth || !health)
      return <span role="status" className="inline-flex items-center gap-1.5 text-xs text-slate-600"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Checking backend…</span>;
    if (health.connected)
      return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-800"><CircleCheck className="h-4 w-4" aria-hidden /> Backend connected</span>;
    return (
      <span className="inline-flex flex-wrap items-center gap-2 text-xs font-medium text-red-800" title={health.message}>
        <ServerOff className="h-4 w-4" aria-hidden /> Backend not connected ({API_BASE_URL})
        <Button onClick={recheck} className="!rounded-lg !px-2 !py-0.5 text-xs"><RefreshCw className="h-3 w-3" aria-hidden /> Retry</Button>
      </span>
    );
  })();

  const mode = source === "demo" ? <ModeBadge mode="demo" />
    : health?.connected && health.executionMode ? <ModeBadge mode={health.executionMode} />
    : <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700"><CircleHelp className="h-3.5 w-3.5" aria-hidden /> Mode: Unknown</span>;

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 px-4 py-2.5 backdrop-blur sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2">
        {source === "demo" && (
          <span className="inline-flex items-center gap-1 rounded-full border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-900">
            <FlaskConical className="h-3.5 w-3.5" aria-hidden /> Demo data
          </span>
        )}
        <fieldset>
          <legend className="sr-only">Data source</legend>
          <div className="flex rounded-xl bg-slate-100 p-0.5">
            {(["demo", "live"] as const).map((s) => (
              <label key={s} className={`cursor-pointer rounded-[10px] px-3 py-1 text-xs font-medium transition-colors focus-within:ring-2 focus-within:ring-teal-600 ${source === s ? "bg-white text-teal-800 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                <input type="radio" name="source" value={s} checked={source === s} onChange={() => setSource(s)} className="sr-only" />
                {s === "demo" ? "Demo" : "Live backend"}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex items-center gap-2">
          <label htmlFor="policy" className="hidden text-xs font-medium text-slate-500 md:inline">Organization policy</label>
          <select
            id="policy"
            aria-label="Organization policy"
            value={policy?.id ?? ""}
            onChange={(e) => setPolicyId(e.target.value)}
            disabled={policies.length === 0}
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-sm disabled:bg-slate-50 disabled:text-slate-500"
          >
            {policies.length === 0 && <option value="">Unavailable</option>}
            {policies.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.version}</option>)}
          </select>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {connection}
          {mode}
        </div>
      </div>
    </header>
  );
}
