import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import { rateRide } from '../../lib/rides';
import { RidesError } from '../../lib/ridesTypes';
import type { RideView } from '../../lib/ridesTypes';
import { ToastProvider } from '../Toast';
import { RideDone } from './RideDone';

vi.mock('../../lib/rides', async importOriginal => ({ ...await importOriginal<typeof import('../../lib/rides')>(), rateRide: vi.fn() }));
vi.mock('../../lib/sfx', () => ({ play: vi.fn() }));

function ride(patch: Partial<RideView> = {}): RideView {
  return {
    id: 'ride-test', mode: 'express', from_district: 'Демо-район', from_address: 'Демо-дом, 1', to_address: 'Демо-центр, 2',
    scheduled_at: null, repeat_days: [], needs_escort: false, categories: [], category_other: '', show_category: false,
    needs: [], comment: '', hints: [], parent_price: 2000, initial_price: 2000, final_price: 3100,
    status: 'completed', driver_id: 'drv-test', pin: '0123', rating_stars: null, rating_tags: [],
    created_at: '2026-11-14T10:00:00Z', status_changed_at: '2026-11-14T10:00:00Z', price_changed_at: '2026-11-14T10:00:00Z', offers: [],
    driver: { id: 'drv-test', name: 'Арман Демо', initials: 'АД', phone: '+7 700 000 00 01', car: 'Демо-авто', plate: '000 DMU 02',
      rating: 4.9, verified: true, trained: true, kit_ok: true, worked_with: [], is_demo: true }, ...patch,
  };
}
function Destination() { return <p>{useLocation().pathname}</p>; }
function open(value = ride()) {
  return render(<MemoryRouter initialEntries={['/rides/ride-test']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <I18nProvider><ToastProvider><Routes>
      <Route path="/rides/:id" element={<RideDone ride={value} />} />
      <Route path="/rides" element={<Destination />} /><Route path="/" element={<Destination />} />
    </Routes></ToastProvider></I18nProvider>
  </MemoryRouter>);
}
beforeEach(() => { vi.mocked(rateRide).mockReset().mockResolvedValue(ride({ rating_stars: 4 })); });
afterEach(() => { vi.restoreAllMocks(); });

describe('completed trip and rating', () => {
  test('shows mascot, final cash amount, route and driver', () => {
    open();
    expect(screen.getByRole('heading', { name: 'Поездка завершена' })).toBeInTheDocument();
    expect(document.querySelector('img[src="/mascot/m-cheer.png"]')).toBeInTheDocument();
    expect(screen.getByText('К оплате наличными водителю: 3 100 ₸')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Итоги поездки' })).toHaveTextContent('Демо-дом, 1 → Демо-центр, 2');
    expect(screen.getByText('Арман Демо')).toBeInTheDocument();
    expect(screen.getByText('Демо-авто · 000 DMU 02')).toBeInTheDocument();
    expect(screen.queryByLabelText('PIN: 0123')).not.toBeInTheDocument();
  });
  test('submit disabled without stars and guarded against manual submit', () => {
    open();
    expect(screen.getByRole('button', { name: 'Отправить оценку' })).toBeDisabled();
    fireEvent.submit(screen.getByRole('form', { name: 'Как прошла поездка?' }));
    expect(rateRide).not.toHaveBeenCalled();
  });
  test('sends selected stars and multiple tags, then thanks without form', async () => {
    open();
    await userEvent.click(screen.getByRole('button', { name: 'Оценка: 4 из 5' }));
    expect(screen.getByRole('button', { name: 'Оценка: 4 из 5' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Спокойно' }));
    await userEvent.click(screen.getByRole('button', { name: 'Бережно' }));
    await userEvent.click(screen.getByRole('button', { name: 'Вовремя' }));
    await userEvent.click(screen.getByRole('button', { name: 'Бережно' }));
    await userEvent.click(screen.getByRole('button', { name: 'Отправить оценку' }));
    expect(rateRide).toHaveBeenCalledExactlyOnceWith('ride-test', 4, ['calm', 'on_time']);
    expect(screen.getByText('Спасибо!')).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });
  test('existing rating shows thanks immediately', () => {
    open(ride({ rating_stars: 5, rating_tags: ['careful'] }));
    expect(screen.getByText('Спасибо за оценку')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Отправить оценку' })).not.toBeInTheDocument();
  });
  test('failed rating keeps selection and allows retry', async () => {
    vi.mocked(rateRide).mockRejectedValueOnce(new Error('offline'));
    open(); await userEvent.click(screen.getByRole('button', { name: 'Оценка: 5 из 5' }));
    await userEvent.click(screen.getByRole('button', { name: 'Отправить оценку' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Нет связи. Последние данные сохранены. Попробуйте ещё раз.');
    expect(screen.getByRole('button', { name: 'Оценка: 5 из 5' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Отправить оценку' }));
    expect(screen.getByText('Спасибо!')).toBeInTheDocument();
  });
  test('already_rated response closes form', async () => {
    vi.mocked(rateRide).mockRejectedValueOnce(new RidesError(409, 'already_rated'));
    open(); await userEvent.click(screen.getByRole('button', { name: 'Оценка: 5 из 5' }));
    await userEvent.click(screen.getByRole('button', { name: 'Отправить оценку' }));
    expect(screen.getByText('Спасибо!')).toBeInTheDocument();
  });
  test('prevents double submission and freezes choices while saving', async () => {
    let finish!: (value: RideView) => void;
    vi.mocked(rateRide).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    open(); fireEvent.click(screen.getByRole('button', { name: 'Оценка: 3 из 5' }));
    const form = screen.getByRole('form', { name: 'Как прошла поездка?' });
    fireEvent.submit(form); fireEvent.submit(form);
    expect(rateRide).toHaveBeenCalledExactlyOnceWith('ride-test', 3, []);
    expect(screen.getByRole('button', { name: 'Спокойно' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Оценка: 5 из 5' })).toBeDisabled();
    await act(async () => finish(ride({ rating_stars: 3 })));
    expect(screen.getByText('Спасибо!')).toBeInTheDocument();
  });
});

describe('favourite and navigation', () => {
  test('adds favourite on device, reads it on reopening and can remove it', async () => {
    const view = open();
    const favourite = screen.getByRole('button', { name: 'Сделать постоянным водителем' });
    expect(favourite).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(favourite);
    expect(JSON.parse(localStorage.getItem('demeu.favDrivers')!)).toEqual(['drv-test']);
    expect(screen.getByText('Водитель добавлен в постоянные')).toBeInTheDocument();
    view.unmount(); open();
    expect(screen.getByRole('button', { name: 'Сделать постоянным водителем' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Сделать постоянным водителем' }));
    expect(JSON.parse(localStorage.getItem('demeu.favDrivers')!)).toEqual([]);
    expect(rateRide).not.toHaveBeenCalled();
  });
  test('storage failure reports error without marking favourite as saved', async () => {
    open();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    await userEvent.click(screen.getByRole('button', { name: 'Сделать постоянным водителем' }));
    expect(screen.getByRole('button', { name: 'Сделать постоянным водителем' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Не удалось сохранить водителя на устройстве. Попробуйте ещё раз.')).toBeInTheDocument();
  });
  test.each([['Готово', '/rides'], ['На главную', '/']])('%s goes to %s', async (label, destination) => {
    open(); await userEvent.click(screen.getByRole('button', { name: label }));
    expect(screen.getByText(destination)).toBeInTheDocument();
  });
});
