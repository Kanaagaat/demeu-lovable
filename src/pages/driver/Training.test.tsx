import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import { useDriver } from '../../state/rides';
import * as api from '../../lib/rides';
import type { Driver } from '../../lib/ridesTypes';
import { DRIVER_LESSONS, type DriverLessonId } from '../../data/driverLessons';
import ru from '../../i18n/ns/driver.ru.json';
import Training from './Training';

vi.mock('../../state/rides', () => ({ useDriver: vi.fn() }));
vi.mock('../../lib/rides', async importOriginal => ({ ...await importOriginal<typeof api>(), patchDriver: vi.fn() }));
const driver: Driver = { id: 'local-r06', name: 'Демо', phone: '+7 700 000 00 00', car: 'Демо авто', plate: '000 DMU 02', rating: 4.8, verified: false, trained: false, kit_checked_at: null, kit_ok: false, online: false, worked_with: [], is_demo: false };
const refresh = vi.fn();
const dict: Record<string, string> = ru;
function open(path = '/driver/training') { return render(<MemoryRouter initialEntries={['/driver/feed', path]} initialIndex={1}><I18nProvider><Routes><Route path="/driver/training" element={<Training />} /><Route path="/driver/feed" element={<p>feed destination</p>} /><Route path="/driver" element={<p>registration destination</p>} /></Routes></I18nProvider></MemoryRouter>); }
async function start(index: number) {
  await userEvent.click(screen.getAllByRole('button', { name: 'Открыть урок' })[index]);
  for (let i = 0; i < 4; i++) await userEvent.click(screen.getByRole('button', { name: 'Далее' }));
  await userEvent.click(screen.getByRole('button', { name: 'К мини-тесту' }));
}
async function answer(id: DriverLessonId, answers: readonly number[]) {
  for (let i = 0; i < 3; i++) {
    await userEvent.click(screen.getByRole('button', { name: dict[`trainLesson_${id}_q${i + 1}_a${answers[i]}`] }));
    await userEvent.click(screen.getByRole('button', { name: i === 2 ? 'Завершить урок' : 'Далее' }));
  }
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(useDriver).mockReturnValue({ data: driver, loading: false, error: null, offline: false, refresh }); vi.mocked(api.patchDriver).mockResolvedValue({ ...driver, trained: true }); });
afterEach(() => { vi.restoreAllMocks(); });

test('lesson requires 3/3, gives immediate gentle feedback and permits a retake', async () => {
  open(); await start(0);
  expect(screen.getByRole('button', { name: 'Далее' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Крепко держать руки' }));
  expect(screen.getByRole('status')).toHaveTextContent('Почти. Правильный ответ: Убрать опасные предметы и засечь время');
  await userEvent.click(screen.getByRole('button', { name: 'Далее' }));
  await userEvent.click(screen.getByRole('button', { name: 'Осторожно положить на бок и быть рядом' }));
  await userEvent.click(screen.getByRole('button', { name: 'Далее' }));
  await userEvent.click(screen.getByRole('button', { name: 'Звонить 103 / 112' }));
  await userEvent.click(screen.getByRole('button', { name: 'Завершить урок' }));
  expect(screen.getByText('Верных ответов: 2 из 3')).toBeInTheDocument();
  expect(localStorage.getItem('demeu.driverLessons')).toBeNull();
  expect(api.patchDriver).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Пройти тест ещё раз' }));
  await answer('seizure', DRIVER_LESSONS[0].answers);
  expect(screen.getByText('Урок пройден')).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('demeu.driverLessons')!).completed).toEqual(['seizure']);
  expect(api.patchDriver).not.toHaveBeenCalled();
});

test('three passed lessons call patchDriver trained and show the badge', async () => {
  open();
  for (const lesson of DRIVER_LESSONS) {
    await start(0); await answer(lesson.id, lesson.answers);
    if (lesson.id !== 'wheelchair') await userEvent.click(screen.getByRole('button', { name: 'К списку уроков' }));
  }
  expect(await screen.findByText('Вы обучены Мама Про')).toBeInTheDocument();
  expect(api.patchDriver).toHaveBeenCalledExactlyOnceWith(driver.id, { trained: true });
  expect(screen.getByRole('link', { name: 'К чек-листу' })).toHaveAttribute('href', '/driver/checklist');
});

test.each(DRIVER_LESSONS)('?lesson=$id opens that lesson as reference and closes back to the caller', async lesson => {
  localStorage.setItem('demeu.driverLessons', JSON.stringify({ driverId: driver.id, completed: DRIVER_LESSONS.map(item => item.id) }));
  open(`/driver/training?lesson=${lesson.id}`);
  expect(screen.getByRole('heading', { name: dict[`trainLesson_${lesson.id}_title`] })).toBeInTheDocument();
  expect(screen.getByText('Учебный материал, проверяется фондом')).toBeInTheDocument();
  if (lesson.id === 'seizure') expect(screen.getByText('Если приступ длится долго — 103 / 112')).toBeInTheDocument();
  for (let i = 0; i < 4; i++) await userEvent.click(screen.getByRole('button', { name: 'Далее' }));
  expect(screen.queryByRole('button', { name: 'К мини-тесту' })).not.toBeInTheDocument();
  await userEvent.click(screen.getAllByRole('button', { name: 'Закрыть' })[0]);
  expect(await screen.findByText('feed destination')).toBeInTheDocument();
  expect(api.patchDriver).not.toHaveBeenCalled();
});

test('completed progress resumes the final save, and a failed save can be retried', async () => {
  localStorage.setItem('demeu.driverLessons', JSON.stringify({ driverId: driver.id, completed: DRIVER_LESSONS.map(item => item.id) }));
  vi.mocked(api.patchDriver).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ ...driver, trained: true });
  open(); expect(await screen.findByRole('alert')).toHaveTextContent('Не получилось сохранить');
  await userEvent.click(screen.getByRole('button', { name: 'Попробовать снова' }));
  expect(await screen.findByText('Вы обучены Мама Про')).toBeInTheDocument();
  expect(api.patchDriver).toHaveBeenCalledTimes(2);
});

test('malformed or unavailable storage does not block the course', async () => {
  localStorage.setItem('demeu.driverLessons', '{invalid');
  const view = open(); expect(screen.getAllByRole('button', { name: 'Открыть урок' })).toHaveLength(3); view.unmount();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  open(); await start(0); await answer('seizure', DRIVER_LESSONS[0].answers);
  expect(screen.getByText('Урок пройден')).toBeInTheDocument();
});

test('unregistered visitors can use a reference lesson', async () => {
  vi.mocked(useDriver).mockReturnValue({ data: null, loading: false, error: null, offline: false, refresh });
  open('/driver/training?lesson=seizure');
  expect(screen.getByText('Если приступ длится долго — 103 / 112')).toBeInTheDocument();
  await act(async () => undefined); await waitFor(() => expect(api.patchDriver).not.toHaveBeenCalled());
});


test('trained driver can revisit and retake lessons without saving trained again', async () => {
  vi.mocked(useDriver).mockReturnValue({ data: { ...driver, trained: true }, loading: false, error: null, offline: false, refresh });
  open();
  await userEvent.click(screen.getByRole('button', { name: 'Повторить уроки' }));
  await userEvent.click(screen.getAllByRole('button', { name: 'Повторить урок' })[0]);
  expect(screen.getByRole('heading', { name: 'Первая помощь при судорожном приступе' })).toBeInTheDocument();
  for (let i = 0; i < 4; i++) await userEvent.click(screen.getByRole('button', { name: 'Далее' }));
  await userEvent.click(screen.getByRole('button', { name: 'К мини-тесту' }));
  await answer('seizure', DRIVER_LESSONS[0].answers);
  expect(screen.getByText('Урок пройден')).toBeInTheDocument();
  expect(api.patchDriver).not.toHaveBeenCalled();
});
