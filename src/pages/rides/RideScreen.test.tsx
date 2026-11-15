import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import type { RideView } from '../../lib/ridesTypes';
import { useRide } from '../../state/rides';
import RideScreen from './RideScreen';

vi.mock('../../state/rides', () => ({ useRide: vi.fn() }));
const refresh = vi.fn();
const base = { loading: false, error: null, offline: false, refresh };
function open() {
  render(<MemoryRouter initialEntries={['/rides/r1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><I18nProvider><Routes>
    <Route path="/rides/:id" element={<RideScreen />} />
  </Routes></I18nProvider></MemoryRouter>);
}

test('unknown ride shows a friendly message instead of the error code', () => {
  vi.mocked(useRide).mockReturnValue({ ...base, data: null, error: 'not_found' });
  open();
  expect(screen.getByRole('heading', { name: 'Поездка не найдена' })).toBeInTheDocument();
  expect(screen.queryByText('not_found')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Новая поездка' })).toHaveAttribute('href', '/rides/new');
  expect(screen.getByRole('link', { name: 'К моим поездкам' })).toHaveAttribute('href', '/rides');
});

test('loading and cancelled states are translated', () => {
  vi.mocked(useRide).mockReturnValue({ ...base, data: null, loading: true });
  const { unmount } = render(<MemoryRouter initialEntries={['/rides/r1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><I18nProvider><Routes>
    <Route path="/rides/:id" element={<RideScreen />} /></Routes></I18nProvider></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'Загружаем…' })).toBeInTheDocument();
  unmount();
  vi.mocked(useRide).mockReturnValue({ ...base, data: { id: 'r1', status: 'cancelled' } as RideView });
  open();
  expect(screen.getByRole('heading', { name: 'Поездка отменена' })).toBeInTheDocument();
  expect(screen.queryByText('cancelled')).not.toBeInTheDocument();
});
