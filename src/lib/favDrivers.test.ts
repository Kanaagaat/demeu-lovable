import { afterEach, expect, test, vi } from 'vitest';
import { getFavDrivers, setFavDriver } from './favDrivers';

afterEach(() => { vi.restoreAllMocks(); });

test('writes and reads ids without duplicates and removes only selected id', () => {
  expect(getFavDrivers()).toEqual([]);
  expect(setFavDriver('drv-1', true)).toBe(true);
  setFavDriver('drv-2', true); setFavDriver('drv-1', true);
  expect(JSON.parse(localStorage.getItem('demeu.favDrivers')!)).toEqual(['drv-2', 'drv-1']);
  expect(getFavDrivers()).toEqual(['drv-2', 'drv-1']);
  setFavDriver('drv-1', false);
  expect(getFavDrivers()).toEqual(['drv-2']);
});

test.each(['broken', '{}', 'null', '42'])('invalid storage %s is safe', value => {
  localStorage.setItem('demeu.favDrivers', value);
  expect(getFavDrivers()).toEqual([]);
});

test('filters malformed ids and duplicates', () => {
  localStorage.setItem('demeu.favDrivers', JSON.stringify(['drv-1', 3, null, '', 'drv-1', 'drv-2']));
  expect(getFavDrivers()).toEqual(['drv-1', 'drv-2']);
});

test('unavailable storage does not throw or claim success', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(getFavDrivers()).toEqual([]);
  expect(setFavDriver('drv-1', true)).toBe(false);
});
