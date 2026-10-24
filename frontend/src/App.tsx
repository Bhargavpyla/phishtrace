import { useState } from "react";
import { AppProvider, useApp } from "./api/context";
import { Sidebar, type View } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { CasePage } from "./pages/CasePage";
import { ImpactPage } from "./pages/ImpactPage";
import { QueuePage } from "./pages/QueuePage";
import { RelatedPage } from "./pages/RelatedPage";

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

  const navigate = (v: View) => { setView(v); setCaseId(null); };
  const openCase = (id: string) => { setCaseId(id); setView("investigations"); window.scrollTo?.({ top: 0 }); };
  const newInvestigation = () => {
    navigate("investigations");
    // After the page renders, bring the upload card into view and put focus on its browse button.
    window.setTimeout(() => {
      document.getElementById("upload-title")?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      (document.querySelector('[data-upload-browse]') as HTMLButtonElement | null)?.focus({ preventScroll: true });
    }, 50);
  };

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar view={view} onNavigate={navigate} onNewInvestigation={newInvestigation} />
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* subtle wash behind the page header */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-accent-100/60 via-teal-50/40 to-transparent" />
        <TopBar crumbs={[{ investigations: "Investigations", related: "Related reports", impact: "Review & impact" }[view], ...(view === "investigations" && caseId ? [`Case ${caseId}`] : [])]} />
        <main className="relative mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
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
