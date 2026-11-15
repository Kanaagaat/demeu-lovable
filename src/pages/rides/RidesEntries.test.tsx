import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import App from '../../App';
import { getSpecialist } from '../../lib/engine';
import { useSpecialist } from '../../lib/hooks';

const flag = vi.hoisted(() => ({ enabled: true }));
vi.mock('../../lib/flags', () => ({ get RIDES_ENABLED() { return flag.enabled; } }));
vi.mock('../../lib/hooks', async importOriginal => ({
  ...await importOriginal<typeof import('../../lib/hooks')>(),
  useNews: () => ({ data: { items: [] }, loading: false, error: null }),
  useSpecialist: vi.fn(),
}));
vi.mock('../../state/rides', () => {
  const result = { data: null, loading: false, error: null, offline: false, refresh: vi.fn() };
  return {
    useMyRides: () => ({ ...result, data: [] }),
    useDriver: () => ({ ...result, data: { id: 'driver-demo', name: 'Демо водитель', phone: '+7 700 000 00 01', car: 'Демо авто', plate: '000 DMU 02', rating: 4.8, verified: true, trained: true, kit_checked_at: new Date().toISOString(), online: true, worked_with: [], is_demo: true, kit_ok: true } }),
    useEstimate: () => result,
    useDriverFeed: () => ({ ...result, data: [] }),
    useDriverRides: () => ({ ...result, data: [] }),
    useDriverRide: () => result,
    useRide: () => result,
  };
});
function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname} {JSON.stringify(location.state)}</output>;
}
function open(path: string, onboarded = true) {
  localStorage.setItem('demeu.onboarded', JSON.stringify(onboarded));
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><App /><Location /></MemoryRouter>);
}
beforeEach(() => {
  flag.enabled = true;
  localStorage.clear();
  vi.mocked(useSpecialist).mockReturnValue({ data: getSpecialist(1), loading: false, error: null, source: 'seed', reload: vi.fn() });
  localStorage.setItem('demeu.bookings', JSON.stringify([{ id: 'booking-1', specialist_id: 1, slot: '2026-12-01T10:00:00Z', format: 'Кабинет', created_at: '2026-11-14T10:00:00Z' }]));
});

describe.each([false, true])('entry points with RIDES_ENABLED=%s', enabled => {
  beforeEach(() => { flag.enabled = enabled; });
  test('home has one compact entry only when enabled', async () => {
    open('/');
    await screen.findByRole('heading', { name: 'Ваш специалист' });
    const entry = screen.queryByRole('button', { name: 'Поездка для ребёнка' });
    expect(!!entry).toBe(enabled);
    if (entry) {
      expect(entry.querySelector('img')).toHaveAttribute('src', '/icons/fluency-systems-regular/6755B2/car.png');
      fireEvent.click(entry);
      expect(screen.getByTestId('location')).toHaveTextContent('/rides/new');
    }
  });
  test('booking success passes the loaded specialist address', async () => {
    open('/booked/1');
    await screen.findByRole('heading', { name: 'Готово!' });
    const entry = screen.queryByRole('link', { name: 'Заказать поездку к специалисту' });
    expect(!!entry).toBe(enabled);
    if (entry) {
      expect(entry).toHaveAttribute('href', '/rides/new');
      expect(entry).toHaveClass('pl-secondary');
      fireEvent.click(entry);
      expect(screen.getByTestId('location')).toHaveTextContent(JSON.stringify({ to_address: getSpecialist(1)!.address }));
    }
  });
  test('profile shows both menu rows only when enabled', async () => {
    open('/profile');
    await screen.findByRole('heading', { name: 'Профиль' });
    const rides = screen.queryByRole('link', { name: /Мои поездки/ });
    const driver = screen.queryByRole('link', { name: /Я водитель/ });
    expect(!!rides).toBe(enabled);
    expect(!!driver).toBe(enabled);
    if (enabled) {
      expect(rides).toHaveAttribute('href', '/rides');
      expect(driver).toHaveAttribute('href', '/driver');
    }
  });
  test('welcome driver link bypasses parent onboarding only when enabled', async () => {
    open('/welcome', false);
    await screen.findByText('RU');
    const entry = screen.queryByRole('link', { name: 'Я водитель' });
    expect(!!entry).toBe(enabled);
    if (entry) {
      fireEvent.click(entry);
      expect(await screen.findByRole('heading', { level: 1, name: 'Я водитель' })).toBeInTheDocument();
      expect(screen.getByTestId('location')).toHaveTextContent('/driver');
      expect(localStorage.getItem('demeu.onboarded')).toBe('false');
    }
  });
});

test.each(['/rides', '/rides/new', '/rides/demo', '/driver', '/driver/feed', '/driver/ride/demo'])('disabled route %s renders App NotFound', async path => {
  flag.enabled = false;
  open(path);
  expect(await screen.findByRole('heading', { name: 'Страница не найдена' })).toBeInTheDocument();
  expect(screen.queryByText('Новая поездка')).not.toBeInTheDocument();
});

test('enabled /rides renders the actual list through App with no active tab', async () => {
  open('/rides');
  expect(await screen.findByRole('heading', { name: 'Мои поездки' })).toBeInTheDocument();
  const navigation = screen.getByRole('navigation', { name: 'Основная навигация' });
  expect(within(navigation).getAllByRole('link')).toHaveLength(5);
  expect(navigation.querySelector('[aria-current]')).toBeNull();
  expect(document.querySelector('.app-shell')).toHaveAttribute('data-tabs', 'true');
});

test.each(['/rides/new', '/driver/ride/demo'])('AppShell hides the tab bar on fullscreen route %s', async path => {
  localStorage.setItem('demeu.driverId', 'driver-demo');
  open(path);
  expect(await screen.findByTestId('location')).toHaveTextContent(path);
  expect(screen.queryByRole('navigation', { name: 'Основная навигация' })).not.toBeInTheDocument();
  expect(document.querySelector('.app-shell')).toHaveAttribute('data-tabs', 'false');
});

test.each(['/driver', '/driver/training', '/driver/checklist', '/driver/feed'])('driver route %s opens before parent onboarding and retains tabs', async path => {
  localStorage.setItem('demeu.driverId', 'driver-demo');
  open(path, false);
  await screen.findByRole('heading', { level: 1 });
  expect(screen.getByTestId('location')).toHaveTextContent(path);
  expect(screen.getByRole('navigation', { name: 'Основная навигация' })).toBeInTheDocument();
  expect(document.querySelector('.app-shell')).toHaveAttribute('data-tabs', 'true');
});

test('a disabled driver route preserves the original onboarding guard', async () => {
  flag.enabled = false;
  open('/driver', false);
  await screen.findByText('RU');
  expect(screen.getByTestId('location')).toHaveTextContent('/welcome');
});
