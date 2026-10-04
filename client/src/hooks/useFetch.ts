import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errMsg } from '../lib/api';

/** GET helper with loading / error / reload, abort on unmount or dependency change. */
export function useFetch<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const first = useRef(true);

  useEffect(() => {
    if (path === null) { setLoading(false); return; }
    const ctrl = new AbortController();
    setLoading(true); setError('');
    api.get<T>(path, { signal: ctrl.signal })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { if ((e as Error).name !== 'AbortError') { setError(errMsg(e)); setLoading(false); } });
    first.current = false;
    return () => ctrl.abort();
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload, setData };
}
