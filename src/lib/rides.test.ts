import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RideDraft } from './ridesTypes';
const draft: Omit<RideDraft, 'parent_ref'> = { mode: 'express', from_district: 'Бостандыкский', to_address: 'Демо-центр', parent_price: 3000 };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
let client: typeof import('./rides');
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(async () => {
  vi.resetModules(); vi.stubEnv('VITE_API_URL', 'https://rides.example/');
  fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock); client = await import('./rides');
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('rides HTTP client', () => {
  it('keeps 4xx codes and full not_ready body without fallback', async () => {
    fetchMock.mockResolvedValueOnce(response({ detail: 'not_ready', missing: ['kit'] }, 409));
    await expect(client.setOnline('server-driver', true)).rejects.toMatchObject({ status: 409, code: 'not_ready', extra: { detail: 'not_ready', missing: ['kit'] } });
    fetchMock.mockResolvedValueOnce(response({ detail: 'price_out_of_range' }, 422));
    await expect(client.createRide(draft)).rejects.toBeInstanceOf(client.RidesError);
    expect(localStorage.getItem('demeu.ridesMock')).toBeNull();
  });
  it('creates a local ride after a network error and never fetches local ids', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'));
    const ride = await client.createRide(draft);
    expect(ride.id).toMatch(/^local-/);
    expect(ride.parent_ref).toBe(client.getParentRef());
    fetchMock.mockClear();
    await client.getRide(ride.id); await client.raisePrice(ride.id, 3200); await client.cancelRide(ride.id);
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(client.getRide('server-ride')).rejects.toBeInstanceOf(client.RidesNetworkError);
  });
  it('uses timeout fallback at 4 seconds, including a fetch that ignores AbortSignal', async () => {
    vi.useFakeTimers(); fetchMock.mockImplementation(() => new Promise(() => undefined));
    const pending = client.createRide(draft);
    await vi.advanceTimersByTimeAsync(4000);
    expect((await pending).id).toMatch(/^local-/);
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it('does not mask a known 4xx if its body stalls', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue({ ok: false, status: 403, statusText: 'Forbidden', json: () => new Promise(() => undefined) });
    const pending = expect(client.createRide(draft)).rejects.toMatchObject({ status: 403 });
    await vi.advanceTimersByTimeAsync(4000); await pending;
    expect(localStorage.getItem('demeu.ridesMock')).toBeNull();
  });
  it('uses the API prefix, implicit identities and list envelopes', async () => {
    client.setDriverId('driver-test');
    fetchMock.mockResolvedValueOnce(response({ id: 'ride-test' }));
    await client.getRide('ride-test', 'driver');
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe('/api/rides/ride-test'); expect(url.searchParams.get('driver_id')).toBe('driver-test');
    fetchMock.mockResolvedValueOnce(response({ id: 'ride-test' }));
    await client.raisePrice('ride-test', 3500);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ parent_ref: client.getParentRef(), price: 3500 });
    fetchMock.mockResolvedValueOnce(response({ items: [] }));
    expect(await client.listRides()).toEqual([]);
  });
  it('uses local estimates for 5xx and registers a local driver on network failure', async () => {
    fetchMock.mockResolvedValueOnce(response({}, 503));
    const estimated = await client.estimate('Бостандыкский', 'Бостандыкский');
    expect(estimated.minutes).toBe(5); expect(estimated.suggested).toBe(1900);
    fetchMock.mockRejectedValue(new TypeError('offline'));
    const driver = await client.registerDriver({ name: 'Демо Водитель', phone: '+77000000000', car: 'Демо авто', plate: '000 DMU 02' });
    expect(client.getDriverId()).toBe(driver.id);
    const { KIT_REQUIRED } = await import('./ridesTypes');
    await client.patchDriver(driver.id, { trained: true, verified: true }); await client.kitCheck(driver.id, KIT_REQUIRED); await client.setOnline(driver.id, true);
    const ride = await client.createRide(draft);
    fetchMock.mockClear();
    expect((await client.getFeed(driver.id))[0].id).toBe(ride.id);
    const offer = await client.sendOffer(ride.id, driver.id, 3000);
    await client.acceptOffer(offer.id);
    expect((await client.setRideStatus(ride.id, driver.id, 'driver_on_way')).status).toBe('driver_on_way');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('uses mock immediately with an empty API URL', async () => {
    vi.resetModules(); vi.stubEnv('VITE_API_URL', ''); const local = await import('./rides');
    expect((await local.createRide(draft)).id).toMatch(/^local-/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('keeps identities and rides in memory when storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const parent = client.getParentRef(); expect(client.getParentRef()).toBe(parent);
    expect(parent).toMatch(/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/);
    client.setDriverId('local-test'); expect(client.getDriverId()).toBe('local-test');
    client.setDriverId(null); expect(client.getDriverId()).toBeNull();
    fetchMock.mockRejectedValue(new TypeError('offline'));
    const ride = await client.createRide(draft);
    expect((await client.getRide(ride.id)).id).toBe(ride.id);
  });
  it('uses the newest memory state when storage fills up over an older saved ride', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'));
    const ride = await client.createRide(draft);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    await client.raisePrice(ride.id, 3500);
    expect((await client.getRide(ride.id)).parent_price).toBe(3500);
    expect((await client.cancelRide(ride.id)).status).toBe('cancelled');
    expect((await client.getRide(ride.id)).status).toBe('cancelled');
  });
  it('translates known errors and uses a general fallback', () => {
    const t = (key: string) => key === 'rides.err.wrong_pin' ? 'Проверьте PIN' : key === 'rides.err.generic' ? 'Повторите' : key;
    expect(client.errorText(t, new client.RidesError(403, 'wrong_pin'))).toBe('Проверьте PIN');
    expect(client.errorText(t, new client.RidesError(422, 'unrecognized'))).toBe('Повторите');
  });
});
