import { CircleCheck, Download, FlaskConical, UserCheck } from "lucide-react";
import { useState } from "react";
import { useApp } from "../api/context";
import type { Assessment, Case } from "../api/types";
import { downloadBlob, formatTime } from "../lib/format";
import { ASSESSMENT_LABEL } from "../lib/labels";
import { AssessmentBadge, ReviewBadge } from "./Badges";
import { Button, Card, CardHeader, Disclosure, ErrorNotice, Notice } from "./ui";

export function ReviewPanel({ c, onSaved }: { c: Case; onSaved: (updated: Case) => void }) {
  const { api, source, bump } = useApp();
  const [selected, setSelected] = useState<Assessment>(c.proposed);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const changed = selected !== c.proposed;

  async function submit(assessment: Assessment) {
    if (busy) return;   // one submission at a time
    setBusy(true); setError(null); setSaved(null);
    try {
      const updated = await api.submitReview(c.id, { assessment, note: note.trim(), policyVersion: c.policyVersion });
      onSaved(updated);
      bump();
      setNote("");
      setSaved(`Review saved: ${ASSESSMENT_LABEL[assessment]}.`);   // shown only after the API confirmed
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the review.");   // the note is kept so nothing is lost
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    if (reportBusy) return;
    setReportBusy(true); setReportError(null);
    try {
      const f = await api.downloadReport(c.id);
      downloadBlob(f.filename, f.blob);
    } catch (e) {
      setReportError(e instanceof Error ? e.message : "Could not download the report.");
    } finally {
      setReportBusy(false);
    }
  }

  return (
    <Card aria-labelledby="review-title" className="overflow-hidden">
      <CardHeader id="review-title" title="What needs your review" icon={<UserCheck className="h-4 w-4" aria-hidden />}
        subtitle="Accept or change the proposal. The original is always kept." />
      <div className="space-y-4 px-5 pb-5">
        {source === "demo" && (
          <Notice tone="warn"><FlaskConical className="mr-1 inline h-3.5 w-3.5" aria-hidden />Demo only: saved in this browser, not sent anywhere.</Notice>
        )}

        <dl className="grid grid-cols-[auto,1fr] items-center gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-3 text-sm">
          <dt className="text-slate-600">Original proposal</dt><dd><AssessmentBadge value={c.proposed} /></dd>
          <dt className="text-slate-600">Reviewed decision</dt>
          <dd className="flex flex-wrap items-center gap-2">
            {c.reviewedAssessment ? <><AssessmentBadge value={c.reviewedAssessment} /><ReviewBadge value="reviewed" /></> : <ReviewBadge value="unreviewed" />}
          </dd>
        </dl>

        <div className="space-y-3">
          <div>
            <label htmlFor="review-assessment" className="block text-xs font-medium text-slate-700">Change assessment</label>
            <select id="review-assessment" value={selected} onChange={(e) => setSelected(e.target.value as Assessment)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
              {(Object.keys(ASSESSMENT_LABEL) as Assessment[]).map((a) => <option key={a} value={a}>{ASSESSMENT_LABEL[a]}{a === c.proposed ? " (proposed)" : ""}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="review-note" className="block text-xs font-medium text-slate-700">
              Reviewer note {changed ? <span className="text-amber-900">(required when changing the assessment)</span> : "(optional)"}
            </label>
            <textarea id="review-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" busy={busy} disabled={changed} onClick={() => submit(c.proposed)}
              title={changed ? "Set the selector back to the proposed assessment to accept it" : undefined}>
              <CircleCheck className="h-4 w-4" aria-hidden /> Accept proposed assessment
            </Button>
            <Button busy={busy} disabled={!changed || !note.trim()} onClick={() => submit(selected)}>Confirm review</Button>
          </div>
        </div>

        {error && <ErrorNotice title="Review not saved. Your note is still here." message={error} />}
        {saved && <p role="status" className="flex items-center gap-1.5 rounded-xl bg-teal-50 px-3 py-2 text-sm font-medium text-teal-800"><CircleCheck className="h-4 w-4" aria-hidden /> {saved}</p>}

        <div className="border-t border-slate-100 pt-4">
          <Button onClick={download} busy={reportBusy}><Download className="h-4 w-4" aria-hidden /> Download report (JSON)</Button>
          {reportError && <div className="mt-2"><ErrorNotice title="Report not downloaded" message={reportError} /></div>}
        </div>

        <Disclosure title={`Review history (${c.reviews.length})`}>
          <p className="mb-2 text-xs text-slate-500">Audit history of reviews, not a tamper-proof record.</p>
          {c.reviews.length === 0 ? (
            <p className="text-sm text-slate-600">No reviews recorded yet.</p>
          ) : (
            <ol className="space-y-2">
              {c.reviews.map((r) => (
                <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-2.5 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <AssessmentBadge value={r.originalAssessment} /><span aria-hidden>→</span><span className="sr-only">reviewed as</span>
                    <AssessmentBadge value={r.reviewedAssessment} />
                    {r.demoOnly && <span className="rounded-full border border-indigo-200 bg-indigo-50 px-1.5 text-xs text-indigo-900">Demo-only</span>}
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{formatTime(r.at)} · {r.reviewer} · policy {r.policyVersion}</p>
                  <p className="wrap-any mt-1 text-slate-800">{r.note || "No note."}</p>
                </li>
              ))}
            </ol>
          )}
        </Disclosure>
      </div>
    </Card>
  );
}
