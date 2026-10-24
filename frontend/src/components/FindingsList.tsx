import type { Evidence, Finding } from "../api/types";
import { FindingTypeBadge } from "./Badges";
import { EvidenceDetail } from "./EvidenceLedger";
import { Card, CardHeader, EmptyState } from "./ui";

export function FindingsList({ findings, evidence, openIds, onToggle, onOpenCase }: {
  findings: Finding[]; evidence: Evidence[]; openIds: Set<string>; onToggle: (id: string) => void; onOpenCase: (id: string) => void;
}) {
  const byId = new Map(evidence.map((e) => [e.id, e]));
  return (
    <Card aria-labelledby="findings-title" className="overflow-hidden">
      <CardHeader id="findings-title" title="Why it was flagged" subtitle="Select an evidence ID to see where a point comes from." />
      {findings.length === 0 ? (
        <EmptyState title="Nothing was flagged">The investigation produced no findings for this email.</EmptyState>
      ) : (
        <ol className="divide-y divide-slate-100 border-t border-slate-100">
          {findings.map((f, i) => (
            <li key={f.id} className="flex gap-4 px-5 py-4">
              <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-50 text-sm font-semibold text-accent-700">{i + 1}</span>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="wrap-any min-w-0 text-sm font-semibold text-slate-900">{f.title}</h3>
                  <FindingTypeBadge type={f.type} />
                </div>
                {f.explanation && <p className="text-sm text-slate-600">{f.explanation}</p>}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-slate-500">Based on</span>
                  {f.evidenceIds.length === 0 && <span className="text-xs text-slate-500">no evidence cited</span>}
                  {f.evidenceIds.map((id) => (
                    <button key={id} type="button" onClick={() => onToggle(id)} aria-expanded={openIds.has(id)}
                      aria-label={`Show evidence ${id}`}
                      className={`rounded-lg border px-2 py-0.5 font-mono text-xs transition-colors ${openIds.has(id)
                        ? "border-teal-600 bg-teal-50 text-teal-900" : "border-slate-300 bg-white text-teal-800 hover:bg-teal-50"}`}>
                      {id}
                    </button>
                  ))}
                </div>
                {f.evidenceIds.filter((id) => openIds.has(id) && byId.has(id)).map((id) => (
                  <div key={id} className="rounded-xl border border-slate-200 bg-slate-50 p-3" data-testid={`inline-evidence-${id}`}>
                    <p className="wrap-any text-sm text-slate-900"><span className="mr-2 rounded-md bg-white px-1.5 py-0.5 font-mono text-xs font-semibold">{id}</span>{byId.get(id)!.observation}</p>
                    <div className="mt-2"><EvidenceDetail ev={byId.get(id)!} onOpenCase={onOpenCase} /></div>
                  </div>
                ))}
                {f.sourceDetail && (
                  <details className="text-xs text-slate-600">
                    <summary className="font-medium text-slate-700">Technical source details</summary>
                    <pre className="wrap-any mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-2">{f.sourceDetail}</pre>
                  </details>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
