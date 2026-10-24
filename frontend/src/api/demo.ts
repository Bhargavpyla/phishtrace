/**
 * Demo adapter: same Api interface as the live client, backed by synthetic fixtures.
 * Reviews are stored in localStorage and flagged demoOnly. Uploaded files are validated but NOT analysed.
 */
import { buildReport } from "../lib/report";
import { validateEml } from "../lib/format";
import { DEMO_CASES, DEMO_COMPARISONS, DEMO_POLICY } from "./fixtures";
import {
  ApiError,
  type Api,
  type Case,
  type CaseSummary,
  type Health,
  type Metrics,
  type ReviewEvent,
  type ReviewInput,
  type UploadResult,
} from "./types";

const STORAGE_KEY = "phishtrace.demo.reviews";
type ReviewStore = Record<string, ReviewEvent[]>;

export interface DemoApi extends Api {
  hasLocalData(): boolean;
  resetLocalData(): void;
}

function readStore(): ReviewStore {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as ReviewStore;
  } catch {
    return {};
  }
}

function writeStore(s: ReviewStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    throw new ApiError("unsupported", "Browser storage is unavailable, so demo reviews cannot be saved.");
  }
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function withReviews(base: Case, store: ReviewStore): Case {
  const c = clone(base);
  const local = store[c.id] ?? [];
  c.reviews = [...c.reviews, ...local];
  if (c.reviews.length) {
    c.reviewStatus = "reviewed";
    c.reviewedAssessment = c.reviews[c.reviews.length - 1].reviewedAssessment;
  }
  return c;
}

const summary = (c: Case): CaseSummary => ({
  id: c.id, subject: c.subject, sender: c.sender, receivedAt: c.receivedAt, proposed: c.proposed,
  reviewStatus: c.reviewStatus, reviewedAssessment: c.reviewedAssessment, relatedGroupId: c.relatedGroupId,
  relatedGroupReason: c.relatedGroupReason, investigationState: c.investigationState,
});

export function createDemoApi(opts: { delayMs?: number } = {}): DemoApi {
  const delay = opts.delayMs ?? 250;
  const wait = () => new Promise<void>((r) => setTimeout(r, delay));
  const all = () => DEMO_CASES.map((c) => withReviews(c, readStore()));
  const find = (id: string) => {
    const base = DEMO_CASES.find((c) => c.id === id);
    if (!base) throw new ApiError("http", `Demo case ${id} does not exist.`, 404);
    return withReviews(base, readStore());
  };

  return {
    source: "demo",
    hasLocalData: () => Object.keys(readStore()).length > 0,
    resetLocalData: () => {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage unavailable: nothing to clear */ }
    },

    async health(): Promise<Health> {
      return { connected: false, executionMode: "demo", message: "Demo mode: no backend is used." };
    },
    async listPolicies() { return [DEMO_POLICY]; },

    async listCases() { await wait(); return all().map(summary); },

    async uploadEml(file: File): Promise<UploadResult> {
      await wait();
      const problem = validateEml(file);
      if (problem) return { filename: file.name, ok: false, error: problem };
      return {
        filename: file.name, ok: false,
        error: "Demo mode does not analyse uploaded files. Switch to a live backend to investigate real .eml files.",
      };
    },

    async getCase(id) { await wait(); return find(id); },

    async getRelated(id) {
      await wait();
      find(id);
      const store = readStore();
      return clone(DEMO_COMPARISONS[id] ?? []).map((cmp) => {
        const prev = withReviews(DEMO_CASES.find((c) => c.id === cmp.previousCaseId)!, store);
        return { ...cmp, previousAssessment: prev.reviewedAssessment ?? cmp.previousAssessment, previousReviewStatus: prev.reviewStatus };
      });
    },

    async submitReview(id, input: ReviewInput) {
      await wait();
      const c = find(id);
      if (input.assessment !== c.proposed && !input.note.trim())
        throw new ApiError("http", "A note is required when the reviewed assessment differs from the proposal.", 422);
      const store = readStore();
      const ev: ReviewEvent = {
        id: `R-local-${Date.now()}`, at: new Date().toISOString(), reviewer: "demo-reviewer",
        originalAssessment: c.proposed, reviewedAssessment: input.assessment, note: input.note.trim(),
        policyVersion: input.policyVersion, demoOnly: true,
      };
      store[id] = [...(store[id] ?? []), ev];
      writeStore(store);
      return find(id);
    },

    async getMetrics(): Promise<Metrics> {
      await wait();
      const cases = all();
      return {
        reportsInvestigated: cases.length,
        reportsGrouped: cases.filter((c) => c.relatedGroupId).length,
        casesReviewed: cases.filter((c) => c.reviewStatus === "reviewed").length,
        evidenceReused: cases.reduce((n, c) => n + c.evidence.filter((e) => e.origin === "reused").length, 0),
        toolCalls: cases.reduce((n, c) => n + c.toolEvents.length, 0),
        runtimeMs: cases.reduce((n, c) => n + (c.runtimeMs ?? 0), 0),
        analystReviewMinutes: null,
      };
    },

    async downloadReport(id) {
      await wait();
      const c = find(id);
      const report = buildReport(c, clone(DEMO_COMPARISONS[id] ?? []), true);
      return { filename: `phishtrace-demo-report-${id}.json`, blob: new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }) };
    },
  };
}
