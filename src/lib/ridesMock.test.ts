import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as mock from './ridesMock';
import { KIT_REQUIRED, RidesError } from './ridesTypes';
import type { RideDraft } from './ridesTypes';
const draft: RideDraft = { parent_ref: 'parent-test', mode: 'express', from_district: 'Бостандыкский', to_address: 'Демо-центр', parent_price: 3000, categories: ['asd', 'wheelchair'] };
function create() { return mock.createRide(draft); }
function accepted() {
  const r = create(); vi.setSystemTime(Date.now() + 4000);
  const offers = mock.getRide(r.id).offers;
  return mock.acceptOffer(offers[0].id, draft.parent_ref);
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-14T10:00:00Z')); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe('local rides backend', () => {
  it('replies only after 4 seconds and advances lazily every 8 seconds', () => {
    const r = create();
    vi.setSystemTime(Date.now() + 3999); expect(mock.getRide(r.id).offers).toHaveLength(0);
    vi.setSystemTime(Date.now() + 1);
    const replies = mock.getRide(r.id).offers;
    expect(replies.map(o => o.price)).toEqual([3000, 3500]);
    expect(replies.every(o => o.driver.phone === null)).toBe(true);
    const chosen = mock.acceptOffer(replies[0].id, draft.parent_ref);
    expect(chosen.pin).toMatch(/^\d{4}$/);
    expect(chosen.driver?.phone).toBeTruthy();
    expect(chosen.offers.map(o => o.status)).toEqual(['accepted', 'declined']);
    vi.setSystemTime(Date.now() + 7999); expect(mock.getRide(r.id).status).toBe('accepted');
    vi.setSystemTime(Date.now() + 1); expect(mock.getRide(r.id).status).toBe('driver_on_way');
    for (let i = 0; i < 4; i++) { vi.setSystemTime(Date.now() + 8000); mock.getRide(r.id); }
    expect(mock.getRide(r.id).status).toBe('completed');
  });
  it('hides private data and all other drivers’ offers', () => {
    const r = accepted();
    const v = mock.getRide(r.id, 'driver', r.driver_id!);
    expect(v).not.toHaveProperty('pin'); expect(v).not.toHaveProperty('parent_ref'); expect(v).not.toHaveProperty('child_ref');
    expect(v.categories).toEqual(draft.categories); expect(v.hints).toContain('quiet_ride');
    expect(v.offers).toHaveLength(1); expect(v.offers[0].driver_id).toBe(r.driver_id);
    expect(mock.getRide(r.id).categories).toEqual(draft.categories);
  });
  it('requires the correct PIN, without changing status after an error', () => {
    const r = accepted(), d = r.driver_id!;
    mock.setRideStatus(r.id, d, 'driver_on_way'); mock.setRideStatus(r.id, d, 'arrived');
    try { mock.setRideStatus(r.id, d, 'child_in_car', 'wrong'); throw new Error('expected rejection'); }
    catch (e) { expect(e).toBeInstanceOf(RidesError); expect(e).toMatchObject({ status: 403, code: 'wrong_pin' }); }
    expect(mock.getRide(r.id, 'driver', d).status).toBe('arrived');
    expect(mock.setRideStatus(r.id, d, 'child_in_car', r.pin!).status).toBe('child_in_car');
    expect(() => mock.setRideStatus(r.id, d, 'completed')).toThrow('bad_transition');
  });
  it('validates readiness and keeps a real local driver in control of the trip', () => {
    const d = mock.registerDriver({ name: 'Демо Водитель', phone: '+77000000000', car: 'Демо авто', plate: '000 DMU 02' });
    expect(() => mock.setOnline(d.id, true)).toThrow('not_ready');
    expect(() => mock.getFeed(d.id)).toThrow('driver_not_ready');
    expect(() => mock.kitCheck(d.id, ['water'])).toThrow('kit_incomplete');
    mock.patchDriver(d.id, { verified: true, trained: true }); mock.kitCheck(d.id, KIT_REQUIRED); mock.setOnline(d.id, true);
    const r = create();
    expect(mock.getFeed(d.id)[0]).toMatchObject({ id: r.id, categories: ['asd', 'wheelchair'], my_offer: null });
    const o = mock.sendOffer(r.id, d.id, 3000);
    expect(mock.sendOffer(r.id, d.id, 3000).id).toBe(o.id);
    const replacement = mock.sendOffer(r.id, d.id, 3200);
    expect(mock.getRide(r.id).offers[0].status).toBe('withdrawn');
    expect(() => mock.sendOffer(r.id, d.id, 4600)).toThrow('price_out_of_range');
    mock.acceptOffer(replacement.id, draft.parent_ref);
    vi.setSystemTime(Date.now() + 40000);
    expect(mock.getRide(r.id).status).toBe('accepted');
    vi.setSystemTime(Date.now() + 12 * 3600000);
    expect(() => mock.getFeed(d.id)).toThrow('driver_not_ready');
  });
  it('rates once and updates driver rating; rejects late cancellation', () => {
    const r = accepted();
    for (let i = 0; i < 5; i++) { vi.setSystemTime(Date.now() + 8000); mock.getRide(r.id); }
    expect(() => mock.cancelRide(r.id, draft.parent_ref)).toThrow('too_late');
    const rated = mock.rateRide(r.id, draft.parent_ref, 5, ['calm', 'careful']);
    expect(rated.driver?.rating).toBe(4.82);
    expect(() => mock.rateRide(r.id, draft.parent_ref, 5, [])).toThrow('already_rated');
  });
  it('persists rides, raises prices and withdraws pending offers on cancel', () => {
    const r = create();
    expect(JSON.parse(localStorage.getItem('demeu.ridesMock')!).rides[0].id).toBe(r.id);
    expect(() => mock.raisePrice(r.id, draft.parent_ref, 3000)).toThrow('price_not_higher');
    expect(mock.raisePrice(r.id, draft.parent_ref, 4000).initial_price).toBe(3000);
    vi.setSystemTime(Date.now() + 4000); mock.getRide(r.id);
    expect(mock.cancelRide(r.id, draft.parent_ref).offers.every(o => o.status === 'withdrawn')).toBe(true);
    expect(mock.listRides(draft.parent_ref)[0].offers).toEqual([]);
  });
});
