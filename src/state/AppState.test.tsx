import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { AppStateProvider, DEFAULT_SHARE, useAppState } from './AppState';
import oracle from '../lib/__fixtures__/parity.json';
import type { ChildCard, SavedBooking } from '../lib/types';

const card = oracle.cases[0].card as ChildCard;
const booking: SavedBooking = { id: 'demo-booking', specialist_id: 1, slot: '2026-12-01T10:00:00Z', format: 'Онлайн', created_at: '2026-11-14T00:00:00Z' };
const renderState = () => renderHook(useAppState, { wrapper: AppStateProvider });
afterEach(() => vi.restoreAllMocks());

describe('AppState persistence', () => {
  test('actions persist and restore all fields; compare handles same-batch changes and limit', () => {
    const { result, unmount } = renderState();
    act(() => {
      result.current.setCard(card);
      expect(result.current.toggleCompare(1)).toBe('added');
      expect(result.current.toggleCompare(2)).toBe('added');
      expect(result.current.toggleCompare(3)).toBe('added');
      expect(result.current.toggleCompare(4)).toBe('limit');
      expect(result.current.toggleCompare(2)).toBe('removed');
      expect(result.current.toggleCompare(4)).toBe('added');
      result.current.addBooking(booking);
      result.current.togglePlanDone('pmpk');
      result.current.setOnboarded(true);
      result.current.setShareDefaults({ ...DEFAULT_SHARE, district: true });
    });
    expect(JSON.parse(localStorage.getItem('demeu.card')!)).toEqual(card);
    expect(JSON.parse(localStorage.getItem('demeu.compare')!)).toEqual([1, 3, 4]);
    unmount();
    const restored = renderState();
    expect(restored.result.current).toMatchObject({ card, compare: [1, 3, 4], bookings: [booking], planDone: ['pmpk'], onboarded: true, shareDefaults: { ...DEFAULT_SHARE, district: true } });
    act(() => restored.result.current.togglePlanDone('pmpk'));
    expect(restored.result.current.planDone).toEqual([]);
  });
  test('reset removes managed keys, resets memory, and survives remount', () => {
    localStorage.setItem('unrelated', 'keep');
    const { result, unmount } = renderState();
    act(() => { result.current.setCard(card); result.current.addBooking(booking); result.current.setOnboarded(true); });
    act(() => result.current.resetAll());
    expect(result.current).toMatchObject({ card: null, compare: [], bookings: [], planDone: [], onboarded: false, shareDefaults: DEFAULT_SHARE });
    expect(localStorage.getItem('demeu.card')).toBeNull();
    expect(localStorage.getItem('demeu.bookings')).toBeNull();
    expect(localStorage.getItem('unrelated')).toBe('keep');
    unmount();
    expect(renderState().result.current.card).toBeNull();
  });
  test('corrupt JSON and wrong-shaped stored values are recovered safely', () => {
    localStorage.setItem('demeu.card', '{broken');
    localStorage.setItem('demeu.compare', '[1,1,2,3,4,"5",null]');
    localStorage.setItem('demeu.bookings', '[null,{},42]');
    localStorage.setItem('demeu.planDone', '["pmpk","unknown","pmpk"]');
    localStorage.setItem('demeu.onboarded', '"true"');
    localStorage.setItem('demeu.shareDefaults', '{"age":false,"features":"yes"}');
    expect(renderState().result.current).toMatchObject({ card: null, compare: [1, 2, 3], bookings: [], planDone: ['pmpk'], onboarded: false, shareDefaults: { ...DEFAULT_SHARE, age: false } });
  });
  test('blocked storage still allows in-memory actions and reset', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('Blocked'); });
    const { result } = renderState();
    act(() => { result.current.setCard(card); result.current.toggleCompare(1); result.current.addBooking(booking); });
    expect(result.current).toMatchObject({ card, compare: [1], bookings: [booking] });
    act(() => result.current.resetAll());
    expect(result.current.card).toBeNull();
  });
});
