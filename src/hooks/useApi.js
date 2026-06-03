import { useState, useEffect, useRef, useCallback } from 'react';

// useApi(fetcher, deps, options)
//
//   fetcher : async () => <payload>   (e.g. () => apiClient.get('/x').then(r => r.data.data))
//   deps    : dependency array; the request re-runs when these change
//   options : { immediate=true, enabled=true, initialData=null }
//
// Returns { data, loading, error, reload, setData }.
//
// Contract that the UI relies on:
//   - loading is true while a request is in flight (initial load shows a loader)
//   - on failure `error` is set and the previous data is kept as-is - we never
//     replace good/loaded data with an empty value because of an error, so the
//     UI can show an error state instead of a misleading "no data" message
//   - on success `error` is cleared and `data` is replaced
export default function useApi(fetcher, deps = [], options = {}) {
  const { immediate = true, enabled = true, initialData = null } = options;

  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(immediate && enabled);
  const [error, setError] = useState(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const reqId = useRef(0);

  const run = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (id === reqId.current) setData(result);
      return result;
    } catch (err) {
      // Keep whatever data we already had; surface the error instead of
      // letting the page fall through to an empty state.
      if (id === reqId.current) setError(err);
      throw err;
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (immediate) run().catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return { data, loading, error, reload: run, setData };
}
