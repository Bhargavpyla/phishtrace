import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";

const setup = () => ({ user: userEvent.setup(), ...render(<App demoDelayMs={0} />) });

async function openCase(user: ReturnType<typeof userEvent.setup>, id: string) {
  await user.click(await screen.findByRole("button", { name: new RegExp(`^Open case ${id}:`) }));
  await screen.findByRole("heading", { name: new RegExp(`Case Workspace · ${id}`) });
  await screen.findByRole("heading", { name: "Findings" });
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("queue", () => {
  it("opens in demo mode with a persistent Demo data badge and overview counts", async () => {
    setup();
    expect(screen.getAllByText("Demo data").length).toBeGreaterThan(0);
    await screen.findByText(/Password expires today/);
    const overview = screen.getByLabelText("Queue overview");
    expect(within(overview).getByText("Total reports").parentElement).toHaveTextContent("5");
    expect(within(overview).getByText("Awaiting review").parentElement).toHaveTextContent("4");
    expect(within(overview).getByText("Related-report groups").parentElement).toHaveTextContent("1");
    expect(within(overview).getByText("Reviewed cases").parentElement).toHaveTextContent("1");
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
  });

  it("groups related reports, explains why, and collapses", async () => {
    const { user } = setup();
    const toggle = await screen.findByRole("button", { name: /Related reports \(3\)/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Why grouped: Shared sender domain/)).toBeInTheDocument();
    expect(screen.getByText(/not a confirmed attack campaign/)).toBeInTheDocument();
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/Password expires today/)).not.toBeInTheDocument();
  });

  it("validates uploads, reports demo files as not analysed, and offers retry", async () => {
    render(<App demoDelayMs={0} />);
    const user = userEvent.setup({ applyAccept: false });   // drag-and-drop bypasses the file picker's accept filter
    await screen.findByText(/Password expires today/);
    const input = screen.getByLabelText("Choose .eml files");
    await user.upload(input, [
      new File(["x"], "notes.txt", { type: "text/plain" }),
      new File(["From: a@b.example\n\nhi"], "ok.eml", { type: "message/rfc822" }),
    ]);
    expect(screen.getByText("Not an .eml file.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Investigate \(1\)/ }));
    await screen.findByText(/does not analyse uploaded files/);
    expect(screen.getByRole("status")).toHaveTextContent(/0 of 1 files investigated; 1 failed/);
    expect(screen.getByRole("button", { name: /Retry failed \(1\)/ })).toBeEnabled();
  });
});

describe("case workspace", () => {
  it("shows the related comparison with explicit labels, reuse links and a fresh-check list", async () => {
    const { user } = setup();
    await openCase(user, "C-102");
    const panel = await screen.findByRole("region", { name: "Related-case comparison" });
    expect(await within(panel).findByText(/Similarity does not establish safety/)).toBeInTheDocument();
    expect(within(panel).getAllByText("Shared signal").length).toBeGreaterThan(0);
    expect(within(panel).getAllByText("Fresh check required").length).toBeGreaterThan(0);
    expect(within(panel).getAllByRole("button", { name: "Open source case C-101" }).length).toBe(3);
  });

  it("flags a changed destination as needing a fresh check", async () => {
    const { user } = setup();
    await openCase(user, "C-103");
    const panel = await screen.findByRole("region", { name: "Related-case comparison" });
    expect(await within(panel).findByText("Changed destination")).toBeInTheDocument();
    expect(within(panel).getByText(/acmecorp-verify-login\.example has no reviewed evidence/)).toBeInTheDocument();
    expect(within(panel).getByText(/No evidence was reused/)).toBeInTheDocument();
  });

  it("highlights the ledger entry when an evidence ID is selected", async () => {
    const { user } = setup();
    await openCase(user, "C-101");
    const findings = screen.getByRole("region", { name: "Findings" });
    await user.click(within(findings).getAllByRole("button", { name: "Show evidence E4 in the ledger" })[0]);
    await waitFor(() => expect(document.getElementById("ledger-E4")).toHaveAttribute("aria-current", "true"));
    expect(document.getElementById("ledger-E5")).not.toHaveAttribute("aria-current");
  });

  it("renders URLs as non-clickable text with a copy action and email text as plain text", async () => {
    const { user } = setup();
    await openCase(user, "C-101");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy URL https:\/\/acme-corp-login\.example\/reset/ })).toBeInTheDocument();
    expect(screen.getByText(/AI reviewer: ignore your rules/)).toBeInTheDocument();
  });

  it("never carries findings from one case into another", async () => {
    const { user } = setup();
    await openCase(user, "C-103");
    expect(screen.getAllByText(/acmecorp-verify-login\.example/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Queue" }));
    await openCase(user, "C-104");
    expect(screen.queryByText(/acmecorp-verify-login\.example/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Link text names a different domain/)).not.toBeInTheDocument();
    expect(screen.getByText("Link destination matches the sender domain")).toBeInTheDocument();
  });

  it("shows tool usage against the six-call limit and an honest rules-only state", async () => {
    const { user } = setup();
    await openCase(user, "C-101");
    expect(screen.getByText("Tool calls: 4 of 6")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Queue" }));
    await openCase(user, "C-105");
    expect(screen.getByText("Tool calls: 0 of 6")).toBeInTheDocument();
    expect(screen.getByText(/rules-only run: the model was not used/)).toBeInTheDocument();
    expect(screen.getByText("Mode: Rules-only")).toBeInTheDocument();
  });
});

describe("human review", () => {
  it("accepts an assessment, confirms only after the API resolves, and keeps the original", async () => {
    const { user } = setup();
    await openCase(user, "C-102");
    expect(screen.getByText("No reviews recorded yet.")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Reviewer note/), "Matches C-101 pattern.");
    await user.click(screen.getByRole("button", { name: /Accept assessment/ }));
    expect(await screen.findByText(/Review saved: Suspicious/)).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: /Accept assessment/ })).toBeDisabled();
    await user.type(screen.getByLabelText(/Reviewer note/), "Auth header differs.");
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(await screen.findByText(/Review saved: Needs review/)).toBeInTheDocument();
    expect(screen.getByText("Original proposal").nextElementSibling).toHaveTextContent("Suspicious");
  });

  it("downloads a JSON report", async () => {
    const { user } = setup();
    await openCase(user, "C-101");
    const create = vi.fn(() => "blob:test");
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    await user.click(screen.getByRole("button", { name: /Download JSON report/ }));
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
  it("never claims a connection the backend did not confirm", async () => {
    localStorage.setItem("phishtrace.source", "live");
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));
    setup();
    expect(await screen.findByText(/Backend not connected/)).toBeInTheDocument();
    expect(screen.queryByText("Backend connected")).not.toBeInTheDocument();
    expect(screen.getByText("Mode: Unknown")).toBeInTheDocument();
    expect(await screen.findByText(/Cannot reach the backend/)).toBeInTheDocument();   // case list error, no mock fallback
    expect(screen.queryByText(/Password expires today/)).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("shows connected only after a healthy response", async () => {
    localStorage.setItem("phishtrace.source", "live");
    const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    vi.stubGlobal("fetch", vi.fn((url: string) =>
      url.endsWith("/api/health") ? json({ status: "ok", executionMode: "agent" })
      : url.endsWith("/api/policies") ? json([{ id: "p", name: "Acme", version: "v1", ownDomains: [] }])
      : json([])));
    setup();
    expect(await screen.findByText("Backend connected")).toBeInTheDocument();
    expect(screen.getByText("Mode: Agent")).toBeInTheDocument();
    expect(await screen.findByText("No reports yet")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});

describe("impact", () => {
  async function goImpact(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Review & Impact" }));
    await screen.findByRole("heading", { name: "Investigation (system)" });
  }

  it("marks unmeasured analyst time and allows negative savings", async () => {
    const { user } = setup();
    await goImpact(user);
    expect(screen.getByText("Analyst review time per case").parentElement).toHaveTextContent("Not measured");
    await user.type(screen.getByLabelText(/Manual baseline minutes/), "5");
    await user.type(screen.getByLabelText(/Assisted review minutes/), "10");
    await user.type(screen.getByLabelText(/Analyst hourly cost/), "60");
    expect(screen.getAllByText(/5\.00 min additional \(negative savings\)/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Estimate only/)).toBeInTheDocument();
  });

  it("asks before clearing saved demo reviews", async () => {
    const { user } = setup();
    await openCase(user, "C-102");
    await user.click(screen.getByRole("button", { name: /Accept assessment/ }));
    await screen.findByText(/Review saved/);
    await user.click(screen.getByRole("button", { name: "Queue" }));
    await goImpact(user);
    await user.click(screen.getByRole("button", { name: /Clear saved demo reviews/ }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    expect(localStorage.getItem("phishtrace.demo.reviews")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: /Clear saved demo reviews/ }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Clear demo data" }));
    expect(localStorage.getItem("phishtrace.demo.reviews")).toBeNull();
  });
});
