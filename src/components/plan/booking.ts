import type { SharedCard } from '../../lib/types';
import { dateText } from '../../state/plan';
export type Translate = (key: string) => string;
export const fieldKeys = ['name', 'age', 'features', 'comm', 'react', 'goals', 'disability', 'district'] as const;
export function ageWords(age: number, t: Translate) {
  if (age === 0) return t('plan.ageUnder1');
  if (age >= 18) return t('plan.ageAdult');
  const form = age % 10 === 1 && age % 100 !== 11 ? 'ageOne' : age % 10 >= 2 && age % 10 <= 4 && !(age % 100 >= 12 && age % 100 <= 14) ? 'ageFew' : 'ageMany';
  return `${age} ${t(`plan.${form}`)}`;
}
export function fieldText(key: keyof SharedCard, value: SharedCard[keyof SharedCard], t: Translate) {
  const shown = key === 'age' && typeof value === 'number' ? ageWords(value, t) : Array.isArray(value) ? value.join(', ') || t('plan.unspecified') : value ?? t('plan.unspecified');
  return `${t(`plan.${key}`)}: ${shown}`;
}
export function bookingIntroduction(name: string, slot: string, format: string, direct: boolean, language: string, t: Translate) {
  return `${t('plan.greeting').replace('{name}', name)} ${direct ? t('plan.introDirect') : t('plan.intro').replace('{date}', dateText(slot, language)).replace('{format}', format)}`;
}
export function messagePreview(introduction: string, shared: SharedCard, t: Translate) {
  const fields = fieldKeys.flatMap(key => shared[key] == null ? [] : [fieldText(key, shared[key], t)]);
  return introduction + (fields.length ? `\n${t('plan.aboutChild')}: ${fields.join('; ')}` : '');
}
export function formatText(format: string, t: Translate) { return t(format === 'Онлайн' ? 'plan.online' : format === 'На дом' ? 'plan.home' : 'plan.office'); }
export function priceText(price: number, t: Translate) { return price === 0 ? t('plan.free') : `${price.toLocaleString('ru-RU')} ${t('plan.priceUnit')}`; }
