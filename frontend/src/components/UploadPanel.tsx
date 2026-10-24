import { CircleAlert, CircleCheck, FileText, Loader2, RotateCcw, Upload, X } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { useApp } from "../api/context";
import { validateEml } from "../lib/format";
import { Button, Card, CardHeader, Notice } from "./ui";

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

let seq = 0;

export function UploadPanel({ onOpenCase }: { onOpenCase: (id: string) => void }) {
  const { api, source, policy, bump } = useApp();
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (e.dataTransfer.files.length) add(e.dataTransfer.files);
  }

  const runnable = items.filter((i) => !i.invalid && (i.status === "queued" || i.status === "failed"));
  const failedAfterRun = items.filter((i) => i.status === "failed" && !i.invalid);
  const doneCount = items.filter((i) => i.status === "done").length;

  async function investigate() {
    setRunning(true);
    for (const item of runnable) {
      patch(item.key, { status: "uploading", error: undefined });
      const r = await api.uploadEml(item.file, policy?.id);
      patch(item.key, r.ok
        ? { status: "done", caseId: r.caseId, duplicate: r.duplicate }
        : { status: "failed", error: r.error ?? "Upload failed." });
    }
    setRunning(false);
    bump();
  }

  return (
    <Card aria-labelledby="upload-title">
      <CardHeader id="upload-title" title="Investigate reported emails" subtitle="Drop one or several .eml files. Content is parsed, never opened or fetched." />
      <div className="space-y-3 p-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          data-testid="dropzone"
          className={`rounded-lg border-2 border-dashed p-6 text-center focus-within:ring-2 focus-within:ring-teal-600 ${dragging ? "border-teal-600 bg-teal-50" : "border-slate-300 bg-slate-50"}`}
        >
          <Upload className="mx-auto h-6 w-6 text-slate-500" aria-hidden />
          <p className="mt-2 text-sm text-slate-700">Drag and drop .eml files here, or</p>
          <label className="mt-1 inline-block cursor-pointer text-sm font-medium text-teal-700 underline">
            choose files
            <input ref={inputRef} type="file" multiple accept=".eml,message/rfc822" className="sr-only" aria-label="Choose .eml files"
              onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ""; }} />
          </label>
        </div>

        {source === "demo" && (
          <Notice tone="warn">Demo data is in use: uploads are validated here but not analysed. Switch to “Live backend” to investigate real emails.</Notice>
        )}

        {items.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-md border border-slate-200" aria-label="Selected files">
            {items.map((i) => (
              <li key={i.key} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                <span className="wrap-any min-w-0 flex-1">{i.file.name} <span className="text-xs text-slate-500">({Math.max(1, Math.round(i.file.size / 1024))} KB)</span></span>
                {i.status === "uploading" && <span className="inline-flex items-center gap-1 text-xs text-slate-600"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Investigating…</span>}
                {i.status === "done" && (
                  <span className="inline-flex items-center gap-2 text-xs text-teal-800">
                    <CircleCheck className="h-3.5 w-3.5" aria-hidden /> {i.duplicate ? "Duplicate of an existing case" : "Investigated"}
                    {i.caseId && <Button className="!px-2 !py-0.5 text-xs" onClick={() => onOpenCase(i.caseId!)}>Open case</Button>}
                  </span>
                )}
                {i.status === "failed" && (
                  <span role="alert" className="inline-flex max-w-full items-start gap-1 text-xs text-red-800">
                    <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> <span className="wrap-any">{i.error}</span>
                  </span>
                )}
                {!running && i.status !== "uploading" && (
                  <button type="button" aria-label={`Remove ${i.file.name}`} onClick={() => setItems((cur) => cur.filter((x) => x.key !== i.key))} className="rounded p-1 text-slate-500 hover:bg-slate-100">
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {!running && items.length > 0 && failedAfterRun.length > 0 && (
          <p role="status" className="text-sm text-amber-900">
            {doneCount} of {items.filter((i) => !i.invalid).length} files investigated; {failedAfterRun.length} failed. Failed files can be retried; the rest are unaffected.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={investigate} busy={running} disabled={runnable.length === 0}>
            {failedAfterRun.length > 0 && runnable.length === failedAfterRun.length
              ? <><RotateCcw className="h-4 w-4" aria-hidden /> Retry failed ({failedAfterRun.length})</>
              : <>Investigate{runnable.length > 0 ? ` (${runnable.length})` : ""}</>}
          </Button>
          {items.length > 0 && !running && <Button variant="ghost" onClick={() => setItems([])}>Clear list</Button>}
        </div>
      </div>
    </Card>
  );
}
