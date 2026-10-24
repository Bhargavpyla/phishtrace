/**
 * Live adapter. Talks to the Python backend over HTTP using the contract in docs/FRONTEND_API.md.
 * NOTE: those endpoints are PROPOSED; the current Python backend exposes no HTTP API yet.
 * Failures surface as ApiError; nothing here substitutes mock data.
 */
import { toAssessment, toMode } from "../lib/labels";
import {
  ApiError,
  type Api,
  type Case,
  type CaseSummary,
  type Health,
  type Metrics,
  type Policy,
  type RelatedCaseComparison,
  type ReportFile,
  type ReviewInput,
  type UploadResult,
} from "./types";

const DEFAULT_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 90_000;

export function createLiveApi(baseUrl: string): Api {
  const base = baseUrl.replace(/\/+$/, "");

  async function request(path: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(base + path, { ...init, signal: ctrl.signal });
      if (!res.ok) {
        let detail = "";
        try {
          const body = await res.json();
          detail = typeof body?.error === "string" ? body.error : typeof body?.detail === "string" ? body.detail : "";
        } catch {
          /* non-JSON error body */
        }
        const hint =
          res.status === 404 ? "The backend does not expose this endpoint yet." :
          res.status === 403 ? "Your role is not allowed to do this." :
          res.status >= 500 ? "The backend failed; check its logs and retry." : "";
        throw new ApiError("http", [detail || `Request failed (HTTP ${res.status}).`, hint].filter(Boolean).join(" "), res.status);
      }
      return res;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      if (e instanceof DOMException && e.name === "AbortError")
        throw new ApiError("timeout", `The backend did not answer within ${Math.round(timeoutMs / 1000)} s. Check that it is running at ${base || "this origin"}, then retry.`);
      throw new ApiError("network", `Cannot reach the backend at ${base || "this origin"}. Check the URL, CORS settings and that the server is running.`);
    } finally {
      clearTimeout(timer);
    }
  }

  async function json<T>(path: string, init?: RequestInit, timeoutMs?: number): Promise<T> {
    const res = await request(path, init, timeoutMs);
    try {
      return (await res.json()) as T;
    } catch {
      throw new ApiError("parse", "The backend returned a response that is not valid JSON.");
    }
  }

  const normSummary = <T extends CaseSummary>(c: T): T => ({
    ...c,
    proposed: toAssessment(c.proposed),
    reviewedAssessment: c.reviewedAssessment ? toAssessment(c.reviewedAssessment) : undefined,
  });

  const normCase = (c: Case): Case => ({
    ...normSummary(c),
    mode: toMode(c.mode),
    findings: c.findings ?? [],
    evidence: c.evidence ?? [],
    toolEvents: c.toolEvents ?? [],
    toolLimit: c.toolLimit ?? 6,
    missingEvidence: c.missingEvidence ?? [],
    limitations: c.limitations ?? [],
    urls: c.urls ?? [],
    reviews: (c.reviews ?? []).map((r) => ({
      ...r,
      originalAssessment: toAssessment(r.originalAssessment),
      reviewedAssessment: toAssessment(r.reviewedAssessment),
    })),
  });

  return {
    source: "live",

    async health(): Promise<Health> {
      try {
        const h = await json<{ status?: string; executionMode?: string }>("/api/health", {}, 5_000);
        if (h.status !== "ok") return { connected: false, message: "Backend responded but did not report status ok." };
        return { connected: true, executionMode: toMode(h.executionMode) };
      } catch (e) {
        return { connected: false, message: e instanceof Error ? e.message : "Unreachable." };
      }
    },

    listPolicies: () => json<Policy[]>("/api/policies"),

    async listCases() {
      return (await json<CaseSummary[]>("/api/cases")).map(normSummary);
    },

    async uploadEml(file: File, policyId?: string): Promise<UploadResult> {
      const form = new FormData();
      form.append("file", file, file.name);
      if (policyId) form.append("policyId", policyId);
      try {
        const r = await json<{ caseId: string; duplicate?: boolean }>("/api/cases", { method: "POST", body: form }, UPLOAD_TIMEOUT_MS);
        return { filename: file.name, ok: true, caseId: r.caseId, duplicate: !!r.duplicate };
      } catch (e) {
        return { filename: file.name, ok: false, error: e instanceof Error ? e.message : "Upload failed." };
      }
    },

    async getCase(id) {
      return normCase(await json<Case>(`/api/cases/${encodeURIComponent(id)}`));
    },

    getRelated: (id) => json<RelatedCaseComparison[]>(`/api/cases/${encodeURIComponent(id)}/related`),

    async submitReview(id, input: ReviewInput) {
      return normCase(await json<Case>(`/api/cases/${encodeURIComponent(id)}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }));
    },

    getMetrics: () => json<Metrics>("/api/metrics"),

    async downloadReport(id): Promise<ReportFile> {
      const res = await request(`/api/cases/${encodeURIComponent(id)}/report`);
      return { filename: `phishtrace-report-${id}.json`, blob: await res.blob() };
    },
  };
}
