import seed from '../data/seed.json';
import type { ArticlesResult, BookingRequest, BookingResult, ChatRequest, ChatResult, ChildCard, FeedbackRequest, FeedbackResult, Filters, MatchItem, MatchResult, Meta, PlanCode, PlanResult, PlanStep, ReportRequest, SavedBooking, SeedData, SharedCard, SlotDay, SpecialistCard, SpecialistDetail, SpecialistList, SpecialistProfile } from './types';

const DATA = seed as SeedData;
export const UNKNOWN = 'Пока не знаю / не хочу указывать';
export class ApiError extends Error {
  constructor(public status: number, public detail: unknown) {
    super(typeof detail === 'string' ? detail : JSON.stringify(detail));
    this.name = 'ApiError';
  }
}
function invalid(message = 'Проверьте данные'): never { throw new ApiError(422, message); }
function districtValid(district?: string | null) {
  if (district != null && !DATA.districts.includes(district)) invalid('Неизвестный район');
}

export function isChildCard(value: unknown): value is ChildCard {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const c = value as Record<string, unknown>;
  const options = (v: unknown, allowed: string[], max: number) => Array.isArray(v) && v.length <= max && v.every(x => typeof x === 'string' && allowed.includes(x));
  return (c.name == null || typeof c.name === 'string' && c.name.length <= 80)
    && typeof c.age === 'number' && Number.isInteger(c.age) && c.age >= 0 && c.age <= 18
    && typeof c.district === 'string' && DATA.districts.includes(c.district)
    && options(c.features, DATA.meta.features, 8)
    && !(Array.isArray(c.features) && c.features.includes(UNKNOWN) && c.features.length > 1)
    && typeof c.comm === 'string' && (DATA.meta.comm as string[]).includes(c.comm)
    && typeof c.react === 'string' && (DATA.meta.react as string[]).includes(c.react)
    && options(c.goals, DATA.meta.goals, 6)
    && typeof c.disability === 'string' && (DATA.meta.disability as string[]).includes(c.disability)
    && Object.keys(c).every(k => k in LABELS);
}

// Python sorted() uses Unicode code points, not locale collation.
function intersect(a: string[], b: string[]) { return [...new Set(a)].filter(v => b.includes(v)).sort(); }
function casefold(s: string) { return s.toLowerCase().replaceAll('ß', 'ss').replaceAll('ς', 'σ'); }
// Python round() rounds ties to even (Math.round would change several scores).
function pythonRound(n: number) {
  const floor = Math.floor(n);
  return n - floor === 0.5 ? floor + floor % 2 : Math.round(n);
}

const almaty = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Almaty', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
function localParts(now: Date) {
  const parts = Object.fromEntries(almaty.formatToParts(now).map(p => [p.type, p.value]));
  return { year: parts.year, month: parts.month, day: parts.day, date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
export function travelMinutes(specialist: SpecialistProfile, district?: string | null): number | null {
  if (specialist.formats.length === 1 && specialist.formats[0] === 'Онлайн') return 0;
  return district ? DATA.district_minutes[district][specialist.district] : null;
}
export function slots(specialist: SpecialistProfile, now = new Date()): SlotDay[] {
  const local = localParts(now);
  const start = new Date(`${local.date}T00:00:00Z`);
  const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  return Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(start.getTime() + offset * 86400000);
    const weekday = (day.getUTCDay() + 6) % 7;
    const times = specialist.schedule.find(d => d.weekday === weekday)?.times ?? [];
    return { date: day.toISOString().slice(0, 10), label: `${weekdays[weekday]} ${day.getUTCDate()}`, times: times.filter(t => offset > 0 || t > local.time) };
  });
}
export function cardView(s: SpecialistProfile, district?: string | null, now = new Date()): SpecialistCard {
  // Mirror card_view's exclusion list, including the extra is_demo field in API responses.
  const excluded = new Set(['legacy_id', 'features', 'latitude', 'longitude', 'bio', 'methods', 'works_with', 'education', 'goals', 'schedule', 'whatsapp_phone']);
  const fields = Object.fromEntries(Object.entries(s).filter(([key]) => !excluded.has(key)));
  let next_slot: string | null = null;
  for (const [offset, day] of slots(s, now).entries()) {
    if (day.times.length) {
      next_slot = `${offset === 0 ? 'Сегодня' : offset === 1 ? 'Завтра' : day.label}, ${day.times[0]}`;
      break;
    }
  }
  return { ...fields, travel_minutes: travelMinutes(s, district), next_slot } as SpecialistCard;
}
export function score(card: ChildCard, specialist: SpecialistProfile): Pick<MatchItem, 'score' | 'match' | 'reasons'> {
  const reasons: [number, string][] = [];
  let value = 0;
  const add = (weight: number, text: string) => { value += weight; reasons.push([weight, text]); };
  const features = [...new Set(card.features)].filter(f => f !== UNKNOWN);
  const goals = [...new Set(card.goals)];
  const overlap = intersect(features, specialist.experiences);
  if (overlap.length) add(35, `Работал(а) с ${overlap.join(', ')}`);
  if (['Пока не говорит', 'Жесты или карточки', 'Отдельные слова'].includes(card.comm) && specialist.experiences.includes('Неговорящие дети')) add(10, 'Опыт с неговорящими детьми');
  if (card.react === 'Бывают сильные реакции' && specialist.experiences.includes('Выраженные поведенческие особенности')) add(10, 'Умеет работать с сильными реакциями');
  const matchingGoals = intersect(goals, specialist.goals);
  if (goals.length && matchingGoals.length) {
    const descriptions: Record<string, string> = { Речь: 'Развивает речь', Общение: 'Поддерживает общение', Поведение: 'Помогает с поведением', Моторика: 'Развивает моторику', Учёба: 'Поддерживает обучение', Самостоятельность: 'Развивает самостоятельность' };
    add((features.length ? 20 : 55) * matchingGoals.length / goals.length, descriptions[matchingGoals[0]]);
  }
  const minutes = travelMinutes(specialist, card.district);
  if (specialist.formats.includes('На дом') || specialist.formats.includes('Онлайн')) add(15, specialist.formats.includes('На дом') ? 'Есть занятия на дому' : 'Есть занятия онлайн');
  else if (minutes !== null && minutes < 60) add(minutes <= 20 ? 15 : 15 * (60 - minutes) / 40, `${minutes} мин от дома (примерная оценка)`);
  if (specialist.verified) add(5, 'Проверено Мама Про (демо)');
  if (specialist.rating >= 4.8) value += 5;
  const points = Math.min(100, pythonRound(value));
  return { score: points, match: points >= 60, reasons: reasons.sort((a, b) => b[0] - a[0]).slice(0, 3).map(r => r[1]) };
}

function validateFilters(f: Filters) {
  districtValid(f.district);
  if (f.max_minutes != null && (!Number.isInteger(f.max_minutes) || f.max_minutes < 0 || f.max_minutes > 180)) invalid('Проверьте фильтры');
  if (f.q != null && (typeof f.q !== 'string' || f.q.length > 100)) invalid('Проверьте фильтры');
  const lists: [unknown, string[], number][] = [
    [f.specialty, [], 20], [f.exp, [], 20], [f.price, ['free', 'lt5', '5_10', '10_15', 'gt15'], Infinity],
    [f.format, ['Кабинет', 'На дом', 'Онлайн'], Infinity], [f.lang, ['Русский', 'Казахский'], Infinity],
  ];
  for (const [v, allowed, max] of lists) if (v !== undefined && (!Array.isArray(v) || v.length > max || v.some(x => typeof x !== 'string' || allowed.length > 0 && !allowed.includes(x)))) invalid('Проверьте фильтры');
  if (f.kind !== undefined && !['child', 'parent'].includes(f.kind) || f.sort !== undefined && !['best', 'near', 'cheap', 'rating'].includes(f.sort)) invalid('Проверьте фильтры');
  for (const v of [f.group, f.verified]) if (v != null && typeof v !== 'boolean') invalid('Проверьте фильтры');
}
export function filterAndRank(filters?: Filters, card?: undefined, now?: Date): SpecialistCard[];
export function filterAndRank(filters: Filters, card: ChildCard, now?: Date): MatchItem[];
export function filterAndRank(filters: Filters = {}, card?: ChildCard, now = new Date()): (SpecialistCard | MatchItem)[] {
  validateFilters(filters);
  const district = filters.district || card?.district;
  const rows: (SpecialistCard | MatchItem)[] = [];
  for (const spec of DATA.specialists) {
    if (spec.kind !== (filters.kind ?? 'child')) continue;
    if (filters.q && !casefold(`${spec.name} ${spec.role}`).includes(casefold(filters.q))) continue;
    if (filters.specialty?.length && !filters.specialty.some(s => casefold(spec.role).includes(casefold(s)))) continue;
    if (filters.exp?.length && !intersect(filters.exp, spec.experiences).length) continue;
    const prices = { free: spec.price === 0, lt5: spec.price <= 5000, '5_10': spec.price >= 5000 && spec.price <= 10000, '10_15': spec.price >= 10000 && spec.price <= 15000, gt15: spec.price > 15000 };
    if (filters.price?.length && !filters.price.some(p => prices[p])) continue;
    if (filters.format?.length && !intersect(filters.format, spec.formats).length) continue;
    if (filters.lang?.length && !intersect(filters.lang, spec.languages).length) continue;
    if (filters.group != null && spec.group !== filters.group) continue;
    if (filters.verified != null && spec.verified !== filters.verified) continue;
    const minutes = travelMinutes(spec, district);
    if (district && minutes !== null && minutes > (filters.max_minutes ?? 60)) continue;
    const row = cardView(spec, district, now);
    rows.push(card ? { ...row, ...score(card, spec) } : row);
  }
  return rows.sort((a, b) => {
    if ((filters.sort ?? 'best') === 'best' && card) return (b as MatchItem).score - (a as MatchItem).score || a.id - b.id;
    if (filters.sort === 'near') return Number(a.travel_minutes === null) - Number(b.travel_minutes === null) || (a.travel_minutes ?? 0) - (b.travel_minutes ?? 0) || a.id - b.id;
    if (filters.sort === 'cheap') return a.price - b.price || a.id - b.id;
    return b.rating - a.rating || a.id - b.id;
  });
}
export function getMeta(): Meta {
  return { districts: [...DATA.districts], features: [...DATA.meta.features], goals: [...DATA.meta.goals], roles: [...new Set(DATA.specialists.map(s => s.role))].sort(), formats: ['Кабинет', 'На дом', 'Онлайн'], languages: ['Русский', 'Казахский'] };
}
export function listSpecialists(filters: Filters = {}, now = new Date()): SpecialistList {
  if ((filters.max_minutes != null || filters.sort === 'near') && filters.district == null) invalid('Для времени в пути укажите район');
  const items = filterAndRank(filters, undefined, now);
  return { items, total: items.length };
}
function profile(id: number) {
  const spec = DATA.specialists.find(s => s.id === id);
  if (!spec) throw new ApiError(404, 'Специалист не найден');
  return spec;
}
export function getSpecialist(id: number, district?: string | null, now = new Date()): SpecialistDetail {
  if (district) districtValid(district);
  const s = profile(id);
  return { ...cardView(s, district, now), bio: s.bio, works_with: [...s.works_with], methods: s.methods.map(m => ({ ...m })), education: [...s.education], goals: [...s.goals], reviews: DATA.reviews.filter(r => r.specialist_id === id).map(r => ({ ...r })), slots: slots(s, now) };
}
export function plan(card: ChildCard): PlanResult {
  if (!isChildCard(card)) invalid('Проверьте карточку');
  const f = card.features, g = card.goals;
  const codes: PlanCode[] = [];
  if (f.length || g.some(v => ['Речь', 'Учёба'].includes(v))) codes.push('pmpk');
  if (['Нет', 'В процессе'].includes(card.disability) && f.some(v => ['РАС', 'ДЦП', 'Синдром Дауна', 'Нарушения слуха', 'Нарушения зрения'].includes(v))) codes.push('disability');
  if (g.includes('Речь')) codes.push('speech');
  if (f.includes('РАС') && g.includes('Поведение')) codes.push('aba');
  if (f.includes('ДЦП') || g.includes('Моторика')) codes.push('rehab');
  if (f.includes('ЗПР / ЗРР') || g.includes('Учёба')) codes.push('defect');
  if (g.includes('Поведение') || card.react === 'Бывают сильные реакции') codes.push('psych');
  if (f.includes('РАС') && card.age >= 4) codes.push('neuro');
  if (['Да', 'В процессе'].includes(card.disability)) codes.push('benefits');
  const steps = codes.map(code => {
    const template = DATA.plan_templates.find(t => t.code === code)!;
    const { specialist_role: role, ...fields } = template;
    const item: PlanStep = { ...fields, docs: [...fields.docs], specialist_id: null, minutes: null };
    if (role) {
      const best = DATA.specialists.filter(s => s.kind === 'child' && s.role === role).sort((a, b) => score(card, b).score - score(card, a).score || a.id - b.id)[0];
      if (best) Object.assign(item, { specialist_id: best.id, minutes: travelMinutes(best, card.district), where: best.name, address: best.address });
    }
    return item;
  });
  return { steps };
}
/** Best catalogue match for a role (same choice as in `plan`), used by the family plan. */
export function bestForRole(card: ChildCard, role: string) {
  const best = DATA.specialists.filter(s => s.kind === 'child' && s.role === role).sort((a, b) => score(card, b).score - score(card, a).score || a.id - b.id)[0];
  return best ? { id: best.id, name: best.name, address: best.address, minutes: travelMinutes(best, card.district) } : null;
}
export function match(card: ChildCard, filters: Filters = {}, now = new Date()): MatchResult {
  const result = plan(card);
  return { items: filterAndRank({ ...filters, kind: 'child' }, card, now), plan: result.steps };
}

const LABELS: Record<keyof SharedCard, string> = { name: 'Имя', age: 'Возраст', features: 'Особенности', comm: 'Общение', react: 'Реакция на новых людей', goals: 'Цели', disability: 'Инвалидность', district: 'Район' };
const SHARED_KEYS = ['name', 'age', 'district', 'features', 'comm', 'react', 'goals', 'disability'] as const;
/** Human-readable age, same as api/app/engine.py age_text: «6 лет», «1 год», «3 года». */
export function ageText(age: number): string {
  if (age === 0) return 'до 1 года';
  if (age >= 18) return '18 лет и старше';
  if (age % 10 === 1 && age % 100 !== 11) return `${age} год`;
  if (age % 10 >= 2 && age % 10 <= 4 && !(age % 100 >= 12 && age % 100 <= 14)) return `${age} года`;
  return `${age} лет`;
}
export function bookingMessage(specialist: SpecialistProfile, slot: string, format: string, shared: SharedCard = {}, introduction?: string | null): string {
  const local = localParts(new Date(slot));
  const lines = [introduction ?? `Здравствуйте, ${specialist.name}! Хочу записать ребёнка на ${local.day}.${local.month}.${local.year} в ${local.time} (${format}).`];
  // Pydantic model_dump uses schema order, regardless of the order of JSON keys.
  const fields = SHARED_KEYS.flatMap(key => {
    const value = shared[key];
    return value == null ? [] : [`${LABELS[key]}: ${Array.isArray(value) ? [...new Set(value)].join(', ') : key === 'age' && typeof value === 'number' ? ageText(value) : value}`];
  });
  if (fields.length) lines.push(`О ребёнке (из DEMEU): ${fields.join('; ')}`);
  return lines.join('\n');
}
function validateShared(shared: SharedCard) {
  const full = { age: 0, district: DATA.districts[0], features: [], comm: DATA.meta.comm[0], react: DATA.meta.react[0], goals: [], disability: DATA.meta.disability[0], ...Object.fromEntries(Object.entries(shared).filter(([, v]) => v != null)) };
  if (!isChildCard(full)) invalid('Проверьте карточку');
}
export function createBooking(body: BookingRequest, id: string, phone = '', now = new Date()): BookingResult {
  const slot = new Date(body.slot);
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(body.slot) || !Number.isFinite(slot.getTime()) || slot <= now) invalid('Нужна будущая дата с часовым поясом');
  if (body.message != null && body.message.length > 1500) invalid();
  validateShared(body.shared ?? {});
  const spec = profile(body.specialist_id);
  if (!spec.formats.includes(body.format)) invalid('Специалист не предлагает этот формат');
  const message = bookingMessage(spec, body.slot, body.format, body.shared, body.message);
  // urllib.parse.urlencode uses quote_plus: ~ stays literal, * is escaped.
  const encoded = encodeURIComponent(message).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`).replaceAll('%20', '+');
  return { id, message, wa_url: `https://wa.me/${phone.replace(/\D/g, '')}?text=${encoded}` };
}
export function sendFeedback(body: FeedbackRequest, id: string, bookings: SavedBooking[] = []): FeedbackResult {
  const spec = profile(body.specialist_id);
  if (body.answers.length !== 4 || body.answers.some(v => typeof v !== 'boolean') || (body.comment?.length ?? 0) > 2000) invalid();
  if (body.booking_id) {
    const booking = bookings.find(b => b.id === body.booking_id);
    if (!booking) throw new ApiError(404, 'Запись не найдена');
    if (booking.specialist_id !== spec.id) invalid('Запись относится к другому специалисту');
  }
  const suggest_alternatives = !body.answers.every(Boolean);
  return { id, suggest_alternatives, alternatives: suggest_alternatives ? filterAndRank({ kind: spec.kind }).filter(s => s.id !== spec.id).slice(0, 3) : [] };
}
export function sendReport(body: ReportRequest, id: string) {
  if (body.category.length < 2 || body.category.length > 200 || body.text.length < 3 || body.text.length > 3000) invalid();
  if (body.specialist_id != null) profile(body.specialist_id);
  return { id };
}

// Scenario fallback from ai.py; Python's Unicode \w is explicit in JS regexes.
const word = '[\\p{L}\\p{N}_]';
const crisisPatterns = [
  'жить\\s+не\\s+хоч', 'не\\s+вижу\\s+смысла\\s+жить', 'незачем\\s+жить', 'өмірден\\s+кеткім\\s+кел', 'суицид', 'самоубий', 'поконч\\w*\\s+с\\s+собой', 'не\\s+хоч\\w*\\s+жить',
  'не\\s+хочется\\s+жить', 'хоч\\w*\\s+умереть', 'уби(?:ть|л|ла|ваю)\\s+себя', 'навред\\w*\\s+(?:себе|ребенку|ребёнку|ребенка|ребёнка)', 'самоповрежден', 'причин\\w*\\s+себе\\s+(?:вред|боль)', 'режу\\s+себя', 'хоч\\w*\\s+убить',
  'бейін\\s+өлтір', 'өзім\\w*\\s+өлтір', 'өзін\\w*\\s+өлтір', 'өлгім\\s+кел', 'өмір\\s+сүргім\\s+келм', 'өмір\\s+сүргісі\\s+келм', 'өзім\\w*\\s+зиян', 'бала\\w*\\s+зиян', 'бала\\w*\\s+өлтір',
  'мені\\s+ұрады', 'меня\\s+бьют', 'меня\\s+избива', 'баланы\\s+ұрады', 'бьют\\s+реб[её]нка', 'убью\\s+(?:себя|реб[её]нка)',
].map(p => new RegExp(p.replaceAll('\\w', word), 'u'));
export function chat(body: ChatRequest): ChatResult {
  const last = body.messages.at(-1);
  if (!last || body.messages.length > 20 || body.messages.some(m => !['user', 'assistant'].includes(m.role) || !m.content.length || m.content.length > 4000)) invalid();
  if (last.role !== 'user') invalid('Последнее сообщение должно быть от пользователя');
  const crisis = body.messages.some(m => {
    const text = casefold(m.content.normalize('NFKC')).replaceAll('ё', 'е').replace(/[^\p{L}\p{N}_\s]/gu, ' ').split(/\s+/).filter(Boolean).join(' ');
    return crisisPatterns.some(p => p.test(text));
  });
  const reply = crisis ? /[әғқңөұүһі]/u.test(casefold(last.content))
    ? 'Қазір сізге өте ауыр екенін түсінемін. Жалғыз қалмауға тырысыңыз: жақын адамыңызға хабарласып, 111 немесе 150 нөміріне қоңырау шалыңыз. Қауіпті заттардан алыстап, біреуден қасыңызда болуын сұраңыз.'
    : 'Мне очень жаль, что вам сейчас так тяжело. Пожалуйста, не оставайтесь одни: обратитесь к близкому человеку и позвоните 111 или 150. Если рядом есть опасные предметы, постарайтесь отойти от них и попросить кого-то побыть с вами.'
    : 'Похоже, сейчас много забот. Можно выбрать один небольшой шаг и попросить близкого человека помочь с ним. Если хочется выговориться, в DEMEU есть демо-каталог психологов для родителей.';
  return { reply: [reply], offer_psychologist: !crisis, crisis };
}
export function articles(): ArticlesResult { return { items: DATA.articles.map(a => ({ ...a, tags: [...a.tags] })) }; }
export function article(id: string) {
  const result = articles().items.find(a => a.id === id);
  if (!result) throw new ApiError(404, 'Статья не найдена');
  return result;
}
