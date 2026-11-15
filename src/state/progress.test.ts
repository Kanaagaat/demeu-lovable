import { expect, test } from 'vitest';
import type { SavedBooking } from '../lib/types';
import { monthGrid, monthStats, occurrencesOn, parseYmd } from './progress';
import type { Session } from './progress';

const weekly: Session = { id: 's1', title: 'Логопед', date: '2026-11-03', time: '10:00', repeat: true };
const once: Session = { id: 's2', title: 'Бассейн', date: '2026-11-05', time: '09:00', repeat: false };
const booking: SavedBooking = { id: 'b1', specialist_id: 1, slot: new Date(2026, 10, 10, 15, 30).toISOString(), format: 'Кабинет', created_at: '2026-11-01T00:00:00Z' };

test('weekly sessions repeat from their start date only, one-off sessions stay on their day', () => {
  expect(occurrencesOn('2026-10-27', [weekly], [])).toEqual([]);
  expect(occurrencesOn('2026-11-03', [weekly], []).map(o => o.title)).toEqual(['Логопед']);
  expect(occurrencesOn('2026-11-10', [weekly, once], [booking]).map(o => [o.kind, o.time])).toEqual([['session', '10:00'], ['booking', '15:30']]);
  expect(occurrencesOn('2026-11-12', [weekly, once], [])).toEqual([]);
  expect(occurrencesOn('2026-11-05', [weekly, once], []).map(o => o.key)).toEqual(['s:s2|2026-11-05']);
});

test('month grid starts on Monday', () => {
  const grid = monthGrid(parseYmd('2026-11-15'));
  expect(grid.slice(0, 7)).toEqual([null, null, null, null, null, null, '2026-11-01']);
  expect(grid.filter(Boolean)).toHaveLength(30);
});

test('attendance counts only days up to today', () => {
  const marks = { 's:s1|2026-11-03': 'done', 's:s1|2026-11-10': 'missed' } as const;
  expect(monthStats(parseYmd('2026-11-01'), '2026-11-15', [weekly], [], marks)).toEqual({ planned: 2, done: 1, missed: 1 });
  expect(monthStats(parseYmd('2026-11-01'), '2026-11-30', [weekly], [], marks).planned).toBe(4);
});
