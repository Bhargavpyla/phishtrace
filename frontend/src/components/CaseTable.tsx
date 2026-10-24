import { ChevronDown, ChevronRight, Layers } from "lucide-react";
import { Fragment, useState } from "react";
import type { CaseSummary } from "../api/types";
import { formatTime, orDash } from "../lib/format";
import { AssessmentBadge, ReviewBadge } from "./Badges";
import { Button } from "./ui";

interface Group { id: string; reason?: string; members: CaseSummary[] }
type Row = { kind: "case"; c: CaseSummary } | { kind: "group"; g: Group };

/** Groups of two or more cases sharing relatedGroupId become expandable "related reports" rows. */
function toRows(cases: CaseSummary[]): Row[] {
  const byGroup = new Map<string, CaseSummary[]>();
  for (const c of cases) if (c.relatedGroupId) byGroup.set(c.relatedGroupId, [...(byGroup.get(c.relatedGroupId) ?? []), c]);
  const rows: Row[] = [];
  const emitted = new Set<string>();
  for (const c of cases) {
    const gid = c.relatedGroupId;
    if (gid && (byGroup.get(gid)?.length ?? 0) > 1) {
      if (emitted.has(gid)) continue;
      emitted.add(gid);
      const members = byGroup.get(gid)!;
      rows.push({ kind: "group", g: { id: gid, reason: members.find((m) => m.relatedGroupReason)?.relatedGroupReason, members } });
    } else {
      rows.push({ kind: "case", c });
    }
  }
  return rows;
}

function CaseRow({ c, onOpen, indented }: { c: CaseSummary; onOpen: (id: string) => void; indented?: boolean }) {
  return (
    <tr className="border-t border-slate-100 align-top hover:bg-slate-50">
      <td className={`max-w-xs py-2 pr-3 ${indented ? "pl-9" : "pl-4"}`}>
        <span className="wrap-any block font-medium text-slate-900">{orDash(c.subject, "(no subject)")}</span>
        <span className="text-xs text-slate-500">{c.id}</span>
      </td>
      <td className="wrap-any max-w-[14rem] py-2 pr-3 text-slate-700">{orDash(c.sender)}</td>
      <td className="whitespace-nowrap py-2 pr-3 text-slate-700">{formatTime(c.receivedAt)}</td>
      <td className="py-2 pr-3">
        {c.investigationState === "running" ? <span className="text-xs text-slate-600">Investigation running</span>
          : c.investigationState === "failed" ? <span className="text-xs text-red-800">Investigation failed</span>
          : <AssessmentBadge value={c.proposed} />}
      </td>
      <td className="py-2 pr-3"><ReviewBadge value={c.reviewStatus} /></td>
      <td className="py-2 pr-3 text-xs text-slate-600">{c.relatedGroupId ?? "None"}</td>
      <td className="py-2 pr-4 text-right">
        <Button onClick={() => onOpen(c.id)} aria-label={`Open case ${c.id}: ${c.subject}`}>Open case</Button>
      </td>
    </tr>
  );
}

export function CaseTable({ cases, onOpen }: { cases: CaseSummary[]; onOpen: (id: string) => void }) {
  const rows = toRows(cases);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setCollapsed((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] text-left text-sm">
        <caption className="sr-only">Reported emails and their investigation status</caption>
        <thead className="text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="py-2 pl-4 pr-3 font-medium">Subject</th>
            <th scope="col" className="py-2 pr-3 font-medium">Sender</th>
            <th scope="col" className="py-2 pr-3 font-medium">Received</th>
            <th scope="col" className="py-2 pr-3 font-medium">Proposed assessment</th>
            <th scope="col" className="py-2 pr-3 font-medium">Review status</th>
            <th scope="col" className="py-2 pr-3 font-medium">Related group</th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            if (r.kind === "case") return <CaseRow key={r.c.id} c={r.c} onOpen={onOpen} />;
            const open = !collapsed.has(r.g.id);
            return (
              <Fragment key={r.g.id}>
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td colSpan={7} className="px-4 py-2">
                    <button type="button" aria-expanded={open} onClick={() => toggle(r.g.id)}
                      className="flex w-full items-start gap-2 text-left">
                      {open ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
                      <Layers className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" aria-hidden />
                      <span className="min-w-0">
                        <span className="font-medium text-slate-900">Related reports ({r.g.members.length}) · {r.g.id}</span>
                        {r.g.reason && <span className="block text-xs text-slate-600">Why grouped: {r.g.reason}</span>}
                      </span>
                    </button>
                  </td>
                </tr>
                {open && r.g.members.map((m) => <CaseRow key={m.id} c={m} onOpen={onOpen} indented />)}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
