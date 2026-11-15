import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import { useDriver } from '../../state/rides';
import * as api from '../../lib/rides';
import { KIT_REQUIRED, RidesError, type Driver } from '../../lib/ridesTypes';
import Checklist from './Checklist';

vi.mock('../../state/rides', () => ({ useDriver: vi.fn() }));
vi.mock('../../lib/rides', async importOriginal => ({ ...await importOriginal<typeof api>(), kitCheck: vi.fn(), setOnline: vi.fn() }));
const driver: Driver = { id: 'local-r06', name: 'Демо', phone: '+7 700 000 00 00', car: 'Демо авто', plate: '000 DMU 02', rating: 4.8, verified: true, trained: true, kit_checked_at: null, kit_ok: false, online: false, worked_with: [], is_demo: false };
const refresh = vi.fn();
function state(data: Driver | null) { vi.mocked(useDriver).mockReturnValue({ data, loading: false, error: null, offline: false, refresh }); }
function open() { return render(<MemoryRouter initialEntries={['/driver/checklist']}><I18nProvider><Routes><Route path="/driver/checklist" element={<Checklist />} /><Route path="/driver" element={<p>registration destination</p>} /><Route path="/driver/feed" element={<p>feed destination</p>} /></Routes></I18nProvider></MemoryRouter>); }
async function checkRequired() { for (const checkbox of screen.getAllByRole('checkbox').slice(0, 5)) await userEvent.click(checkbox); }
beforeEach(() => { vi.clearAllMocks(); state(driver); vi.mocked(api.kitCheck).mockResolvedValue({ ...driver, kit_checked_at: new Date().toISOString(), kit_ok: true }); vi.mocked(api.setOnline).mockResolvedValue({ ...driver, online: true }); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

test('only the first five items are required and kitCheck precedes online', async () => {
  open();
  expect(screen.getAllByRole('checkbox')).toHaveLength(8);
  const submit = screen.getByRole('button', { name: 'Выйти на линию' });
  expect(submit).toBeDisabled();
  for (const checkbox of screen.getAllByRole('checkbox').slice(5)) await userEvent.click(checkbox);
  expect(submit).toBeDisabled();
  await checkRequired(); expect(submit).toBeEnabled();
  await userEvent.click(submit);
  expect(await screen.findByText('feed destination')).toBeInTheDocument();
  expect(api.kitCheck).toHaveBeenCalledWith(driver.id, expect.arrayContaining(KIT_REQUIRED));
  expect(api.setOnline).toHaveBeenCalledWith(driver.id, true);
  expect(vi.mocked(api.kitCheck).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(api.setOnline).mock.invocationCallOrder[0]);
});

test('not_ready explains missing verification and training and links to them', async () => {
  vi.mocked(api.setOnline).mockRejectedValue(new RidesError(409, 'not_ready', { missing: ['verified', 'trained'] }));
  open(); await checkRequired(); await userEvent.click(screen.getByRole('button', { name: 'Выйти на линию' }));
  const alert = await screen.findByRole('alert'); expect(alert).toHaveTextContent('Сначала: Проверка, Обучение');
  expect(within(alert).getByRole('link', { name: 'Проверка' })).toHaveAttribute('href', '/driver');
  expect(within(alert).getByRole('link', { name: 'Обучение' })).toHaveAttribute('href', '/driver/training');
});

test('draft survives remount, including with optional items unchecked', async () => {
  const view = open(); await checkRequired(); view.unmount(); open();
  expect(screen.getByRole('button', { name: 'Выйти на линию' })).toBeEnabled();
  expect(screen.getAllByRole('checkbox').slice(5).every(item => !(item as HTMLInputElement).checked)).toBe(true);
});

test('kit expiry clears saved checks while the screen stays open', async () => {
  vi.useFakeTimers();
  const checkedAt = new Date(Date.now() - 12 * 60 * 60 * 1000 + 1000).toISOString();
  state({ ...driver, kit_ok: true, kit_checked_at: checkedAt });
  localStorage.setItem('demeu.kitDraft', JSON.stringify({ driverId: driver.id, kitCheckedAt: checkedAt, items: KIT_REQUIRED, savedAt: Date.now() }));
  open(); expect(screen.getByRole('button', { name: 'Выйти на линию' })).toBeEnabled();
  await act(async () => { vi.advanceTimersByTime(1100); });
  expect(screen.getByRole('button', { name: 'Выйти на линию' })).toBeDisabled();
  expect(screen.getAllByRole('checkbox').every(item => !(item as HTMLInputElement).checked)).toBe(true);
});

test('expired draft and a different driver cannot reuse previous checks', () => {
  const checkedAt = new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString();
  state({ ...driver, kit_checked_at: checkedAt });
  localStorage.setItem('demeu.kitDraft', JSON.stringify({ driverId: driver.id, kitCheckedAt: checkedAt, items: KIT_REQUIRED, savedAt: Date.now() - 2 * 60 * 60 * 1000 }));
  open(); expect(screen.getByRole('button', { name: 'Выйти на линию' })).toBeDisabled();
});

test('unregistered driver is sent to the registration route', async () => {
  state(null); open(); expect(await screen.findByText('registration destination')).toBeInTheDocument();
});

test('blocked storage does not prevent checking items and going online', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  open(); await checkRequired(); await userEvent.click(screen.getByRole('button', { name: 'Выйти на линию' }));
  await waitFor(() => expect(api.setOnline).toHaveBeenCalledWith(driver.id, true));
});
