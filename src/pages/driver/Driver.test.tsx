import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import { useDriver } from '../../state/rides';
import * as api from '../../lib/rides';
import { RidesError, type Driver as DriverData } from '../../lib/ridesTypes';
import Driver from './Driver';
import Training from './Training';
import Checklist from './Checklist';
import { DRIVER_LESSONS } from '../../data/driverLessons';
import ru from '../../i18n/ns/driver.ru.json';

vi.mock('../../state/rides', () => ({ useDriver: vi.fn() }));
vi.mock('../../lib/rides', async importOriginal => ({ ...await importOriginal<typeof api>(), registerDriver: vi.fn(), setDriverId: vi.fn(), patchDriver: vi.fn(), setOnline: vi.fn() }));
const driver: DriverData = { id: 'local-r06', name: 'Демо Водитель', phone: '+7 700 000 00 00', car: 'Демо авто, серый', plate: '000 DMU 02', rating: 4.8, verified: false, trained: false, kit_checked_at: null, kit_ok: false, online: false, worked_with: [], is_demo: false };
const refresh = vi.fn();
function state(data: DriverData | null) { vi.mocked(useDriver).mockReturnValue({ data, loading: false, error: null, offline: false, refresh }); }
function open() { return render(<MemoryRouter initialEntries={['/driver']}><I18nProvider><Routes><Route path="/driver" element={<Driver />} /><Route path="/driver/feed" element={<p>feed destination</p>} /></Routes></I18nProvider></MemoryRouter>); }
beforeEach(() => { vi.clearAllMocks(); state(null); });

test('registration requires fields, keeps document uploads in demo, and uses the R02 client', async () => {
  const user = userEvent.setup();
  vi.mocked(api.registerDriver).mockResolvedValue(driver);
  open();
  const submit = screen.getByRole('button', { name: 'Отправить на проверку' });
  expect(submit).toBeDisabled();
  await user.type(screen.getByLabelText('Имя и фамилия'), driver.name);
  await user.type(screen.getByLabelText('Телефон'), '+7 912 345 67 89');
  await user.type(screen.getByLabelText('Машина: марка и цвет'), driver.car);
  await user.type(screen.getByLabelText('Госномер'), driver.plate);
  expect(submit).toBeDisabled();
  await user.clear(screen.getByLabelText('Телефон'));
  await user.type(screen.getByLabelText('Телефон'), driver.phone);
  await user.click(screen.getByRole('button', { name: 'Загрузить удостоверение' }));
  await user.click(screen.getByRole('button', { name: 'Загрузить техпаспорт' }));
  expect(screen.getAllByRole('button', { name: /Загружено \(демо\)/ })).toHaveLength(2);
  expect(document.querySelector('input[type=file]')).toBeNull();
  expect(submit).toBeEnabled();
  await user.click(submit);
  expect(api.registerDriver).toHaveBeenCalledWith({ name: driver.name, phone: driver.phone, car: driver.car, plate: driver.plate });
  expect(api.setDriverId).toHaveBeenCalledWith(driver.id);
  expect(refresh).toHaveBeenCalled();
});

test('hub verification is explicitly demo and going online needs all three checks', async () => {
  const user = userEvent.setup();
  state(driver); vi.mocked(api.patchDriver).mockResolvedValue({ ...driver, verified: true });
  open();
  expect(screen.getByText('На проверке у Мама Про')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Выйти на линию' })).toBeDisabled();
  expect(screen.getByRole('link', { name: 'Обучение' })).toHaveAttribute('href', '/driver/training');
  await user.click(screen.getByRole('button', { name: 'Подтвердить (демо)' }));
  expect(api.patchDriver).toHaveBeenCalledWith(driver.id, { verified: true });
});

test('ready hub displays missing readiness returned by the server', async () => {
  state({ ...driver, verified: true, trained: true, kit_ok: true, kit_checked_at: new Date().toISOString() });
  vi.mocked(api.setOnline).mockRejectedValue(new RidesError(409, 'not_ready', { missing: ['kit'] }));
  open(); await userEvent.click(screen.getByRole('button', { name: 'Выйти на линию' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Сначала: Чек-лист');
  expect(api.setOnline).toHaveBeenCalledWith(driver.id, true);
});

test('online driver can open the feed and go offline', async () => {
  state({ ...driver, online: true }); vi.mocked(api.setOnline).mockResolvedValue(driver);
  open();
  expect(screen.getByRole('link', { name: 'Открыть ленту заказов' })).toHaveAttribute('href', '/driver/feed');
  await userEvent.click(screen.getByRole('button', { name: 'Сойти с линии' }));
  await waitFor(() => expect(api.setOnline).toHaveBeenCalledWith(driver.id, false));
});

test('loading errors offer retry instead of a second registration', () => {
  vi.mocked(useDriver).mockReturnValue({ data: null, loading: false, error: null, offline: true, refresh });
  open(); expect(screen.getByRole('button', { name: 'Попробовать снова' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Отправить на проверку' })).not.toBeInTheDocument();
});


test('registration → verification → all lessons → kit → online works with the real local R02 client', async () => {
  const actualState = await vi.importActual<typeof import('../../state/rides')>('../../state/rides');
  const actualApi = await vi.importActual<typeof api>('../../lib/rides');
  vi.mocked(useDriver).mockImplementation(actualState.useDriver);
  vi.mocked(api.registerDriver).mockImplementation(actualApi.registerDriver);
  vi.mocked(api.setDriverId).mockImplementation(actualApi.setDriverId);
  vi.mocked(api.patchDriver).mockImplementation(actualApi.patchDriver);
  vi.mocked(api.setOnline).mockImplementation(actualApi.setOnline);
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={['/driver']}><I18nProvider><Routes>
    <Route path="/driver" element={<Driver />} /><Route path="/driver/training" element={<Training />} />
    <Route path="/driver/checklist" element={<Checklist />} /><Route path="/driver/feed" element={<p>feed destination</p>} />
  </Routes></I18nProvider></MemoryRouter>);
  await user.type(await screen.findByLabelText('Имя и фамилия'), driver.name);
  await user.type(screen.getByLabelText('Телефон'), driver.phone);
  await user.type(screen.getByLabelText('Машина: марка и цвет'), driver.car);
  await user.type(screen.getByLabelText('Госномер'), driver.plate);
  await user.click(screen.getByRole('button', { name: 'Отправить на проверку' }));
  await user.click(await screen.findByRole('button', { name: 'Подтвердить (демо)' }));
  expect(await screen.findByRole('heading', { name: 'Проверен' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Выйти на линию' })).toBeDisabled();
  await user.click(screen.getByRole('link', { name: 'Обучение' }));
  const dict: Record<string, string> = ru;
  for (const lesson of DRIVER_LESSONS) {
    await user.click((await screen.findAllByRole('button', { name: 'Открыть урок' }))[0]);
    for (let i = 0; i < 4; i++) await user.click(screen.getByRole('button', { name: 'Далее' }));
    await user.click(screen.getByRole('button', { name: 'К мини-тесту' }));
    for (let i = 0; i < 3; i++) {
      await user.click(screen.getByRole('button', { name: dict[`trainLesson_${lesson.id}_q${i + 1}_a${lesson.answers[i]}`] }));
      await user.click(screen.getByRole('button', { name: i === 2 ? 'Завершить урок' : 'Далее' }));
    }
    if (lesson.id !== 'wheelchair') await user.click(screen.getByRole('button', { name: 'К списку уроков' }));
  }
  await user.click(await screen.findByRole('link', { name: 'К чек-листу' }));
  const boxes = await screen.findAllByRole('checkbox');
  for (const box of boxes.slice(0, 5)) await user.click(box);
  await user.click(screen.getByRole('button', { name: 'Выйти на линию' }));
  expect(await screen.findByText('feed destination')).toBeInTheDocument();
  const saved = await actualApi.getDriver(actualApi.getDriverId()!);
  expect(saved).toMatchObject({ verified: true, trained: true, kit_ok: true, online: true });
});
