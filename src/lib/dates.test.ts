import { expect, test } from 'vitest';
import { formatDate } from './dates';

test('kazakh dates use real month names, never "M12"', () => {
  expect(formatDate('2026-12-05T12:00:00+05:00', 'kz', { day: 'numeric', month: 'long', timeZone: 'Asia/Almaty' })).toBe('5 желтоқсан');
  expect(formatDate('2026-11-16T10:00:00+05:00', 'kz', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Almaty' })).toBe('16 қараша, 10:00');
  expect(formatDate('2026-11-16T10:00:00+05:00', 'kz', { weekday: 'short', timeZone: 'Asia/Almaty' })).toBe('дс');
  expect(formatDate('2026-03-01T10:00:00+05:00', 'kz', { month: 'long', year: 'numeric', timeZone: 'Asia/Almaty' })).toBe('наурыз 2026');
  expect(formatDate('2026-12-05T12:00:00+05:00', 'ru', { day: 'numeric', month: 'long', timeZone: 'Asia/Almaty' })).toBe('5 декабря');
  expect(formatDate('bad', 'kz', { day: 'numeric' })).toBe('');
});
