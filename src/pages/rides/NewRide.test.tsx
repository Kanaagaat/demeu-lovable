import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import { AppStateProvider } from '../../state/AppState';
import { createRide, estimate } from '../../lib/rides';
import { RidesError } from '../../lib/ridesTypes';
import type { RideView } from '../../lib/ridesTypes';
import type { ChildCard, SavedBooking } from '../../lib/types';
import { useSpecialist } from '../../lib/hooks';
import { getSpecialist } from '../../lib/engine';
import { searchPlaces } from '../../lib/places';
import type { Place } from '../../lib/places';
import NewRide from './NewRide';

vi.mock('../../lib/rides', async importOriginal => ({
  ...await importOriginal<typeof import('../../lib/rides')>(),
  createRide: vi.fn(), estimate: vi.fn(),
}));
vi.mock('../../lib/hooks', () => ({ useSpecialist: vi.fn() }));
vi.mock('../../lib/places', async importOriginal => ({
  ...await importOriginal<typeof import('../../lib/places')>(),
  searchPlaces: vi.fn(), reversePlace: vi.fn().mockResolvedValue(''),
}));
// Leaflet needs a real layout engine; the picker logic is what matters here.
vi.mock('../../components/rides/PlaceMap', () => ({ PlaceMap: () => <div data-testid="map" /> }));

const card: ChildCard = {
  name: 'Айдан', age: 6, district: 'Бостандыкский', features: ['РАС'], comm: 'Пока не говорит',
  react: 'Нужно время, чтобы привыкнуть', goals: ['Речь'], disability: 'Да',
};
const quote = { minutes: 15, low: 2300, high: 3400, suggested: 2700 };
const specialist = getSpecialist(1);
const resource = (data: typeof specialist | null) => ({ data, loading: false, error: null, source: null, reload: vi.fn() });
function Result() {
  const { pathname } = useLocation();
  const navigation = useNavigationType();
  return <div role="status">{pathname} {navigation}</div>;
}
function open(options: { card?: ChildCard | null; state?: { to_address: string }; bookings?: SavedBooking[] } = {}) {
  const value = options.card === undefined ? card : options.card;
  if (value) localStorage.setItem('demeu.card', JSON.stringify(value));
  if (options.bookings) localStorage.setItem('demeu.bookings', JSON.stringify(options.bookings));
  const tree = () => <MemoryRouter initialEntries={['/rides', { pathname: '/rides/new', state: options.state }]} initialIndex={1}
    future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <I18nProvider><AppStateProvider><Routes>
      <Route path="/rides/new" element={<NewRide />} />
      <Route path="/rides/:id" element={<Result />} />
    </Routes></AppStateProvider></I18nProvider>
  </MemoryRouter>;
  const view = render(tree());
  return { ...view, refresh: () => view.rerender(tree()) };
}
const priceInput = () => screen.getByRole('spinbutton', { name: 'Ваша цена, ₸' });
const submitButton = () => screen.getByRole('button', { name: 'Найти водителя' });
const place = (address: string, district = 'Бостандыкский'): Place => ({ address, district, lat: 43.22, lng: 76.9 });
/** Opens the picker for «Откуда»/«Куда», searches, taps the result and confirms. */
async function pick(which: 'Откуда' | 'Куда', result: Place, query = 'поиск') {
  const user = userEvent.setup();
  vi.mocked(searchPlaces).mockResolvedValue([result]);
  await user.click(screen.getByRole('button', { name: new RegExp(`^${which}`) }));
  await user.type(screen.getByRole('searchbox', { name: 'Поиск адреса' }), query);
  await user.click(await screen.findByRole('option', { name: new RegExp(result.address) }));
  await user.click(screen.getByRole('button', { name: 'Выбрать' }));
}
const routeRow = (which: 'Откуда' | 'Куда') => screen.getByRole('button', { name: new RegExp(`^${which}`) });
async function ready() {
  await pick('Куда', place('Демо-центр, ул. Примерная, 10'));
  await waitFor(() => expect(priceInput()).toHaveValue(2700));
  expect(submitButton()).toBeEnabled();
}
function scheduledTomorrow() {
  const tomorrow = new Date(Date.now() + 86400000);
  const date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  fireEvent.change(screen.getByLabelText('Дата', { exact: true }), { target: { value: date } });
  fireEvent.change(screen.getByLabelText('Время', { exact: true }), { target: { value: '15:45' } });
  return new Date(`${date}T15:45`).toISOString();
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(estimate).mockReset().mockResolvedValue(quote);
  vi.mocked(createRide).mockReset().mockResolvedValue({ id: 'ride-r03' } as RideView);
  vi.mocked(useSpecialist).mockReset().mockReturnValue(resource(null));
});

describe('new ride and invataxi', () => {
  test('eligible card shows the calm explanation, demo phone and article', () => {
    open();
    expect(screen.getByRole('heading', { name: 'Новая поездка' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Вам может быть положено бесплатное инватакси' })).toBeInTheDocument();
    expect(screen.getByText(/Условия и порядок заказа уточняйте у перевозчика/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Позвонить перевозчику' })).toHaveAttribute('href', 'tel:+77000000000');
    expect(screen.getByText('+7 700 000 00 00 · демо-номер')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Прочитать статью' })).toHaveAttribute('href', '/useful/invataxi-guide');
  });

  test.each([null, { ...card, disability: 'Нет' as const }])('does not offer invataxi without eligibility: %j', value => {
    open({ card: value });
    expect(screen.queryByRole('heading', { name: 'Вам может быть положено бесплатное инватакси' })).not.toBeInTheDocument();
  });

  test('card categories and hints are prefilled, no sharing switch, other is editable', async () => {
    const user = userEvent.setup();
    open({ card: { ...card, features: ['РАС', 'ДЦП', 'Нарушения зрения'] } });
    expect(routeRow('Откуда')).toHaveTextContent('Бостандыкский');
    for (const name of ['РАС', 'ДЦП', 'Нарушения зрения']) expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('switch', { name: /категори/i })).not.toBeInTheDocument();
    expect(screen.getByText('Может пугаться громких звуков, тишина в машине')).toBeInTheDocument();
    expect(screen.getByText('Нужна помощь при посадке')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Другое' }));
    expect(screen.getByLabelText('Своими словами')).toHaveAttribute('maxlength', '120');
    expect(screen.getByLabelText('Комментарий')).toHaveAttribute('maxlength', '500');
    await user.click(screen.getByRole('button', { name: 'РАС' }));
    expect(screen.queryByText('Может пугаться громких звуков, тишина в машине')).not.toBeInTheDocument();
  });

  test('scheduled controls appear only in scheduled mode and use a 30 minute minimum', async () => {
    const user = userEvent.setup();
    open();
    expect(screen.queryByLabelText('Дата', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Нужен сопровождающий' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Повторять' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Запланированная' }));
    const date = screen.getByLabelText('Дата', { exact: true });
    const time = screen.getByLabelText('Время', { exact: true });
    const minTime = Date.parse(`${date.getAttribute('min')}T${time.getAttribute('min')}`);
    expect(minTime).toBeGreaterThanOrEqual(Date.now() + 29 * 60000);
    expect(screen.getByRole('switch', { name: 'Нужен сопровождающий' })).not.toBeChecked();
    expect(within(screen.getByRole('group', { name: 'Повторять' })).getAllByRole('button')).toHaveLength(7);
    await user.click(screen.getByRole('button', { name: 'Экспресс' }));
    expect(screen.queryByLabelText('Дата', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Нужен сопровождающий' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Повторять' })).not.toBeInTheDocument();
  });

  test('invalid prices block submission, including the bounds and increments', async () => {
    open();
    await ready();
    for (const value of ['', '400', '550', '50001', '50100', '2700.5']) {
      fireEvent.change(priceInput(), { target: { value } });
      expect(submitButton()).toBeDisabled();
      expect(priceInput()).toHaveAttribute('aria-invalid', 'true');
      fireEvent.submit(screen.getByRole('form', { name: 'Новая поездка' }));
    }
    expect(createRide).not.toHaveBeenCalled();
    for (const value of ['500', '50000']) {
      fireEvent.change(priceInput(), { target: { value } });
      expect(submitButton()).toBeEnabled();
    }
  });

  test('an express ride sends the expected body without parent_ref and replaces the route', async () => {
    const user = userEvent.setup();
    open();
    await ready();
    await pick('Откуда', place('ул. Демо, 5'));
    await user.click(screen.getByRole('button', { name: 'Детское кресло' }));
    await user.type(screen.getByLabelText('Комментарий'), 'Пожалуйста, без музыки');
    await user.click(submitButton());
    expect(createRide).toHaveBeenCalledExactlyOnceWith({
      mode: 'express', from_district: 'Бостандыкский', from_address: 'ул. Демо, 5',
      to_address: 'Демо-центр, ул. Примерная, 10', scheduled_at: null, repeat_days: [], needs_escort: false,
      categories: ['asd'], category_other: '', show_category: true, needs: ['child_seat'],
      comment: 'Пожалуйста, без музыки', parent_price: 2700,
    });
    expect(await screen.findByRole('status')).toHaveTextContent('/rides/ride-r03 REPLACE');
  });

  test('scheduled payload includes the date, escort, sorted repeat days and chosen categories', async () => {
    const user = userEvent.setup();
    open();
    await ready();
    await user.click(screen.getByRole('button', { name: 'Запланированная' }));
    const iso = scheduledTomorrow();
    await user.click(screen.getByRole('switch', { name: 'Нужен сопровождающий' }));
    await user.click(screen.getByRole('button', { name: 'чт' }));
    await user.click(screen.getByRole('button', { name: 'вт' }));
    await user.click(screen.getByRole('button', { name: 'Другое' }));
    await user.type(screen.getByLabelText('Своими словами'), 'Нужно время для посадки');
    await user.click(submitButton());
    expect(createRide).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'scheduled', scheduled_at: iso, needs_escort: true, repeat_days: [1, 3], show_category: true,
      categories: ['asd', 'other'], category_other: 'Нужно время для посадки',
    }));
  });

  test('switching back to express clears scheduled fields from the submitted payload', async () => {
    const user = userEvent.setup();
    open();
    await ready();
    await user.click(screen.getByRole('button', { name: 'Запланированная' }));
    await user.click(screen.getByRole('switch', { name: 'Нужен сопровождающий' }));
    await user.click(screen.getByRole('button', { name: 'вт' }));
    await user.click(screen.getByRole('button', { name: 'Экспресс' }));
    await user.click(submitButton());
    expect(createRide).toHaveBeenCalledWith(expect.objectContaining({ mode: 'express', scheduled_at: null, needs_escort: false, repeat_days: [] }));
  });

  test('a past or near scheduled time blocks submission', async () => {
    const user = userEvent.setup();
    open();
    await ready();
    await user.click(screen.getByRole('button', { name: 'Запланированная' }));
    fireEvent.change(screen.getByLabelText('Дата', { exact: true }), { target: { value: '2020-01-01' } });
    expect(submitButton()).toBeDisabled();
    scheduledTomorrow();
    expect(submitButton()).toBeEnabled();
  });

  test('server errors preserve input and allow retry; duplicate submits are ignored', async () => {
    const user = userEvent.setup();
    let reject!: (error: Error) => void;
    vi.mocked(createRide).mockImplementationOnce(() => new Promise((_resolve, rejectPromise) => { reject = rejectPromise; }));
    open();
    await ready();
    await user.type(screen.getByLabelText('Комментарий'), 'Подождите у двери');
    await user.click(submitButton());
    fireEvent.submit(screen.getByRole('form', { name: 'Новая поездка' }));
    expect(createRide).toHaveBeenCalledTimes(1);
    await act(async () => reject(new RidesError(422, 'price_out_of_range')));
    expect(screen.getByRole('alert')).toHaveTextContent('Укажите цену от 500 до 50 000 ₸');
    expect(screen.getByLabelText('Комментарий')).toHaveValue('Подождите у двери');
    expect(priceInput()).toHaveValue(2700);
    expect(routeRow('Куда')).toHaveTextContent('Демо-центр, ул. Примерная, 10');
    expect(submitButton()).toBeEnabled();
    await user.click(submitButton());
    expect(await screen.findByRole('status')).toHaveTextContent('/rides/ride-r03');
  });

  test('new quotes update the hint, while the initial price is only applied once', async () => {
    const user = userEvent.setup();
    vi.mocked(estimate).mockResolvedValueOnce(quote).mockResolvedValue({ ...quote, low: 4000, high: 6000, suggested: 4800 });
    open();
    await ready();
    await pick('Куда', place('Другой адрес, демо', 'Медеуский'));
    await screen.findByText(/Обычно 4\s000–6\s000 ₸/);
    expect(estimate).toHaveBeenLastCalledWith('Бостандыкский', 'Медеуский');
    expect(priceInput()).toHaveValue(2700);
    await user.click(screen.getByRole('button', { name: 'Увеличить цену на 100 ₸' }));
    expect(priceInput()).toHaveValue(2800);
    await user.click(screen.getByRole('button', { name: 'Уменьшить цену на 100 ₸' }));
    expect(priceInput()).toHaveValue(2700);
  });

  test('manual price entered before the estimate arrives is preserved', async () => {
    let resolve!: (value: typeof quote) => void;
    vi.mocked(estimate).mockReturnValueOnce(new Promise(resolvePromise => { resolve = resolvePromise; }));
    open();
    fireEvent.change(priceInput(), { target: { value: '3200' } });
    await waitFor(() => expect(estimate).toHaveBeenCalled());
    await act(async () => resolve(quote));
    expect(priceInput()).toHaveValue(3200);
  });

  test('latest saved booking supplies the destination and district, navigation address takes priority', () => {
    vi.mocked(useSpecialist).mockReturnValue(resource(specialist));
    const bookings: SavedBooking[] = [
      { id: 'latest', specialist_id: 1, slot: '2026-12-02T10:00:00Z', format: 'Кабинет', created_at: '2026-11-14T08:00:00Z' },
      { id: 'older', specialist_id: 2, slot: '2026-12-01T10:00:00Z', format: 'Кабинет', created_at: '2026-11-13T08:00:00Z' },
    ];
    const view = open({ bookings });
    expect(useSpecialist).toHaveBeenCalledWith(1);
    expect(routeRow('Куда')).toHaveTextContent(specialist.address);
    view.unmount();
    open({ bookings, state: { to_address: 'Адрес из записи, демо' } });
    expect(routeRow('Куда')).toHaveTextContent('Адрес из записи, демо');
  });

  test('late specialist data does not replace an edited destination or district', async () => {
    const view = open();
    await pick('Куда', place('Мой адрес, демо', 'Медеуский'));
    vi.mocked(useSpecialist).mockReturnValue(resource(specialist));
    view.refresh();
    expect(routeRow('Куда')).toHaveTextContent('Мой адрес, демо');
    expect(routeRow('Куда')).toHaveTextContent('Медеуский');
  });

  test('the typed text can be used as is when the search finds nothing', async () => {
    const user = userEvent.setup();
    vi.mocked(searchPlaces).mockResolvedValue([]);
    open();
    await user.click(routeRow('Куда'));
    await user.type(screen.getByRole('searchbox', { name: 'Поиск адреса' }), 'Школа 15');
    await user.click(await screen.findByRole('button', { name: /Использовать «Школа 15»/ }));
    await user.click(screen.getByRole('button', { name: 'Выбрать' }));
    expect(routeRow('Куда')).toHaveTextContent('Школа 15');
  });

  test('search falls back to the local list when the geocoder is unreachable', async () => {
    const user = userEvent.setup();
    vi.mocked(searchPlaces).mockRejectedValue(new Error('offline'));
    open();
    await user.click(routeRow('Откуда'));
    await user.type(screen.getByRole('searchbox', { name: 'Поиск адреса' }), 'Медеуск');
    expect(await screen.findByText(/Нет связи с картой/)).toBeInTheDocument();
    await user.click((await screen.findAllByRole('option', { name: /Медеуский/ }))[0]);
    await user.click(screen.getByRole('button', { name: 'Выбрать' }));
    expect(routeRow('Откуда')).toHaveTextContent('Медеуский');
  });

  test('the picker closes without changes on back', async () => {
    const user = userEvent.setup();
    open();
    await user.click(routeRow('Откуда'));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Назад' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(routeRow('Откуда')).toHaveTextContent('Бостандыкский');
  });
});
