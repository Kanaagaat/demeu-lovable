import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../lib/rides';
import * as mock from '../lib/ridesMock';
import { RidesError } from '../lib/ridesTypes';
import type { RideView } from '../lib/ridesTypes';
import { useDriver, useDriverFeed, useDriverRide, useEstimate, useRide } from './rides';
vi.mock('../lib/rides', async importOriginal => {
  const actual = await importOriginal<typeof import('../lib/rides')>();
  return { ...actual, getRide: vi.fn(), getDriver: vi.fn(), getFeed: vi.fn(), estimate: vi.fn() };
});
let ride: RideView;
const tick = async (ms = 0) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-14T10:00:00Z'));
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  ride = mock.createRide({ parent_ref: 'test', mode: 'express', from_district: 'Бостандыкский', to_address: 'Демо-центр', parent_price: 3000 });
  vi.mocked(api.getRide).mockResolvedValue(ride);
  api.setDriverId(null);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe('rides polling hooks', () => {
  it('loads immediately, polls every 2 seconds and stops on completed', async () => {
    const { result, unmount } = renderHook(() => useRide('ride'));
    expect(api.getRide).toHaveBeenCalledTimes(1); await tick();
    expect(result.current.data?.status).toBe('searching');
    await tick(1999); expect(api.getRide).toHaveBeenCalledTimes(1);
    await tick(1); expect(api.getRide).toHaveBeenCalledTimes(2);
    vi.mocked(api.getRide).mockResolvedValue({ ...ride, status: 'completed' });
    await tick(2000); expect(api.getRide).toHaveBeenCalledTimes(3);
    await tick(10000); expect(api.getRide).toHaveBeenCalledTimes(3);
    act(() => result.current.refresh()); await tick(); expect(api.getRide).toHaveBeenCalledTimes(4);
    unmount(); await tick(4000); expect(api.getRide).toHaveBeenCalledTimes(4);
  });
  it('keeps last data offline, surfaces API codes, then recovers', async () => {
    const { result } = renderHook(() => useRide('ride')); await tick();
    vi.mocked(api.getRide).mockRejectedValueOnce(new api.RidesNetworkError());
    await tick(2000);
    expect(result.current).toMatchObject({ data: ride, offline: true, error: null, loading: false });
    vi.mocked(api.getRide).mockRejectedValueOnce(new RidesError(409, 'bad_transition'));
    await tick(2000); expect(result.current.error).toBe('bad_transition'); expect(result.current.offline).toBe(false);
    await tick(2000); expect(result.current.error).toBeNull();
  });
  it('does not overlap slow requests, coalesces refreshes and pauses when hidden', async () => {
    let resolve!: (value: RideView) => void;
    vi.mocked(api.getRide).mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const { result } = renderHook(() => useRide('ride'));
    await tick(6000); expect(api.getRide).toHaveBeenCalledTimes(1);
    act(() => { result.current.refresh(); result.current.refresh(); });
    await act(async () => { resolve(ride); }); await tick(); expect(api.getRide).toHaveBeenCalledTimes(2);
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    await tick(6000); expect(api.getRide).toHaveBeenCalledTimes(2);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    act(() => document.dispatchEvent(new Event('visibilitychange'))); await tick(); expect(api.getRide).toHaveBeenCalledTimes(3);
  });
  it('ignores stale results after route change and waits for the preceding request', async () => {
    let resolve!: (value: RideView) => void;
    vi.mocked(api.getRide).mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const { result, rerender } = renderHook(({ id }) => useRide(id), { initialProps: { id: 'old' } });
    rerender({ id: 'new' }); expect(api.getRide).toHaveBeenCalledTimes(1);
    await act(async () => { resolve({ ...ride, id: 'old' }); }); await tick();
    expect(api.getRide).toHaveBeenLastCalledWith('new'); expect(result.current.data?.id).toBe(ride.id);
  });
  it('debounces estimates and clears data while a district is absent', async () => {
    vi.mocked(api.estimate).mockResolvedValue({ minutes: 15, low: 2300, high: 3400, suggested: 2700 });
    const { result, rerender } = renderHook(({ from, to }: { from: string | null; to: string | null }) => useEstimate(from, to), { initialProps: { from: null as string | null, to: 'A' as string | null } });
    expect(result.current).toMatchObject({ data: null, loading: false });
    rerender({ from: 'B', to: 'A' }); await tick(200); expect(api.estimate).not.toHaveBeenCalled();
    rerender({ from: 'C', to: 'A' }); await tick(249); expect(api.estimate).not.toHaveBeenCalled();
    await tick(1); expect(api.estimate).toHaveBeenCalledExactlyOnceWith('C', 'A');
    expect(result.current.data?.minutes).toBe(15);
    rerender({ from: null, to: 'A' }); expect(result.current.data).toBeNull();
  });
  it('handles no driver and can refresh after registration', async () => {
    const { result } = renderHook(() => useDriver());
    expect(result.current).toMatchObject({ data: null, loading: false }); expect(api.getDriver).not.toHaveBeenCalled();
    const d = mock.registerDriver({ name: 'Демо Водитель', phone: '+77000000000', car: 'Демо авто', plate: '000 DMU 02' });
    vi.mocked(api.getDriver).mockResolvedValue(d); api.setDriverId(d.id);
    act(() => result.current.refresh()); await tick();
    expect(result.current.data?.id).toBe(d.id);
  });
  it('exposes feed readiness errors and requests driver view', async () => {
    vi.mocked(api.getFeed).mockRejectedValue(new RidesError(403, 'driver_not_ready'));
    const { result } = renderHook(() => useDriverFeed('driver')); await tick();
    expect(result.current.error).toBe('driver_not_ready');
    renderHook(() => useDriverRide('ride')); await tick(); expect(api.getRide).toHaveBeenLastCalledWith('ride', 'driver');
  });
});
