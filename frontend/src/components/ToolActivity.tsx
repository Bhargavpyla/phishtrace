import { Loader2 } from "lucide-react";
import type { Case } from "../api/types";
import { formatDuration } from "../lib/format";
import { ToolStatusBadge } from "./Badges";

/** Tool events exactly as the backend reported them. Nothing is inferred or invented. */
export function ToolActivity({ c }: { c: Case }) {
  const used = c.toolEvents.length;
  const limit = c.toolLimit || 6;
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-slate-700">Tool calls: {used} of {limit}</p>
        <div role="progressbar" aria-label="Tool calls used" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(used, limit)}
          className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-teal-600" style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} />
        </div>
      </div>

      {c.investigationState === "running" && used === 0 && (
        <p role="status" className="flex items-center gap-2 text-sm text-slate-700">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Investigation running. The backend has not reported any tool events yet.
        </p>
      )}
      {c.investigationState === "failed" && <p role="alert" className="text-sm text-red-800">The investigation failed. Partial events, if any, are listed below.</p>}
      {c.investigationState !== "running" && used === 0 && (
        <p className="text-sm text-slate-600">
          No tool events were recorded.{c.mode === "rules_only" ? " This was a rules-only run: the model was not used, so no tools were called." : ""}
        </p>
      )}

      {used > 0 && (
        <ol className="space-y-2">
          {c.toolEvents.map((t, i) => (
            <li key={t.id} className="rounded-xl border border-slate-200 bg-white p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">{i + 1}.</span>
                <code className="text-sm font-medium text-slate-900">{t.tool}</code>
                <ToolStatusBadge status={t.status} />
                <span className="ml-auto text-xs text-slate-600">{formatDuration(t.durationMs)}</span>
              </div>
              {t.reason && <p className="mt-1 text-xs text-slate-700"><span className="font-medium">Why:</span> {t.reason}</p>}
              {t.resultSummary && <p className="wrap-any text-xs text-slate-700"><span className="font-medium">Result:</span> {t.resultSummary}</p>}
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs text-slate-500">Total investigation runtime: {formatDuration(c.runtimeMs)}</p>
    </div>
  );
}
