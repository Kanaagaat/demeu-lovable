import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import type { RideStatus, RideView } from '../../lib/ridesTypes';
import { useMyRides } from '../../state/rides';
import Rides from './Rides';

vi.mock('../../state/rides', () => ({ useMyRides: vi.fn() }));
const refresh = vi.fn();
function ride(id: string, status: RideStatus = 'searching', extra: Partial<RideView> = {}): RideView {
  return { id, mode: 'express', from_district: 'Бостандыкский', from_address: `Дом ${id}`, to_address: `Центр ${id}`,
    scheduled_at: null, repeat_days: [], needs_escort: false, categories: [], category_other: '', show_category: false,
    needs: [], comment: '', hints: [], parent_price: 2500, initial_price: 2500, final_price: null, status,
    driver_id: null, driver: null, rating_stars: null, rating_tags: [], created_at: '2026-11-14T10:00:00Z',
    status_changed_at: '2026-11-14T10:00:00Z', price_changed_at: '2026-11-14T10:00:00Z', offers: [], ...extra };
}
function Destination() { return <p>{useLocation().pathname}</p>; }
function open() {
  return render(<MemoryRouter initialEntries={['/rides']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><I18nProvider><Routes>
    <Route path="/rides" element={<Rides />} /><Route path="/rides/:id" element={<Destination />} />
  </Routes></I18nProvider></MemoryRouter>);
}
beforeEach(() => {
  refresh.mockClear();
  vi.mocked(useMyRides).mockReturnValue({ data: [], loading: false, error: null, offline: false, refresh });
});

test('groups active, scheduled by date and terminal rides without duplicates', () => {
  const active = ['searching', 'accepted', 'driver_on_way', 'arrived', 'child_in_car', 'in_ride'] as const;
  vi.mocked(useMyRides).mockReturnValue({ data: [
    ...active.map(status => ride(status, status)),
    ride('later', 'accepted', { mode: 'scheduled', scheduled_at: '2026-11-17T12:00:00Z', repeat_days: [3, 1], final_price: 3100 }),
    ride('sooner', 'searching', { mode: 'scheduled', scheduled_at: '2026-11-16T12:00:00Z' }),
    ride('departed', 'driver_on_way', { mode: 'scheduled', scheduled_at: '2026-11-16T12:00:00Z' }),
    ride('completed', 'completed', { mode: 'scheduled', scheduled_at: '2026-11-13T12:00:00Z' }),
    ride('cancelled', 'cancelled'),
  ], loading: false, error: null, offline: false, refresh });
  open();
  const current = screen.getByRole('region', { name: 'Активная' });
  expect(within(current).getAllByRole('link')).toHaveLength(7);
  for (const status of active) expect(within(current).getByRole('link', { name: new RegExp(`Дом ${status}`) })).toHaveAttribute('href', `/rides/${status}`);
  const scheduled = screen.getByRole('region', { name: 'Запланированные' });
  expect(within(scheduled).getAllByRole('link').map(link => link.getAttribute('href'))).toEqual(['/rides/sooner', '/rides/later']);
  expect(within(scheduled).getByText('Регулярно: вт, чт')).toBeInTheDocument();
  expect(within(scheduled).getByText(/3\s100 ₸/)).toBeInTheDocument();
  expect(within(scheduled).getByText(/16 ноября/)).toHaveAttribute('dateTime', '2026-11-16T12:00:00Z');
  const history = screen.getByRole('region', { name: 'История' });
  expect(within(history).getAllByRole('link').map(link => link.getAttribute('href'))).toEqual(['/rides/completed', '/rides/cancelled']);
  expect(screen.getAllByRole('listitem')).toHaveLength(11);
});

test('empty state offers a single new ride action and mascot', () => {
  open();
  expect(screen.getByRole('heading', { name: 'Поездок пока нет' })).toBeInTheDocument();
  expect(document.querySelector('img[src="/mascot/m-hug.png"]')).toBeInTheDocument();
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: 'Новая поездка' }));
  expect(screen.getByText('/rides/new')).toBeInTheDocument();
});

test('a card opens the ride dispatcher', () => {
  vi.mocked(useMyRides).mockReturnValue({ data: [ride('demo')], loading: false, error: null, offline: false, refresh });
  open();
  expect(screen.getByText(/2\s500 ₸/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: /Дом demo/ }));
  expect(screen.getByText('/rides/demo')).toBeInTheDocument();
});

test('loading and an unavailable list never claim there are no rides', () => {
  vi.mocked(useMyRides).mockReturnValue({ data: null, loading: true, error: null, offline: false, refresh });
  const view = open();
  expect(screen.getByRole('status')).toHaveTextContent('Загружаем');
  expect(screen.queryByText('Поездок пока нет')).not.toBeInTheDocument();
  view.unmount();
  vi.mocked(useMyRides).mockReturnValue({ data: null, loading: false, error: null, offline: true, refresh });
  open();
  expect(screen.getByRole('status')).toHaveTextContent('Не удалось загрузить');
  expect(screen.queryByText('Поездок пока нет')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
  expect(refresh).toHaveBeenCalledOnce();
});

test('offline keeps the last known rides visible and API errors allow retry', () => {
  vi.mocked(useMyRides).mockReturnValue({ data: [ride('saved')], loading: false, error: 'unknown', offline: true, refresh });
  open();
  expect(screen.getByRole('status')).toHaveTextContent('Показываем последние данные');
  expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить');
  expect(screen.getByRole('link', { name: /Дом saved/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
  expect(refresh).toHaveBeenCalledOnce();
});

test('Kazakh list translates headings, status, mode and recurrence', () => {
  localStorage.setItem('demeu.lang', 'kz');
  vi.mocked(useMyRides).mockReturnValue({ data: [ride('kz', 'searching', { mode: 'scheduled', scheduled_at: '2026-11-17T12:00:00Z', repeat_days: [1, 3] })], loading: false, error: null, offline: false, refresh });
  open();
  expect(screen.getByRole('heading', { name: 'Менің сапарларым' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Жоспарланған' })).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/ridesEntry\.|rides\./);
});
