/** Frontend data model. The live adapter maps backend payloads onto these types (see docs/FRONTEND_API.md). */

export type Assessment = "suspicious" | "likely_benign" | "needs_review";
export type ReviewStatus = "unreviewed" | "reviewed";
export type ExecutionMode = "demo" | "agent" | "rules_only";
export type FindingType = "observed_fact" | "policy_guidance" | "model_interpretation";
export type ToolStatus = "running" | "ok" | "error" | "refused";
export type InvestigationState = "running" | "complete" | "failed";

export interface Policy {
  id: string;
  name: string;
  version: string;
  ownDomains: string[];
}

export interface Evidence {
  /** Case-local id such as "E3" or "PB-lookalike-domains". */
  id: string;
  observation: string;
  /** Source header/field or the excerpt the observation came from. */
  source: string;
  /** How it was collected, e.g. "Parser: header extraction" or "Tool: inspect_links". */
  method: string;
  collectedAt: string | null;
  origin: "new" | "reused";
  reusedFrom?: { caseId: string; evidenceId: string };
  note?: string;
}

export interface Finding {
  id: string;
  title: string;
  explanation: string;
  type: FindingType;
  evidenceIds: string[];
  /** Expandable source details (raw field values, playbook passage title). */
  sourceDetail?: string;
}

export interface ToolEvent {
  id: string;
  tool: string;
  status: ToolStatus;
  durationMs?: number;
  reason?: string;
  resultSummary?: string;
}

export interface ReviewEvent {
  id: string;
  at: string;
  reviewer: string;
  originalAssessment: Assessment;
  reviewedAssessment: Assessment;
  note: string;
  policyVersion: string;
  /** True only for reviews saved locally in demo mode. */
  demoOnly?: boolean;
}

export interface CaseSummary {
  id: string;
  subject: string;
  sender: string;
  receivedAt: string | null;
  proposed: Assessment;
  reviewStatus: ReviewStatus;
  reviewedAssessment?: Assessment;
  relatedGroupId?: string;
  relatedGroupReason?: string;
  investigationState: InvestigationState;
}

export interface Case extends CaseSummary {
  replyTo?: string;
  /** Plain text only. Never HTML. */
  preview: string;
  urls: string[];
  explanation: string;
  mode: ExecutionMode;
  policyVersion: string;
  findings: Finding[];
  evidence: Evidence[];
  toolEvents: ToolEvent[];
  toolLimit: number;
  missingEvidence: string[];
  limitations: string[];
  reviews: ReviewEvent[];
  runtimeMs?: number;
  fallback?: boolean;
}

export interface ComparisonItem {
  label: string;
  detail: string;
}

export interface RelatedCaseComparison {
  currentCaseId: string;
  previousCaseId: string;
  previousSubject: string;
  previousSender: string;
  previousAssessment?: Assessment;
  previousReviewStatus: ReviewStatus;
  groupReason: string;
  sharedSignals: ComparisonItem[];
  changed: { label: string; previous: string; current: string }[];
  reused: { evidenceId: string; fromCaseId: string; fromEvidenceId: string; observation: string }[];
  freshChecks: ComparisonItem[];
}

/** Any metric the backend cannot supply is null and rendered as "Not measured". */
export interface Metrics {
  reportsInvestigated: number | null;
  reportsGrouped: number | null;
  casesReviewed: number | null;
  evidenceReused: number | null;
  toolCalls: number | null;
  runtimeMs: number | null;
  analystReviewMinutes: number | null;
}

export interface Health {
  connected: boolean;
  executionMode?: ExecutionMode;
  message?: string;
}

export interface UploadResult {
  filename: string;
  ok: boolean;
  caseId?: string;
  duplicate?: boolean;
  error?: string;
}

export interface ReviewInput {
  assessment: Assessment;
  note: string;
  policyVersion: string;
}

export interface ReportFile {
  filename: string;
  blob: Blob;
}

export type ApiErrorKind = "timeout" | "network" | "http" | "parse" | "unsupported";

export class ApiError extends Error {
  kind: ApiErrorKind;
  status?: number;
  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

/** The single interface the UI talks to. Implemented by the live client and the demo adapter. */
export interface Api {
  readonly source: "live" | "demo";
  health(): Promise<Health>;
  listPolicies(): Promise<Policy[]>;
  listCases(): Promise<CaseSummary[]>;
  uploadEml(file: File, policyId?: string): Promise<UploadResult>;
  getCase(id: string): Promise<Case>;
  getRelated(id: string): Promise<RelatedCaseComparison[]>;
  submitReview(id: string, input: ReviewInput): Promise<Case>;
  getMetrics(): Promise<Metrics>;
  downloadReport(id: string): Promise<ReportFile>;
}
