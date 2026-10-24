import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createDemoApi, type DemoApi } from "./demo";
import { createLiveApi } from "./live";
import type { Api, Health, Policy } from "./types";

export type Source = "demo" | "live";

const SOURCE_KEY = "phishtrace.source";
/** Backend base URL; configure with VITE_API_BASE_URL. Credentials never belong here. */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

interface AppState {
  api: Api;
  demo: DemoApi;
  source: Source;
  setSource: (s: Source) => void;
  health: Health | null;
  checkingHealth: boolean;
  recheck: () => void;
  policies: Policy[];
  policy: Policy | null;
  setPolicyId: (id: string) => void;
  /** Bumped after uploads/reviews so lists refetch. */
  dataVersion: number;
  bump: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}

function initialSource(): Source {
  try {
    const s = localStorage.getItem(SOURCE_KEY);
    if (s === "live" || s === "demo") return s;
  } catch { /* storage unavailable */ }
  return "demo";
}

export function AppProvider({ children, demoDelayMs }: { children: ReactNode; demoDelayMs?: number }) {
  const demo = useMemo(() => createDemoApi({ delayMs: demoDelayMs }), [demoDelayMs]);
  const live = useMemo(() => createLiveApi(API_BASE_URL), []);
  const [source, setSourceState] = useState<Source>(initialSource);
  const api: Api = source === "demo" ? demo : live;

  const [health, setHealth] = useState<Health | null>(null);
  const [checkingHealth, setChecking] = useState(false);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [policyId, setPolicyId] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const token = useRef(0);

  const recheck = useCallback(() => {
    const mine = ++token.current;
    setChecking(true);
    setHealth(null);
    setPolicies([]);
    api.health().then(async (h) => {
      if (mine !== token.current) return;
      setHealth(h);
      // Policies come from the same source; only ask a live backend once it confirmed it is up.
      if (api.source === "demo" || h.connected) {
        try {
          const p = await api.listPolicies();
          if (mine === token.current) setPolicies(p);
        } catch { /* leave the selector empty; the connection state already explains */ }
      }
    }).finally(() => { if (mine === token.current) setChecking(false); });
  }, [api]);

  useEffect(() => { recheck(); }, [recheck]);

  const setSource = (s: Source) => {
    try { localStorage.setItem(SOURCE_KEY, s); } catch { /* storage unavailable */ }
    setSourceState(s);
    setDataVersion((v) => v + 1);
  };

  const policy = policies.find((p) => p.id === policyId) ?? policies[0] ?? null;

  return (
    <Ctx.Provider value={{
      api, demo, source, setSource, health, checkingHealth, recheck, policies, policy,
      setPolicyId, dataVersion, bump: () => setDataVersion((v) => v + 1),
    }}>
      {children}
    </Ctx.Provider>
  );
}
