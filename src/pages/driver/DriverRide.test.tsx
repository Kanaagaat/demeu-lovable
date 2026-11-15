import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import * as api from '../../lib/rides';
import * as mock from '../../lib/ridesMock';
import { RidesError, type RideStatus, type RideView } from '../../lib/ridesTypes';
import { formatPrice } from '../../lib/ridesRules';
import * as hooks from '../../state/rides';
import DriverRide from './DriverRide';

vi.mock('../../state/rides', () => ({ useDriver: vi.fn(), useDriverRide: vi.fn(), useDriverRides: vi.fn() }));
vi.mock('../../lib/rides', async importOriginal => ({ ...await importOriginal<typeof api>(), setRideStatus: vi.fn() }));
const refresh = vi.fn();
const polled = <T,>(data: T) => ({ data, loading: false, error: null, offline: false, refresh });
let ride: RideView;
function state(status: RideStatus) {
  ride = { ...ride, status }; vi.mocked(hooks.useDriverRide).mockReturnValue(polled(ride));
  vi.mocked(api.setRideStatus).mockResolvedValue(ride);
}
const open = (path = '/driver/ride/demo-ride') => render(<MemoryRouter initialEntries={[path]}><I18nProvider><Routes><Route path="/driver/ride/:id" element={<DriverRide />} /><Route path="/driver" element={<p>registration destination</p>} /><Route path="/driver/feed" element={<p>feed destination</p>} /></Routes></I18nProvider></MemoryRouter>);
beforeEach(() => {
  vi.clearAllMocks(); api.setDriverId('drv-1');
  ride = { ...mock.createRide({ parent_ref: 'parent', mode: 'express', from_district: 'Бостандыкский', to_address: 'Демо-центр', categories: ['epilepsy'], needs: ['quiet'], comment: 'Объясняйте следующий шаг', parent_price: 3000 }), id: 'demo-ride', driver_id: 'drv-1', final_price: 3400, status_changed_at: new Date().toISOString() };
  vi.mocked(hooks.useDriver).mockReturnValue(polled(mock.getDriver('drv-1')));
  vi.mocked(hooks.useDriverRides).mockReturnValue(polled([]));
  state('accepted');
});

test('arrived reveals PIN, requires four digits, passes PIN and displays wrong_pin without changing status', async () => {
  state('arrived'); vi.mocked(api.setRideStatus).mockRejectedValueOnce(new RidesError(403, 'wrong_pin')).mockResolvedValueOnce({ ...ride, status: 'child_in_car' });
  open(); const user = userEvent.setup();
  const button = screen.getByRole('button', { name: 'Ребёнок в машине' });
  await user.click(button);
  const input = screen.getByLabelText('Код из 4 цифр');
  expect(input).toHaveAttribute('inputmode', 'numeric'); expect(input).toHaveAttribute('autocomplete', 'one-time-code');
  expect(button).toBeDisabled(); expect(api.setRideStatus).not.toHaveBeenCalled();
  await user.type(input, '12a3'); expect(input).toHaveValue('123'); expect(button).toBeDisabled();
  await user.type(input, '4'); expect(button).toBeEnabled(); await user.click(button);
  expect(api.setRideStatus).toHaveBeenCalledExactlyOnceWith('demo-ride', 'drv-1', 'child_in_car', '1234');
  expect(await screen.findByRole('alert')).toHaveTextContent('Неверный код. Попросите родителя назвать его ещё раз');
  expect(button).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Начать поездку' })).not.toBeInTheDocument();
  await user.clear(input); await user.type(input, '0042'); await user.click(button);
  expect(api.setRideStatus).toHaveBeenLastCalledWith('demo-ride', 'drv-1', 'child_in_car', '0042');
  expect(button).toBeDisabled(); expect(refresh).toHaveBeenCalledTimes(2);
});

test.each([
  ['accepted', 'Еду к ребёнку', 'driver_on_way'],
  ['driver_on_way', 'Я на месте', 'arrived'],
  ['child_in_car', 'Начать поездку', 'in_ride'],
  ['in_ride', 'Завершить поездку', 'completed'],
] as const)('%s exposes just its next action and sends %s in order', async (status, label, next) => {
  state(status); open();
  const actions = ['Еду к ребёнку', 'Я на месте', 'Ребёнок в машине', 'Начать поездку', 'Завершить поездку'];
  for (const other of actions.filter(action => action !== label)) expect(screen.queryByRole('button', { name: other })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: label }));
  expect(api.setRideStatus).toHaveBeenCalledExactlyOnceWith('demo-ride', 'drv-1', next);
});

test('accepted shows chosen, the large reminder, first aid and a marked demo phone link', () => {
  open();
  expect(screen.getByText('Вас выбрали')).toBeInTheDocument();
  expect(screen.getByText('Возможен приступ — действовать по инструкции первой помощи')).toBeInTheDocument();
  expect(screen.getByText('Объясняйте следующий шаг')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Первая помощь' })).toHaveAttribute('href', '/driver/training?lesson=seizure');
  expect(screen.getByRole('link', { name: 'Позвонить родителю демо-номер' })).toHaveAttribute('href', 'tel:+77000000099');
});

test('pending offers wait for the parent and another driver assignment has no controls', () => {
  const offer = mock.sendOffer(mock.createRide({ parent_ref: 'p', mode: 'express', from_district: 'Бостандыкский', to_address: 'Демо-адрес', parent_price: 3000 }).id, 'drv-1', 3000);
  ride = { ...ride, status: 'searching', driver_id: null, offers: [offer] };
  vi.mocked(hooks.useDriverRide).mockReturnValue(polled(ride));
  const view = open(); expect(screen.getByText('Ждём ответа родителя')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Еду к ребёнку' })).not.toBeInTheDocument();
  vi.mocked(hooks.useDriverRide).mockReturnValue(polled({ ...ride, status: 'accepted', driver_id: 'drv-2' }));
  view.rerender(<MemoryRouter initialEntries={['/driver/ride/demo-ride']}><I18nProvider><Routes><Route path="/driver/ride/:id" element={<DriverRide />} /></Routes></I18nProvider></MemoryRouter>);
  expect(screen.getByText('Поездка больше недоступна')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Еду к ребёнку' })).not.toBeInTheDocument();
});

test('status errors appear as a toast; offline preserves reminder and disables advancement', async () => {
  vi.mocked(api.setRideStatus).mockRejectedValue(new RidesError(409, 'bad_transition'));
  const view = open(); await userEvent.click(screen.getByRole('button', { name: 'Еду к ребёнку' }));
  expect(await screen.findByText('Статус уже изменился. Обновите поездку.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Еду к ребёнку' })).toBeEnabled();
  vi.mocked(hooks.useDriverRide).mockReturnValue({ ...polled(ride), offline: true });
  view.rerender(<MemoryRouter initialEntries={['/driver/ride/demo-ride']}><I18nProvider><Routes><Route path="/driver/ride/:id" element={<DriverRide />} /></Routes></I18nProvider></MemoryRouter>);
  expect(screen.getByText('Нет связи. Показываем последние данные.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Еду к ребёнку' })).toBeDisabled();
});

test('D6 totals only own completed rides with status_changed_at today, deduplicates current ride and limits history to ten', async () => {
  state('completed');
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const older: RideView[] = Array.from({ length: 12 }, (_, i) => ({ ...ride, id: `old-${i}`, from_address: `Старый демо-дом ${i}`, status_changed_at: new Date(yesterday.getTime() - i * 60000).toISOString(), final_price: 1000 }));
  const anotherToday = { ...ride, id: 'another-today', final_price: 3000, created_at: yesterday.toISOString() };
  vi.mocked(hooks.useDriverRides).mockReturnValue(polled([ride, anotherToday, ...older, { ...ride, id: 'cancelled', status: 'cancelled' }, { ...ride, id: 'active', status: 'in_ride' }, { ...ride, id: 'other-driver', driver_id: 'drv-2' }]));
  open();
  expect(screen.getByText(`Получено наличными ${formatPrice(3400)}`, { normalizer: text => text })).toBeInTheDocument();
  expect(screen.getByText(`Заработано сегодня: ${formatPrice(6400)} за 2 поездки`, { normalizer: text => text })).toBeInTheDocument();
  expect(document.querySelectorAll('.dr-feed-history article')).toHaveLength(10);
  const confirmation = screen.getByRole('button', { name: 'Получил' }); await userEvent.click(confirmation);
  expect(screen.getByRole('button', { name: 'Получение подтверждено' })).toHaveAttribute('aria-pressed', 'true');
  expect(api.setRideStatus).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('link', { name: 'К заказам' })); expect(screen.getByText('feed destination')).toBeInTheDocument();
});

test('D6 includes a just-completed ride when the list poll is one response behind', () => {
  state('completed'); vi.mocked(hooks.useDriverRides).mockReturnValue(polled([])); open();
  expect(screen.getByText(`Заработано сегодня: ${formatPrice(3400)} за 1 поездку`, { normalizer: text => text })).toBeInTheDocument();
  expect(within(document.querySelector('.dr-feed-history') as HTMLElement).getAllByRole('article')).toHaveLength(1);
});

test('unregistered driver redirects, and a cancelled ride exposes only return to feed', () => {
  api.setDriverId(null); const view = open(); expect(screen.getByText('registration destination')).toBeInTheDocument();
  view.unmount(); api.setDriverId('drv-1'); state('cancelled'); open();
  expect(screen.getByRole('link', { name: 'К заказам' })).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Еду к ребёнку' })).not.toBeInTheDocument();
});

test('D5 → D6 works with the real local R02 client, hooks and PIN validation', async () => {
  const actualHooks = await vi.importActual<typeof hooks>('../../state/rides');
  const actualApi = await vi.importActual<typeof api>('../../lib/rides');
  vi.mocked(hooks.useDriver).mockImplementation(actualHooks.useDriver);
  vi.mocked(hooks.useDriverRide).mockImplementation(actualHooks.useDriverRide);
  vi.mocked(hooks.useDriverRides).mockImplementation(actualHooks.useDriverRides);
  vi.mocked(api.setRideStatus).mockImplementation(actualApi.setRideStatus);
  const d = mock.registerDriver({ name: 'Демо Водитель', phone: '+77000000000', car: 'Демо авто', plate: '000 DMU 02' });
  mock.patchDriver(d.id, { verified: true, trained: true }); mock.kitCheck(d.id, ['first_aid_kit', 'diapers', 'water', 'wet_wipes', 'bags']); mock.setOnline(d.id, true);
  const r = mock.createRide({ parent_ref: 'parent', mode: 'express', from_district: 'Бостандыкский', to_address: 'Демо-центр', parent_price: 3000 });
  const offer = mock.sendOffer(r.id, d.id, 3200); const accepted = mock.acceptOffer(offer.id, 'parent');
  api.setDriverId(d.id); open(`/driver/ride/${r.id}`);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Еду к ребёнку' }));
  await user.click(await screen.findByRole('button', { name: 'Я на месте' }));
  await user.click(await screen.findByRole('button', { name: 'Ребёнок в машине' }));
  await user.type(screen.getByLabelText('Код из 4 цифр'), accepted.pin!);
  await user.click(screen.getByRole('button', { name: 'Ребёнок в машине' }));
  await user.click(await screen.findByRole('button', { name: 'Начать поездку' }));
  await user.click(await screen.findByRole('button', { name: 'Завершить поездку' }));
  expect(await screen.findByRole('button', { name: 'Получил' })).toBeInTheDocument();
  expect(await screen.findByText(`Заработано сегодня: ${formatPrice(3200)} за 1 поездку`, { normalizer: text => text })).toBeInTheDocument();
  expect(mock.getRide(r.id, 'driver', d.id).status).toBe('completed');
});
