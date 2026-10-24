import { ArrowRight, CircleCheck, Link2, ShieldAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import type { Assessment, Case } from "../api/types";
import { ASSESSMENT_LABEL } from "../lib/labels";
import { ASSESS_STYLE, ModeBadge, ReviewBadge } from "./Badges";
import { Button, Disclosure } from "./ui";

const MEANING: Record<Assessment, string> = {
  suspicious: "Several signals point to a phishing attempt. A person should confirm before anything is acted on.",
  likely_benign: "No strong warning signs were found. That isn’t a guarantee of safety; a person decides whether to close the report.",
  needs_review: "The evidence is mixed or incomplete, so this needs a person’s judgement.",
};
const ICON: Record<Assessment, { icon: LucideIcon; tone: string }> = {
  suspicious: { icon: ShieldAlert, tone: "bg-red-100 text-red-700" },
  likely_benign: { icon: CircleCheck, tone: "bg-teal-100 text-teal-700" },
  needs_review: { icon: TriangleAlert, tone: "bg-amber-100 text-amber-800" },
};

export function VerdictCard({ c, relatedTo, onCompare }: {
  c: Case;
  /** Earlier reviewed case this one resembles, if the backend found one. */
  relatedTo?: { caseId: string; reviewed: boolean } | null;
  onCompare: () => void;
}) {
  const { icon: Icon, tone } = ICON[c.proposed];
  const reasons = c.findings.slice(0, 3);
  const gaps = [...c.missingEvidence, ...c.limitations];
  return (
    <section aria-labelledby="assessment-title" className={`rounded-3xl border p-5 shadow-card sm:p-6 ${ASSESS_STYLE[c.proposed].panel}`}>
      <div className="flex items-start gap-4">
        <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${tone}`}><Icon className="h-7 w-7" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h2 id="assessment-title" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Proposed assessment</h2>
          <p className="text-3xl font-semibold tracking-tight text-slate-900">{ASSESSMENT_LABEL[c.proposed]}</p>
          <p className="mt-1 text-base text-slate-700">{MEANING[c.proposed]}</p>
        </div>
      </div>

      {reasons.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-slate-900">Top reasons</h3>
          <ul className="mt-2 space-y-1.5">
            {reasons.map((f) => (
              <li key={f.id} className="flex items-start gap-2 text-sm text-slate-800">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" />
                <span className="wrap-any">{f.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {c.fallback && (
        <p role="note" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Rules-only fallback: the AI model was unavailable, so this proposal comes from automatic checks alone.
        </p>
      )}

      {relatedTo && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-200 bg-white/80 px-4 py-3">
          <Link2 className="h-5 w-5 shrink-0 text-indigo-700" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-slate-800">
            Similar to <span className="font-semibold">{relatedTo.caseId}</span>{relatedTo.reviewed ? ", a case a person already reviewed" : ""}. See what matches and what changed.
          </p>
          <Button onClick={onCompare}>Compare <ArrowRight className="h-4 w-4" aria-hidden /></Button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <ReviewBadge value={c.reviewStatus} />
        <ModeBadge mode={c.mode} />
        <span>Policy {c.policyVersion}</span>
      </div>

      {gaps.length > 0 && (
        <div className="mt-4">
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
        </div>
      )}
    </section>
  );
}
