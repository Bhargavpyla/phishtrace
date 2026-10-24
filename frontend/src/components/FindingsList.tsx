import type { Finding } from "../api/types";
import { FindingTypeBadge } from "./Badges";
import { Card, CardHeader, EmptyState } from "./ui";

export function FindingsList({ findings, onSelectEvidence }: { findings: Finding[]; onSelectEvidence: (id: string) => void }) {
  return (
    <Card aria-labelledby="findings-title">
      <CardHeader id="findings-title" title="Findings" subtitle="Each finding cites evidence. A citation shows where something came from; it does not prove the conclusion." />
      {findings.length === 0 ? (
        <EmptyState title="No findings recorded">The investigation produced no findings for this case.</EmptyState>
      ) : (
        <ul className="divide-y divide-slate-100">
          {findings.map((f) => (
            <li key={f.id} className="space-y-2 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="wrap-any min-w-0 text-sm font-medium text-slate-900">{f.title}</h3>
                <FindingTypeBadge type={f.type} />
              </div>
              {f.explanation && <p className="text-sm text-slate-700">{f.explanation}</p>}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-500">Evidence:</span>
                {f.evidenceIds.length === 0 && <span className="text-xs text-slate-500">none cited</span>}
                {f.evidenceIds.map((id) => (
                  <button key={id} type="button" onClick={() => onSelectEvidence(id)}
                    aria-label={`Show evidence ${id} in the ledger`}
                    className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-xs text-teal-800 hover:bg-teal-50">
                    {id}
                  </button>
                ))}
              </div>
              {f.sourceDetail && (
                <details className="text-xs text-slate-600">
                  <summary className="cursor-pointer font-medium text-slate-700">Source details</summary>
                  <pre className="wrap-any mt-1 whitespace-pre-wrap rounded bg-slate-50 p-2">{f.sourceDetail}</pre>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
