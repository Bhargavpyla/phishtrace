import {
  BarChart3,
  CircleCheck,
  CircleHelp,
  FlaskConical,
  Layers,
  Loader2,
  RefreshCw,
  SearchCheck,
  ServerOff,
} from "lucide-react";
import { API_BASE_URL, useApp } from "../api/context";
import { ModeBadge } from "./Badges";
import { Button } from "./ui";
import { Mascot } from "./Mascot";

export type View = "investigations" | "related" | "impact";

export function Navbar({ view, onNavigate }: { view: View; onNavigate: (v: View) => void }) {
  const {
    source,
    setSource,
    health,
    checkingHealth,
    recheck,
    policies,
    policy,
    setPolicyId,
    unreviewedCount,
  } = useApp();

  const connection = (() => {
    if (source === "demo") return null;
    if (checkingHealth || !health)
      return (
        <span role="status" className="inline-flex items-center gap-1.5 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-400" aria-hidden />
          <span className="hidden sm:inline">Checking backend…</span>
        </span>
      );
    if (health.connected)
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-400">
          <CircleCheck className="h-4 w-4" aria-hidden />
          <span>Backend connected</span>
        </span>
      );
    return (
      <span className="inline-flex items-center gap-2 text-xs font-medium text-red-400" title={health.message}>
        <ServerOff className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate max-w-[130px] sm:max-w-none">Backend not connected ({API_BASE_URL})</span>
        <Button
          onClick={recheck}
          className="!rounded-md !px-1.5 !py-0.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
        >
          <RefreshCw className="h-3 w-3" aria-hidden /> Retry
        </Button>
      </span>
    );
  })();

  const mode =
    source === "demo" ? (
      <ModeBadge mode="demo" dark />
    ) : health?.connected && health.executionMode ? (
      <ModeBadge mode={health.executionMode} dark />
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-xs font-medium text-slate-300">
        <CircleHelp className="h-3.5 w-3.5 text-slate-400" aria-hidden /> Mode: Unknown
      </span>
    );

  return (
    <header className="sticky top-0 z-30 h-16 w-full border-b border-slate-800 bg-[#0B132B] px-6 text-slate-200 shadow-md">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4">
        {/* Left Zone: Brand + Primary Navigation */}
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            className="flex items-center gap-3 select-none shrink-0 text-left focus:outline-none focus:ring-2 focus:ring-teal-500 rounded-lg p-0.5"
            onClick={() => onNavigate("investigations")}
            title="Evidence-led email triage."
          >
            <Mascot />
            <span className="text-lg font-bold tracking-tight text-white">PhishTrace</span>
          </button>

          <div className="h-6 w-px bg-slate-800 shrink-0" aria-hidden="true" />

          <nav aria-label="Main" className="flex items-center gap-1.5">
            <button
              type="button"
              aria-current={view === "investigations" ? "page" : undefined}
              onClick={() => onNavigate("investigations")}
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                view === "investigations"
                  ? "bg-slate-800/90 text-white shadow-sm ring-1 ring-white/10"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
              }`}
            >
              <SearchCheck className="h-4 w-4" aria-hidden />
              <span>Investigations</span>
              {unreviewedCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/20 px-1.5 text-[11px] font-semibold text-amber-300 ring-1 ring-inset ring-amber-500/30">
                  {unreviewedCount}
                </span>
              )}
            </button>

            <button
              type="button"
              aria-current={view === "related" ? "page" : undefined}
              onClick={() => onNavigate("related")}
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                view === "related"
                  ? "bg-slate-800/90 text-white shadow-sm ring-1 ring-white/10"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
              }`}
            >
              <Layers className="h-4 w-4" aria-hidden />
              <span>Related reports</span>
            </button>

            <button
              type="button"
              aria-current={view === "impact" ? "page" : undefined}
              onClick={() => onNavigate("impact")}
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                view === "impact"
                  ? "bg-slate-800/90 text-white shadow-sm ring-1 ring-white/10"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
              }`}
            >
              <BarChart3 className="h-4 w-4" aria-hidden />
              <span>Review & impact</span>
            </button>
          </nav>
        </div>

        {/* Right Zone: Controls & Telemetry (Single Row, No Wrapping) */}
        <div className="flex items-center gap-3 shrink-0">
          {source === "demo" && (
            <span className="hidden md:inline-flex items-center gap-1 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-300">
              <FlaskConical className="h-3 w-3" aria-hidden /> Demo data
            </span>
          )}

          {/* Segmented Source Switcher */}
          <fieldset className="shrink-0">
            <legend className="sr-only">Data source</legend>
            <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-0.5">
              {(["demo", "live"] as const).map((s) => (
                <label
                  key={s}
                  className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-within:ring-2 focus-within:ring-teal-500 ${
                    source === s ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="source"
                    value={s}
                    checked={source === s}
                    onChange={() => setSource(s)}
                    className="sr-only"
                  />
                  {s === "demo" ? "Demo" : "Live backend"}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Policy Selector Dropdown */}
          <div className="shrink-0">
            <select
              id="policy"
              aria-label="Organization policy"
              value={policy?.id ?? ""}
              onChange={(e) => setPolicyId(e.target.value)}
              disabled={policies.length === 0}
              className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
            >
              {policies.length === 0 && <option value="">Unavailable</option>}
              {policies.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
                  {p.name} · {p.version}
                </option>
              ))}
            </select>
          </div>

          {/* Status & Mode */}
          <div className="flex items-center gap-2 shrink-0">
            {connection}
            {mode}
          </div>
        </div>
      </div>
    </header>
  );
}
