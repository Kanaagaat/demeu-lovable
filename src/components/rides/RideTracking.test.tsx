import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import { cancelRide } from '../../lib/rides';
import { RIDE_FLOW, RidesError } from '../../lib/ridesTypes';
import type { RideView } from '../../lib/ridesTypes';
import { ToastProvider } from '../Toast';
import { RideTracking } from './RideTracking';
import { Timeline } from './Timeline';

vi.mock('../../lib/rides', async importOriginal => ({ ...await importOriginal<typeof import('../../lib/rides')>(), cancelRide: vi.fn() }));
vi.mock('../../lib/sfx', () => ({ play: vi.fn() }));

function ride(patch: Partial<RideView> = {}): RideView {
  return {
    id: 'ride-test', child_ref: 'Айдан', mode: 'express', from_district: 'Демо-район', from_address: 'Демо-дом, 1', to_address: 'Демо-центр, 2',
    scheduled_at: null, repeat_days: [], needs_escort: false, categories: ['asd'], category_other: '', show_category: false,
    needs: [], comment: 'Айдан', hints: [], parent_price: 2000, initial_price: 2000, final_price: 3100,
    status: 'accepted', driver_id: 'drv-test', pin: '0123', rating_stars: null, rating_tags: [],
    created_at: '2026-11-14T10:00:00Z', status_changed_at: '2026-11-14T10:00:00Z', price_changed_at: '2026-11-14T10:00:00Z', offers: [],
    driver: { id: 'drv-test', name: 'Арман Демо', initials: 'АД', phone: '+7 700 000 00 01', car: 'Демо-авто', plate: '000 DMU 02',
      rating: 4.9, verified: true, trained: true, kit_ok: true, worked_with: ['asd'], is_demo: true }, ...patch,
  };
}
function Destination() { return <p>{useLocation().pathname}</p>; }
function open(value = ride(), offline = false) {
  const refresh = vi.fn();
  const tree = (data: RideView) => <MemoryRouter initialEntries={['/rides/ride-test']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <I18nProvider><ToastProvider><Routes>
      <Route path="/rides/:id" element={<RideTracking ride={data} offline={offline} refresh={refresh} />} />
      <Route path="/sos" element={<Destination />} /><Route path="/rides" element={<Destination />} />
    </Routes></ToastProvider></I18nProvider>
  </MemoryRouter>;
  const view = render(tree(value));
  return { ...view, refresh, update: (data: RideView) => view.rerender(tree(data)) };
}
beforeEach(() => { vi.mocked(cancelRide).mockReset().mockResolvedValue(ride({ status: 'cancelled' })); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const headings = ['Водитель принял поездку', 'Едет к вам', 'Водитель на месте', 'Ребёнок в машине', 'В пути'];
describe('tracking and boarding', () => {
  test.each(RIDE_FLOW)('timeline highlights %s and fills previous steps', status => {
    render(<I18nProvider><Timeline status={status} /></I18nProvider>);
    const steps = within(screen.getByRole('list', { name: 'Этапы поездки' })).getAllByRole('listitem');
    expect(steps).toHaveLength(6);
    steps.forEach((step, index) => {
      expect(step).toHaveClass(index < RIDE_FLOW.indexOf(status) ? 'is-past' : index === RIDE_FLOW.indexOf(status) ? 'is-current' : 'is-future');
      if (index === RIDE_FLOW.indexOf(status)) expect(step).toHaveAttribute('aria-current', 'step');
      else expect(step).not.toHaveAttribute('aria-current');
    });
  });
  test.each(RIDE_FLOW.slice(0, 5))('status %s shows heading and protects PIN after boarding', status => {
    open(ride({ status }));
    expect(screen.getByRole('heading', { name: headings[RIDE_FLOW.indexOf(status)] })).toBeInTheDocument();
    if (RIDE_FLOW.indexOf(status) < 3) {
      expect(screen.getByLabelText('PIN: 0123')).toBeInTheDocument();
      expect(screen.getByText('Назовите водителю при посадке')).toBeInTheDocument();
    } else {
      expect(screen.queryByLabelText('PIN: 0123')).not.toBeInTheDocument();
      expect(screen.getByText('Посадка подтверждена')).toBeInTheDocument();
    }
  });
  test('driver card has cash price, readiness badges, phone and WhatsApp', () => {
    open();
    const driver = screen.getByRole('article', { name: 'Арман Демо' });
    expect(within(driver).getByText('Демо-авто · 000 DMU 02')).toBeInTheDocument();
    expect(within(driver).getByText('3 100 ₸ наличными')).toBeInTheDocument();
    expect(within(driver).getByText('Обучен первой помощи')).toBeInTheDocument();
    expect(within(driver).getByText('Аптечка и набор в машине')).toBeInTheDocument();
    expect(within(driver).getByText('Работал с детьми с похожими особенностями')).toBeInTheDocument();
    expect(within(driver).getByRole('link', { name: 'Позвонить' })).toHaveAttribute('href', 'tel:+77000000001');
    expect(within(driver).getByRole('link', { name: 'Написать в WhatsApp' })).toHaveAttribute('href', 'https://wa.me/77000000001');
  });
  test('offline banner and disabled camera without controls', () => {
    open(ride(), true);
    expect(screen.getByText('Нет связи. Показываем последние данные.')).toBeInTheDocument();
    const camera = screen.getByRole('region', { name: 'Камера в машине — скоро' });
    expect(camera).toHaveAttribute('aria-disabled', 'true');
    expect(within(camera).queryByRole('button')).not.toBeInTheDocument();
    expect(within(camera).getByText('Мы работаем над возможностью смотреть за поездкой. Пока её нет')).toBeInTheDocument();
  });
  test('SOS navigates to emergency screen', async () => {
    open(); await userEvent.click(screen.getByRole('button', { name: 'SOS' }));
    expect(screen.getByText('/sos')).toBeInTheDocument();
  });
});

describe('sharing without child details or trip link', () => {
  test('native share sends only the D-34 text', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share });
    open(); await userEvent.click(screen.getByRole('button', { name: 'Поделиться поездкой с близким' }));
    expect(share).toHaveBeenCalledExactlyOnceWith({ text: 'Еду с DEMEU Жол. Водитель Арман Демо, Демо-авто, 000 DMU 02. Маршрут: Демо-дом, 1 → Демо-центр, 2. Оплата наличными.' });
    const payload = JSON.stringify(share.mock.calls[0]);
    for (const secret of ['/rides/', 'Айдан', '0123', 'ride-test']) expect(payload).not.toContain(secret);
  });
  test.each([false, true])('copies and shows toast when native share is unavailable or fails: %s', async fails => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText }, ...(fails ? { share: vi.fn().mockRejectedValue(new Error('unsupported')) } : {}) });
    open(); await userEvent.click(screen.getByRole('button', { name: 'Поделиться поездкой с близким' }));
    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0][0]).not.toMatch(/Айдан|\/rides\/|0123/);
    expect(screen.getByText('Скопировано')).toBeInTheDocument();
  });
  test('user dismissing native share does not copy', async () => {
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { clipboard: { writeText }, share: vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')) });
    open(); await userEvent.click(screen.getByRole('button', { name: 'Поделиться поездкой с близким' }));
    expect(writeText).not.toHaveBeenCalled();
  });
});

describe('cancellation', () => {
  test('requires confirmation then calls cancelRide and returns to rides', async () => {
    open(); await userEvent.click(screen.getByRole('button', { name: 'Отменить поездку' }));
    expect(cancelRide).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Да, отменить поездку' }));
    expect(cancelRide).toHaveBeenCalledExactlyOnceWith('ride-test');
    expect(screen.getByText('/rides')).toBeInTheDocument();
  });
  test('cancel confirmation can be dismissed', async () => {
    open(); await userEvent.click(screen.getByRole('button', { name: 'Отменить поездку' }));
    await userEvent.click(screen.getByRole('button', { name: 'Продолжить поездку' }));
    expect(cancelRide).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'Отменить поездку?' })).not.toBeInTheDocument();
  });
  test('no cancel at in_ride, including an already opened confirmation', async () => {
    const view = open(ride({ status: 'child_in_car' }));
    await userEvent.click(screen.getByRole('button', { name: 'Отменить поездку' }));
    view.update(ride({ status: 'in_ride' }));
    expect(screen.queryByRole('button', { name: /отменить/i })).not.toBeInTheDocument();
    expect(cancelRide).not.toHaveBeenCalled();
  });
  test('error is translated and refreshes last status', async () => {
    vi.mocked(cancelRide).mockRejectedValueOnce(new RidesError(409, 'too_late'));
    const { refresh } = open(); await userEvent.click(screen.getByRole('button', { name: 'Отменить поездку' }));
    await userEvent.click(screen.getByRole('button', { name: 'Да, отменить поездку' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Поездку уже нельзя отменить.');
    expect(refresh).toHaveBeenCalledOnce();
  });
  test('blocks duplicate cancellation requests', async () => {
    let finish!: (value: RideView) => void;
    vi.mocked(cancelRide).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    open(); fireEvent.click(screen.getByRole('button', { name: 'Отменить поездку' }));
    const confirm = screen.getByRole('button', { name: 'Да, отменить поездку' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(cancelRide).toHaveBeenCalledOnce();
    await act(async () => finish(ride({ status: 'cancelled' })));
  });
});
