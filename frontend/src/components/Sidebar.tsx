import { BarChart3, Layers, SearchCheck, ShieldCheck, type LucideIcon } from "lucide-react";

export type View = "investigations" | "related" | "impact";

const ITEMS: { view: View; label: string; icon: LucideIcon }[] = [
  { view: "investigations", label: "Investigations", icon: SearchCheck },
  { view: "related", label: "Related reports", icon: Layers },
  { view: "impact", label: "Review & impact", icon: BarChart3 },
];

export function Sidebar({ view, onNavigate }: { view: View; onNavigate: (v: View) => void }) {
  return (
    <aside className="on-dark bg-navy-900 text-slate-200 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0">
      <div className="flex items-center gap-3 px-5 py-4 lg:py-7">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white shadow-lift">
          <ShieldCheck className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <p className="text-lg font-semibold leading-tight tracking-tight text-white">PhishTrace</p>
          <p className="text-xs text-slate-300">Evidence-led email triage.</p>
        </div>
      </div>
      <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:pb-0">
        <p className="hidden px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 lg:block">Workspace</p>
        {ITEMS.map(({ view: v, label, icon: Icon }) => {
          const active = v === view;
          return (
            <button
              key={v}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onNavigate(v)}
              className={`flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? "bg-white/10 text-white ring-1 ring-inset ring-white/10" : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className={`h-[18px] w-[18px] ${active ? "text-teal-100" : ""}`} aria-hidden /> {label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
