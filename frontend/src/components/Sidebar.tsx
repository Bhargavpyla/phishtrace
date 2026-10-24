import { BarChart3, FolderOpen, Inbox, ShieldCheck, type LucideIcon } from "lucide-react";

export type View = "queue" | "case" | "impact";

const ITEMS: { view: View; label: string; icon: LucideIcon }[] = [
  { view: "queue", label: "Investigation Queue", icon: Inbox },
  { view: "case", label: "Case Workspace", icon: FolderOpen },
  { view: "impact", label: "Review & Impact", icon: BarChart3 },
];

export function Sidebar({ view, onNavigate }: { view: View; onNavigate: (v: View) => void }) {
  return (
    <aside className="on-dark bg-navy-900 text-slate-200 lg:min-h-screen lg:w-60 lg:shrink-0">
      <div className="flex items-center gap-3 px-4 py-4 lg:py-6">
        <ShieldCheck className="h-7 w-7 text-teal-100" aria-hidden />
        <div>
          <p className="text-base font-semibold leading-tight text-white">PhishTrace</p>
          <p className="text-xs text-slate-300">Evidence-led email triage.</p>
        </div>
      </div>
      <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:px-3 lg:pb-0">
        {ITEMS.map(({ view: v, label, icon: Icon }) => {
          const active = v === view;
          return (
            <button
              key={v}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onNavigate(v)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${
                active ? "bg-navy-700 text-white" : "text-slate-300 hover:bg-navy-800 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden /> {label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
