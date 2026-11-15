import type { ChildCard, Feature } from '../lib/types';
import { isChildCard } from '../lib/engine';
export type Draft = Omit<ChildCard, 'age' | 'comm' | 'react' | 'disability'> & {
  age: number | null;
  comm: ChildCard['comm'] | '';
  react: ChildCard['react'] | '';
  disability: ChildCard['disability'] | '';
};
export const DISTRICTS = ['Алатауский', 'Алмалинский', 'Ауэзовский', 'Бостандыкский', 'Жетысуский', 'Медеуский', 'Наурызбайский', 'Турксибский'];
export const FEATURES: Feature[] = ['РАС', 'ДЦП', 'Синдром Дауна', 'ЗПР / ЗРР', 'Нарушения слуха', 'Нарушения зрения', 'Другое', 'Пока не знаю / не хочу указывать'];
export const COMM: ChildCard['comm'][] = ['Говорит фразами', 'Отдельные слова', 'Пока не говорит', 'Жесты или карточки'];
export const REACT: ChildCard['react'][] = ['Спокойно', 'Нужно время, чтобы привыкнуть', 'Бывают сильные реакции'];
export const GOALS: ChildCard['goals'] = ['Речь', 'Поведение', 'Самостоятельность', 'Моторика', 'Учёба', 'Общение'];
export const DISABILITY: ChildCard['disability'][] = ['Да', 'Нет', 'В процессе'];
export const emptyDraft = (): Draft => ({ name: '', age: null, district: '', features: [], comm: '', react: '', goals: [], disability: '' });
export function toggleFeature(values: Feature[], value: Feature): Feature[] {
  if (values.includes(value))
    return values.filter(v => v !== value);
  if (value === FEATURES[7])
    return [value];
  return [...values.filter(v => v !== FEATURES[7]), value];
}
// A separate draft preserves unfinished answers when opening the voice screen.
export function saveDraft(draft: Draft) {
  try {
    localStorage.setItem('demeu.home.draft', JSON.stringify(draft));
  }
  catch { /* Storage is optional. */ }
}
export function readDraft(card: ChildCard | null): Draft {
  try {
    const raw = JSON.parse(localStorage.getItem('demeu.home.draft') ?? 'null') as Draft | null;
    if (raw && typeof raw === 'object') {
      const value = { ...raw, age: raw.age ?? 0, district: raw.district || DISTRICTS[0], comm: raw.comm || COMM[0], react: raw.react || REACT[0], disability: raw.disability || DISABILITY[1] };
      if (isChildCard(value) && (raw.age === null || Number.isInteger(raw.age)))
        return raw;
    }
  }
  catch { /* Ignore malformed storage. */ }
  return card ? { ...card, features: [...card.features], goals: [...card.goals] } : emptyDraft();
}
export function clearDraft() {
  try {
    localStorage.removeItem('demeu.home.draft');
  }
  catch { /* Optional. */ }
}
export function missingStep(draft: Draft): number | null {
  if (draft.age === null)
    return 1;
  if (!DISTRICTS.includes(draft.district))
    return 2;
  if (!draft.comm)
    return 4;
  if (!draft.react)
    return 5;
  if (!draft.disability)
    return 7;
  return null;
}
export function completeCard(draft: Draft): ChildCard | null {
  const value = { ...draft, name: draft.name?.trim() || null };
  return isChildCard(value) ? value : null;
}
export function formatPhone(digits: string) {
  let text = digits.length ? `(${digits.slice(0, 3)}` : '';
  if (digits.length >= 3)
    text += `) ${digits.slice(3, 6)}`;
  if (digits.length > 6)
    text += `-${digits.slice(6, 8)}`;
  if (digits.length > 8)
    text += `-${digits.slice(8, 10)}`;
  return text;
}
export interface VoiceField {
  key: string;
  value: string;
}
export const demoVoice = (): VoiceField[] => [
  { key: 'name', value: 'Айдан' }, { key: 'age', value: '6 лет' }, { key: 'features', value: 'РАС' },
  { key: 'comm', value: 'Отдельные слова, иногда жесты' },
  { key: 'concern', value: 'Пока не говорит фразами, тяжело в новых местах' },
  { key: 'strength', value: 'Любит пазлы, запоминает дорогу до дома' },
];
export function voiceToDraft(fields: VoiceField[], draft: Draft): Draft {
  const values = Object.fromEntries(fields.map(f => [f.key, f.value.trim()]));
  const next = { ...draft };
  if (values.name !== undefined && values.name.length <= 80)
    next.name = values.name || null;
  const age = /^(\d{1,2})(?:\s*(?:лет|год|года|жас|\+))?$/.exec(values.age ?? '');
  if (age && Number(age[1]) <= 18)
    next.age = Number(age[1]);
  if (values.features !== undefined) {
    const features = FEATURES.filter(v => values.features.split(/[,;\n]/).map(s => s.trim()).includes(v));
    if (features.length || !values.features)
      next.features = features.includes(FEATURES[7]) ? [FEATURES[7]] : features;
  }
  if (values.comm) {
    const communication = COMM.find(v => values.comm === v) ?? COMM.find(v => values.comm.startsWith(`${v},`));
    if (communication)
      next.comm = communication;
  }
  if (values.goals !== undefined) {
    const goals = GOALS.filter(v => values.goals.split(/[,;\n]/).map(s => s.trim()).includes(v));
    if (goals.length || !values.goals) next.goals = goals;
  }
  const district = DISTRICTS.find(v => values.district === v || values.district?.startsWith(`${v} `));
  if (district)
    next.district = district;
  const reaction = REACT.find(v => values.react === v);
  if (reaction)
    next.react = reaction;
  const disability = DISABILITY.find(v => values.disability === v);
  if (disability)
    next.disability = disability;
  return next;
}
// Parent's own words for «Другое» (not part of the API card contract: kept on the device only).
const CUSTOM_KEY = 'demeu.home.customFeatures';
export const CUSTOM_MAX = 5;
export const CUSTOM_LENGTH = 40;
export function readCustomFeatures(): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string' && !!v.trim()).map(v => v.trim().slice(0, CUSTOM_LENGTH)).slice(0, CUSTOM_MAX) : [];
  }
  catch { return []; }
}
export function saveCustomFeatures(values: string[]) {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(values.slice(0, CUSTOM_MAX)));
  }
  catch { /* Storage is optional. */ }
}
/** Features for display: «Другое» is replaced by the parent's own words when there are any. */
export function featureList(features: readonly string[], custom = readCustomFeatures()): string[] {
  return features.flatMap(v => v === FEATURES[6] && custom.length ? custom : [v]);
}
