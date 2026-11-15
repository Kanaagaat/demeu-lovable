import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { I18nProvider } from '../../i18n';
import { AppStateProvider } from '../../state/AppState';
import { ToastProvider } from '../Toast';
import Specialists from '../../pages/Specialists';
import Specialist from '../../pages/Specialist';
import Compare from '../../pages/Compare';
import seed from '../../data/seed.json';
import * as api from '../../lib/api';
import type { ChildCard, SpecialistCard } from '../../lib/types';
import { resetFilters } from '../../state/specs';
import type { Quick } from '../../state/specs';

const card: ChildCard = { name: 'Айдан', age: 6, district: 'Бостандыкский', features: ['РАС'], comm: 'Отдельные слова', react: 'Нужно время, чтобы привыкнуть', goals: ['Речь', 'Общение'], disability: 'В процессе' };
function Location() { const { pathname, search } = useLocation(); return <output data-testid="location">{pathname}{search}</output>; }
function setup(path = '/specialists', hasCard = true) {
  localStorage.setItem('demeu.onboarded', 'true');
  if (hasCard) localStorage.setItem('demeu.card', JSON.stringify(card));
  return render(<I18nProvider><AppStateProvider><MemoryRouter initialEntries={[path]}><ToastProvider><Routes><Route path="/specialists" element={<Specialists />} /><Route path="/specialists/:id" element={<Specialist />} /><Route path="/compare" element={<Compare />} /><Route path="/book/:id" element={<div>booking destination</div>} /></Routes><Location /></ToastProvider></MemoryRouter></AppStateProvider></I18nProvider>);
}
function ids() { return [...document.querySelectorAll<HTMLElement>('[data-specialist-id]')].map(node => Number(node.dataset.specialistId)); }
const childCount = seed.specialists.filter(p => p.kind === 'child').length;
const parentIds = seed.specialists.filter(p => p.kind === 'parent').map(p => p.id);
async function loaded() { await waitFor(() => expect(ids().length).toBe(childCount)); }
afterEach(() => vi.restoreAllMocks());

describe('specialist discovery', () => {
  test.each<[Quick, string]>([['near', 'Рядом с домом'], ['home', 'На дом'], ['online', 'Онлайн'], ['free', 'Бесплатно'], ['cheap', 'До 10 000 ₸']])('quick chip %s changes the actual results', async (key, name) => {
    const user = userEvent.setup(); setup(); await loaded();
    await user.click(screen.getByRole('button', { name }));
    await waitFor(() => { expect(ids().length).toBeGreaterThan(0); expect(ids().length).toBeLessThan(childCount); });
    const baseline = await api.match(card);
    const predicate: Record<Quick, (item: SpecialistCard) => boolean> = {
      near: p => p.travel_minutes !== null && p.travel_minutes <= 20,
      home: p => p.formats.includes('На дом'), online: p => p.formats.includes('Онлайн'),
      free: p => p.price === 0, cheap: p => p.price <= 10000,
    };
    expect(ids()).toEqual(baseline.data.items.filter(predicate[key]).map(p => p.id));
    expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('location')).toHaveTextContent(`quick=${key}`);
    await user.click(screen.getByRole('button', { name })); await loaded();
  });
  test('quick chips intersect, including home AND online', async () => {
    const user = userEvent.setup(); setup(); await loaded();
    await user.click(screen.getByRole('button', { name: 'На дом' }));
    await user.click(screen.getByRole('button', { name: 'Онлайн' }));
    const expected = seed.specialists.filter(s => s.kind === 'child' && s.formats.includes('На дом') && s.formats.includes('Онлайн')).map(s => s.id);
    await waitFor(() => expect(ids().sort()).toEqual(expected.sort()));
  });
  test('all filter groups, travel slider and verification reset together', async () => {
    const user = userEvent.setup(); setup('/specialists?quick=cheap&specialty=Логопед&max_minutes=20&verified=true&sort=rating&view=list');
    await screen.findByText('Анна Сергеева');
    await user.click(screen.getByRole('button', { name: /Фильтры/ }));
    const dialog = screen.getByRole('dialog', { name: 'Фильтры' });
    expect(within(dialog).getByRole('slider')).toHaveValue('20');
    expect(within(dialog).getByRole('switch')).toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: 'Сбросить' }));
    expect(within(dialog).getByRole('slider')).toHaveValue('60');
    expect(within(dialog).getByRole('switch')).not.toBeChecked();
    await user.click(await within(dialog).findByRole('button', { name: /Показать/ }));
    await loaded();
    expect(screen.getByTestId('location')).toHaveTextContent('sort=rating');
    expect(screen.getByTestId('location').textContent).not.toMatch(/quick|specialty|max_minutes|verified|sheet/);
  });
  test('demo empty state and reset restore real list', async () => {
    const user = userEvent.setup(); setup('/specialists?state=empty');
    expect(await screen.findByText('Ничего не нашли по фильтрам')).toBeInTheDocument();
    expect(ids()).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Сбросить фильтры' })); await loaded();
  });
  test('demo error retry and explicit loading state', async () => {
    const user = userEvent.setup(); const result = setup('/specialists?state=error');
    await screen.findByText('Не получилось загрузить');
    await user.click(screen.getByRole('button', { name: 'Повторить' })); await loaded();
    result.unmount(); setup('/specialists?state=loading');
    expect(screen.getByRole('status', { name: 'Загружаем специалистов' })).toBeInTheDocument();
    await act(async () => { await Promise.resolve(); });
    expect(ids()).toHaveLength(0);
  });
  test('comparison stops at three and shows limit toast', async () => {
    const user = userEvent.setup(); setup(); await loaded();
    const buttons = screen.getAllByRole('button', { name: /Добавить к сравнению:/ });
    await user.click(buttons[0]);
    expect(screen.getByText('Добавлено. Выберите ещё 1–2 для сравнения')).toBeInTheDocument();
    await user.click(buttons[1]); await user.click(buttons[2]); await user.click(buttons[3]);
    expect(screen.getByText('Можно сравнить до 3 специалистов')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('demeu.compare')!)).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Сравнить (3)' })).toBeInTheDocument();
  });
  test('parent segment returns parent specialists even with a child card', async () => {
    const user = userEvent.setup(); setup(); await loaded();
    await user.click(screen.getByRole('button', { name: 'Для меня' }));
    await waitFor(() => expect(ids().sort()).toEqual([...parentIds].sort()));
    expect(ids()).toHaveLength(parentIds.length);
  });
  test('map uses the filtered results and opens a selected pin preview', async () => {
    const user = userEvent.setup(); setup('/specialists?view=map&quick=free');
    const spec = seed.specialists.find(s => s.kind === 'child' && s.price === 0)!;
    await user.click(await screen.findByRole('button', { name: `${spec.name}, Бесплатно` }));
    expect(screen.getByRole('link', { name: 'Подробнее' })).toHaveAttribute('href', `/specialists/${spec.id}`);
    expect(screen.getByRole('link', { name: 'Записаться' })).toHaveAttribute('href', `/book/${spec.id}`);
    expect(screen.queryByRole('button', { name: 'Анна Сергеева, 8 000 ₸' })).not.toBeInTheDocument();
  });
  test('without a card the list works and proximity explains the required district', async () => {
    const user = userEvent.setup(); setup('/specialists', false); await loaded();
    await user.click(screen.getByRole('button', { name: 'Рядом с домом' }));
    expect(screen.getByText('Заполните район в карточке ребёнка, чтобы рассчитать время от дома.')).toBeInTheDocument();
    expect(ids()).toHaveLength(childCount);
  });
});

test('returning from a profile restores search, sort and chips in URL', async () => {
  const user = userEvent.setup(); setup('/specialists?q=Анна&sort=cheap&quick=online');
  await user.click(await screen.findByRole('heading', { name: 'Анна Сергеева' }));
  await screen.findByRole('button', { name: 'Сообщить о проблеме' });
  await user.click(screen.getByRole('button', { name: 'Назад' }));
  expect(await screen.findByRole('textbox', { name: 'Имя или специальность' })).toHaveValue('Анна');
  expect(screen.getByRole('button', { name: 'Онлайн' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Дешевле' })).toBeInTheDocument();
});
test('Kazakh interface renders translated discovery and filter labels', async () => {
  localStorage.setItem('demeu.lang', 'kz'); const user = userEvent.setup(); setup(); await loaded();
  expect(screen.getByRole('heading', { name: 'Мамандар' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Сүзгілер' }));
  expect(screen.getByRole('dialog', { name: 'Сүзгілер' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Тегін / квота бойынша' })).toBeInTheDocument();
  expect(document.body.textContent).not.toContain('specs.');
});

describe('profile and comparison', () => {
  test('profile renders API reasons, contextual reviews, methods and booking link', async () => {
    const user = userEvent.setup(); setup('/specialists/1');
    expect(await screen.findByRole('heading', { name: 'Анна Сергеева' })).toBeInTheDocument();
    const matched = await api.match(card); const reasons = matched.data.items.find(s => s.id === 1)!.reasons;
    for (const reason of reasons) expect(await screen.findByText(reason)).toBeInTheDocument();
    const detail = await api.getSpecialist(1, card.district);
    for (const review of detail.data.reviews.slice(0, 2)) { expect(screen.getByText(review.child_context)).toBeInTheDocument(); expect(screen.getAllByText(review.text).length).toBeGreaterThan(0); }
    const method = detail.data.methods[0]; await user.click(screen.getByRole('button', { name: method.name })); expect(screen.getByText(method.desc)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Записаться' })).toHaveAttribute('href', '/book/1');
  });
  test('report sheet sends category and text, then thanks the parent', async () => {
    const send = vi.spyOn(api, 'sendReport').mockResolvedValue({ data: { id: 'report-demo' }, source: 'seed' });
    const user = userEvent.setup(); setup('/specialists/1');
    await user.click(await screen.findByRole('button', { name: 'Сообщить о проблеме' }));
    const dialog = screen.getByRole('dialog');
    const submit = within(dialog).getByRole('button', { name: 'Отправить модераторам' });
    expect(submit).toBeDisabled();
    await user.click(within(dialog).getByRole('radio', { name: 'Давление на ребёнка' }));
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Хочу обсудить ситуацию с модератором' } });
    await user.click(submit);
    await waitFor(() => expect(send).toHaveBeenCalledWith({ specialist_id: 1, category: 'Давление на ребёнка', text: 'Хочу обсудить ситуацию с модератором' }));
    expect(await screen.findByText('Спасибо, модератор Мама Про проверит')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  test('comparison renders two columns, meaningful rows, and booking links', async () => {
    localStorage.setItem('demeu.compare', '[1,2]'); setup('/compare');
    expect(await screen.findAllByTestId('compare-column')).toHaveLength(2);
    for (const name of ['Цена за занятие', 'Время в пути от дома', 'Опыт: РАС', 'Ближайший слот', 'Совпадение с карточкой']) expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Записаться' }).map(n => n.getAttribute('href'))).toEqual(['/book/1', '/book/2']);
    await userEvent.click(screen.getByRole('button', { name: 'Убрать из сравнения: Дана Мусина' }));
    expect(screen.getByText('Выберите хотя бы двух специалистов')).toBeInTheDocument();
  });
  test('reset preserves route context and removes all filters', () => {
    const next = resetFilters(new URLSearchParams('view=map&sort=near&sheet=filters&q=test&quick=free&format=Онлайн&group=group&lang=Русский&exp=РАС&price=free&state=empty'));
    expect([...next.keys()]).toEqual(['view', 'sort', 'sheet']);
  });
});
