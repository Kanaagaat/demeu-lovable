import { describe, expect, test } from 'vitest';
import seed from '../data/seed.json';
import oracle from './__fixtures__/parity.json';
import * as engine from './engine';
import type { ChildCard, Filters, MatchItem, PlanStep, SharedCard, SlotDay, SpecialistCard, SpecialistProfile } from './types';

const fixture = oracle as unknown as {
  now: string;
  cases: { card: ChildCard; filters: Filters; match: Pick<MatchItem, 'id' | 'score' | 'match' | 'reasons'>[]; plan: PlanStep[] }[];
  list_cases: { filters: Filters; items: SpecialistCard[] }[];
  slot_cases: { now: string; id: number; slots: SlotDay[]; card: SpecialistCard }[];
  booking: { shared: SharedCard; message: string; wa_url: string };
};
export const aidan = fixture.cases[0].card;
const now = new Date(fixture.now);
const profile = seed.specialists[0] as SpecialistProfile;

describe('Python engine parity (gen-parity-fixture.py)', () => {
  test('Айдан: top two and plan match the actual API rules', () => {
    const result = engine.match(aidan, {}, now);
    expect(result.items.slice(0, 2).map(s => [s.id, s.match])).toEqual([[1, true], [2, true]]);
    expect(result.plan.map(s => s.code)).toEqual(['pmpk', 'disability', 'speech', 'neuro', 'benefits']);
  });
  test.each(fixture.cases.map((c, i) => ({ ...c, label: `card ${Math.floor(i / 5) + 1}, filters ${i % 5 + 1}` })))('$label: order, score, match, reasons and full plan', c => {
    const result = engine.match(c.card, c.filters, now);
    expect(result.items.map(({ id, score, match, reasons }) => ({ id, score, match, reasons }))).toEqual(c.match);
    expect(result.plan).toEqual(c.plan);
    expect(engine.plan(c.card).steps).toEqual(c.plan);
  });
  test.each(fixture.list_cases)('list filters $filters', c => {
    expect(engine.listSpecialists(c.filters, now)).toEqual({ items: c.items, total: c.items.length });
  });
  test.each(fixture.slot_cases)('Almaty slots and next_slot: $now, id $id', c => {
    const detail = engine.getSpecialist(c.id, 'Бостандыкский', new Date(c.now));
    expect(detail.slots).toEqual(c.slots);
    for (const key of Object.keys(c.card) as (keyof SpecialistCard)[]) expect(detail[key]).toEqual(c.card[key]);
  });
  test('Python rounds .5 to even and preserves stable reason ordering', () => {
    const specialist = { ...profile, formats: ['Кабинет'] as SpecialistProfile['formats'], district: 'Жетысуский' };
    const card = { ...aidan, district: 'Алмалинский', goals: ['Речь'] as ChildCard['goals'] };
    // 35 + 10 + 20 + 7.5 + 5 + 5 = 82.5 -> 82 in Python.
    expect(engine.score(card, specialist).score).toBe(82);
  });
});

describe('endpoint behavior', () => {
  test('details include canonical reviews, methods, goals and seven days', () => {
    const result = engine.getSpecialist(1, aidan.district, now);
    expect(result.reviews).toEqual(seed.reviews.filter(r => r.specialist_id === 1));
    expect(result.methods).toEqual(profile.methods);
    expect(result.goals).toEqual(profile.goals);
    expect(result.slots).toHaveLength(7);
    expect(result).not.toHaveProperty('schedule');
    expect(result).not.toHaveProperty('whatsapp_phone');
  });
  test('travel time is zero only for online-only profiles', () => {
    expect(engine.getSpecialist(8, undefined, now).travel_minutes).toBe(0);
    expect(engine.getSpecialist(1, undefined, now).travel_minutes).toBeNull();
    expect(engine.getSpecialist(1, aidan.district, now).travel_minutes).toBe(5);
  });
  test('invalid inputs and unknown IDs use HTTP error semantics', () => {
    expect(() => engine.listSpecialists({ sort: 'near' })).toThrow('Для времени в пути укажите район');
    expect(() => engine.listSpecialists({ max_minutes: 20 })).toThrow();
    expect(() => engine.getSpecialist(99999)).toThrow('Специалист не найден');
    expect(() => engine.getSpecialist(1, 'Неизвестный')).toThrow('Неизвестный район');
    expect(() => engine.match({ ...aidan, age: 19 })).toThrow();
    expect(() => engine.match({ ...aidan, features: ['РАС', engine.UNKNOWN] })).toThrow();
    expect(() => engine.article('unknown')).toThrow('Статья не найдена');
  });
  test('empty features and goals produce an empty plan', () => {
    expect(engine.plan({ ...aidan, features: [], goals: [], react: 'Спокойно', disability: 'Нет' }).steps).toEqual([]);
  });
  test('meta uses the public endpoint shape, articles retain canonical tags', () => {
    expect(Object.keys(engine.getMeta()).sort()).toEqual(['districts', 'features', 'formats', 'goals', 'languages', 'roles']);
    expect(engine.getMeta().roles).toEqual([...new Set(seed.specialists.map(s => s.role))].sort());
    expect(engine.articles().items).toEqual(seed.articles);
    expect(engine.article(seed.articles[0].id)).toEqual(seed.articles[0]);
  });
  test('feedback alternatives exclude the current specialist; reports check IDs', () => {
    const positive = { specialist_id: 1, answers: [true, true, true, true] as [boolean, boolean, boolean, boolean] };
    expect(engine.sendFeedback(positive, 'feedback')).toEqual({ id: 'feedback', suggest_alternatives: false, alternatives: [] });
    const negative = engine.sendFeedback({ ...positive, answers: [true, false, true, true] }, 'feedback');
    expect(negative.suggest_alternatives).toBe(true);
    expect(negative.alternatives.map(s => s.id)).toEqual(engine.listSpecialists().items.filter(s => s.id !== 1).slice(0, 3).map(s => s.id));
    expect(() => engine.sendFeedback({ ...positive, booking_id: 'missing' }, 'feedback')).toThrow('Запись не найдена');
    expect(engine.sendReport({ category: 'Другое', text: 'Демо-пример' }, 'report')).toEqual({ id: 'report' });
    expect(() => engine.sendReport({ specialist_id: 99999, category: 'Другое', text: 'Демо-пример' }, 'report')).toThrow();
  });
  test('chat checks the entire history for crisis phrases in Russian and Kazakh', () => {
    expect(engine.chat({ messages: [{ role: 'user', content: 'Мне трудно' }] })).toMatchObject({ crisis: false, offer_psychologist: true });
    for (const content of ['Не хочу жить', 'Хочу навредить ребёнку', 'Өзіме зиян келтіргім келеді']) {
      const result = engine.chat({ messages: [{ role: 'user', content }, { role: 'assistant', content: 'Я рядом' }, { role: 'user', content: 'Спасибо' }] });
      expect(result).toMatchObject({ crisis: true, offer_psychologist: false });
      expect(result.reply[0]).toContain('111');
      expect(result.reply[0]).toContain('150');
    }
    expect(() => engine.chat({ messages: [{ role: 'assistant', content: 'Ответ' }] })).toThrow();
  });
});

describe('booking privacy and encoding', () => {
  const body = { specialist_id: 1, slot: '2026-12-01T10:00:00Z', format: 'Онлайн' as const };
  test('matches Python message and quote_plus exactly, including ~ and *', () => {
    const result = engine.createBooking({ ...body, shared: fixture.booking.shared }, 'booking', '', now);
    expect(result.message).toBe(fixture.booking.message);
    expect(result.wa_url).toBe(fixture.booking.wa_url);
  });
  test('only selected fields are included, even with a custom introduction', () => {
    const result = engine.createBooking({ ...body, shared: { goals: ['Речь'], age: 6, disability: null }, message: 'Хочу познакомиться & задать вопрос' }, 'booking', '', now);
    expect(result.message).toBe('Хочу познакомиться & задать вопрос\nО ребёнке (из DEMEU): Возраст: 6 лет; Цели: Речь');
    for (const label of ['Имя:', 'Район:', 'Особенности:', 'Общение:', 'Реакция на новых людей:', 'Инвалидность:']) expect(result.message).not.toContain(label);
    const url = new URL(result.wa_url);
    expect(url.searchParams.get('text')).toBe(result.message);
    expect(result.wa_url).toContain('%26');
    expect(result.wa_url).toContain('%0A');
  });
  test('age is written with the right word form', () => {
    expect([0, 1, 2, 4, 5, 11, 12, 14, 18].map(engine.ageText)).toEqual(['до 1 года', '1 год', '2 года', '4 года', '5 лет', '11 лет', '12 лет', '14 лет', '18 лет и старше']);
  });
  test('empty shared sends no card; demo phone is used only when configured', () => {
    const result = engine.createBooking(body, 'booking', '', now);
    expect(result.message).toBe('Здравствуйте, Анна Сергеева! Хочу записать ребёнка на 01.12.2026 в 15:00 (Онлайн).');
    expect(result.wa_url).toMatch(/^https:\/\/wa.me\/\?text=/);
    expect(engine.createBooking(body, 'booking', '+7 (000) 000-00-00', now).wa_url).toMatch(/^https:\/\/wa.me\/70000000000\?text=/);
  });
  test('rejects past/naive slots, unsupported format, and missing specialists', () => {
    expect(() => engine.createBooking({ ...body, slot: '2026-11-01T10:00:00Z' }, 'id', '', now)).toThrow();
    expect(() => engine.createBooking({ ...body, slot: '2026-12-01T10:00:00' }, 'id', '', now)).toThrow();
    expect(() => engine.createBooking({ ...body, format: 'На дом' }, 'id', '', now)).toThrow('Специалист не предлагает этот формат');
    expect(() => engine.createBooking({ ...body, specialist_id: 99999 }, 'id', '', now)).toThrow('Специалист не найден');
  });
});
