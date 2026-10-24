import { useState } from "react";
import { AppProvider, useApp } from "./api/context";
import { Sidebar, type View } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { CasePage } from "./pages/CasePage";
import { ImpactPage } from "./pages/ImpactPage";
import { QueuePage } from "./pages/QueuePage";

function Shell() {
  const { source } = useApp();
  const [view, setView] = useState<View>("queue");
  const [caseId, setCaseId] = useState<string | null>(null);

  // Case ids belong to one data source; never carry a selection across.
  const [lastSource, setLastSource] = useState(source);
  if (lastSource !== source) {
    setLastSource(source);
    setCaseId(null);
    setView("queue");
  }

  const openCase = (id: string) => { setCaseId(id); setView("case"); };

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar view={view} onNavigate={setView} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
          {view === "queue" && <QueuePage onOpenCase={openCase} />}
          {view === "case" && <CasePage caseId={caseId} onOpenCase={openCase} onBack={() => setView("queue")} />}
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
