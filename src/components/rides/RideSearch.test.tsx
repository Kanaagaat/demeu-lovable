import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import { acceptOffer, cancelRide, declineOffer, raisePrice } from '../../lib/rides';
import { RidesError } from '../../lib/ridesTypes';
import type { DriverPublic, OfferView, RideView } from '../../lib/ridesTypes';
import { ToastProvider } from '../Toast';
import { RideSearch } from './RideSearch';

vi.mock('../../lib/rides', async importOriginal => ({
  ...await importOriginal<typeof import('../../lib/rides')>(),
  acceptOffer: vi.fn(), declineOffer: vi.fn(), raisePrice: vi.fn(), cancelRide: vi.fn(),
}));
vi.mock('../../lib/sfx', () => ({ play: vi.fn() }));

const driver: DriverPublic = {
  id: 'driver-test', name: 'Данияр Демо', initials: 'ДД', car: 'Toyota Camry', plate: '777 DMU 02',
  rating: 4.9, trained: true, verified: true, kit_ok: true, worked_with: ['asd'], is_demo: false,
};
function offer(patch: Partial<OfferView> = {}): OfferView {
  return { id: 'offer-test', ride_id: 'ride-test', driver_id: driver.id, price: 3000, status: 'pending',
    created_at: '2026-11-14T10:00:00Z', eta_minutes: 7, driver, ...patch };
}
function ride(patch: Partial<RideView> = {}): RideView {
  return {
    id: 'ride-test', parent_ref: 'parent-test', child_ref: null, mode: 'express',
    from_district: 'Бостандыкский', from_address: 'Демо-дом, 1', to_address: 'Демо-центр, 2',
    scheduled_at: null, repeat_days: [], needs_escort: false, categories: ['asd'], category_other: '',
    show_category: false, needs: [], comment: '', hints: [], parent_price: 3000, initial_price: 3000,
    final_price: null, status: 'searching', driver_id: null, driver: null, pin: null,
    rating_stars: null, rating_tags: [], created_at: '2026-11-14T09:00:00Z',
    status_changed_at: '2026-11-14T09:00:00Z', price_changed_at: '2026-11-14T09:00:00Z', offers: [], ...patch,
  };
}
function Destination() {
  const location = useLocation(), type = useNavigationType();
  return <p>{location.pathname} {type}</p>;
}
function open(value = ride(), offline = false) {
  const refresh = vi.fn();
  const tree = (data: RideView) => <MemoryRouter initialEntries={['/rides/ride-test']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <I18nProvider><ToastProvider><Routes>
      <Route path="/rides/:id" element={<RideSearch ride={data} offline={offline} refresh={refresh} />} />
      <Route path="/rides" element={<Destination />} />
    </Routes></ToastProvider></I18nProvider>
  </MemoryRouter>;
  const view = render(tree(value));
  return { ...view, refresh, update: (data: RideView) => view.rerender(tree(data)) };
}
async function openPrice() {
  await userEvent.click(screen.getByRole('button', { name: 'Поднять цену' }));
  return screen.getByRole('dialog', { name: 'Поднять цену' });
}
const amount = () => screen.getByRole('spinbutton', { name: 'Новая цена, ₸' });

beforeEach(() => {
  vi.mocked(acceptOffer).mockReset().mockResolvedValue(ride({ status: 'accepted' }));
  vi.mocked(declineOffer).mockReset().mockResolvedValue(offer({ status: 'declined' }));
  vi.mocked(raisePrice).mockReset().mockResolvedValue(ride({ parent_price: 3500 }));
  vi.mocked(cancelRide).mockReset().mockResolvedValue(ride({ status: 'cancelled' }));
});

describe('search and offers', () => {
  test('empty state, route, cash price and offline banner', () => {
    open(ride(), true);
    expect(screen.getByRole('heading', { name: 'Ищем водителя' })).toBeInTheDocument();
    expect(screen.getByText('Водители, прошедшие обучение Мама Про, видят вашу поездку. Предложения появятся здесь')).toBeInTheDocument();
    expect(screen.getByText('Нет связи. Показываем последние данные.')).toBeInTheDocument();
    expect(screen.getByText(/Ваша цена: 3 000 ₸ · наличными водителю/)).toBeInTheDocument();
    expect(screen.getByText('Демо-дом, 1')).toBeInTheDocument();
    expect(screen.getByText('Демо-центр, 2')).toBeInTheDocument();
    expect(document.querySelector('img[src="/mascot/m-search.png"]')).toBeInTheDocument();
  });

  test('renders driver, badges, rating and regular price', () => {
    open(ride({ offers: [offer()] }));
    const card = screen.getByRole('article', { name: driver.name });
    expect(within(card).getByText('Toyota Camry · 777 DMU 02')).toBeInTheDocument();
    expect(within(card).getByLabelText('Рейтинг: 4,9')).toBeInTheDocument();
    expect(within(card).getByText('Обучен первой помощи')).toBeInTheDocument();
    expect(within(card).getByText('Аптечка и набор в машине')).toBeInTheDocument();
    expect(within(card).getByText('Работал с детьми с похожими особенностями')).toBeInTheDocument();
    expect(within(card).getByText('3 000 ₸')).toBeInTheDocument();
    expect(within(card).queryByText(/просит/)).not.toBeInTheDocument();
    expect(within(card).getByText('Подача через 7 мин')).toBeInTheDocument();
  });

  test('counteroffer uses accented price text', () => {
    open(ride({ offers: [offer({ price: 3500 })] }));
    expect(screen.getByText('просит 3 500 ₸ вместо 3 000 ₸')).toHaveClass('rd-search-counter-price');
  });

  test.each([{ categories: [] }, { categories: ['cp'] as const }])('similar experience badge requires an intersection: %j', ({ categories }) => {
    open(ride({ categories: [...categories], offers: [offer()] }));
    expect(screen.queryByText('Работал с детьми с похожими особенностями')).not.toBeInTheDocument();
  });

  test('badges depend on driver readiness fields', () => {
    open(ride({ offers: [offer({ driver: { ...driver, trained: false, kit_ok: false, worked_with: [] } })] }));
    expect(screen.queryByText('Обучен первой помощи')).not.toBeInTheDocument();
    expect(screen.queryByText('Аптечка и набор в машине')).not.toBeInTheDocument();
    expect(screen.queryByText('Работал с детьми с похожими особенностями')).not.toBeInTheDocument();
  });

  test('shows pending offers only, newest first, and reacts to incoming props', () => {
    const view = open();
    view.update(ride({ offers: [offer(), offer({ id: 'new', created_at: '2026-11-14T10:01:00Z', driver: { ...driver, name: 'Арман Демо' } }), offer({ id: 'old', status: 'withdrawn' }), offer({ id: 'declined', status: 'declined' }), offer({ id: 'accepted', status: 'accepted' })] }));
    expect(screen.getAllByRole('article').map(card => card.getAttribute('aria-labelledby')).map(id => document.getElementById(id!)?.textContent)).toEqual(['Арман Демо', driver.name]);
    view.update(ride({ offers: [offer({ status: 'declined' })] }));
    expect(screen.getByRole('heading', { name: 'Ищем водителя' })).toBeInTheDocument();
  });

  test('scheduled ride shows date, regular days, escort and scheduled arrival', () => {
    open(ride({ mode: 'scheduled', scheduled_at: '2026-11-16T10:30:00+05:00', repeat_days: [1, 3], needs_escort: true, offers: [offer()] }));
    expect(screen.getByText(/Запланированная ·/)).toHaveTextContent('ноября');
    expect(screen.getByText('Регулярно: вт, чт')).toBeInTheDocument();
    expect(screen.getByText('С сопровождающим')).toBeInTheDocument();
    expect(screen.getByText('Приедет к назначенному времени')).toBeInTheDocument();
    expect(screen.queryByText(/Подача через/)).not.toBeInTheDocument();
  });

  test.each([['Принять', acceptOffer], ['Отклонить', declineOffer]] as const)('%s calls the client with offer id and refreshes', async (label, client) => {
    const { refresh } = open(ride({ offers: [offer()] }));
    await userEvent.click(screen.getByRole('button', { name: `${label}: ${driver.name}` }));
    expect(client).toHaveBeenCalledExactlyOnceWith('offer-test');
    expect(refresh).toHaveBeenCalledOnce();
  });

  test('blocks double taps and other mutations until accept finishes', async () => {
    let complete!: (value: RideView) => void;
    vi.mocked(acceptOffer).mockReturnValue(new Promise(resolve => { complete = resolve; }));
    const { refresh } = open(ride({ offers: [offer()] }));
    const accept = screen.getByRole('button', { name: `Принять: ${driver.name}` });
    fireEvent.click(accept); fireEvent.click(accept);
    expect(acceptOffer).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: `Отклонить: ${driver.name}` })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Поднять цену' })).toBeDisabled();
    await act(async () => complete(ride({ status: 'accepted' })));
    expect(refresh).toHaveBeenCalledOnce();
  });

  test('offer errors show translated toast and allow retry', async () => {
    vi.mocked(acceptOffer).mockRejectedValueOnce(new RidesError(409, 'not_searching'));
    const { refresh } = open(ride({ offers: [offer()] }));
    await userEvent.click(screen.getByRole('button', { name: `Принять: ${driver.name}` }));
    expect(screen.getByText('Поиск водителя уже завершён. Обновите поездку.')).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: `Принять: ${driver.name}` })).toBeEnabled();
  });
});

describe('raise price and cancel sheets', () => {
  test.each(['3000', '2900', '3050', '50100', '', '3100.5'])('does not submit invalid price %j', async value => {
    open();
    const sheet = await openPrice();
    fireEvent.change(amount(), { target: { value } });
    expect(within(sheet).getByRole('button', { name: 'Поднять цену' })).toBeDisabled();
    fireEvent.submit(amount().closest('form')!);
    expect(raisePrice).not.toHaveBeenCalled();
    expect(within(sheet).getByRole('alert')).toBeInTheDocument();
  });

  test.each([100, 200, 500])('chip +%s raises price and refreshes', async increase => {
    const { refresh } = open();
    const sheet = await openPrice();
    await userEvent.click(within(sheet).getByRole('button', { name: `Повысить цену на ${increase} ₸` }));
    expect(amount()).toHaveValue(3000 + increase);
    await userEvent.click(within(sheet).getByRole('button', { name: 'Поднять цену' }));
    expect(raisePrice).toHaveBeenCalledExactlyOnceWith('ride-test', 3000 + increase);
    expect(refresh).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('manual price accepts the maximum and chips respect the limit', async () => {
    open(ride({ parent_price: 49900 }));
    const sheet = await openPrice();
    expect(within(sheet).getByRole('button', { name: 'Повысить цену на 200 ₸' })).toBeDisabled();
    fireEvent.change(amount(), { target: { value: '50000' } });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Поднять цену' }));
    expect(raisePrice).toHaveBeenCalledExactlyOnceWith('ride-test', 50000);
  });

  test('polling price updates revalidate an open sheet', async () => {
    const view = open();
    const sheet = await openPrice();
    view.update(ride({ parent_price: 3200 }));
    expect(within(sheet).getByText('Новая цена должна быть выше текущей.')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Поднять цену' })).toBeDisabled();
  });

  test('server price error stays inside the sheet', async () => {
    vi.mocked(raisePrice).mockRejectedValueOnce(new RidesError(409, 'price_not_higher'));
    const { refresh } = open();
    const sheet = await openPrice();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Поднять цену' }));
    expect(within(sheet).getByRole('alert')).toHaveTextContent('Новая цена должна быть выше текущей.');
    expect(refresh).not.toHaveBeenCalled();
  });

  test('price sheet blocks duplicate requests while saving', async () => {
    let complete!: (value: RideView) => void;
    vi.mocked(raisePrice).mockReturnValue(new Promise(resolve => { complete = resolve; }));
    open();
    const sheet = await openPrice();
    const submit = within(sheet).getByRole('button', { name: 'Поднять цену' });
    fireEvent.click(submit); fireEvent.submit(amount().closest('form')!);
    expect(raisePrice).toHaveBeenCalledOnce();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(sheet).toBeInTheDocument();
    await act(async () => complete(ride({ parent_price: 3100 })));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('sheet traps focus, closes on Escape and restores the trigger', async () => {
    const user = userEvent.setup();
    open();
    const trigger = screen.getByRole('button', { name: 'Поднять цену' });
    const sheet = await openPrice();
    expect(sheet).toHaveFocus();
    await user.tab({ shift: true });
    expect(within(sheet).getByRole('button', { name: 'Поднять цену' })).toHaveFocus();
    await user.tab();
    expect(within(sheet).getByRole('button', { name: 'Закрыть' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  test('cancel requires confirmation and replaces route after success', async () => {
    open();
    await userEvent.click(screen.getByRole('button', { name: 'Отменить поиск' }));
    expect(cancelRide).not.toHaveBeenCalled();
    const sheet = screen.getByRole('dialog', { name: 'Отменить поиск водителя?' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Да, отменить поиск' }));
    expect(cancelRide).toHaveBeenCalledExactlyOnceWith('ride-test');
    expect(await screen.findByText('/rides REPLACE')).toBeInTheDocument();
  });

  test('continue search closes confirmation without cancelling', async () => {
    open();
    await userEvent.click(screen.getByRole('button', { name: 'Отменить поиск' }));
    await userEvent.click(screen.getByRole('button', { name: 'Продолжить поиск' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(cancelRide).not.toHaveBeenCalled();
  });

  test('cancel errors stay in the confirmation sheet', async () => {
    vi.mocked(cancelRide).mockRejectedValueOnce(new RidesError(409, 'too_late'));
    open();
    await userEvent.click(screen.getByRole('button', { name: 'Отменить поиск' }));
    await userEvent.click(screen.getByRole('button', { name: 'Да, отменить поиск' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Поездку уже нельзя отменить.');
  });

  test('back goes to rides explicitly', async () => {
    open();
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }));
    await waitFor(() => expect(screen.getByText('/rides PUSH')).toBeInTheDocument());
  });
});
