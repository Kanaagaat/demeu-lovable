import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import { I18nProvider } from '../i18n';
import { AppStateProvider } from '../state/AppState';
import { ToastProvider } from '../components/Toast';
import * as api from '../lib/api';
import type { ChildCard } from '../lib/types';
import Home from './Home';
import Resources from './Resources';

const card: ChildCard = { name: 'Айдан', age: 6, district: 'Бостандыкский', features: ['РАС'], comm: 'Пока не говорит', react: 'Спокойно', goals: ['Речь'], disability: 'Нет' };
function wrap(children: ReactNode, path = '/') {
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><I18nProvider><AppStateProvider><ToastProvider>{children}</ToastProvider></AppStateProvider></I18nProvider></MemoryRouter>);
}
beforeEach(() => { localStorage.clear(); localStorage.setItem('demeu.onboarded', 'true'); localStorage.setItem('demeu.card', JSON.stringify(card)); });
afterEach(() => { vi.restoreAllMocks(); });

describe('home: your specialist and news', () => {
  test('nobody is chosen yet: an honest empty state instead of «suitable specialists»', async () => {
    wrap(<Home />);
    expect(await screen.findByRole('heading', { name: 'Ваш специалист' })).toBeInTheDocument();
    expect(screen.getByText('Вы ещё никого не выбрали')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Найти специалиста' })).toBeInTheDocument();
    expect(screen.queryByText(/Подходящие специалисты/i)).not.toBeInTheDocument();
  });
  test('after a booking the booked specialist is shown', async () => {
    localStorage.setItem('demeu.bookings', JSON.stringify([{ id: 'b1', specialist_id: 1, slot: new Date(Date.now() + 2 * 86400000).toISOString(), format: 'Кабинет', created_at: new Date().toISOString() }]));
    wrap(<Home />);
    expect(await screen.findByText(/Ближайшая запись/)).toBeInTheDocument();
    expect(screen.queryByText('Вы ещё никого не выбрали')).not.toBeInTheDocument();
    expect(document.querySelector('[data-specialist-id="1"]')).not.toBeNull();
  });
  test('events and news come from the API and show their kind, audience and link', async () => {
    vi.spyOn(api, 'news').mockResolvedValue({ source: 'api', data: { items: [
      { id: 'n1', kind: 'course', audience: 'parents', title: 'Курс лидерства для родителей', body: 'Четыре вечерние встречи онлайн.', link: 'https://example.org/course', event_date: '2026-12-05', pinned: true },
      { id: 'n2', kind: 'benefit', audience: 'all', title: 'Изменился порядок оформления', body: 'Теперь заявление можно подать онлайн.', link: null, event_date: null, pinned: false },
    ] } });
    wrap(<Home />);
    const heading = await screen.findByRole('heading', { name: 'События и новости' });
    expect(heading).toBeInTheDocument();
    const course = (await screen.findByText('Курс лидерства для родителей')).closest('article')!;
    expect(within(course).getByText('Курс')).toBeInTheDocument();
    expect(within(course).getByText('Для родителей')).toBeInTheDocument();
    expect(within(course).getByRole('link', { name: /Подробнее/ })).toHaveAttribute('href', 'https://example.org/course');
    expect(screen.getByText('Изменился порядок оформления').closest('article')).not.toBeNull();
  });
});

describe('resources', () => {
  test('communities are grouped by condition and the card comes first', async () => {
    wrap(<Resources />, '/resources#communities');
    const headings = (await screen.findAllByRole('heading', { level: 2 })).map(h => h.textContent);
    expect(headings.indexOf('РАС (аутизм)')).toBeGreaterThan(-1);
    expect(headings.indexOf('РАС (аутизм)')).toBeLessThan(headings.indexOf('Синдром Дауна'));
    const link = screen.getByRole('link', { name: /Аутизм победим!, Добровольное общество/ });
    expect(link).toHaveAttribute('href', 'https://autismpobedim.kz/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.getAllByText(/Проверенных сообществ для этого направления мы пока не нашли/).length).toBeGreaterThan(0);
  });
  test('government services tab lists official links; videos are built from the card', async () => {
    const user = userEvent.setup();
    wrap(<Resources />, '/resources');
    expect(await screen.findByRole('link', { name: /eGov\.kz/ })).toHaveAttribute('href', 'https://egov.kz');
    expect(screen.getByRole('link', { name: /Госкорпорация/ })).toHaveAttribute('href', 'https://gov4c.kz');
    await user.click(screen.getByRole('button', { name: 'Видео' }));
    expect(screen.getByRole('heading', { name: 'Видео для родителей' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Видео для ребёнка' })).toBeInTheDocument();
    const video = screen.getByRole('link', { name: /Как заниматься с ребёнком с РАС дома/ });
    expect(video.getAttribute('href')).toMatch(/^https:\/\/www\.youtube\.com\/results\?search_query=/);
    expect(screen.getByRole('link', { name: /Аутизм победим!/ })).toHaveAttribute('href', expect.stringContaining('youtube.com/channel/'));
    expect(screen.getByText(/не заменяют занятий со специалистом/)).toBeInTheDocument();
  });
});
