import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from './api';
import type { ApiResponse, ChildCard, Filters, Source } from './types';

interface Resource<T> { data: T | null; loading: boolean; error: Error | null; source: Source | null }
function useResource<T>(load: (() => Promise<ApiResponse<T>>) | null) {
  const [result, setResult] = useState<Resource<T>>({ data: null, loading: load !== null, error: null, source: null });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(v => v + 1), []);
  useEffect(() => {
    let active = true;
    setResult({ data: null, loading: load !== null, error: null, source: null });
    if (load) {
      void load().then(
        response => { if (active) setResult({ ...response, loading: false, error: null }); },
        error => { if (active) setResult({ data: null, loading: false, source: null, error: error instanceof Error ? error : new Error(String(error)) }); },
      );
    }
    return () => { active = false; };
  }, [load, version]);
  return { ...result, reload };
}

export function useSpecialists(filters: Filters = {}) {
  const key = JSON.stringify(filters);
  const load = useCallback(() => api.listSpecialists(JSON.parse(key) as Filters), [key]);
  return useResource(load);
}
export function useSpecialist(id: number | null | undefined, district?: string | null) {
  const load = useMemo(() => id == null ? null : () => api.getSpecialist(id, district), [id, district]);
  return useResource(load);
}
export function useMatch(card: ChildCard | null, filters: Filters = {}) {
  const cardKey = JSON.stringify(card), filterKey = JSON.stringify(filters);
  const load = useMemo(() => cardKey === 'null' ? null : () => api.match(JSON.parse(cardKey) as ChildCard, JSON.parse(filterKey) as Filters), [cardKey, filterKey]);
  return useResource(load);
}
export function usePlan(card: ChildCard | null) {
  const key = JSON.stringify(card);
  const load = useMemo(() => key === 'null' ? null : () => api.plan(JSON.parse(key) as ChildCard), [key]);
  return useResource(load);
}
export function useArticles() { return useResource(api.articles); }
export function useNews(audience?: 'parents' | 'children') { const load = useCallback(() => api.news(audience), [audience]); return useResource(load); }
