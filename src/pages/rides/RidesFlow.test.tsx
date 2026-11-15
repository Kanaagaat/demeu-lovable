import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import App from '../../App';
import { getRide, listRides } from '../../lib/rides';
import type { ChildCard } from '../../lib/types';

// Set env before App and the real rides client are imported. No screen/client/hook mocks.
vi.hoisted(() => {
  vi.stubEnv('VITE_API_URL', '');
  vi.stubEnv('VITE_RIDES_ENABLED', 'true');
});

const card: ChildCard = {
  age: 6, district: 'Бостандыкский', features: ['РАС'], disability: 'Да',
  comm: 'Отдельные слова', react: 'Нужно время, чтобы привыкнуть', goals: ['Общение'],
};
let fetchMock: ReturnType<typeof vi.fn>;

function Location() { return <output aria-label="Текущий маршрут">{useLocation().pathname}</output>; }
async function advance(ms: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}
function expectTimeline(index: number) {
  const steps = within(screen.getByRole('list', { name: 'Этапы поездки' })).getAllByRole('listitem');
  expect(steps.map(step => step.textContent)).toEqual(['Принял', 'Едет', 'На месте', 'Ребёнок в машине', 'В пути', 'Доставил']);
  steps.forEach((step, position) => {
    if (position === index) expect(step).toHaveAttribute('aria-current', 'step');
    else expect(step).not.toHaveAttribute('aria-current');
  });
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('demeu.onboarded', 'true');
  localStorage.setItem('demeu.lang', 'ru');
  localStorage.setItem('demeu.card', JSON.stringify(card));
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-14T10:00:00Z'));
  fetchMock = vi.fn().mockRejectedValue(new Error('Unexpected network request'));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup(); // Stop polling before restoring real timers, also when an assertion fails.
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test('App: eligible card → search → two demo offers → PIN and every timeline step → rating', async () => {
  render(<MemoryRouter initialEntries={[{
    pathname: '/rides/new', state: { to_address: 'Демо-центр, 2' },
  }]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><App /><Location /></MemoryRouter>);
  await act(async () => { await vi.dynamicImportSettled(); });

  expect(screen.getByRole('heading', { name: 'Вам может быть положено бесплатное инватакси' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Позвонить перевозчику' })).toHaveAttribute('href', 'tel:+77000000000');
  expect(screen.getByRole('button', { name: 'РАС' })).toHaveAttribute('aria-pressed', 'true');
  await advance(250); // Real useEstimate debounce, with the offline estimate.
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Ваша цена, ₸' }), { target: { value: '3000' } });
  expect(screen.getByRole('button', { name: 'Найти водителя' })).toBeEnabled();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Найти водителя' })); });
  await act(async () => { await vi.dynamicImportSettled(); });

  const [created] = await listRides();
  expect(created).toMatchObject({ status: 'searching', parent_price: 3000, categories: ['asd'], show_category: true });
  expect(screen.getByLabelText('Текущий маршрут')).toHaveTextContent(`/rides/${created.id}`);
  expect(screen.getByRole('heading', { name: 'Поиск водителя' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Принять:/ })).not.toBeInTheDocument();
  await advance(3999);
  expect(screen.queryByRole('button', { name: /^Принять:/ })).not.toBeInTheDocument();
  await advance(1); // Second poll at 4 s triggers the lazy offline demo replies.

  const offers = screen.getAllByRole('button', { name: /^Принять:/ });
  expect(offers).toHaveLength(2);
  const offered = await getRide(created.id);
  expect(offered.offers.map(offer => offer.price).sort((a, b) => a - b)).toEqual([3000, 3500]);
  expect(offered.offers.every(offer => offer.driver.is_demo)).toBe(true);
  await act(async () => { fireEvent.click(offers[0]); });

  expect(screen.getByRole('heading', { name: 'Водитель принял поездку' })).toBeInTheDocument();
  expectTimeline(0);
  const accepted = await getRide(created.id);
  expect(accepted.pin).toMatch(/^\d{4}$/);
  expect(screen.getByLabelText(`PIN: ${accepted.pin}`)).toBeInTheDocument();

  const headings = ['Едет к вам', 'Водитель на месте', 'Ребёнок в машине', 'В пути'];
  for (const [index, heading] of headings.entries()) {
    await advance(8000);
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expectTimeline(index + 1);
    if (index < 2) expect(screen.getByLabelText(`PIN: ${accepted.pin}`)).toBeInTheDocument();
    else {
      expect(screen.queryByLabelText(`PIN: ${accepted.pin}`)).not.toBeInTheDocument();
      expect(screen.getByText('Посадка подтверждена')).toBeInTheDocument();
    }
  }
  // On the final «Доставил» step the dispatcher replaces tracking with the rating screen.
  await advance(8000);
  expect((await getRide(created.id)).status).toBe('completed');
  expect(screen.getByRole('heading', { name: 'Поездка завершена' })).toBeInTheDocument();
  expect(screen.getByRole('form', { name: 'Как прошла поездка?' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Отправить оценку' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Оценка: 5 из 5' }));
  fireEvent.click(screen.getByRole('button', { name: 'Спокойно' }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Отправить оценку' })); });
  expect(screen.getByText('Спасибо!')).toHaveAttribute('role', 'status');
  expect(await getRide(created.id)).toMatchObject({ rating_stars: 5, rating_tags: ['calm'] });
  expect(fetchMock).not.toHaveBeenCalled();
});
