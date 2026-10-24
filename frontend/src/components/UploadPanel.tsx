import { CircleAlert, CircleCheck, FileText, Loader2, RotateCcw, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { useApp } from "../api/context";
import { validateEml } from "../lib/format";
import { Button } from "./ui";

type ItemStatus = "queued" | "uploading" | "done" | "failed";
interface Item {
  key: string;
  file: File;
  invalid: string | null;
  status: ItemStatus;
  error?: string;
  caseId?: string;
  duplicate?: boolean;
}

const STEPS = ["Upload email", "Investigate", "Understand findings", "Review & export"];
let seq = 0;

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2" aria-label="Investigation steps">
      {STEPS.map((s, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "current" : "todo";
        return (
          <li key={s} aria-current={state === "current" ? "step" : undefined} className="flex items-center gap-2">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
              state === "done" ? "bg-teal-100 text-teal-800" : state === "current" ? "bg-white text-navy-900" : "bg-white/15 text-slate-200"}`}>
              {state === "done" ? <CircleCheck className="h-4 w-4" aria-hidden /> : n}
            </span>
            <span className={`text-sm ${state === "todo" ? "text-slate-300" : "font-medium text-white"}`}>{s}</span>
            {n < STEPS.length && <span aria-hidden className="mx-1 hidden h-px w-5 bg-white/25 sm:block" />}
          </li>
        );
      })}
    </ol>
  );
}

export function UploadPanel({ onOpenCase }: { onOpenCase: (id: string) => void }) {
  const { api, source, policy, bump } = useApp();
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!running) return;
    setElapsed(0);
    const t = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [running]);

  const patch = (key: string, p: Partial<Item>) => setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...p } : i)));

  function add(files: FileList | File[]) {
    const next = Array.from(files).map<Item>((file) => {
      const invalid = validateEml(file);
      return { key: `f${++seq}`, file, invalid, status: invalid ? "failed" : "queued", error: invalid ?? undefined };
    });
    setItems((cur) => [...cur, ...next]);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (!running && e.dataTransfer.files.length) add(e.dataTransfer.files);
  }

  const runnable = items.filter((i) => !i.invalid && (i.status === "queued" || i.status === "failed"));
  const failedAfterRun = items.filter((i) => i.status === "failed" && !i.invalid);
  const doneItems = items.filter((i) => i.status === "done");
  const active = items.find((i) => i.status === "uploading");
  const step = items.length > 0 || running ? 2 : 1;

  async function investigate() {
    if (running) return;   // prevents duplicate submissions
    setRunning(true);
    const opened: { caseId: string }[] = [];
    for (const item of runnable) {
      patch(item.key, { status: "uploading", error: undefined });
      const r = await api.uploadEml(item.file, policy?.id);
      patch(item.key, r.ok
        ? { status: "done", caseId: r.caseId, duplicate: r.duplicate }
        : { status: "failed", error: r.error ?? "Upload failed." });
      if (r.ok && r.caseId) opened.push({ caseId: r.caseId });
    }
    setRunning(false);
    bump();
    if (opened.length === 1 && runnable.length === 1) onOpenCase(opened[0].caseId);   // single file: go straight to the result
  }

  const label = failedAfterRun.length > 0 && runnable.length === failedAfterRun.length
    ? <><RotateCcw className="h-4 w-4" aria-hidden /> Retry failed ({failedAfterRun.length})</>
    : <>Start investigation{runnable.length > 1 ? ` (${runnable.length} files)` : ""}</>;

  return (
    <section aria-labelledby="upload-title" className="overflow-hidden rounded-2xl bg-gradient-to-br from-navy-900 via-navy-800 to-accent-700 shadow-lift">
      <div className="px-5 pb-4 pt-5 text-white sm:px-6">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
          <div>
            <h2 id="upload-title" className="text-xl font-semibold tracking-tight">Investigate an email</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-200">Upload an .eml file. PhishTrace gathers evidence and proposes the next action for a reviewer.</p>
          </div>
          <Stepper current={step} />
        </div>
      </div>

      <div className="space-y-3 rounded-t-2xl bg-white p-4 sm:p-5">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          data-testid="dropzone"
          className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-5 py-5 text-center transition-colors sm:flex-row sm:text-left ${dragging ? "border-teal-600 bg-teal-50" : "border-slate-300 bg-slate-50/70"}`}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Upload className="h-6 w-6" aria-hidden /></span>
          <div className="flex-1">
            <p className="text-base font-semibold text-slate-900">Drag and drop an .eml file here</p>
            <p className="text-sm text-slate-500">
              A saved email, up to 1 MB. It is read as text: links are never opened and attachments are never run.
            </p>
          </div>
          <Button variant="primary" data-upload-browse onClick={() => inputRef.current?.click()} disabled={running}>Browse files</Button>
          <input ref={inputRef} type="file" multiple accept=".eml,message/rfc822" className="hidden" tabIndex={-1} aria-label="Choose .eml files"
            onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ""; }} />
        </div>

        {source === "demo" && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">Demo data is on, so uploads are checked but not analysed. Open a sample case below, or switch to “Live backend”.</p>
        )}

        {items.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200" aria-label="Selected files">
            {items.map((i) => (
              <li key={i.key} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                <span className="wrap-any min-w-0 flex-1 font-medium text-slate-800">{i.file.name} <span className="text-xs font-normal text-slate-500">({Math.max(1, Math.round(i.file.size / 1024))} KB)</span></span>
                {i.status === "uploading" && <span className="inline-flex items-center gap-1 text-xs text-slate-600"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Investigating…</span>}
                {i.status === "done" && (
                  <span className="inline-flex items-center gap-2 text-xs text-teal-800">
                    <CircleCheck className="h-3.5 w-3.5" aria-hidden /> {i.duplicate ? "Already uploaded; existing case" : "Investigated"}
                    {i.caseId && <Button className="!rounded-lg !px-2 !py-0.5 text-xs" onClick={() => onOpenCase(i.caseId!)}>Open case</Button>}
                  </span>
                )}
                {i.status === "failed" && (
                  <span role="alert" className="inline-flex max-w-full items-start gap-1 text-xs text-red-800">
                    <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> <span className="wrap-any">{i.error}</span>
                  </span>
                )}
                {!running && i.status !== "uploading" && (
                  <button type="button" aria-label={`Remove ${i.file.name}`} onClick={() => setItems((cur) => cur.filter((x) => x.key !== i.key))}
                    className="rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-100">
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {running && (
          <p role="status" className="flex items-start gap-2 rounded-xl bg-accent-50 px-3 py-2 text-sm text-accent-700">
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden />
            <span>
              Investigating {active?.file.name ?? "your email"}… {elapsed}s elapsed. This can take up to a minute; the backend
              doesn’t report step-by-step progress.
            </span>
          </p>
        )}
        {!running && failedAfterRun.length > 0 && (
          <p role="status" className="text-sm text-amber-900">
            {doneItems.length} of {items.filter((i) => !i.invalid).length} files investigated; {failedAfterRun.length} failed. Your files are kept so you can retry.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={investigate} busy={running} disabled={runnable.length === 0}>{label}</Button>
          {items.length > 0 && !running && <Button variant="ghost" onClick={() => setItems([])}>Clear list</Button>}
          {items.length === 0 && <span className="text-xs text-slate-500">Choose a file to enable “Start investigation”.</span>}
        </div>
      </div>
    </section>
  );
}
