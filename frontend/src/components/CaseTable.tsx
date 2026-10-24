import { Layers } from "lucide-react";
import type { CaseSummary } from "../api/types";
import { formatTime, orDash } from "../lib/format";
import { AssessmentBadge, ReviewBadge } from "./Badges";
import { Button } from "./ui";

export function CaseTable({ cases, onOpen }: { cases: CaseSummary[]; onOpen: (id: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <caption className="sr-only">Recent investigations</caption>
        <thead className="text-xs font-medium uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="py-2.5 pl-5 pr-3">Subject</th>
            <th scope="col" className="py-2.5 pr-3">Sender</th>
            <th scope="col" className="py-2.5 pr-3">Assessment</th>
            <th scope="col" className="py-2.5 pr-3">Review status</th>
            <th scope="col" className="hidden py-2.5 pr-3 lg:table-cell">Received</th>
            <th scope="col" className="py-2.5 pr-5 text-right"><span className="sr-only">Action</span></th>
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => (
            <tr key={c.id} className="border-t border-slate-100 align-top transition-colors hover:bg-slate-50/80">
              <td className="max-w-xs py-3 pl-5 pr-3">
                <span className="wrap-any block font-medium text-slate-900">{orDash(c.subject, "(no subject)")}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {c.id}
                  {c.relatedGroupId && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-1.5 py-0.5 text-indigo-800">
                      <Layers className="h-3 w-3" aria-hidden /> Related · {c.relatedGroupId}
                    </span>
                  )}
                </span>
              </td>
              <td className="wrap-any max-w-[13rem] py-3 pr-3 text-slate-700">{orDash(c.sender)}</td>
              <td className="py-3 pr-3">
                {c.investigationState === "running" ? <span className="text-xs text-slate-600">Investigation running</span>
                  : c.investigationState === "failed" ? <span className="text-xs text-red-800">Investigation failed</span>
                  : <AssessmentBadge value={c.proposed} />}
              </td>
              <td className="py-3 pr-3"><ReviewBadge value={c.reviewStatus} /></td>
              <td className="hidden whitespace-nowrap py-3 pr-3 text-slate-600 lg:table-cell">{formatTime(c.receivedAt)}</td>
              <td className="py-3 pr-5 text-right">
                <Button onClick={() => onOpen(c.id)} aria-label={`Open case ${c.id}: ${c.subject}`}>Open case</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
