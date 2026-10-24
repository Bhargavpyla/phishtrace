import type { Case, RelatedCaseComparison } from "../api/types";

/** Report built in the browser for demo data. The live backend produces its own report. */
export function buildReport(c: Case, related: RelatedCaseComparison[], demo: boolean) {
  return {
    generatedAt: new Date().toISOString(),
    source: demo ? "demo-data" : "backend",
    notice:
      "Audit history, not a tamper-proof record. Evidence citations support but do not by themselves prove a conclusion." +
      (demo ? " Demo data: nothing here was produced by a real investigation." : ""),
    case: {
      id: c.id,
      subject: c.subject,
      sender: c.sender,
      replyTo: c.replyTo ?? null,
      receivedAt: c.receivedAt,
      executionMode: c.mode,
      policyVersion: c.policyVersion,
      proposedAssessment: c.proposed,
      reviewStatus: c.reviewStatus,
      reviewedAssessment: c.reviewedAssessment ?? null,
      explanation: c.explanation,
      missingEvidence: c.missingEvidence,
      limitations: c.limitations,
      relatedGroupId: c.relatedGroupId ?? null,
    },
    findings: c.findings,
    evidence: c.evidence,
    toolEvents: c.toolEvents,
    toolCallsUsed: c.toolEvents.length,
    toolLimit: c.toolLimit,
    relatedComparisons: related,
    reviews: c.reviews,
  };
}
