import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isInvataxiEligible } from './ridesRules';
import { KIT_REQUIRED } from './ridesTypes';
import type { RideDraft, RideStatus, RideView } from './ridesTypes';
import type { ChildCard } from './types';

const draft: Omit<RideDraft, 'parent_ref'> = {
  mode: 'scheduled', from_district: 'Бостандыкский', from_address: 'Демо-дом, 1',
  to_address: 'Демо-центр, 2', scheduled_at: '2026-11-15T10:00:00Z',
  repeat_days: [1, 3], needs_escort: true, parent_price: 3000,
  child_ref: 'demo-child', categories: ['asd'], show_category: true,
  needs: ['quiet', 'door_lock'], comment: 'Пожалуйста, без музыки',
};
// Keep the expected contract independent of the implementation's RIDE_FLOW.
const statuses: RideStatus[] = ['accepted', 'driver_on_way', 'arrived', 'child_in_car', 'in_ride', 'completed'];
let client: typeof import('./rides');
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  localStorage.setItem('demeu.parentRef', 'demo-parent');
  vi.stubEnv('VITE_API_URL', '');
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-14T10:00:00Z'));
  fetchMock = vi.fn().mockRejectedValue(new Error('Unexpected network request'));
  vi.stubGlobal('fetch', fetchMock);
  client = await import('./rides');
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function register() {
  return client.registerDriver({ name: 'Демо Водитель', phone: '+7 700 000 00 09', car: 'Демо-авто', plate: '009 DMU 02' });
}

async function readyDriver() {
  const driver = await register();
  await client.patchDriver(driver.id, { verified: true, trained: true });
  await client.kitCheck(driver.id, KIT_REQUIRED);
  return client.setOnline(driver.id, true);
}

function expectPrivate(view: RideView) {
  for (const key of ['pin', 'parent_ref', 'child_ref']) expect(view).not.toHaveProperty(key);
  expect(view.categories).toEqual(['asd']);
}

describe('offline parent and driver ride flow through lib/rides', () => {
  it('creates an escorted scheduled ride, negotiates, checks every transition and PIN, completes and rates', async () => {
    const ride = await client.createRide(draft);
    expect(ride).toMatchObject({ ...draft, parent_ref: 'demo-parent', status: 'searching', initial_price: 3000, offers: [] });
    expect(ride.id).toMatch(/^local-/);

    const driver = await readyDriver();
    expect(client.getDriverId()).toBe(driver.id);
    expect(driver).toMatchObject({ verified: true, trained: true, kit_ok: true, online: true });
    const feed = await client.getFeed(driver.id);
    expect(feed).toHaveLength(1);
    expect(feed[0]).toMatchObject({
      id: ride.id, mode: 'scheduled', needs_escort: true, parent_price: 3000,
      scheduled_at: draft.scheduled_at, regular_label_days: [1, 3], my_offer: null,
      needs: draft.needs, comment: draft.comment, hints: ['quiet_ride', 'may_run_lock_doors'],
    });
    expectPrivate(feed[0]);

    const offer = await client.sendOffer(ride.id, driver.id, 3500);
    expect((await client.getFeed(driver.id))[0].my_offer).toMatchObject({ id: offer.id, price: 3500, status: 'pending' });
    const parent = await client.getRide(ride.id);
    expect(parent.categories).toEqual(['asd']);
    expect(parent.offers).toHaveLength(1);
    expect(parent.offers[0]).toMatchObject({ id: offer.id, price: 3500, driver: { id: driver.id } });

    const accepted = await client.acceptOffer(parent.offers[0].id);
    expect(accepted).toMatchObject({ status: 'accepted', driver_id: driver.id, final_price: 3500 });
    expect(accepted.pin).toMatch(/^\d{4}$/);
    expect(accepted.offers[0].status).toBe('accepted');
    expect(await client.getFeed(driver.id)).toEqual([]);
    expectPrivate(await client.getRide(ride.id, 'driver'));
    await expect(client.rateRide(ride.id, 5, [])).rejects.toMatchObject({ status: 409, code: 'bad_transition' });

    const seen: RideStatus[] = ['searching', accepted.status];
    for (const [index, current] of statuses.entries()) {
      const next = statuses[index + 1];
      // No skipping, reversing, repeating or cancelling through the driver's status endpoint.
      for (const invalid of ['searching', ...statuses, 'cancelled'] as RideStatus[]) {
        if (invalid === next) continue;
        await expect(client.setRideStatus(ride.id, driver.id, invalid, accepted.pin!))
          .rejects.toMatchObject({ status: 409, code: 'bad_transition' });
        expect((await client.getRide(ride.id, 'driver')).status).toBe(current);
      }
      if (!next) break;
      if (next === 'child_in_car') {
        const wrongPin = accepted.pin === '0000' ? '0001' : '0000';
        for (const pin of [undefined, wrongPin]) {
          await expect(client.setRideStatus(ride.id, driver.id, next, pin))
            .rejects.toMatchObject({ status: 403, code: 'wrong_pin' });
          expect((await client.getRide(ride.id)).status).toBe('arrived');
        }
      }
      const updated = await client.setRideStatus(ride.id, driver.id, next, next === 'child_in_car' ? accepted.pin! : undefined);
      expect(updated.status).toBe(next);
      expectPrivate(updated);
      seen.push((await client.getRide(ride.id)).status);
    }
    expect(seen).toEqual(['searching', ...statuses]);

    const rated = await client.rateRide(ride.id, 5, ['calm', 'careful']);
    expect(rated).toMatchObject({ status: 'completed', rating_stars: 5, rating_tags: ['calm', 'careful'], driver: { rating: 4.82 } });
    expect((await client.getDriver(driver.id)).rating).toBe(4.82);
    expect((await client.getRide(ride.id)).rating_stars).toBe(5);
    await expect(client.rateRide(ride.id, 4, [])).rejects.toMatchObject({ status: 409, code: 'already_rated' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([3000, 3500, 3600, 4500])('accepts a driver offer of %i ₸ for a 3 000 ₸ ride (inclusive +50%% limit)', async price => {
    const ride = await client.createRide(draft);
    const driver = await readyDriver();
    expect(await client.sendOffer(ride.id, driver.id, price)).toMatchObject({ price, status: 'pending' });
    expect((await client.getRide(ride.id)).offers[0].price).toBe(price);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([2900, 3550, 4600])('rejects a driver offer of %i ₸ without publishing it', async price => {
    const ride = await client.createRide(draft);
    const driver = await readyDriver();
    await expect(client.sendOffer(ride.id, driver.id, price)).rejects.toMatchObject({ status: 422, code: 'price_out_of_range' });
    expect((await client.getRide(ride.id)).offers).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['kit', 'trained', 'both'] as const)('blocks an unready driver missing %s from the feed and going online', async missing => {
    const driver = await register();
    await client.patchDriver(driver.id, { verified: true, trained: missing === 'kit' });
    if (missing === 'trained') await client.kitCheck(driver.id, KIT_REQUIRED);
    await expect(client.getFeed(driver.id)).rejects.toMatchObject({ status: 403, code: 'driver_not_ready' });
    const expectedMissing = missing === 'both' ? ['trained', 'kit'] : [missing];
    await expect(client.setOnline(driver.id, true)).rejects.toMatchObject({ status: 409, code: 'not_ready', extra: { missing: expectedMissing } });
    expect((await client.getDriver(driver.id)).online).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('invataxi card combinations', () => {
  it.each<{ card: Pick<ChildCard, 'features' | 'disability'>; eligible: boolean }>([
    { card: { features: ['РАС'], disability: 'Да' }, eligible: true },
    { card: { features: ['ДЦП', 'Синдром Дауна', 'Нарушения слуха', 'Нарушения зрения'], disability: 'Да' }, eligible: true },
    { card: { features: ['Другое', 'ЗПР / ЗРР'], disability: 'Да' }, eligible: false },
    { card: { features: ['РАС'], disability: 'Нет' }, eligible: false },
    { card: { features: ['ДЦП'], disability: 'В процессе' }, eligible: false },
    { card: { features: [], disability: 'Да' }, eligible: false },
  ])('$card → eligible=$eligible', ({ card, eligible }) => {
    expect(isInvataxiEligible(card)).toBe(eligible);
  });
});
