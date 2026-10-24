import { useEffect, useRef } from "react";
import type { Evidence } from "../api/types";
import { formatTime } from "../lib/format";
import { OriginBadge } from "./Badges";
import { Button, Card, CardHeader, EmptyState } from "./ui";

export function EvidenceEntry({ ev, highlighted, onOpenCase }: { ev: Evidence; highlighted: boolean; onOpenCase: (id: string) => void }) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (highlighted) {
      ref.current?.scrollIntoView?.({ block: "center", behavior: "smooth" });
      ref.current?.focus({ preventScroll: true });
    }
  }, [highlighted]);

  return (
    <li
      ref={ref}
      id={`ledger-${ev.id}`}
      tabIndex={-1}
      aria-current={highlighted ? "true" : undefined}
      className={`space-y-1.5 px-4 py-3 ${highlighted ? "bg-teal-50 ring-2 ring-inset ring-teal-600" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-800">{ev.id}</span>
        <OriginBadge ev={ev} />
        {ev.reusedFrom && (
          <span className="inline-flex items-center gap-1 text-xs text-slate-600">
            from
            <Button className="!px-1.5 !py-0 text-xs" onClick={() => onOpenCase(ev.reusedFrom!.caseId)}
              aria-label={`Open source case ${ev.reusedFrom.caseId}`}>
              {ev.reusedFrom.caseId}/{ev.reusedFrom.evidenceId}
            </Button>
          </span>
        )}
      </div>
      <p className="wrap-any text-sm text-slate-900">{ev.observation}</p>
      <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 text-xs text-slate-600">
        <dt className="font-medium">Source</dt><dd className="wrap-any font-mono">{ev.source || "Not recorded"}</dd>
        <dt className="font-medium">Method</dt><dd>{ev.method || "Not recorded"}</dd>
        <dt className="font-medium">Collected</dt><dd>{formatTime(ev.collectedAt)}</dd>
      </dl>
      {ev.note && <p className="text-xs italic text-slate-600">{ev.note}</p>}
    </li>
  );
}

export function EvidenceLedger({ evidence, highlightedId, onOpenCase }: { evidence: Evidence[]; highlightedId: string | null; onOpenCase: (id: string) => void }) {
  const reused = evidence.filter((e) => e.origin === "reused").length;
  return (
    <Card aria-labelledby="ledger-title">
      <CardHeader id="ledger-title" title="Evidence ledger"
        subtitle={`${evidence.length} entries · ${reused} reused from earlier cases · observations only, no confidence scores`} />
      {evidence.length === 0 ? (
        <EmptyState title="No evidence recorded">Nothing was extracted from this email.</EmptyState>
      ) : (
        <ul className="divide-y divide-slate-100">
          {evidence.map((e) => <EvidenceEntry key={e.id} ev={e} highlighted={e.id === highlightedId} onOpenCase={onOpenCase} />)}
        </ul>
      )}
    </Card>
  );
}
