import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Runs `fn` whenever `deps` change. Data is cleared immediately on a dependency change and responses
 * from superseded requests are ignored, so results for one case can never show under another.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  const run = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const load = useCallback(() => {
    const mine = ++run.current;
    setState({ data: null, error: null, loading: true });
    fnRef.current().then(
      (data) => { if (mine === run.current) setState({ data, error: null, loading: false }); },
      (e: unknown) => { if (mine === run.current) setState({ data: null, error: e instanceof Error ? e.message : "Request failed.", loading: false }); },
    );
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); return () => { run.current++; }; }, deps);
  return { ...state, reload: load };
}
