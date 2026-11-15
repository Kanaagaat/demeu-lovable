import { describe, expect, it } from 'vitest';
import { canOffer, canTransition, categoriesFromCard, estimate, formatPrice, hintsFor, isInvataxiEligible, isValidPrice, nextOfferPrice, nextStatus, offerLimit, regularLabel, roundTo100, timelineIndex, weekdayShort } from './ridesRules';

describe('rides pure rules', () => {
  it.each([
    [5, { low: 1600, high: 2400, suggested: 1900 }],
    [15, { low: 2300, high: 3400, suggested: 2700 }],
    [45, { low: 4300, high: 6400, suggested: 5100 }],
  ])('estimates %i minutes', (minutes, expected) => { expect(estimate(minutes)).toEqual(expected); });
  it('rounds and floors offer ceilings, never offers above the ceiling', () => {
    expect(roundTo100(2350)).toBe(2400);
    expect(estimate(0).low).toBe(1500);
    expect(offerLimit(3000)).toBe(4500);
    expect(offerLimit(3100)).toBe(4600);
    expect(offerLimit(500)).toBe(700);
    expect(nextOfferPrice(3000, 4400)).toBe(4500);
    expect(nextOfferPrice(3000, 4500)).toBe(4500);
    expect(nextOfferPrice(50000, 50000)).toBe(50000);
    expect(canOffer(3000, 4500)).toBe(true);
    for (const n of [2900, 4600, 3150, NaN]) expect(canOffer(3000, n)).toBe(false);
    for (const n of [500, 50000]) expect(isValidPrice(n)).toBe(true);
    for (const n of [400, 501, 50100, Infinity]) expect(isValidPrice(n)).toBe(false);
  });
  it('deduplicates hints in a deterministic order', () => {
    const expected = ['quiet_ride', 'may_run_lock_doors', 'boarding_help', 'folding_wheelchair'];
    expect(hintsFor(['asd', 'wheelchair', 'cp', 'asd'])).toEqual(expected);
    expect(hintsFor(['asd', 'wheelchair'])).toEqual(expected);
    expect(hintsFor(['hearing', 'vision']).filter(h => h === 'help_to_door')).toHaveLength(1);
  });
  it('maps card features and checks both invataxi conditions', () => {
    expect(categoriesFromCard({ features: ['РАС', 'ДЦП', 'Пока не знаю / не хочу указывать'] })).toEqual(['asd', 'cp']);
    expect(categoriesFromCard(null)).toEqual([]);
    expect(isInvataxiEligible({ features: ['РАС'], disability: 'Да' })).toBe(true);
    expect(isInvataxiEligible({ features: ['РАС'], disability: 'Нет' })).toBe(false);
    expect(isInvataxiEligible({ features: [], disability: 'Да' })).toBe(false);
  });
  it('allows only the next driver step', () => {
    expect(canTransition('accepted', 'driver_on_way')).toBe(true);
    expect(canTransition('arrived', 'child_in_car')).toBe(true);
    for (const to of ['accepted', 'arrived', 'child_in_car', 'completed', 'cancelled'] as const) expect(canTransition('accepted', to)).toBe(false);
    expect(canTransition('completed', 'in_ride')).toBe(false);
    expect(nextStatus('accepted')).toBe('driver_on_way');
    expect(nextStatus('completed')).toBeNull();
    expect(nextStatus('searching')).toBeNull();
    expect(timelineIndex('child_in_car')).toBe(3);
    expect(timelineIndex('cancelled')).toBe(-1);
  });
  it('formats common labels', () => {
    expect(formatPrice(3500)).toBe('3\u00a0500\u00a0₸');
    expect(weekdayShort(0, 'kz')).toBe('дс');
    expect(regularLabel([3, 1, 1], 'ru')).toBe('Регулярно: вт, чт');
    expect(regularLabel([], 'kz')).toBe('');
  });
});

describe('driver registration validation', () => {
  it('phone: Kazakhstan formats are normalised, junk is rejected', async () => {
    const { normalizePhone } = await import('./ridesRules');
    expect(normalizePhone('+7 701 234 56 78')).toBe('+7 701 234 56 78');
    expect(normalizePhone('87012345678')).toBe('+7 701 234 56 78');
    expect(normalizePhone('701-234-56-78')).toBe('+7 701 234 56 78');
    for (const bad of ['7004304030434242342', '12345', '+7 912 345 67 89', '', 'abc']) expect(normalizePhone(bad)).toBeNull();
  });
  it('plate: 3 digits + 2–3 letters + region; Cyrillic lookalikes accepted', async () => {
    const { normalizePlate } = await import('./ridesRules');
    expect(normalizePlate('085dbf02')).toBe('085 DBF 02');
    expect(normalizePlate('123 АВС 05')).toBe('123 ABC 05');
    expect(normalizePlate('12 AB 02')).toBeNull();
    for (const bad of ['34234dsfsdf', '085 DBF 99', '08 DBF 02', '']) expect(normalizePlate(bad)).toBeNull();
  });
  it('name and car', async () => {
    const { isValidPersonName, isValidCar } = await import('./ridesRules');
    expect(isValidPersonName('Берик Сапаров')).toBe(true);
    expect(isValidPersonName('1234')).toBe(false);
    expect(isValidCar('Toyota Camry, белая')).toBe(true);
    expect(isValidCar('34234dsfsdf')).toBe(false);
  });
});
