import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminApiError } from '../lib/adminApi';
import type { AdminApplication, AdminBackend, AdminNews, AdminReport, AdminReview, AdminSummary } from '../lib/adminApi';

export interface AdminData {
  loading: boolean;
  /** Set when the last refresh failed. Previously loaded data stays on screen. */
  error: AdminApiError | null;
  loaded: boolean;
  updatedAt: Date | null;
  summary: AdminSummary | null;
  applications: AdminApplication[];
  reports: AdminReport[];
  reviews: AdminReview[];
  news: AdminNews[];
}
const initial: AdminData = { loading: true, error: null, loaded: false, updatedAt: null, summary: null, applications: [], reports: [], reviews: [], news: [] };

export const toAdminError = (error: unknown) => error instanceof AdminApiError ? error : new AdminApiError('server', 'Что-то пошло не так. Повторите действие');

/** Loads the console data, refreshes it in the background and runs moderator decisions with error handling. */
export function useAdminData(backend: AdminBackend, onAuthLost: () => void) {
  const [data, setData] = useState<AdminData>(initial);
  const alive = useRef(true);
  const authLost = useRef(onAuthLost);
  useEffect(() => { authLost.current = onAuthLost; }, [onAuthLost]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const load = useCallback(async () => {
    try {
      const [summary, applications, reports, reviews, news] = await Promise.all([backend.summary(), backend.applications(), backend.reports(), backend.reviews(), backend.news()]);
      if (alive.current) setData({ loading: false, error: null, loaded: true, updatedAt: new Date(), summary, applications, reports, reviews, news });
    } catch (caught) {
      const error = toAdminError(caught);
      if (error.kind === 'auth') { authLost.current(); return; }
      if (alive.current) setData(previous => ({ ...previous, loading: false, error }));
    }
  }, [backend]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (backend.mode !== 'remote') return undefined;
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [backend, load]);

  const reload = useCallback(() => { setData(previous => ({ ...previous, loading: true, error: null })); void load(); }, [load]);

  /** Runs a decision. Resolves with an error message to show next to the form, or null on success. */
  const decide = useCallback(async (request: () => Promise<{ id: string }>, key: 'applications' | 'reports' | 'reviews' | 'news', created = false): Promise<string | null> => {
    try {
      const updated = await request();
      if (alive.current) setData(previous => ({ ...previous, [key]: created ? [updated, ...(previous[key] as { id: string }[])] : (previous[key] as { id: string }[]).map(item => item.id === updated.id ? updated : item) }));
      void backend.summary().then(summary => { if (alive.current) setData(previous => ({ ...previous, summary })); }).catch(() => undefined);
      return null;
    } catch (caught) {
      const error = toAdminError(caught);
      if (error.kind === 'auth') { authLost.current(); return error.message; }
      if (error.kind === 'missing' || error.kind === 'conflict') void load();
      return error.message;
    }
  }, [backend, load]);

  return { data, reload, decide };
}
