import { BadgeCheck, Clock, FlaskConical, Layers, Mail, RefreshCw, Trash2, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../api/context";
import type { Metrics } from "../api/types";
import { Button, Card, CardHeader, ConfirmDialog, Disclosure, ErrorNotice, Notice, SkeletonRows } from "../components/ui";
import { formatDuration } from "../lib/format";
import { useAsync } from "../lib/useAsync";

const CALC_KEY = "phishtrace.calc";

function Tile({ label, value, icon: Icon, tone }: { label: string; value: number | string | null; icon: LucideIcon; tone: string }) {
  const measured = value !== null;
  return (
    <div className={`rounded-2xl p-4 ${measured ? tone : "border border-dashed border-slate-300 bg-slate-50 text-slate-500"}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</p>
        <Icon className="h-5 w-5 opacity-70" aria-hidden />
      </div>
      <p className={`mt-2 font-semibold tracking-tight ${measured ? "text-3xl" : "text-xl"}`}>{measured ? value : "Not measured"}</p>
    </div>
  );
}

function NumberField({ id, label, tag, value, onChange, disabled, hint }: {
  id: string; label: string; tag: "Assumption" | "Observed"; value: string; onChange: (v: string) => void; disabled?: boolean; hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-2 text-xs font-medium text-slate-700">
        {label}
        <span className={`rounded-full border px-1.5 text-[11px] ${tag === "Observed" ? "border-teal-200 bg-teal-50 text-teal-900" : "border-amber-300 bg-amber-50 text-amber-900"}`}>{tag}</span>
      </label>
      <input id={id} type="number" min={0} step="any" inputMode="decimal" value={value} disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-600" />
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Calculator({ m }: { m: Metrics }) {
  const [baseline, setBaseline] = useState("");
  const [assisted, setAssisted] = useState("");
  const [rate, setRate] = useState("");
  const [cases, setCases] = useState("");

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(CALC_KEY) ?? "{}") as Record<string, string>;
      setBaseline(s.baseline ?? ""); setAssisted(s.assisted ?? ""); setRate(s.rate ?? ""); setCases(s.cases ?? "");
    } catch { /* ignore unreadable saved inputs */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(CALC_KEY, JSON.stringify({ baseline, assisted, rate, cases })); } catch { /* storage unavailable */ }
  }, [baseline, assisted, rate, cases]);

  const assistedObserved = m.analystReviewMinutes != null;
  const casesObserved = m.casesReviewed != null;
  const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
  const b = num(baseline);
  const a = assistedObserved ? m.analystReviewMinutes! : num(assisted);
  const r = num(rate);
  const n = casesObserved ? m.casesReviewed! : num(cases);
  const ready = [b, a, r, n].every((v) => Number.isFinite(v) && v >= 0);

  const perCase = b - a;
  const totalMin = perCase * n;
  const cost = (totalMin / 60) * r;
  const phrase = (v: number, unit: string) => {
    const u = unit ? ` ${unit}` : "";
    return v > 0 ? `${v.toFixed(2)}${u} saved` : v < 0 ? `${(-v).toFixed(2)}${u} additional (negative savings)` : `No${u} difference`;
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Enter your own figures. Entered values are assumptions, measured values are observed, and the result can be zero or negative.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField id="calc-baseline" label="Manual baseline minutes per case" tag="Assumption" value={baseline} onChange={setBaseline} />
        {assistedObserved
          ? <NumberField id="calc-assisted" label="Assisted review minutes per case" tag="Observed" value={String(m.analystReviewMinutes)} onChange={() => undefined} disabled />
          : <NumberField id="calc-assisted" label="Assisted review minutes per case" tag="Assumption" value={assisted} onChange={setAssisted} hint="Not measured yet; enter your own figure." />}
        <NumberField id="calc-rate" label="Analyst hourly cost" tag="Assumption" value={rate} onChange={setRate} hint="Any currency." />
        {casesObserved
          ? <NumberField id="calc-cases" label="Cases reviewed" tag="Observed" value={String(m.casesReviewed)} onChange={() => undefined} disabled />
          : <NumberField id="calc-cases" label="Cases in scope" tag="Assumption" value={cases} onChange={setCases} />}
      </div>
      <div className="rounded-xl bg-white p-4" aria-live="polite">
        {!ready ? (
          <p className="text-sm text-slate-600">Fill in the fields above to see an estimate.</p>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-3">
            <div><dt className="text-xs text-slate-500">Difference per case</dt><dd className="text-sm font-semibold">{phrase(perCase, "min")}</dd></div>
            <div><dt className="text-xs text-slate-500">Total time difference</dt><dd className="text-sm font-semibold">{phrase(totalMin, "min")}</dd></div>
            <div><dt className="text-xs text-slate-500">Estimated cost difference</dt><dd className="text-sm font-semibold">{phrase(cost, "")}</dd></div>
          </dl>
        )}
        <p className="mt-3 text-xs text-slate-500">Estimate only. System runtime and model cost are excluded. This is not proof of accuracy or of money saved.</p>
      </div>
    </div>
  );
}

export function ImpactPage() {
  const { api, source, demo, dataVersion, bump } = useApp();
  const { data, error, loading, reload } = useAsync(() => api.getMetrics(), [api, dataVersion]);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Review &amp; impact</h1>
        <p className="mt-1 text-sm text-slate-600">What has been investigated and reviewed. Anything we can’t measure says so.</p>
      </div>
      {source === "demo" && <Notice tone="warn"><FlaskConical className="mr-1 inline h-3.5 w-3.5" aria-hidden />Demo data: figures come from the sample cases, not real investigations.</Notice>}
      {loading && <Card><SkeletonRows rows={3} label="Loading metrics…" /></Card>}
      {error && <ErrorNotice title="Could not load metrics" message={error} onRetry={reload} />}
      {data && (
        <>
          <section aria-labelledby="glance-title" className="space-y-3">
            <h2 id="glance-title" className="text-sm font-semibold text-slate-900">At a glance</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile label="Reports investigated" value={data.reportsInvestigated} icon={Mail} tone="bg-accent-50 text-accent-700" />
              <Tile label="Cases reviewed" value={data.casesReviewed} icon={BadgeCheck} tone="bg-teal-50 text-teal-800" />
              <Tile label="Reports grouped" value={data.reportsGrouped} icon={Layers} tone="bg-indigo-50 text-indigo-800" />
              <Tile label="Evidence reused" value={data.evidenceReused} icon={RefreshCw} tone="bg-amber-50 text-amber-900" />
            </div>
          </section>

          <section aria-labelledby="time-title" className="space-y-3">
            <h2 id="time-title" className="text-sm font-semibold text-slate-900">Time <span className="font-normal text-slate-500">(system and analyst are kept separate)</span></h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <Tile label="System runtime" value={data.runtimeMs == null ? null : formatDuration(data.runtimeMs)} icon={Clock} tone="bg-white border border-slate-200/70 shadow-card" />
              <Tile label="Tool calls" value={data.toolCalls} icon={Clock} tone="bg-white border border-slate-200/70 shadow-card" />
              <Tile label="Analyst review time per case" value={data.analystReviewMinutes == null ? null : `${data.analystReviewMinutes} min`} icon={Clock} tone="bg-white border border-slate-200/70 shadow-card" />
            </div>
          </section>

          <Disclosure title="Estimate time saved (optional)"><Calculator m={data} /></Disclosure>
        </>
      )}

      {source === "demo" && (
        <Card aria-labelledby="demo-title" className="overflow-hidden">
          <CardHeader id="demo-title" title="Demo data" subtitle="Reviews made in demo mode are kept in this browser only." />
          <div className="px-5 pb-5">
            <Button onClick={() => setConfirming(true)} disabled={!demo.hasLocalData()}><Trash2 className="h-4 w-4" aria-hidden /> Clear saved demo reviews</Button>
            {!demo.hasLocalData() && <p className="mt-2 text-xs text-slate-500">No locally saved demo reviews.</p>}
          </div>
        </Card>
      )}
      {confirming && (
        <ConfirmDialog title="Clear saved demo reviews?" body="This removes the demo reviews stored in this browser. Sample cases are unaffected. It cannot be undone."
          confirmLabel="Clear demo data" onCancel={() => setConfirming(false)}
          onConfirm={() => { demo.resetLocalData(); setConfirming(false); bump(); }} />
      )}
    </div>
  );
}
