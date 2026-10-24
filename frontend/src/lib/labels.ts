import type { Assessment, ExecutionMode, FindingType } from "../api/types";

export const ASSESSMENT_LABEL: Record<Assessment, string> = {
  suspicious: "Suspicious",
  likely_benign: "Likely benign",
  needs_review: "Needs review",
};

export const MODE_LABEL: Record<ExecutionMode, string> = {
  demo: "Demo",
  agent: "Agent",
  rules_only: "Rules-only",
};

export const FINDING_TYPE_LABEL: Record<FindingType, string> = {
  observed_fact: "Observed",
  policy_guidance: "Playbook guidance",
  model_interpretation: "AI interpretation",
};

/** The Python backend uses its own label vocabulary; accept either. */
export function toAssessment(v: unknown): Assessment {
  switch (v) {
    case "suspicious":
    case "likely_phishing":
      return "suspicious";
    case "likely_benign":
    case "no_strong_indicators":
    case "reviewed_closure":
      return "likely_benign";
    default:
      return "needs_review";
  }
}

export function toMode(v: unknown): ExecutionMode {
  if (v === "agent") return "agent";
  if (v === "rules_only" || v === "rules-only" || v === "fallback") return "rules_only";
  return v === "demo" ? "demo" : "rules_only";
}
