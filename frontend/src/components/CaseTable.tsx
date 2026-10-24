import { ChevronRight, Layers } from "lucide-react";
import type { CaseSummary } from "../api/types";
import { formatRelativeTime, formatTime, orDash } from "../lib/format";
import { AssessmentBadge, ReviewBadge } from "./Badges";
import { Avatar } from "./ui";

const ACCENT = {
  suspicious: "bg-red-500",
  likely_benign: "bg-teal-500",
  needs_review: "bg-amber-400",
} as const;

export function CaseTable({ cases, onOpen }: { cases: CaseSummary[]; onOpen: (id: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <caption className="sr-only">Recent investigations</caption>
        <thead className="sticky top-16 z-10 bg-white/95 backdrop-blur border-b border-slate-200 text-xs font-medium uppercase tracking-wide text-slate-500 shadow-sm">
          <tr>
            <th scope="col" className="w-1/2 min-w-[360px] py-3 pl-5 pr-3">Email</th>
            <th scope="col" className="whitespace-nowrap py-3 pr-3">Assessment</th>
            <th scope="col" className="whitespace-nowrap py-3 pr-3">Review status</th>
            <th scope="col" className="whitespace-nowrap py-3 pr-3">Received</th>
            <th scope="col" className="whitespace-nowrap py-3 pr-5 text-right">
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {cases.map((c) => {
            const isUnreviewed = c.reviewStatus === "unreviewed";
            return (
              <tr
                key={c.id}
                onClick={() => onOpen(c.id)}
                className={`group align-middle transition-colors cursor-pointer ${
                  isUnreviewed
                    ? "bg-white hover:bg-slate-50"
                    : "bg-slate-50/40 hover:bg-slate-100/60"
                }`}
              >
                <td className="relative w-1/2 min-w-[360px] py-3 pl-5 pr-3">
                  <span
                    aria-hidden
                    className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full ${ACCENT[c.proposed]}`}
                  />
                  <div className="flex items-center gap-3">
                    <Avatar sender={c.sender} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                          {c.id}
                        </span>
                        <span
                          className={`wrap-any truncate ${
                            isUnreviewed ? "font-semibold text-slate-900" : "font-normal text-slate-700"
                          }`}
                        >
                          {orDash(c.subject, "(no subject)")}
                        </span>
                        {c.relatedGroupId && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-800 shrink-0">
                            <Layers className="h-3 w-3" aria-hidden /> Related · {c.relatedGroupId}
                          </span>
                        )}
                      </div>
                      <span className="wrap-any block text-xs text-slate-500 mt-0.5 truncate">
                        {orDash(c.sender)}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap py-3 pr-3">
                  {c.investigationState === "running" ? (
                    <span className="text-xs text-slate-600">Investigation running</span>
                  ) : c.investigationState === "failed" ? (
                    <span className="text-xs text-red-800">Investigation failed</span>
                  ) : (
                    <AssessmentBadge value={c.proposed} />
                  )}
                </td>
                <td className="whitespace-nowrap py-3 pr-3">
                  <ReviewBadge value={c.reviewStatus} />
                </td>
                <td className="whitespace-nowrap py-3 pr-3 text-slate-500">
                  <div title={formatTime(c.receivedAt)} className="cursor-default">
                    <span className="text-xs font-medium text-slate-700 block">
                      {formatRelativeTime(c.receivedAt)}
                    </span>
                    <span className="block text-[11px] text-slate-400">
                      {formatTime(c.receivedAt)}
                    </span>
                  </div>
                </td>
                <td className="whitespace-nowrap py-3 pr-5 text-right">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(c.id);
                    }}
                    aria-label={`Open case ${c.id}: ${c.subject}`}
                    className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 transition-colors hover:border-teal-600 hover:text-teal-800"
                  >
                    Open case <ChevronRight className="h-4 w-4" aria-hidden />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
