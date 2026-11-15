import { useCallback, useSyncExternalStore } from 'react';
import type { ChildCard, SharedCard } from '../lib/types';
import type { ShareDefaults } from './AppState';
import { formatDate } from '../lib/dates';

const listeners = new Set<() => void>();
const memory = new Map<string, string>();
const prefix = 'demeu.plan.';
function read(key: string): string | null {
  try { return localStorage.getItem(prefix + key); } catch { return memory.get(key) ?? null; }
}
export function savePlanValue(key: string, value: unknown) {
  const json = JSON.stringify(value);
  memory.set(key, json);
  try { localStorage.setItem(prefix + key, json); } catch { /* Continue in memory. */ }
  listeners.forEach(listener => listener());
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  const storage = () => listener();
  window.addEventListener('storage', storage);
  return () => { listeners.delete(listener); window.removeEventListener('storage', storage); };
};
export function usePlanValue<T>(key: string, fallback: T, valid: (value: unknown) => value is T) {
  const raw = useSyncExternalStore(subscribe, () => read(key), () => null);
  let value = fallback;
  try { const parsed: unknown = JSON.parse(raw ?? 'null'); if (valid(parsed)) value = parsed; } catch { /* Ignore invalid storage. */ }
  const setValue = useCallback((next: T) => savePlanValue(key, next), [key]);
  return [value, setValue] as const;
}
export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
export const isChecks = (value: unknown): value is Record<string, boolean> => !!value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every(v => typeof v === 'boolean');
export interface BookingMeta { wa_url: string; direct: boolean }
export const isBookingMeta = (value: unknown): value is BookingMeta => !!value && typeof value === 'object' && typeof (value as BookingMeta).direct === 'boolean' && typeof (value as BookingMeta).wa_url === 'string' && /^https:\/\/wa\.me\//.test((value as BookingMeta).wa_url);
export function useBookingMeta(id: string) { return usePlanValue<BookingMeta | null>(`booking.${id}`, null, (value): value is BookingMeta | null => value === null || isBookingMeta(value)); }
export function getBookingMeta(id: string): BookingMeta | null {
  try { const value: unknown = JSON.parse(read(`booking.${id}`) ?? 'null'); return isBookingMeta(value) ? value : null; } catch { return null; }
}
export function selectedShared(card: ChildCard | null, selected: ShareDefaults, enabled = true): SharedCard {
  if (!card || !enabled) return {};
  return Object.fromEntries(Object.entries(card).filter(([key, value]) => selected[key as keyof ShareDefaults] && value != null && value !== '')) as SharedCard;
}
export function slotISO(date: string, time: string) { return `${date}T${time}:00+05:00`; }
export function dateText(slot: string, language: string, options?: Intl.DateTimeFormatOptions) {
  return formatDate(slot, language, { timeZone: 'Asia/Almaty', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', ...options });
}
export function childNameForPlan(card: ChildCard | null) {
  const name = card?.name?.trim();
  if (!name) return null;
  return /[бвгджзклмнпрстфхцчшщ]$/i.test(name) ? `${name}а` : name;
}
