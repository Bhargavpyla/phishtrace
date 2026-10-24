import { ArrowRightLeft, Info, Link2, TriangleAlert, type LucideIcon } from "lucide-react";
import { useApp } from "../api/context";
import type { Case, ComparisonItem, RelatedCaseComparison } from "../api/types";
import { useAsync } from "../lib/useAsync";
import { AssessmentBadge, ReviewBadge } from "./Badges";
import { Button, Card, CardHeader, ErrorNotice, Spinner } from "./ui";

/** Explicit labels so the meaning of each row never relies on colour. */
function labelStyle(label: string): { icon: LucideIcon; tone: string } {
  if (/^shared/i.test(label)) return { icon: Link2, tone: "border-teal-200 bg-teal-50 text-teal-900" };
  if (/^changed/i.test(label)) return { icon: ArrowRightLeft, tone: "border-amber-300 bg-amber-50 text-amber-900" };
  if (/fresh check/i.test(label)) return { icon: TriangleAlert, tone: "border-amber-400 bg-amber-100 text-amber-950" };
  return { icon: Info, tone: "border-slate-300 bg-slate-50 text-slate-800" };
}

function Label({ text }: { text: string }) {
  const { icon: Icon, tone } = labelStyle(text);
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden /> {text}
    </span>
  );
}

function Items({ title, items }: { title: string; items: ComparisonItem[] }) {
  if (!items.length) return null;
  return (
    <section aria-label={title}>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <ul className="mt-1.5 space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex flex-wrap items-start gap-2 text-sm">
            <Label text={it.label} />
            <span className="wrap-any min-w-0 flex-1 text-slate-800">{it.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Comparison({ cmp, current, onOpenCase }: { cmp: RelatedCaseComparison; current: Case; onOpenCase: (id: string) => void }) {
  return (
    <div className="space-y-4 p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Previous case</p>
          <p className="wrap-any mt-1 text-sm font-medium text-slate-900">{cmp.previousSubject}</p>
          <p className="wrap-any text-xs text-slate-600">{cmp.previousSender}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {cmp.previousAssessment && <AssessmentBadge value={cmp.previousAssessment} />}
            <ReviewBadge value={cmp.previousReviewStatus} />
            <Button className="!px-2 !py-0.5 text-xs" onClick={() => onOpenCase(cmp.previousCaseId)}>Open {cmp.previousCaseId}</Button>
          </div>
          {cmp.previousReviewStatus !== "reviewed" && (
            <p className="mt-2 text-xs text-amber-900">This earlier case has not been reviewed by a human, so its evidence has no reviewer confirmation.</p>
          )}
        </div>
        <div className="rounded-md border border-teal-200 bg-teal-50/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current case</p>
          <p className="wrap-any mt-1 text-sm font-medium text-slate-900">{current.subject}</p>
          <p className="wrap-any text-xs text-slate-600">{current.sender}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <AssessmentBadge value={current.proposed} />
            <ReviewBadge value={current.reviewStatus} />
          </div>
        </div>
      </div>

      <Items title="Shared signals" items={cmp.sharedSignals} />

      {cmp.changed.length > 0 && (
        <section aria-label="Changes">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Changes</h4>
          <ul className="mt-1.5 space-y-1.5">
            {cmp.changed.map((c, i) => (
              <li key={i} className="flex flex-wrap items-start gap-2 text-sm">
                <Label text={c.label} />
                <span className="wrap-any min-w-0 flex-1 text-slate-800">
                  <span className="text-slate-600 line-through decoration-slate-400">{c.previous}</span>
                  <span aria-hidden> → </span><span className="sr-only"> changed to </span>
                  <span className="font-medium">{c.current}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Reused evidence">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reused evidence</h4>
        {cmp.reused.length === 0 ? (
          <p className="mt-1.5 text-sm text-slate-600">No evidence was reused from {cmp.previousCaseId}.</p>
        ) : (
          <ul className="mt-1.5 space-y-1.5">
            {cmp.reused.map((r) => (
              <li key={r.evidenceId} className="flex flex-wrap items-start gap-2 text-sm">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold">{r.evidenceId}</span>
                <span className="wrap-any min-w-0 flex-1 text-slate-800">{r.observation}</span>
                <Button className="!px-2 !py-0 text-xs" onClick={() => onOpenCase(r.fromCaseId)} aria-label={`Open source case ${r.fromCaseId}`}>
                  from {r.fromCaseId}/{r.fromEvidenceId}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Items title="Needs fresh investigation" items={cmp.freshChecks} />
      <p className="wrap-any text-xs text-slate-600">Why these reports are related: {cmp.groupReason}</p>
    </div>
  );
}

export function RelatedComparisonPanel({ current, onOpenCase }: { current: Case; onOpenCase: (id: string) => void }) {
  const { api, dataVersion } = useApp();
  const { data, error, loading, reload } = useAsync(() => api.getRelated(current.id), [api, current.id, dataVersion]);

  return (
    <Card aria-labelledby="related-title" className="border-indigo-200">
      <CardHeader id="related-title" title="Related-case comparison"
        subtitle="Earlier reviewed report versus this one: what carries over and what must be checked again." />
      <div className="border-b border-indigo-100 bg-indigo-50 px-4 py-2 text-xs text-indigo-950">
        Similarity does not establish safety. Prior verdicts are not copied automatically; each case is assessed on its own evidence.
        Related reports are similarity groupings, not confirmed attack campaigns.
      </div>
      {loading && <Spinner label="Loading related cases…" />}
      {error && <div className="p-4"><ErrorNotice title="Could not load related cases" message={error} onRetry={reload} /></div>}
      {!loading && !error && data && data.length === 0 && (
        <p className="px-4 py-6 text-sm text-slate-600">
          {current.relatedGroupId
            ? "This is the earliest report in its group, so there is no earlier reviewed case to compare against."
            : "No related earlier report was found for this case."}
        </p>
      )}
      {!loading && !error && data && data.map((cmp) => (
        <div key={cmp.previousCaseId} className="border-t border-slate-100 first:border-t-0">
          <Comparison cmp={cmp} current={current} onOpenCase={onOpenCase} />
        </div>
      ))}
    </Card>
  );
}
