import type { Assessment, Case } from "../api/types";
import { ASSESS_STYLE, AssessmentBadge, ModeBadge, ReviewBadge } from "./Badges";
import { Card, Disclosure } from "./ui";

const MEANING: Record<Assessment, string> = {
  suspicious: "Several signals point to a phishing attempt. A person should confirm this before anything is acted on.",
  likely_benign: "No strong warning signs were found. That is not a guarantee of safety; a reviewer decides whether to close the report.",
  needs_review: "The evidence is mixed or incomplete, so this needs a person’s judgement.",
};

export function AssessmentCard({ c }: { c: Case }) {
  const gaps = [...c.missingEvidence, ...c.limitations];
  return (
    <Card aria-labelledby="assessment-title" className={`${ASSESS_STYLE[c.proposed].panel} p-5`}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="assessment-title" className="text-sm font-semibold uppercase tracking-wide text-slate-500">Proposed assessment</h2>
        <AssessmentBadge value={c.proposed} size="lg" />
        <ReviewBadge value={c.reviewStatus} />
        {c.reviewStatus === "reviewed" && c.reviewedAssessment && c.reviewedAssessment !== c.proposed && (
          <span className="inline-flex items-center gap-1 text-sm text-slate-700">reviewed as <AssessmentBadge value={c.reviewedAssessment} /></span>
        )}
      </div>
      <p className="mt-3 text-base font-medium text-slate-900">{MEANING[c.proposed]}</p>
      {c.explanation && <p className="wrap-any mt-2 text-sm text-slate-700">{c.explanation}</p>}
      {c.fallback && (
        <p role="note" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Rules-only fallback: the AI model was unavailable, so this proposal comes from automatic checks alone.
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
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
    </Card>
  );
}
