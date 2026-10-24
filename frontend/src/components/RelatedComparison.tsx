import { ArrowRightLeft, Info, Link2, RefreshCw, TriangleAlert, type LucideIcon } from "lucide-react";
import { useApp } from "../api/context";
import type { Case, ComparisonItem, RelatedCaseComparison } from "../api/types";
import { useAsync } from "../lib/useAsync";
import { AssessmentBadge, ReviewBadge } from "./Badges";
import { Button, Card, CardHeader, ErrorNotice, Skeleton } from "./ui";

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

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="space-y-2">
      <div>
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function CaseSide({ heading, subject, sender, children, tone }: { heading: string; subject: string; sender: string; children: React.ReactNode; tone: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{heading}</p>
      <p className="wrap-any mt-1 text-sm font-semibold text-slate-900">{subject}</p>
      <p className="wrap-any text-xs text-slate-600">{sender}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function Items({ items, tone }: { items: ComparisonItem[]; tone?: string }) {
  return (
    <ul className="grid gap-2 md:grid-cols-2">
      {items.map((it, i) => (
        <li key={i} className={`flex flex-wrap items-start gap-2 rounded-xl border p-2.5 text-sm ${tone ?? "border-slate-200 bg-white"}`}>
          <Label text={it.label} />
          <span className="wrap-any min-w-0 flex-1 text-slate-800">{it.detail}</span>
        </li>
      ))}
    </ul>
  );
}

function Comparison({ cmp, current, onOpenCase }: { cmp: RelatedCaseComparison; current: Case; onOpenCase: (id: string) => void }) {
  return (
    <div className="space-y-6 p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <CaseSide heading="Previously reviewed" subject={cmp.previousSubject} sender={cmp.previousSender} tone="border-slate-200 bg-slate-50">
          {cmp.previousAssessment && <AssessmentBadge value={cmp.previousAssessment} />}
          <ReviewBadge value={cmp.previousReviewStatus} />
          <Button className="!rounded-lg !px-2 !py-0.5 text-xs" onClick={() => onOpenCase(cmp.previousCaseId)}>Open {cmp.previousCaseId}</Button>
          {cmp.previousReviewStatus !== "reviewed" && (
            <p className="basis-full text-xs text-amber-900">This earlier case has not been reviewed by a person, so its evidence has no reviewer confirmation.</p>
          )}
        </CaseSide>
        <CaseSide heading="This report" subject={current.subject} sender={current.sender} tone="border-teal-200 bg-teal-50/50">
          <AssessmentBadge value={current.proposed} />
          <ReviewBadge value={current.reviewStatus} />
        </CaseSide>
      </div>

      {cmp.sharedSignals.length > 0 && (
        <Section title="What matches" hint="Signals both reports have in common.">
          <Items items={cmp.sharedSignals} tone="border-teal-200 bg-teal-50/40" />
        </Section>
      )}

      {cmp.changed.length > 0 && (
        <Section title="What changed" hint="Differences from the reviewed case. A changed destination means earlier checks don’t carry over.">
          <div className="hidden grid-cols-[11rem,1fr,1fr] gap-3 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
            <span /><span>Previously reviewed</span><span>This report</span>
          </div>
          <ul className="space-y-2">
            {cmp.changed.map((c, i) => {
              const destination = /destination/i.test(c.label);
              return (
                <li key={i} className={`grid gap-2 rounded-xl border p-3 text-sm md:grid-cols-[11rem,1fr,1fr] md:items-center md:gap-3 ${destination ? "border-amber-400 bg-amber-50 ring-1 ring-amber-300" : "border-amber-200 bg-amber-50/40"}`}>
                  <span><Label text={c.label} /></span>
                  <span className="wrap-any text-slate-600">
                    <span className="text-xs font-medium uppercase text-slate-400 md:hidden">Before: </span>
                    <code className="rounded bg-white/80 px-1 py-0.5 text-xs line-through decoration-slate-400">{c.previous}</code>
                  </span>
                  <span className="wrap-any text-slate-900">
                    <span className="sr-only"> changed to </span>
                    <span className="text-xs font-medium uppercase text-slate-400 md:hidden">Now: </span>
                    <code className={`rounded px-1 py-0.5 text-xs font-semibold ${destination ? "bg-amber-200 text-amber-950" : "bg-white"}`}>{c.current}</code>
                  </span>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      <Section title="Evidence reused" hint="Observations carried over from the reviewed case, with a link to where they came from.">
        {cmp.reused.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">No evidence was reused from {cmp.previousCaseId}.</p>
        ) : (
          <ul className="space-y-2">
            {cmp.reused.map((r) => (
              <li key={r.evidenceId} className="flex flex-wrap items-start gap-2 rounded-xl border border-indigo-200 bg-indigo-50/50 p-2.5 text-sm">
                <span className="rounded-md bg-white px-1.5 py-0.5 font-mono text-xs font-semibold">{r.evidenceId}</span>
                <span className="wrap-any min-w-0 flex-1 basis-56 text-slate-800">{r.observation}</span>
                <Button className="!rounded-lg !px-2 !py-0.5 text-xs" onClick={() => onOpenCase(r.fromCaseId)} aria-label={`Open source case ${r.fromCaseId}`}>
                  from {r.fromCaseId}/{r.fromEvidenceId}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {cmp.freshChecks.length > 0 && (
        <section aria-label="Needs fresh investigation" className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-amber-950"><RefreshCw className="h-4 w-4" aria-hidden /> Needs a fresh investigation</h4>
          <p className="mt-0.5 text-xs text-amber-900">These can’t be settled from the earlier case.</p>
          <div className="mt-3"><Items items={cmp.freshChecks} tone="border-amber-300 bg-white" /></div>
        </section>
      )}

      <p className="wrap-any text-xs text-slate-500">Why these reports are related: {cmp.groupReason}</p>
    </div>
  );
}

export function RelatedComparisonPanel({ current, onOpenCase }: { current: Case; onOpenCase: (id: string) => void }) {
  const { api, dataVersion } = useApp();
  const { data, error, loading, reload } = useAsync(() => api.getRelated(current.id), [api, current.id, dataVersion]);

  // Nothing to compare and not part of a group: don't take up space.
  if (!loading && !error && data && data.length === 0 && !current.relatedGroupId) return null;

  return (
    <Card aria-labelledby="related-title" className="overflow-hidden border-indigo-200">
      <CardHeader id="related-title" title="Related-case comparison" icon={<Link2 className="h-4 w-4" aria-hidden />}
        subtitle="How this report compares with an earlier one that a person reviewed." />
      <div className="mx-5 mb-1 rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-950">
        Similarity does not establish safety. Prior verdicts are not copied automatically; each case is assessed on its own evidence.
        Related reports are similarity groupings, not confirmed attack campaigns.
      </div>
      {loading && <div className="space-y-3 p-5" role="status" aria-label="Loading related cases"><Skeleton className="h-24 w-full" /><Skeleton className="h-16 w-full" /></div>}
      {error && <div className="p-5"><ErrorNotice title="Could not load related cases" message={error} onRetry={reload} /></div>}
      {!loading && !error && data && data.length === 0 && (
        <p className="px-5 py-6 text-sm text-slate-600">This is the earliest report in its group, so there is no earlier reviewed case to compare against.</p>
      )}
      {!loading && !error && data && data.map((cmp) => (
        <div key={cmp.previousCaseId} className="border-t border-slate-100">
          <Comparison cmp={cmp} current={current} onOpenCase={onOpenCase} />
        </div>
      ))}
    </Card>
  );
}
