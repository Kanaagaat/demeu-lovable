/** Polling hooks for parent and driver screens. */
import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../lib/rides';
import { RidesError } from '../lib/ridesTypes';
import type { Driver, Estimate, FeedItem, RideView } from '../lib/ridesTypes';

export interface Polled<T> { data: T | null; loading: boolean; error: string | null; /** true when the API is unreachable and the last known data is shown */ offline: boolean; refresh: () => void }
type Options<T> = { intervalMs?: number; stop?: (data: T) => boolean; enabled?: boolean; delayMs?: number };
type Result<T> = Omit<Polled<T>, 'refresh'>;
const terminal = (r: RideView) => r.status === 'completed' || r.status === 'cancelled';
function usePolled<T>(fetcher: () => Promise<T>, { intervalMs = 2000, stop, enabled = true, delayMs = 0 }: Options<T> = {}): Polled<T> {
  const [state, setState] = useState<{ key: typeof fetcher; value: Result<T> }>(() => ({ key: fetcher, value: { data: null, loading: enabled, error: null, offline: false } }));
  const requestRef = useRef<Promise<void> | null>(null);
  const refreshRef = useRef<() => void>(() => undefined);
  const stopRef = useRef(stop);
  stopRef.current = stop;
  useEffect(() => {
    let disposed = false, stopped = false, rerun = false;
    let delay: ReturnType<typeof setTimeout> | undefined;
    let polling: ReturnType<typeof setInterval> | undefined;
    let value: Result<T> = { data: null, loading: enabled, error: null, offline: false };
    const publish = () => { if (!disposed) setState({ key: fetcher, value: { ...value } }); };
    const run = async (force = false): Promise<void> => {
      if (disposed || !enabled || document.hidden || (!force && stopped)) return;
      if (requestRef.current) {
        if (force) {
          rerun = true;
          await requestRef.current;
          if (rerun && !disposed) { rerun = false; return run(true); }
        }
        return;
      }
      const request = (async () => {
        try {
          const data = await fetcher();
          if (disposed) return;
          value = { data, loading: false, error: null, offline: false };
          stopped = stopRef.current?.(data) ?? false;
          if (stopped) clearInterval(polling);
        } catch (error) {
          if (disposed) return;
          value = { ...value, loading: false, offline: !(error instanceof RidesError), error: error instanceof RidesError ? error.code : null };
        }
        publish();
      })();
      requestRef.current = request;
      await request;
      if (requestRef.current === request) requestRef.current = null;
    };
    const start = () => {
      delay = undefined;
      if (!document.hidden) void run(true);
      if (intervalMs > 0) polling = setInterval(() => { void run(); }, intervalMs);
    };
    refreshRef.current = () => { clearTimeout(delay); delay = undefined; void run(true); };
    const visibility = () => { if (!document.hidden && !stopped && delay === undefined) void run(true); };
    document.addEventListener('visibilitychange', visibility);
    if (enabled) {
      // A previous route's unfinished request is awaited, never overlapped.
      if (delayMs) delay = setTimeout(start, delayMs);
      else if (!document.hidden) start();
      else if (intervalMs > 0) polling = setInterval(() => { void run(); }, intervalMs);
    }
    return () => {
      disposed = true; rerun = false; clearTimeout(delay); clearInterval(polling);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [fetcher, enabled, intervalMs, delayMs]);
  const refresh = useCallback(() => refreshRef.current(), []);
  const value = state.key === fetcher && enabled ? state.value : { data: null, loading: enabled, error: null, offline: false };
  return { ...value, refresh };
}
export const useRide = (_id: string | undefined): Polled<RideView> => usePolled(useCallback(() => api.getRide(_id!), [_id]), { enabled: !!_id, stop: terminal });
export const useMyRides = (): Polled<RideView[]> => usePolled(api.listRides);
export const useEstimate = (_from: string | null, _to: string | null): Polled<Estimate> => usePolled(useCallback(() => api.estimate(_from!, _to!), [_from, _to]), { enabled: !!_from && !!_to, intervalMs: 0, delayMs: 250 });
export const useDriver = (): Polled<Driver> => {
  const driverId = api.getDriverId();
  const [, render] = useState(0);
  const result = usePolled(useCallback(() => api.getDriver(driverId!), [driverId]), { enabled: !!driverId, intervalMs: 0 });
  const pollRefresh = result.refresh;
  const refresh = useCallback(() => { render(n => n + 1); pollRefresh(); }, [pollRefresh]);
  return { ...result, refresh };
};
export const useDriverFeed = (_driverId: string | null): Polled<FeedItem[]> => usePolled(useCallback(() => api.getFeed(_driverId!), [_driverId]), { enabled: !!_driverId });
export const useDriverRide = (_id: string | undefined): Polled<RideView> => usePolled(useCallback(() => api.getRide(_id!, 'driver'), [_id]), { enabled: !!_id, stop: terminal });

/** D-33: active assignment and history, polled on the same 2 s cadence as the feed. */
export const useDriverRides = (driverId: string | null): Polled<RideView[]> => usePolled(
  useCallback(() => api.listDriverRides(driverId!), [driverId]), { enabled: !!driverId, intervalMs: 2000 },
);
