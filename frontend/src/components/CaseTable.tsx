import { ChevronRight, Layers } from "lucide-react";
import type { CaseSummary } from "../api/types";
import { formatTime, orDash } from "../lib/format";
import { AssessmentBadge, ReviewBadge } from "./Badges";
import { Avatar } from "./ui";

const ACCENT = { suspicious: "bg-red-500", likely_benign: "bg-teal-500", needs_review: "bg-amber-400" } as const;

export function CaseTable({ cases, onOpen }: { cases: CaseSummary[]; onOpen: (id: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <caption className="sr-only">Recent investigations</caption>
        <thead className="text-xs font-medium uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="py-2.5 pl-5 pr-3">Email</th>
            <th scope="col" className="py-2.5 pr-3">Assessment</th>
            <th scope="col" className="py-2.5 pr-3">Review status</th>
            <th scope="col" className="hidden py-2.5 pr-3 lg:table-cell">Received</th>
            <th scope="col" className="py-2.5 pr-5 text-right"><span className="sr-only">Action</span></th>
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => (
            <tr key={c.id} className="group border-t border-slate-100 align-middle transition-colors hover:bg-accent-50/40">
              <td className="relative max-w-sm py-3 pl-5 pr-3">
                <span aria-hidden className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full ${ACCENT[c.proposed]}`} />
                <div className="flex items-center gap-3">
                  <Avatar sender={c.sender} />
                  <div className="min-w-0">
                    <span className="wrap-any block font-medium text-slate-900">{orDash(c.subject, "(no subject)")}</span>
                    <span className="wrap-any block text-xs text-slate-500">{orDash(c.sender)}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      {c.id}
                      {c.relatedGroupId && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-1.5 py-0.5 text-indigo-800">
                          <Layers className="h-3 w-3" aria-hidden /> Related · {c.relatedGroupId}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </td>
              <td className="py-3 pr-3">
                {c.investigationState === "running" ? <span className="text-xs text-slate-600">Investigation running</span>
                  : c.investigationState === "failed" ? <span className="text-xs text-red-800">Investigation failed</span>
                  : <AssessmentBadge value={c.proposed} />}
              </td>
              <td className="py-3 pr-3"><ReviewBadge value={c.reviewStatus} /></td>
              <td className="hidden whitespace-nowrap py-3 pr-3 text-slate-500 lg:table-cell">{formatTime(c.receivedAt)}</td>
              <td className="py-3 pr-5 text-right">
                <button type="button" onClick={() => onOpen(c.id)} aria-label={`Open case ${c.id}: ${c.subject}`}
                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 transition-colors hover:border-teal-600 hover:text-teal-800">
                  Open case <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
