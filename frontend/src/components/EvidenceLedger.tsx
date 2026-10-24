import { ChevronDown } from "lucide-react";
import type { Evidence } from "../api/types";
import { formatTime } from "../lib/format";
import { OriginBadge } from "./Badges";
import { Button, Card, CardHeader, EmptyState } from "./ui";

/** Technical detail for one evidence entry: where it came from and how it was collected. */
export function EvidenceDetail({ ev, onOpenCase }: { ev: Evidence; onOpenCase: (id: string) => void }) {
  return (
    <div className="space-y-1.5">
      <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 text-xs text-slate-600">
        <dt className="font-medium">Source</dt><dd className="wrap-any font-mono">{ev.source || "Not recorded"}</dd>
        <dt className="font-medium">Method</dt><dd>{ev.method || "Not recorded"}</dd>
        <dt className="font-medium">Collected</dt><dd>{formatTime(ev.collectedAt)}</dd>
      </dl>
      {ev.reusedFrom && (
        <p className="flex flex-wrap items-center gap-1 text-xs text-slate-600">
          Reused from reviewed case
          <Button className="!rounded-lg !px-1.5 !py-0 text-xs" onClick={() => onOpenCase(ev.reusedFrom!.caseId)} aria-label={`Open source case ${ev.reusedFrom.caseId}`}>
            {ev.reusedFrom.caseId}/{ev.reusedFrom.evidenceId}
          </Button>
        </p>
      )}
      {ev.note && <p className="text-xs italic text-slate-600">{ev.note}</p>}
    </div>
  );
}

export function EvidenceEntry({ ev, open, highlighted, onToggle, onOpenCase }: {
  ev: Evidence; open: boolean; highlighted: boolean; onToggle: (id: string) => void; onOpenCase: (id: string) => void;
}) {
  return (
    <li
      id={`ledger-${ev.id}`}
      aria-current={highlighted ? "true" : undefined}
      className={`px-5 py-3 transition-colors ${highlighted ? "bg-teal-50 ring-2 ring-inset ring-teal-600" : ""}`}
    >
      <div className="flex flex-wrap items-start gap-2">
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-800">{ev.id}</span>
        <OriginBadge ev={ev} />
        <p className="wrap-any min-w-0 flex-1 basis-60 text-sm text-slate-900">{ev.observation}</p>
        <button type="button" onClick={() => onToggle(ev.id)} aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} details for evidence ${ev.id}`}
          className="inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-xs font-medium text-accent-700 hover:bg-accent-50">
          Details <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </div>
      {open && <div className="mt-2 rounded-xl bg-slate-50 p-3"><EvidenceDetail ev={ev} onOpenCase={onOpenCase} /></div>}
    </li>
  );
}

export function EvidenceLedger({ evidence, openIds, highlightedId, onToggle, onOpenCase }: {
  evidence: Evidence[]; openIds: Set<string>; highlightedId: string | null; onToggle: (id: string) => void; onOpenCase: (id: string) => void;
}) {
  const reused = evidence.filter((e) => e.origin === "reused").length;
  return (
    <Card aria-labelledby="ledger-title" className="overflow-hidden">
      <CardHeader id="ledger-title" title="Supporting evidence"
        subtitle={`${evidence.length} observations${reused ? ` · ${reused} reused from earlier cases` : ""}. Each one shows where it came from.`} />
      {evidence.length === 0 ? (
        <EmptyState title="No evidence recorded">Nothing was extracted from this email.</EmptyState>
      ) : (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {evidence.map((e) => (
            <EvidenceEntry key={e.id} ev={e} open={openIds.has(e.id)} highlighted={e.id === highlightedId} onToggle={onToggle} onOpenCase={onOpenCase} />
          ))}
        </ul>
      )}
    </Card>
  );
}
