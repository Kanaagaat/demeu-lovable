/** Pure rules shared by the rides UI and the offline demo. PLAN.md §7. */
import invataxi from '../data/invataxi.json';
import type { ChildCard } from './types';
import { CATEGORIES, OFFER_UI_STEP, PRICE_MAX, PRICE_MIN, PRICE_STEP, RIDE_FLOW } from './ridesTypes';
import type { Category, Hint, RideStatus } from './ridesTypes';

export const roundTo100 = (n: number): number => Math.round(n / PRICE_STEP) * PRICE_STEP;
export function estimate(minutes: number): { low: number; high: number; suggested: number } {
  const mid = 1500 + 80 * minutes;
  return { low: Math.max(1500, roundTo100(mid * 0.85)), high: roundTo100(mid * 1.25), suggested: roundTo100(mid) };
}
export const isValidPrice = (n: number): boolean => Number.isInteger(n) && n >= PRICE_MIN && n <= PRICE_MAX && n % PRICE_STEP === 0;
export const offerLimit = (parentPrice: number): number => Math.floor(Math.floor(parentPrice * 1.5) / PRICE_STEP) * PRICE_STEP;
export const nextOfferPrice = (parentPrice: number, current: number): number => Math.min(current + OFFER_UI_STEP, offerLimit(parentPrice), PRICE_MAX);
export const canOffer = (parentPrice: number, price: number): boolean => isValidPrice(price) && price >= parentPrice && price <= offerLimit(parentPrice);
const HINTS: Partial<Record<Category, Hint[]>> = {
  asd: ['quiet_ride', 'may_run_lock_doors'], cp: ['boarding_help'], wheelchair: ['boarding_help', 'folding_wheelchair'],
  epilepsy: ['seizure_first_aid'], hearing: ['communicate_hearing', 'help_to_door'], vision: ['communicate_vision', 'help_to_door'],
};
export function hintsFor(categories: readonly Category[]): Hint[] {
  return [...new Set(categories.flatMap(c => HINTS[c] ?? []))];
}
const FEATURE_CATEGORY: Record<string, Category> = {
  'РАС': 'asd', 'ДЦП': 'cp', 'Синдром Дауна': 'down', 'ЗПР / ЗРР': 'zpr', 'Нарушения слуха': 'hearing', 'Нарушения зрения': 'vision', 'Другое': 'other',
};
export function categoriesFromCard(card: Pick<ChildCard, 'features'> | null | undefined): Category[] {
  const mapped = (card?.features ?? []).map(f => FEATURE_CATEGORY[f]);
  return CATEGORIES.filter(c => mapped.includes(c));
}
export function canTransition(from: RideStatus, to: RideStatus): boolean {
  const index = RIDE_FLOW.indexOf(from);
  return index >= 0 && index < RIDE_FLOW.length - 1 && RIDE_FLOW[index + 1] === to;
}
export function nextStatus(status: RideStatus): RideStatus | null {
  const index = RIDE_FLOW.indexOf(status);
  return index >= 0 ? RIDE_FLOW[index + 1] ?? null : null;
}
export const timelineIndex = (status: RideStatus): number => RIDE_FLOW.indexOf(status);
export function isInvataxiEligible(card: Pick<ChildCard, 'disability' | 'features'> | null | undefined): boolean {
  return !!card && invataxi.disability.includes(card.disability) && card.features.some(f => invataxi.features.includes(f));
}
export const formatPrice = (n: number): string => `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n)}\u00a0₸`;
export function weekdayShort(n: number, lang: 'ru' | 'kz' = 'ru'): string {
  return (lang === 'kz' ? ['дс', 'сс', 'ср', 'бс', 'жм', 'сб', 'жс'] : ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'])[n] ?? '';
}
export function regularLabel(days: readonly number[], lang: 'ru' | 'kz' = 'ru'): string {
  const labels = [...new Set(days)].sort((a, b) => a - b).map(n => weekdayShort(n, lang)).filter(Boolean);
  return labels.length ? `${lang === 'kz' ? 'Тұрақты' : 'Регулярно'}: ${labels.join(', ')}` : '';
}

// ---- Driver registration validation (mirrors api/app/rides_schemas.py) ----
const PLATE_LOOKALIKES: Record<string, string> = { 'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'У': 'Y', 'Х': 'X' };

/** Kazakhstan phone → "+7 7XX XXX XX XX", or null. Accepts +7…, 8…, 7… and a bare 10-digit number. */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.length === 10) digits = `7${digits}`;
  else if (digits.length === 11 && digits[0] === '8') digits = `7${digits.slice(1)}`;
  if (!/^77\d{9}$/.test(digits)) return null;
  return `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9, 11)}`;
}

/** Kazakhstan plate "123ABC02" → "123 ABC 02" (3 digits, 2–3 Latin letters, region 01–21), or null. Cyrillic lookalikes are accepted. */
export function normalizePlate(input: string): string | null {
  const value = [...input.toUpperCase().replace(/[\s-]/g, '')].map(ch => PLATE_LOOKALIKES[ch] ?? ch).join('');
  const match = /^(\d{3})([A-Z]{2,3})(0[1-9]|1\d|2[01])$/.exec(value);
  return match ? `${match[1]} ${match[2]} ${match[3]}` : null;
}

const LETTER = 'A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі';
export const isValidPersonName = (input: string) => new RegExp(`^[${LETTER}][${LETTER} '’-]{1,79}$`).test(input.trim());
/** «марка и цвет»: starts with a letter, at least 3 characters. */
export const isValidCar = (input: string) => new RegExp(`^[${LETTER}][${LETTER}0-9 .,'’-]{2,79}$`).test(input.trim());
