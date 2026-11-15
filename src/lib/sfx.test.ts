import { beforeEach, expect, test } from 'vitest';
import { setSoundEnabled, soundEnabled } from './sfx';

beforeEach(() => localStorage.clear());
test('sounds are off by default and only the parent turns them on', () => {
  expect(soundEnabled()).toBe(false);
  setSoundEnabled(true);
  expect(soundEnabled()).toBe(true);
  setSoundEnabled(false);
  expect(soundEnabled()).toBe(false);
});
