import type { Filters, SpecialistCard } from '../lib/types';

export const quickOptions = ['near', 'home', 'online', 'free', 'cheap'] as const;
export type Quick = typeof quickOptions[number];
export const sorts = ['best', 'near', 'cheap', 'rating'] as const;
export const filterGroups = [
  { key: 'specialty', title: 'specialty', options: ['Логопед', 'Дефектолог', 'Нейропсихолог', 'Психолог', 'АВА-терапевт', 'Реабилитолог'] },
  { key: 'exp', title: 'experience', options: ['РАС', 'ДЦП', 'Синдром Дауна', 'Неговорящие дети', 'Выраженные поведенческие особенности'] },
  { key: 'price', title: 'price', options: ['free', 'lt5', '5_10', '10_15', 'gt15'] },
  { key: 'format', title: 'format', options: ['Кабинет', 'На дом', 'Онлайн'] },
  { key: 'group', title: 'sessions', options: ['individual', 'group'] },
  { key: 'lang', title: 'language', options: ['Русский', 'Казахский'] },
] as const;
export type FilterKey = typeof filterGroups[number]['key'];
export function readFilters(params: URLSearchParams, district?: string | null): Filters {
  const time = Number(params.get('max_minutes') ?? 60);
  const sort = sorts.find(value => value === params.get('sort')) ?? 'best';
  const values = (key: FilterKey) => {
    const group = filterGroups.find(g => g.key === key)!;
    return params.getAll(key).filter(v => (group.options as readonly string[]).includes(v));
  };
  return {
    kind: params.get('kind') === 'parent' ? 'parent' : 'child',
    q: params.get('q') ?? '', district: district || undefined,
    specialty: values('specialty'), exp: values('exp'), price: values('price') as Filters['price'],
    format: values('format') as Filters['format'], lang: values('lang') as Filters['lang'],
    group: values('group').length === 1 ? values('group')[0] === 'group' : undefined,
    verified: params.get('verified') === 'true' ? true : undefined,
    max_minutes: district && Number.isFinite(time) ? Math.max(10, Math.min(60, time)) : undefined,
    sort: sort === 'near' && !district ? 'best' : sort,
  };
}
export function readQuick(params: URLSearchParams): Quick[] {
  return quickOptions.filter(value => params.getAll('quick').includes(value));
}
/** Quick chips combine with AND, including home + online and intersecting price filters. */
export function matchesQuick(item: SpecialistCard, quick: readonly Quick[]): boolean {
  return quick.every(value => ({
    near: item.travel_minutes != null && item.travel_minutes <= 20,
    home: item.formats.includes('На дом'), online: item.formats.includes('Онлайн'),
    free: item.price === 0, cheap: item.price <= 10000,
  })[value]);
}
export function withQuick(filters: Filters, quick: readonly Quick[]): Filters {
  return { ...filters,
    max_minutes: quick.includes('near') && filters.district ? Math.min(filters.max_minutes ?? 60, 20) : filters.max_minutes,
    format: filters.format?.length ? filters.format : quick.includes('home') ? ['На дом'] : quick.includes('online') ? ['Онлайн'] : [],
    price: filters.price?.length ? filters.price : quick.includes('free') ? ['free'] : quick.includes('cheap') ? ['free', 'lt5', '5_10'] : [],
  };
}
export function filterCount(params: URLSearchParams): number {
  return filterGroups.reduce((n, g) => n + params.getAll(g.key).length, 0)
    + (params.has('max_minutes') && Number(params.get('max_minutes')) < 60 ? 1 : 0)
    + (params.get('verified') === 'true' ? 1 : 0);
}
export function resetFilters(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of [...filterGroups.map(g => g.key), 'max_minutes', 'verified', 'quick', 'q', 'state']) next.delete(key);
  return next;
}
