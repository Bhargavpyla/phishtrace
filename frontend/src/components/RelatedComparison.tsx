import { ArrowRightLeft, Link2, RefreshCw, TriangleAlert, type LucideIcon } from "lucide-react";
import type { Case, RelatedCaseComparison } from "../api/types";
import type { AsyncState } from "../lib/useAsync";
import { AssessmentBadge, ReviewBadge } from "./Badges";
import { Button, ErrorNotice, Skeleton } from "./ui";

function Label({ text, icon: Icon, tone }: { text: string; icon: LucideIcon; tone: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden /> {text}
    </span>
  );
}

/** One of the three comparison columns: what matches, what changed, what to check again. */
function Column({ title, hint, icon: Icon, tone, children }: { title: string; hint: string; icon: LucideIcon; tone: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className={`flex flex-col rounded-2xl border p-4 ${tone}`}>
      <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Icon className="h-4 w-4" aria-hidden /> {title}</h4>
      <p className="mt-0.5 text-xs text-slate-600">{hint}</p>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

function Comparison({ cmp, current, onOpenCase }: { cmp: RelatedCaseComparison; current: Case; onOpenCase: (id: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-slate-50 p-3 text-sm">
        <span className="text-slate-500">Compared with</span>
        <span className="font-semibold text-slate-900">{cmp.previousCaseId}</span>
        {cmp.previousAssessment && <AssessmentBadge value={cmp.previousAssessment} />}
        <ReviewBadge value={cmp.previousReviewStatus} />
        <span className="wrap-any min-w-0 flex-1 basis-48 text-slate-600">{cmp.previousSubject}</span>
        <Button className="!rounded-lg !px-2 !py-0.5 text-xs" onClick={() => onOpenCase(cmp.previousCaseId)}>Open {cmp.previousCaseId}</Button>
        {cmp.previousReviewStatus !== "reviewed" && (
          <p className="basis-full text-xs text-amber-900">This earlier case hasn’t been reviewed by a person yet.</p>
        )}
      </div>
      <p className="text-xs text-slate-500">
        This report: <span className="wrap-any font-medium text-slate-800">{current.subject}</span> · <span className="wrap-any">{current.sender}</span>
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <Column title="Same as before" hint="Signals both reports share." icon={Link2} tone="border-teal-200 bg-teal-50/50">
          {cmp.sharedSignals.length === 0 && <p className="text-sm text-slate-600">Nothing in common was found.</p>}
          {cmp.sharedSignals.map((s, i) => (
            <p key={i} className="flex flex-wrap items-start gap-2 rounded-xl bg-white/80 p-2 text-sm">
              <Label text={s.label} icon={Link2} tone="border-teal-200 bg-teal-50 text-teal-900" />
              <span className="wrap-any min-w-0 flex-1 text-slate-800">{s.detail}</span>
            </p>
          ))}
          <div aria-label="Evidence reused" role="group" className="space-y-2 pt-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Evidence reused</p>
            {cmp.reused.length === 0 ? (
              <p className="text-sm text-slate-600">No evidence was reused from {cmp.previousCaseId}.</p>
            ) : cmp.reused.map((r) => (
              <p key={r.evidenceId} className="flex flex-wrap items-start gap-2 rounded-xl bg-white/80 p-2 text-sm">
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold">{r.evidenceId}</span>
                <span className="wrap-any min-w-0 flex-1 basis-32 text-slate-800">{r.observation}</span>
                <Button className="!rounded-lg !px-2 !py-0 text-xs" onClick={() => onOpenCase(r.fromCaseId)} aria-label={`Open source case ${r.fromCaseId}`}>
                  from {r.fromCaseId}/{r.fromEvidenceId}
                </Button>
              </p>
            ))}
          </div>
        </Column>

        <Column title="Different now" hint="What changed since the reviewed case." icon={ArrowRightLeft} tone="border-amber-300 bg-amber-50/60">
          {cmp.changed.length === 0 && <p className="text-sm text-slate-600">No differences were recorded.</p>}
          {cmp.changed.map((c, i) => {
            const destination = /destination/i.test(c.label);
            return (
              <div key={i} className={`space-y-1.5 rounded-xl bg-white p-2.5 text-sm ${destination ? "ring-2 ring-amber-400" : ""}`}>
                <Label text={c.label} icon={ArrowRightLeft} tone="border-amber-300 bg-amber-50 text-amber-900" />
                <p className="wrap-any text-xs text-slate-500">Before <code className="rounded bg-slate-100 px-1 py-0.5 line-through decoration-slate-400">{c.previous}</code></p>
                <p className="wrap-any text-xs text-slate-500">
                  <span className="sr-only"> changed to </span>Now{" "}
                  <code className={`rounded px-1 py-0.5 font-semibold ${destination ? "bg-amber-200 text-amber-950" : "bg-slate-100 text-slate-900"}`}>{c.current}</code>
                </p>
              </div>
            );
          })}
        </Column>

        <Column title="Check again" hint="Can’t be settled from the earlier case." icon={RefreshCw} tone="border-red-200 bg-red-50/50">
          <div role="group" aria-label="Needs fresh investigation" className="space-y-2">
            {cmp.freshChecks.length === 0 && <p className="text-sm text-slate-600">Nothing needs a fresh check.</p>}
            {cmp.freshChecks.map((f, i) => (
              <p key={i} className="flex flex-wrap items-start gap-2 rounded-xl bg-white p-2 text-sm">
                <Label text={f.label} icon={TriangleAlert} tone="border-amber-400 bg-amber-100 text-amber-950" />
                <span className="wrap-any min-w-0 flex-1 text-slate-800">{f.detail}</span>
              </p>
            ))}
          </div>
        </Column>
      </div>
      <p className="wrap-any text-xs text-slate-500">Why these reports are related: {cmp.groupReason}</p>
    </div>
  );
}

export function RelatedComparisonPanel({ state, current, onOpenCase }: { state: AsyncState<RelatedCaseComparison[]>; current: Case; onOpenCase: (id: string) => void }) {
  const { data, error, loading, reload } = state;
  return (
    <section aria-labelledby="related-title" className="space-y-4 rounded-2xl border border-indigo-200 bg-white p-5 shadow-card">
      <div>
        <h2 id="related-title" className="text-base font-semibold text-slate-900">Related-case comparison</h2>
        <p className="mt-1 rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-950">
          Similarity does not establish safety. Earlier verdicts are never copied automatically; this case is judged on its own evidence.
        </p>
      </div>
      {loading && <div className="space-y-3" role="status" aria-label="Loading related cases"><Skeleton className="h-12 w-full" /><Skeleton className="h-32 w-full" /></div>}
      {error && <ErrorNotice title="Could not load related cases" message={error} onRetry={reload} />}
      {!loading && !error && data && data.length === 0 && (
        <p className="text-sm text-slate-600">This is the earliest report in its group, so there is no earlier reviewed case to compare against.</p>
      )}
      {!loading && !error && data && data.map((cmp) => <Comparison key={cmp.previousCaseId} cmp={cmp} current={current} onOpenCase={onOpenCase} />)}
    </section>
  );
}
