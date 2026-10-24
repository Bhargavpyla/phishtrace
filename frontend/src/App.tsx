import { useState } from "react";
import { AppProvider, useApp } from "./api/context";
import { Sidebar, type View } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { CasePage } from "./pages/CasePage";
import { ImpactPage } from "./pages/ImpactPage";
import { QueuePage } from "./pages/QueuePage";
import { RelatedPage } from "./pages/RelatedPage";

const VIEW_LABEL: Record<View, string> = { investigations: "Investigations", related: "Related reports", impact: "Review & impact" };

function Shell() {
  const { source } = useApp();
  const [view, setView] = useState<View>("investigations");
  const [caseId, setCaseId] = useState<string | null>(null);

  // Case ids belong to one data source; never carry a selection across.
  const [lastSource, setLastSource] = useState(source);
  if (lastSource !== source) {
    setLastSource(source);
    setCaseId(null);
    setView("investigations");
  }

  const navigate = (v: View) => {
    setView(v);
    setCaseId(null);
  };

  const openCase = (id: string) => {
    setCaseId(id);
    setView("investigations");
    window.scrollTo?.({ top: 0 });
  };

  const newInvestigation = () => {
    navigate("investigations");
    // After the page renders, bring the upload card into view and put focus on its browse button.
    window.setTimeout(() => {
      document.getElementById("upload-title")?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      (document.querySelector("[data-upload-browse]") as HTMLButtonElement | null)?.focus({ preventScroll: true });
    }, 50);
  };

  const crumbs = [VIEW_LABEL[view], ...(view === "investigations" && caseId ? [`Case ${caseId}`] : [])];

  return (
    <div className="min-h-screen bg-canvas lg:flex">
      {/* vertical menu on the left (a compact row on small screens) */}
      <Sidebar view={view} onNavigate={navigate} onNewInvestigation={newInvestigation} />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-accent-100/60 via-teal-50/40 to-transparent" />
        <TopBar crumbs={crumbs} />
        <main className="relative mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {view === "investigations" && (caseId
            ? <CasePage caseId={caseId} onOpenCase={openCase} onBack={() => setCaseId(null)} />
            : <QueuePage onOpenCase={openCase} />)}
          {view === "related" && <RelatedPage onOpenCase={openCase} />}
          {view === "impact" && <ImpactPage />}
        </main>
      </div>
    </div>
  );
}

export function App({ demoDelayMs }: { demoDelayMs?: number }) {
  return (
    <AppProvider demoDelayMs={demoDelayMs}>
      <Shell />
    </AppProvider>
  );
}
