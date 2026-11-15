import { expect, test } from 'vitest';
import ru from './ru.json';
import kz from './kz.json';

function leafKeys(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, entry]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof entry === 'string' ? [path] : leafKeys(entry as object, path);
  });
}

test('RU and KZ have the same nested translation keys', () => {
  expect(leafKeys(kz).sort()).toEqual(leafKeys(ru).sort());
});

const ns = import.meta.glob('./ns/*.json', { eager: true, import: 'default' }) as Record<string, object>;
test('every namespace file has RU and KZ with the same keys', () => {
  for (const [file, dict] of Object.entries(ns)) {
    if (!file.endsWith('.ru.json')) continue;
    const pair = ns[file.replace('.ru.json', '.kz.json')];
    expect(pair, `${file} has no KZ pair`).toBeDefined();
    expect(leafKeys(pair).sort(), file).toEqual(leafKeys(dict).sort());
  }
});
