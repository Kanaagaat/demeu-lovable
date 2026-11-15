import { describe, expect, it } from 'vitest';
import cases from '../data/plan_cases.json';
import { KB, buildPersonalPlan, communitySections, stepIds, videoLinks } from './personalPlan';
import type { ChildCard } from './types';

describe('family plan rules', () => {
  // The same file is checked by the server tests: both sides must produce the identical plan.
  it.each(cases as { name: string; card: ChildCard; steps: string[] }[])('matches the server for $name', ({ card, steps }) => {
    expect(stepIds({ ...card, district: 'Бостандыкский' })).toEqual(steps);
  });
  it('starts in the clinic and groups steps into four stages in order', () => {
    const plan = buildPersonalPlan({ age: 6, district: 'Бостандыкский', features: ['РАС'], comm: 'Пока не говорит', react: 'Бывают сильные реакции', goals: ['Речь', 'Поведение'], disability: 'Нет' });
    expect(plan.stages.map(s => s.id)).toEqual(['clinic', 'status', 'benefits', 'growth']);
    expect(plan.steps[0].id).toBe('c-attach');
    const ids = plan.steps.map(s => s.id);
    expect(ids.indexOf('c-vkk')).toBeLessThan(ids.indexOf('s-pmpk'));
    expect(ids.indexOf('s-pmpk')).toBeLessThan(ids.indexOf('s-mse'));
    expect(plan.steps.find(s => s.id === 'g-speech')?.specialist_id).toBeTruthy();
    expect(plan.steps.find(s => s.id === 's-mse')?.age_notes[0]).toContain('ребёнок с инвалидностью');
  });
  it('resolves links of official resources and communities', () => {
    const plan = buildPersonalPlan({ age: 4, district: 'Алмалинский', features: ['Синдром Дауна'], comm: 'Отдельные слова', react: 'Спокойно', goals: ['Речь'], disability: 'Да' });
    const urls = plan.steps.flatMap(s => s.links.map(l => l.url));
    expect(urls).toContain('https://gov4c.kz');
    expect(urls).toContain('https://downsideup.org/');
    expect(urls.every(u => u.startsWith('https://'))).toBe(true);
  });
  it('orders community sections by the card and builds youtube searches', () => {
    const card: ChildCard = { age: 6, district: 'Бостандыкский', features: ['РАС'], comm: 'Пока не говорит', react: 'Спокойно', goals: ['Речь'], disability: 'Нет' };
    const sections = communitySections(card);
    expect(sections[0].id).toBe('general');
    expect(sections.find(s => s.id === 'autism')?.items.length).toBeGreaterThan(2);
    expect(sections.findIndex(s => s.id === 'autism')).toBeLessThan(sections.findIndex(s => s.id === 'down'));
    const videos = videoLinks(card);
    expect(videos.parents.length).toBeGreaterThan(2);
    expect(videos.parents.some(v => v.label.includes('РАС'))).toBe(true);
    expect(videos.child.some(v => decodeURIComponent(v.url).includes('6 лет'))).toBe(true);
    expect(videos.parents.every(v => v.url.startsWith('https://www.youtube.com/results?search_query='))).toBe(true);
    expect(KB.steps.length).toBeGreaterThan(25);
  });
});
