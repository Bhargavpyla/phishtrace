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

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar view={view} onNavigate={navigate} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
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
