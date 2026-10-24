import { CircleCheck, CircleHelp, Database, FlaskConical, Loader2, PlugZap, RefreshCw, ServerOff } from "lucide-react";
import { API_BASE_URL, useApp } from "../api/context";
import { ModeBadge } from "./Badges";
import { Button } from "./ui";

export function TopBar() {
  const { source, setSource, health, checkingHealth, recheck, policies, policy, setPolicyId } = useApp();

  const connection = (() => {
    if (source === "demo")
      return <span className="inline-flex items-center gap-1 text-xs text-slate-600"><PlugZap className="h-4 w-4" aria-hidden /> Backend: not used (demo data)</span>;
    if (checkingHealth || !health)
      return <span role="status" className="inline-flex items-center gap-1 text-xs text-slate-600"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking backend…</span>;
    if (health.connected)
      return <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-800"><CircleCheck className="h-4 w-4" aria-hidden /> Backend connected</span>;
    return (
      <span className="inline-flex items-center gap-2 text-xs font-medium text-red-800" title={health.message}>
        <ServerOff className="h-4 w-4" aria-hidden /> Backend not connected ({API_BASE_URL})
        <Button onClick={recheck} className="!px-2 !py-0.5 text-xs"><RefreshCw className="h-3 w-3" aria-hidden /> Retry</Button>
      </span>
    );
  })();

  const mode = source === "demo" ? <ModeBadge mode="demo" />
    : health?.connected && health.executionMode ? <ModeBadge mode={health.executionMode} />
    : <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700"><CircleHelp className="h-3.5 w-3.5" aria-hidden /> Mode: Unknown</span>;

  return (
    <header className="border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {source === "demo" && (
          <span className="inline-flex items-center gap-1 rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-900">
            <FlaskConical className="h-3.5 w-3.5" aria-hidden /> Demo data
          </span>
        )}
        <fieldset className="flex items-center gap-2">
          <legend className="sr-only">Data source</legend>
          <Database className="h-4 w-4 text-slate-500" aria-hidden />
          {(["demo", "live"] as const).map((s) => (
            <label key={s} className={`cursor-pointer rounded-md border px-2 py-1 text-xs font-medium focus-within:ring-2 focus-within:ring-teal-600 ${source === s ? "border-teal-600 bg-teal-50 text-teal-900" : "border-slate-300 text-slate-700"}`}>
              <input type="radio" name="source" value={s} checked={source === s} onChange={() => setSource(s)} className="sr-only" />
              {s === "demo" ? "Demo data" : "Live backend"}
            </label>
          ))}
        </fieldset>
        <div className="flex items-center gap-2">
          <label htmlFor="policy" className="text-xs font-medium text-slate-600">Organization policy</label>
          <select
            id="policy"
            value={policy?.id ?? ""}
            onChange={(e) => setPolicyId(e.target.value)}
            disabled={policies.length === 0}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm disabled:bg-slate-50 disabled:text-slate-500"
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
