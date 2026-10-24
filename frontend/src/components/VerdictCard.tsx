import { ArrowRight, CircleCheck, Link2, ShieldAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import type { Assessment, Case } from "../api/types";
import { ASSESSMENT_LABEL } from "../lib/labels";
import { ModeBadge, ReviewBadge } from "./Badges";
import { Button, Disclosure } from "./ui";

const MEANING: Record<Assessment, string> = {
  suspicious: "Several signals point to a phishing attempt. A person should confirm before anything is acted on.",
  likely_benign: "No strong warning signs were found. That isn’t a guarantee of safety; a person decides whether to close the report.",
  needs_review: "The evidence is mixed or incomplete, so this needs a person’s judgement.",
};
// Colour band per assessment. Amber uses dark text to keep contrast; text always states the label too.
const BAND: Record<Assessment, { icon: LucideIcon; band: string; tile: string; sub: string }> = {
  suspicious: { icon: ShieldAlert, band: "bg-gradient-to-br from-red-600 to-rose-700 text-white", tile: "bg-white/15 ring-white/25", sub: "text-red-50" },
  likely_benign: { icon: CircleCheck, band: "bg-gradient-to-br from-teal-600 to-teal-800 text-white", tile: "bg-white/15 ring-white/25", sub: "text-teal-50" },
  needs_review: { icon: TriangleAlert, band: "bg-gradient-to-br from-amber-300 to-amber-400 text-amber-950", tile: "bg-white/40 ring-amber-950/10", sub: "text-amber-950" },
};

export function VerdictCard({ c, relatedTo, onCompare }: {
  c: Case;
  /** Earlier reviewed case this one resembles, if the backend found one. */
  relatedTo?: { caseId: string; reviewed: boolean } | null;
  onCompare: () => void;
}) {
  const b = BAND[c.proposed];
  const Icon = b.icon;
  const reasons = c.findings.slice(0, 3);
  const gaps = [...c.missingEvidence, ...c.limitations];
  return (
    <section aria-labelledby="assessment-title" className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-lift">
      <div className={`relative px-6 py-6 ${b.band}`}>
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-start gap-4">
          <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-1 ${b.tile}`}><Icon className="h-7 w-7" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <h2 id="assessment-title" className={`text-xs font-semibold uppercase tracking-wider opacity-90 ${b.sub}`}>Proposed assessment</h2>
            <p className="text-3xl font-semibold tracking-tight">{ASSESSMENT_LABEL[c.proposed]}</p>
            <p className={`mt-1 max-w-2xl text-base ${b.sub}`}>{MEANING[c.proposed]}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-6">
        {reasons.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Top reasons</h3>
            <ul className="mt-2 grid gap-2 md:grid-cols-3">
              {reasons.map((f, i) => (
                <li key={f.id} className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-800">
                  <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy-900 text-[11px] font-semibold text-white">{i + 1}</span>
                  <span className="wrap-any">{f.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {c.fallback && (
          <p role="note" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Rules-only fallback: the AI model was unavailable, so this proposal comes from automatic checks alone.
          </p>
        )}

        {relatedTo && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-white px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-md shadow-indigo-500/30"><Link2 className="h-5 w-5" aria-hidden /></span>
            <p className="min-w-0 flex-1 text-sm text-slate-800">
              Similar to <span className="font-semibold">{relatedTo.caseId}</span>{relatedTo.reviewed ? ", a case a person already reviewed" : ""}. See what matches and what changed.
            </p>
            <Button onClick={onCompare}>Compare <ArrowRight className="h-4 w-4" aria-hidden /></Button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <ReviewBadge value={c.reviewStatus} />
          <ModeBadge mode={c.mode} />
          <span className="rounded-full bg-slate-100 px-2 py-0.5">Policy {c.policyVersion}</span>
        </div>

        {gaps.length > 0 && (
          <Disclosure title={`What could not be checked (${gaps.length})`}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Missing evidence</h3>
                {c.missingEvidence.length === 0 ? <p className="mt-1 text-sm text-slate-600">None recorded.</p> :
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-slate-800">{c.missingEvidence.map((m) => <li key={m}>{m}</li>)}</ul>}
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Limitations</h3>
                {c.limitations.length === 0 ? <p className="mt-1 text-sm text-slate-600">None recorded.</p> :
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-slate-800">{c.limitations.map((m) => <li key={m}>{m}</li>)}</ul>}
              </div>
            </div>
          </Disclosure>
        )}
      </div>
    </section>
  );
}
