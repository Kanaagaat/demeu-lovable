import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import * as api from '../../lib/rides';
import * as mock from '../../lib/ridesMock';
import { RidesError, type FeedItem, type OfferView } from '../../lib/ridesTypes';
import * as hooks from '../../state/rides';
import { formatPrice } from '../../lib/ridesRules';
import Feed from './Feed';

vi.mock('../../lib/api', () => ({ API_URL: 'https://rides.example' }));
vi.mock('../../state/rides', () => ({ useDriver: vi.fn(), useDriverFeed: vi.fn(), useDriverRides: vi.fn() }));
vi.mock('../../lib/rides', async importOriginal => ({ ...await importOriginal<typeof api>(), sendOffer: vi.fn(), setOnline: vi.fn(), listDriverRides: vi.fn() }));
const refresh = vi.fn();
let item: FeedItem;
let offered: OfferView;
const polled = <T,>(data: T) => ({ data, loading: false, error: null, offline: false, refresh });
const tree = () => (<MemoryRouter initialEntries={['/driver/feed']}><I18nProvider><Routes><Route path="/driver/feed" element={<Feed />} /><Route path="/driver" element={<p>registration destination</p>} /><Route path="/driver/ride/:id" element={<p>active destination</p>} /></Routes></I18nProvider></MemoryRouter>);
const open = () => render(tree());
beforeEach(() => {
  vi.clearAllMocks(); api.setDriverId('drv-1');
  item = { ...mock.createRide({ parent_ref: 'parent', mode: 'scheduled', scheduled_at: '2099-11-15T10:00:00Z', repeat_days: [1, 3], from_district: 'Бостандыкский', from_address: 'Демо-дом, 1', to_address: 'Демо-центр, 2', categories: ['asd'], show_category: false, comment: 'Сначала объясните маршрут', needs: ['door_lock'], parent_price: 3000 }), my_offer: null, regular_label_days: [1, 3] };
  offered = mock.sendOffer(item.id, 'drv-1', 3000);
  vi.mocked(api.sendOffer).mockResolvedValue(offered);
  vi.mocked(api.setOnline).mockResolvedValue(mock.getDriver('drv-1'));
  vi.mocked(hooks.useDriver).mockReturnValue(polled(mock.getDriver('drv-1')));
  vi.mocked(hooks.useDriverFeed).mockReturnValue(polled([item]));
  vi.mocked(hooks.useDriverRides).mockReturnValue(polled([]));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

test('feed shows hints, regular weekdays, route, needs and the child categories right away', () => {
  open();
  expect(screen.getByText('Может пугаться громких звуков, тишина в машине')).toBeInTheDocument();
  expect(screen.getByText('Может уйти — блокировка дверей')).toBeInTheDocument();
  expect(screen.getByText('Регулярно: вт, чт')).toBeInTheDocument();
  expect(screen.getByText('Особенности: РАС')).toBeInTheDocument();
  expect(screen.getByText('Сначала объясните маршрут')).toBeInTheDocument();
  expect(screen.getByText('Блокировка дверей')).toBeInTheDocument();
  expect(screen.getByText('Бостандыкский, Демо-дом, 1')).toBeInTheDocument();
});

test('accepting sends an offer at the parent price and then waits for the parent', async () => {
  open();
  await userEvent.click(screen.getByRole('button', { name: `Принять за ${formatPrice(3000)}` }));
  expect(api.sendOffer).toHaveBeenCalledExactlyOnceWith(item.id, 'drv-1', 3000);
  expect(await screen.findByText(/Вы предложили .* — ждём ответа родителя/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Принять за/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Изменить цену' })).toBeInTheDocument();
});

test.each([3000, 500, 49000])('offer sheet obeys the offer limit and global price cap for parent price %i', async parentPrice => {
  item = { ...item, parent_price: parentPrice };
  vi.mocked(hooks.useDriverFeed).mockReturnValue(polled([item]));
  open(); const user = userEvent.setup();
  const opener = screen.getByRole('button', { name: 'Предложить цену' });
  await user.click(opener);
  const sheet = within(screen.getByRole('dialog'));
  const increase = sheet.getByRole('button', { name: 'Увеличить цену на 200 ₸' });
  const decrease = sheet.getByRole('button', { name: 'Уменьшить цену на 200 ₸' });
  expect(decrease).toBeDisabled();
  for (let i = 0; i < 15; i++) await user.click(increase);
  const limit = Math.min(Math.floor(parentPrice * 1.5 / 100) * 100, 50000);
  expect(sheet.getByRole('status').textContent).toBe(formatPrice(limit));
  expect(increase).toBeDisabled();
  await user.click(sheet.getByRole('button', { name: `Предложить за ${formatPrice(limit)}` }));
  expect(api.sendOffer).toHaveBeenCalledWith(item.id, 'drv-1', limit);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
});

test('a pending offer can be edited, while a ride removed by polling disappears', async () => {
  item = { ...item, my_offer: { ...offered, price: 3400 } };
  vi.mocked(hooks.useDriverFeed).mockReturnValue(polled([item]));
  const view = open();
  expect(screen.queryByRole('button', { name: /Принять за/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Изменить цену' }));
  expect(within(screen.getByRole('dialog')).getByRole('status').textContent).toBe(formatPrice(3400));
  vi.mocked(hooks.useDriverFeed).mockReturnValue(polled([]));
  view.rerender(tree());
  expect(screen.getByText('Пока нет заказов')).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('an active ride has priority even when the driver must prepare again', async () => {
  vi.mocked(hooks.useDriverRides).mockReturnValue(polled([{ ...item, status: 'in_ride', driver_id: 'drv-1' }]));
  vi.mocked(hooks.useDriverFeed).mockReturnValue({ ...polled([]), error: 'driver_not_ready' });
  open();
  expect(screen.getByText('Сначала завершите подготовку')).toBeInTheDocument();
  const active = screen.getByRole('link', { name: /Активная поездка/ });
  expect(active).toHaveAttribute('href', `/driver/ride/${item.id}`);
  expect(active.compareDocumentPosition(screen.getByText('Сначала завершите подготовку')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  await userEvent.click(active); expect(screen.getByText('active destination')).toBeInTheDocument();
});

test('unregistered drivers are redirected and an online driver can leave the line', async () => {
  api.setDriverId(null); const view = open();
  expect(screen.getByText('registration destination')).toBeInTheDocument();
  view.unmount(); api.setDriverId('drv-1'); open();
  await userEvent.click(screen.getByRole('button', { name: 'Сойти с линии' }));
  expect(api.setOnline).toHaveBeenCalledExactlyOnceWith('drv-1', false);
  expect(await screen.findByText('registration destination')).toBeInTheDocument();
});

test('only newly arriving orders briefly highlight and offline keeps the last feed', async () => {
  vi.useFakeTimers();
  const view = open();
  expect(document.querySelector('.dr-feed-new')).toBeNull();
  vi.mocked(hooks.useDriverFeed).mockReturnValue({ ...polled([item, { ...item, id: 'new-order' }]), offline: true });
  view.rerender(tree());
  expect(document.querySelectorAll('.dr-feed-new')).toHaveLength(1);
  expect(screen.getByText('Нет связи. Показываем последние данные.')).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(2400); });
  expect(document.querySelector('.dr-feed-new')).toBeNull();
});

test('D-33 client unwraps the endpoint and preserves HTTP errors instead of mocking them', async () => {
  const actual = await vi.importActual<typeof api>('../../lib/rides');
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [{ ...item, status: 'accepted' }] })));
  vi.stubGlobal('fetch', fetcher);
  expect(await actual.listDriverRides('server-driver')).toHaveLength(1);
  expect(fetcher.mock.calls[0][0]).toBe('https://rides.example/api/driver/rides?driver_id=server-driver');
  fetcher.mockResolvedValue(new Response(JSON.stringify({ detail: 'not_found' }), { status: 404 }));
  await expect(actual.listDriverRides('server-driver')).rejects.toMatchObject({ code: 'not_found', status: 404 });
});

test('D-33 local driver history filters assignments and hides private fields, without fetching', async () => {
  const actual = await vi.importActual<typeof api>('../../lib/rides');
  const d = mock.registerDriver({ name: 'Демо Водитель', phone: '+77000000000', car: 'Демо авто', plate: '000 DMU 02' });
  mock.patchDriver(d.id, { verified: true, trained: true });
  mock.kitCheck(d.id, ['first_aid_kit', 'diapers', 'water', 'wet_wipes', 'bags']); mock.setOnline(d.id, true);
  const ownOffer = mock.sendOffer(item.id, d.id, 3200); mock.acceptOffer(ownOffer.id, 'parent');
  mock.createRide({ parent_ref: 'parent', mode: 'express', from_district: 'Бостандыкский', to_address: 'Другой демо-центр', parent_price: 3000 });
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const list = await actual.listDriverRides(d.id);
  expect(list).toHaveLength(1); expect(list[0]).toMatchObject({ id: item.id, driver_id: d.id, status: 'accepted', categories: ['asd'] });
  expect(list[0]).not.toHaveProperty('pin'); expect(list[0]).not.toHaveProperty('parent_ref');
  mock.cancelRide(item.id, 'parent');
  expect((await actual.listDriverRides(d.id))[0].status).toBe('cancelled');
  expect(mock.listDriverRides('drv-2')).toEqual([]);
  expect(fetcher).not.toHaveBeenCalled();
});

test('D-33 polling runs every 2 seconds and follows driver identity changes', async () => {
  vi.useFakeTimers();
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  vi.mocked(api.listDriverRides).mockResolvedValue([]);
  const actual = await vi.importActual<typeof hooks>('../../state/rides');
  const { result, rerender, unmount } = renderHook(({ id }: { id: string | null }) => actual.useDriverRides(id), { initialProps: { id: 'driver-one' as string | null } });
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(api.listDriverRides).toHaveBeenCalledExactlyOnceWith('driver-one');
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(api.listDriverRides).toHaveBeenCalledTimes(2);
  rerender({ id: 'driver-two' });
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(api.listDriverRides).toHaveBeenLastCalledWith('driver-two');
  rerender({ id: null }); expect(result.current.loading).toBe(false);
  unmount();
  await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
  expect(api.listDriverRides).toHaveBeenCalledTimes(3);
});

test('offer failures show the translated error and keep the sheet open for retry', async () => {
  vi.mocked(api.sendOffer).mockRejectedValue(new RidesError(422, 'price_out_of_range'));
  open(); await userEvent.click(screen.getByRole('button', { name: 'Предложить цену' }));
  await userEvent.click(screen.getByRole('button', { name: /Предложить за/ }));
  await waitFor(() => expect(screen.getByText(/Укажите цену от 500 до 50 000/)).toBeInTheDocument());
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});
