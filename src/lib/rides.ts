/** Rides client. Export signatures are shared with parallel screen tasks. */
import { API_URL } from './api';
import seed from '../data/seed.json';
import * as mock from './ridesMock';
import { estimate as estimatePrice } from './ridesRules';
import { RidesError } from './ridesTypes';
import type { Category, Driver, DriverDraft, Estimate, FeedItem, KitItem, OfferView, RatingTag, RideDraft, RideStatus, RideView } from './ridesTypes';
export { RidesError } from './ridesTypes';
export type { Category };

export class RidesNetworkError extends Error {
  constructor() { super('network'); this.name = 'RidesNetworkError'; }
}
let parentMemory: string | undefined;
let driverMemory: string | null = null;
let driverMemoryOnly = false;
export const getParentRef = (): string => {
  try {
    const stored = localStorage.getItem('demeu.parentRef');
    if (stored) return parentMemory = stored;
    const value = parentMemory ?? crypto.randomUUID();
    parentMemory = value; localStorage.setItem('demeu.parentRef', value); return value;
  } catch { return parentMemory ??= crypto.randomUUID(); }
};
export const getDriverId = (): string | null => {
  try { return driverMemoryOnly ? driverMemory : (driverMemory = localStorage.getItem('demeu.driverId')); }
  catch { return driverMemory; }
};
export const setDriverId = (_id: string | null): void => {
  driverMemory = _id;
  try {
    if (_id === null) localStorage.removeItem('demeu.driverId'); else localStorage.setItem('demeu.driverId', _id);
    driverMemoryOnly = false;
  } catch { driverMemoryOnly = true; }
};
const isLocal = (id: string) => id.startsWith('local-');
const noApi = () => !API_URL?.trim();
const query = (params: Record<string, string>) => `?${new URLSearchParams(params)}`;
const json = (body: unknown, method = 'POST'): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let httpError: RidesError | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(httpError ?? new RidesNetworkError()); }, 4000);
    });
    const run = async () => {
      const response = await fetch(`${API_URL.trim().replace(/\/+$/, '')}/api${path}`, { ...init, signal: controller.signal });
      if (response.status >= 500) throw new RidesNetworkError();
      if (!response.ok) {
        // Preserve known 4xx even if reading its response body stalls or fails.
        httpError = new RidesError(response.status, response.statusText || 'unknown');
        let body: Record<string, unknown> = {};
        try { body = await response.json() as Record<string, unknown>; } catch { /* Non-JSON error. */ }
        throw new RidesError(response.status, typeof body?.detail === 'string' ? body.detail : 'unknown', body);
      }
      return await response.json() as T;
    };
    return await Promise.race([run(), timeout]);
  } catch (error) {
    if (error instanceof RidesError) throw error;
    throw new RidesNetworkError();
  } finally { clearTimeout(timer); }
}
async function withCreationFallback<T>(remote: () => Promise<T>, local: () => T): Promise<T> {
  if (noApi()) return local();
  try { return await remote(); } catch (error) { if (error instanceof RidesNetworkError) return local(); throw error; }
}
export const estimate = async (_from: string, _to: string): Promise<Estimate> => withCreationFallback(
  () => request(`/rides/estimate${query({ from: _from, to: _to })}`),
  () => {
    const matrix = seed.district_minutes as Record<string, Record<string, number>>;
    const minutes = matrix[_from]?.[_to] ?? 12;
    return { minutes, ...estimatePrice(minutes) };
  },
);
export const createRide = async (_draft: Omit<RideDraft, 'parent_ref'>): Promise<RideView> => {
  const draft = { ..._draft, parent_ref: getParentRef() };
  return withCreationFallback(() => request('/rides', json(draft)), () => mock.createRide(draft));
};
export const getRide = async (_id: string, _view?: 'parent' | 'driver'): Promise<RideView> => {
  const perspective = _view ?? 'parent';
  const driverId = perspective === 'driver' ? getDriverId() ?? '' : undefined;
  return noApi() || isLocal(_id) ? mock.getRide(_id, perspective, driverId)
    : request(`/rides/${encodeURIComponent(_id)}${query({ view: perspective, ...(driverId !== undefined ? { driver_id: driverId } : {}) })}`);
};
export const listRides = async (): Promise<RideView[]> => {
  const parent = getParentRef();
  if (noApi()) return mock.listRides(parent);
  const { items } = await request<{ items: RideView[] }>(`/rides${query({ parent_ref: parent })}`);
  return [...items, ...mock.listRides(parent)].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
};
export const raisePrice = async (_id: string, _price: number): Promise<RideView> => noApi() || isLocal(_id)
  ? mock.raisePrice(_id, getParentRef(), _price) : request(`/rides/${encodeURIComponent(_id)}/price`, json({ parent_ref: getParentRef(), price: _price }));
export const cancelRide = async (_id: string): Promise<RideView> => noApi() || isLocal(_id)
  ? mock.cancelRide(_id, getParentRef()) : request(`/rides/${encodeURIComponent(_id)}/cancel`, json({ parent_ref: getParentRef() }));
export const acceptOffer = async (_offerId: string): Promise<RideView> => noApi() || isLocal(_offerId)
  ? mock.acceptOffer(_offerId, getParentRef()) : request(`/offers/${encodeURIComponent(_offerId)}/accept`, json({ parent_ref: getParentRef() }));
export const declineOffer = async (_offerId: string): Promise<OfferView> => noApi() || isLocal(_offerId)
  ? mock.declineOffer(_offerId, getParentRef()) : request(`/offers/${encodeURIComponent(_offerId)}/decline`, json({ parent_ref: getParentRef() }));
export const rateRide = async (_id: string, _stars: number, _tags: RatingTag[]): Promise<RideView> => noApi() || isLocal(_id)
  ? mock.rateRide(_id, getParentRef(), _stars, _tags) : request(`/rides/${encodeURIComponent(_id)}/rating`, json({ parent_ref: getParentRef(), stars: _stars, tags: _tags }));

export const registerDriver = async (_draft: DriverDraft): Promise<Driver> => {
  const d = await withCreationFallback<Driver>(() => request('/drivers', json(_draft)), () => mock.registerDriver(_draft));
  setDriverId(d.id); return d;
};
export const getDriver = async (_id: string): Promise<Driver> => noApi() || isLocal(_id) ? mock.getDriver(_id) : request(`/drivers/${encodeURIComponent(_id)}`);
export const patchDriver = async (_id: string, _patch: Partial<DriverDraft> & { verified?: boolean; trained?: boolean }): Promise<Driver> => noApi() || isLocal(_id)
  ? mock.patchDriver(_id, _patch) : request(`/drivers/${encodeURIComponent(_id)}`, json(_patch, 'PATCH'));
export const kitCheck = async (_id: string, _items: KitItem[]): Promise<Driver> => noApi() || isLocal(_id)
  ? mock.kitCheck(_id, _items) : request(`/drivers/${encodeURIComponent(_id)}/kit-check`, json({ items: _items }));
export const setOnline = async (_id: string, _online: boolean): Promise<Driver> => noApi() || isLocal(_id)
  ? mock.setOnline(_id, _online) : request(`/drivers/${encodeURIComponent(_id)}/online`, json({ online: _online }));
export const getFeed = async (_driverId: string): Promise<FeedItem[]> => noApi() || isLocal(_driverId)
  ? mock.getFeed(_driverId) : (await request<{ items: FeedItem[] }>(`/driver/feed${query({ driver_id: _driverId })}`)).items;
export const sendOffer = async (_rideId: string, _driverId: string, _price: number): Promise<OfferView> => noApi() || isLocal(_rideId) || isLocal(_driverId)
  ? mock.sendOffer(_rideId, _driverId, _price) : request(`/rides/${encodeURIComponent(_rideId)}/offers`, json({ driver_id: _driverId, price: _price }));
export const setRideStatus = async (_rideId: string, _driverId: string, _status: RideStatus, _pin?: string): Promise<RideView> => noApi() || isLocal(_rideId) || isLocal(_driverId)
  ? mock.setRideStatus(_rideId, _driverId, _status, _pin) : request(`/rides/${encodeURIComponent(_rideId)}/status`, json({ driver_id: _driverId, status: _status, ...(_pin !== undefined ? { pin: _pin } : {}) }));

export function errorText(t: (key: string) => string, error: unknown): string {
  const code = error instanceof RidesError ? error.code : typeof error === 'string' ? error : 'network';
  const key = `rides.err.${code}`;
  const translated = t(key);
  return translated !== key ? translated : t('rides.err.generic');
}

/** D-33: assigned rides remain accessible after they leave the searching feed. */
export const listDriverRides = async (driverId: string): Promise<RideView[]> => noApi() || isLocal(driverId)
  ? mock.listDriverRides(driverId)
  : (await request<{ items: RideView[] }>(`/driver/rides${query({ driver_id: driverId })}`)).items;
