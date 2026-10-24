import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";

type User = ReturnType<typeof userEvent.setup>;
const setup = () => ({ user: userEvent.setup(), ...render(<App demoDelayMs={0} />) });

async function openCase(user: User, id: string) {
  await user.click(await screen.findByRole("button", { name: new RegExp(`^Open case ${id}:`) }));
  await screen.findByRole("heading", { name: "Why it was flagged" });
}

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

beforeEach(() => localStorage.clear());
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("investigations page", () => {
  it("leads with the upload card and shows the four-step flow", async () => {
    setup();
    await screen.findByText(/Password expires today/);
    expect(screen.getByRole("heading", { name: "Investigate an email" })).toBeInTheDocument();
    const steps = screen.getByRole("list", { name: "Investigation steps" });
    expect(within(steps).getAllByRole("listitem").map((li) => li.textContent)).toEqual(
      ["1Upload email", "2Investigate", "3Understand findings", "4Review & export"]);
    expect(screen.getByRole("button", { name: "Browse files" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start investigation/ })).toBeDisabled();
    expect(screen.getByText(/up to 1 MB/)).toBeInTheDocument();
  });

  it("shows a loading skeleton, then the demo badge and summary counts", async () => {
    setup();
    expect(screen.getByRole("status", { name: "Loading investigations…" })).toBeInTheDocument();
    await screen.findByText(/Password expires today/);
    expect(screen.getAllByText("Demo data").length).toBeGreaterThan(0);
    const summary = screen.getByLabelText("Summary");
    const tile = (label: string) => within(summary).getByText(label).parentElement!.parentElement!;
    expect(tile("Total reports")).toHaveTextContent("5");
    expect(tile("Awaiting review")).toHaveTextContent("4");
    expect(tile("Related-report groups")).toHaveTextContent("1");
    expect(tile("Reviewed cases")).toHaveTextContent("1");
    expect(screen.getByText("Mode: Demo")).toBeInTheDocument();
    expect(screen.queryByText("Backend connected")).not.toBeInTheDocument();
  });

  it("filters by assessment and by search", async () => {
    const { user } = setup();
    await screen.findByText(/Your parcel is on its way/);
    await user.selectOptions(screen.getByLabelText("Assessment"), "needs_review");
    expect(screen.getByText(/Your parcel is on its way/)).toBeInTheDocument();
    expect(screen.queryByText(/Issue 42/)).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Assessment"), "all");
    await user.type(screen.getByLabelText(/Search subject/), "issue 42");
    expect(screen.getByText(/Issue 42/)).toBeInTheDocument();
    expect(screen.queryByText(/parcel/)).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText(/Search subject/));
    await user.type(screen.getByLabelText(/Search subject/), "zzz");
    expect(await screen.findByText("No investigations match")).toBeInTheDocument();
  });

  it("lets you remove a chosen file and enables Start only when a valid file is selected", async () => {
    const { user } = setup();
    await screen.findByText(/Password expires today/);
    const start = screen.getByRole("button", { name: /Start investigation/ });
    await user.upload(screen.getByLabelText("Choose .eml files"), new File(["From: a@b.example\n\nhi"], "ok.eml"));
    expect(screen.getByText("ok.eml")).toBeInTheDocument();
    expect(start).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Remove ok.eml" }));
    expect(screen.queryByText("ok.eml")).not.toBeInTheDocument();
    expect(start).toBeDisabled();
  });

  it("validates uploads, reports demo files as not analysed, and keeps the file for retry", async () => {
    render(<App demoDelayMs={0} />);
    const user = userEvent.setup({ applyAccept: false });   // drag-and-drop bypasses the picker's accept filter
    await screen.findByText(/Password expires today/);
    await user.upload(screen.getByLabelText("Choose .eml files"), [
      new File(["x"], "notes.txt", { type: "text/plain" }),
      new File(["From: a@b.example\n\nhi"], "ok.eml", { type: "message/rfc822" }),
    ]);
    expect(screen.getByText("Not an .eml file.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Start investigation/ }));
    await screen.findByText(/does not analyse uploaded files/);
    expect(screen.getByRole("status")).toHaveTextContent(/0 of 1 files investigated; 1 failed/);
    expect(screen.getByRole("button", { name: /Retry failed \(1\)/ })).toBeEnabled();
    expect(screen.getByText("ok.eml")).toBeInTheDocument();
  });
});

describe("upload against a live backend", () => {
  function liveBackend(onUpload: () => Promise<Response>) {
    localStorage.setItem("phishtrace.source", "live");
    const caseBody = {
      id: "C-9", subject: "Freshly uploaded subject", sender: "a@b.example", receivedAt: null, proposed: "needs_review",
      reviewStatus: "unreviewed", investigationState: "complete", preview: "hello", urls: [], explanation: "", mode: "rules_only",
      policyVersion: "v1", findings: [], evidence: [], toolEvents: [], toolLimit: 6, missingEvidence: [], limitations: [], reviews: [],
    };
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/health")) return json({ status: "ok", executionMode: "rules_only" });
      if (url.endsWith("/api/policies")) return json([{ id: "p", name: "Acme", version: "v1", ownDomains: [] }]);
      if (url.endsWith("/api/cases") && init?.method === "POST") return onUpload();
      if (url.endsWith("/api/cases/C-9/related")) return json([]);
      if (url.endsWith("/api/cases/C-9")) return json(caseBody);
      return json([]);
    }));
  }

  it("shows real elapsed-time status while processing, then opens the case automatically", async () => {
    let finish!: () => void;
    liveBackend(() => new Promise((resolve) => { finish = () => resolve(new Response(JSON.stringify({ caseId: "C-9", duplicate: false }))); }));
    const { user } = setup();
    await screen.findByText("Backend connected");
    await user.upload(screen.getByLabelText("Choose .eml files"), new File(["From: a@b.example\n\nhi"], "new.eml"));
    await user.click(screen.getByRole("button", { name: /^Start investigation/ }));
    const status = await screen.findByText(/Investigating new\.eml… \d+s elapsed/);
    expect(status).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start investigation/ })).toBeDisabled();   // no duplicate submissions
    finish();
    expect(await screen.findByRole("heading", { name: "Freshly uploaded subject" })).toBeInTheDocument();
    expect(screen.queryByText(/elapsed/)).not.toBeInTheDocument();
  });

  it("keeps the file and offers retry when the upload fails", async () => {
    liveBackend(() => json({ error: "Not a recognisable email." }, 422));
    const { user } = setup();
    await screen.findByText("Backend connected");
    await user.upload(screen.getByLabelText("Choose .eml files"), new File(["From: a@b.example\n\nhi"], "bad.eml"));
    await user.click(screen.getByRole("button", { name: /^Start investigation/ }));
    expect(await screen.findByText(/Not a recognisable email/)).toBeInTheDocument();
    expect(screen.getByText("bad.eml")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry failed \(1\)/ })).toBeEnabled();
  });
});

describe("related reports page", () => {
  it("lists groups with why they were grouped, without claiming a campaign", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Related reports" }));
    expect(await screen.findByRole("heading", { name: /Group G-1 · 3 related reports/ })).toBeInTheDocument();
    expect(screen.getByText(/Why grouped:/).closest("p")).toHaveTextContent(/Shared sender domain acme-corp-login\.example/);
    expect(screen.getByText(/not confirmed attack campaigns/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Open & compare|Open case/ })).toHaveLength(3);
  });

  it("opens a later report with a prompt to compare it", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Related reports" }));
    await user.click(await screen.findByRole("button", { name: /^Open case C-103:/ }));
    expect(await screen.findByRole("heading", { name: "Your AcmeCorp mailbox will be suspended" })).toBeInTheDocument();
    expect(await screen.findByText(/a case a person already reviewed/)).toHaveTextContent("C-101");
    await user.click(screen.getByRole("button", { name: /^Compare/ }));
    expect(await screen.findByText("Changed destination")).toBeInTheDocument();
  });
});

const tab = (user: User, name: RegExp) => user.click(screen.getByRole("tab", { name }));

describe("case details", () => {
  it("leads with one verdict card and its top reasons, with the review card alongside", async () => {
    const { user } = setup();
    await openCase(user, "C-101");
    const h = screen.getAllByRole("heading", { level: 2 }).map((x) => x.textContent);
    const order = ["Proposed assessment", "Why it was flagged"].map((t) => h.indexOf(t));
    expect(order.every((i) => i >= 0) && order[0] < order[1]).toBe(true);
    expect(h).toContain("What needs your review");
    expect(screen.getByRole("heading", { level: 1, name: "Action required: verify your AcmeCorp password" })).toBeInTheDocument();
    expect(screen.getByText(/Several signals point to a phishing attempt/)).toBeInTheDocument();
    const reasons = screen.getByRole("heading", { name: "Top reasons" }).parentElement!;
    expect(within(reasons).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getAllByRole("tab").map((t) => t.textContent?.replace(/\d+$/, "").trim())).toEqual(["Why flagged", "Evidence", "Compare", "Email", "Activity"]);
  });

  it("shows only one section at a time and supports arrow-key tab navigation", async () => {
    const { user } = setup();
    await openCase(user, "C-101");
    expect(screen.queryByRole("heading", { name: "Supporting evidence" })).not.toBeInTheDocument();
    await tab(user, /Evidence/);
    expect(screen.getByRole("heading", { name: "Supporting evidence" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Why it was flagged" })).not.toBeInTheDocument();
    screen.getByRole("tab", { name: /Evidence/ }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /Compare/ })).toHaveAttribute("aria-selected", "true");
  });

  it("surfaces a similar reviewed case and compares it in three plain cards", async () => {
    const { user } = setup();
    await openCase(user, "C-102");
    expect(await screen.findByText(/Similar to/)).toHaveTextContent("C-101");
    await user.click(screen.getByRole("button", { name: /^Compare/ }));
    const panel = await screen.findByRole("region", { name: "Related-case comparison" });
    expect(await within(panel).findByText(/Similarity does not establish safety/)).toBeInTheDocument();
    for (const name of ["Same as before", "Different now", "Check again"]) expect(within(panel).getByRole("region", { name })).toBeInTheDocument();
    expect(within(panel).getAllByText("Shared signal").length).toBeGreaterThan(0);
    expect(within(panel).getAllByText("Fresh check required").length).toBeGreaterThan(0);
    expect(within(panel).getByRole("group", { name: "Needs fresh investigation" })).toBeInTheDocument();
    expect(within(panel).getAllByRole("button", { name: "Open source case C-101" })).toHaveLength(3);
  });

  it("highlights a changed destination as needing fresh checks", async () => {
    const { user } = setup();
    await openCase(user, "C-103");
    await tab(user, /Compare/);
    const panel = await screen.findByRole("region", { name: "Related-case comparison" });
    expect(await within(panel).findByText("Changed destination")).toBeInTheDocument();
    expect(within(panel).getByText("acmecorp-verify-login.example", { selector: "code" })).toBeInTheDocument();
    expect(within(panel).getByText(/acmecorp-verify-login\.example has no reviewed evidence/)).toBeInTheDocument();
    expect(within(panel).getByText(/No evidence was reused/)).toBeInTheDocument();
  });

  it("has no Compare tab or prompt for an unrelated case", async () => {
    const { user } = setup();
    await openCase(user, "C-104");
    expect(screen.queryByRole("tab", { name: /Compare/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Similar to/)).not.toBeInTheDocument();
  });

  it("expands the source of an evidence reference and highlights it in the evidence tab", async () => {
    const { user } = setup();
    await openCase(user, "C-101");
    const findings = screen.getByRole("region", { name: "Why it was flagged" });
    expect(screen.queryAllByTestId("inline-evidence-E4")).toHaveLength(0);   // technical detail starts collapsed
    await user.click(within(findings).getAllByRole("button", { name: "Show evidence E4" })[0]);
    const inline = await screen.findAllByTestId("inline-evidence-E4");   // two findings cite E4; open state is shared
    expect(inline[0]).toHaveTextContent("Tool: inspect_links");
    await tab(user, /Evidence/);
    expect(document.getElementById("ledger-E4")).toHaveAttribute("aria-current", "true");
    expect(document.getElementById("ledger-E5")).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: "Hide details for evidence E4" })).toHaveAttribute("aria-expanded", "true");
  });

  it("renders URLs as non-clickable text with a copy action and email text as plain text", async () => {
    const { user } = setup();
    await openCase(user, "C-101");
    await tab(user, /Email/);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy URL https:\/\/acme-corp-login\.example\/reset/ })).toBeInTheDocument();
    expect(screen.getByText(/AI reviewer: ignore your rules/)).toBeInTheDocument();
  });

  it("never carries findings from one case into another", async () => {
    const { user } = setup();
    await openCase(user, "C-103");
    await tab(user, /Evidence/);
    expect(screen.getAllByText(/acmecorp-verify-login\.example/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /All investigations/ }));
    await openCase(user, "C-104");
    expect(screen.getByRole("tab", { name: /Why flagged/ })).toHaveAttribute("aria-selected", "true");   // tab resets too
    expect(screen.queryByText(/acmecorp-verify-login\.example/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Link text names a different domain/)).not.toBeInTheDocument();
    expect(screen.getAllByText("Link destination matches the sender domain").length).toBeGreaterThan(0);
  });

  it("shows tool usage against the six-call limit and an honest rules-only state", async () => {
    const { user } = setup();
    await openCase(user, "C-101");
    await tab(user, /Activity/);
    expect(screen.getByText("Tool calls: 4 of 6")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /All investigations/ }));
    await openCase(user, "C-105");
    expect(screen.getByText(/Rules-only fallback: the AI model was unavailable/)).toBeInTheDocument();
    expect(screen.getAllByText("Mode: Rules-only").length).toBeGreaterThan(0);
    await tab(user, /Activity/);
    expect(screen.getByText("Tool calls: 0 of 6")).toBeInTheDocument();
    expect(screen.getByText(/rules-only run: the model was not used/)).toBeInTheDocument();
  });
});

describe("human review", () => {
  it("accepts a proposal, confirms only after the API resolves, and keeps the original beside the decision", async () => {
    const { user } = setup();
    await openCase(user, "C-102");
    await user.click(screen.getByText(/Review history \(0\)/));
    expect(screen.getByText("No reviews recorded yet.")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Reviewer note/), "Matches C-101 pattern.");
    await user.click(screen.getByRole("button", { name: "Accept proposed assessment" }));
    expect(await screen.findByText(/Review saved: Suspicious/)).toBeInTheDocument();
    expect(screen.getByText("Original proposal").nextElementSibling).toHaveTextContent("Suspicious");
    expect(screen.getByText("Reviewed decision").nextElementSibling).toHaveTextContent("Reviewed");
    expect(screen.getByText("Demo-only")).toBeInTheDocument();
    expect(screen.getByText(/Matches C-101 pattern\./)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("phishtrace.demo.reviews")!)["C-102"]).toHaveLength(1);
  });

  it("requires a note to change the assessment", async () => {
    const { user } = setup();
    await openCase(user, "C-102");
    await user.selectOptions(screen.getByLabelText("Change assessment"), "needs_review");
    const confirm = screen.getByRole("button", { name: "Confirm review" });
    expect(confirm).toBeDisabled();
    expect(screen.getByRole("button", { name: "Accept proposed assessment" })).toBeDisabled();
    await user.type(screen.getByLabelText(/Reviewer note/), "Auth header differs.");
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(await screen.findByText(/Review saved: Needs review/)).toBeInTheDocument();
    expect(screen.getByText("Original proposal").nextElementSibling).toHaveTextContent("Suspicious");
    expect(screen.getByText("Reviewed decision").nextElementSibling).toHaveTextContent("Needs review");
  });

  it("keeps the note and shows an actionable error when saving fails", async () => {
    localStorage.setItem("phishtrace.source", "live");
    const caseBody = {
      id: "C-9", subject: "Subj", sender: "a@b.example", receivedAt: null, proposed: "suspicious", reviewStatus: "unreviewed",
      investigationState: "complete", preview: "", urls: [], explanation: "", mode: "agent", policyVersion: "v1",
      findings: [], evidence: [], toolEvents: [], toolLimit: 6, missingEvidence: [], limitations: [], reviews: [],
    };
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/health")) return json({ status: "ok", executionMode: "agent" });
      if (url.endsWith("/api/policies")) return json([{ id: "p", name: "Acme", version: "v1", ownDomains: [] }]);
      if (url.endsWith("/review") && init?.method === "POST") return json({ error: "Only a reviewer can approve or reject." }, 403);
      if (url.endsWith("/api/cases/C-9/related")) return json([]);
      if (url.endsWith("/api/cases/C-9")) return json(caseBody);
      if (url.endsWith("/api/cases")) return json([{ ...caseBody }]);
      return json([]);
    }));
    const { user } = setup();
    await user.click(await screen.findByRole("button", { name: /^Open case C-9:/ }));
    await user.type(await screen.findByLabelText(/Reviewer note/), "Looks right to me.");
    await user.click(screen.getByRole("button", { name: "Accept proposed assessment" }));
    expect(await screen.findByText(/Only a reviewer can approve or reject/)).toBeInTheDocument();
    expect(screen.queryByText(/Review saved/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Reviewer note/)).toHaveValue("Looks right to me.");
  });

  it("downloads a JSON report", async () => {
    const { user } = setup();
    await openCase(user, "C-101");
    const create = vi.fn(() => "blob:test");
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    await user.click(screen.getByRole("button", { name: /Download report/ }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    const blob = (create.mock.calls[0] as unknown as [Blob])[0];
    const text = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.readAsText(blob);
    });
    const report = JSON.parse(text);
    expect(report.case.id).toBe("C-101");
    expect(report.source).toBe("demo-data");
    expect(report.notice).toMatch(/not a tamper-proof record/);
  });
});

describe("live mode", () => {
  it("never claims a connection the backend did not confirm and does not fall back to mock data", async () => {
    localStorage.setItem("phishtrace.source", "live");
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));
    setup();
    expect(await screen.findByText(/Backend not connected/)).toBeInTheDocument();
    expect(screen.queryByText("Backend connected")).not.toBeInTheDocument();
    expect(screen.getByText("Mode: Unknown")).toBeInTheDocument();
    expect(await screen.findByText(/Cannot reach the backend/)).toBeInTheDocument();
    expect(screen.queryByText(/Password expires today/)).not.toBeInTheDocument();
  });

  it("shows connected only after a healthy response, with a friendly empty state", async () => {
    localStorage.setItem("phishtrace.source", "live");
    vi.stubGlobal("fetch", vi.fn((url: string) =>
      url.endsWith("/api/health") ? json({ status: "ok", executionMode: "agent" })
      : url.endsWith("/api/policies") ? json([{ id: "p", name: "Acme", version: "v1", ownDomains: [] }])
      : json([])));
    setup();
    expect(await screen.findByText("Backend connected")).toBeInTheDocument();
    expect(screen.getByText("Mode: Agent")).toBeInTheDocument();
    expect(await screen.findByText("No investigations yet")).toBeInTheDocument();
    expect(screen.getByText(/Upload an email above to get started/)).toBeInTheDocument();
  });
});

describe("review & impact", () => {
  async function goImpact(user: User) {
    await user.click(screen.getByRole("button", { name: "Review & impact" }));
    await screen.findByRole("heading", { name: "At a glance" });
  }
  const tileOf = (label: string) => screen.getAllByText(label)[0].parentElement!.parentElement!;

  it("leads with headline numbers and marks unmeasured values plainly", async () => {
    const { user } = setup();
    await goImpact(user);
    expect(tileOf("Reports investigated")).toHaveTextContent("5");
    expect(tileOf("Cases reviewed")).toHaveTextContent("1");
    expect(tileOf("Analyst review time per case")).toHaveTextContent("Not measured");
    expect(screen.getByText(/system and analyst are kept separate/)).toBeInTheDocument();
  });

  it("keeps the calculator collapsed, labels assumptions, and allows negative savings", async () => {
    const { user } = setup();
    await goImpact(user);
    const details = screen.getByText("Estimate time saved (optional)").closest("details")!;
    expect(details).not.toHaveAttribute("open");
    await user.click(screen.getByText("Estimate time saved (optional)"));
    await user.type(screen.getByLabelText(/Manual baseline minutes/), "5");
    await user.type(screen.getByLabelText(/Assisted review minutes/), "10");
    await user.type(screen.getByLabelText(/Analyst hourly cost/), "60");
    expect(screen.getAllByText(/5\.00 min additional \(negative savings\)/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Estimate only/)).toBeInTheDocument();
  });

  it("asks before clearing saved demo reviews", async () => {
    const { user } = setup();
    await openCase(user, "C-102");
    await user.click(screen.getByRole("button", { name: "Accept proposed assessment" }));
    await screen.findByText(/Review saved/);
    await user.click(screen.getByRole("button", { name: /All investigations/ }));
    await goImpact(user);
    await user.click(screen.getByRole("button", { name: /Clear saved demo reviews/ }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    expect(localStorage.getItem("phishtrace.demo.reviews")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: /Clear saved demo reviews/ }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Clear demo data" }));
    expect(localStorage.getItem("phishtrace.demo.reviews")).toBeNull();
  });
});
