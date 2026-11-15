import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nProvider } from '../../i18n';
import { AppStateProvider, DEFAULT_SHARE } from '../../state/AppState';
import { ToastProvider } from '../Toast';
import Plan from '../../pages/Plan';
import Step from '../../pages/Step';
import Book from '../../pages/Book';
import My from '../../pages/My';
import Feedback from '../../pages/Feedback';
import Notifications from '../../pages/Notifications';
import Booked from '../../pages/Booked';
import { deriveNotifications, useUnreadCount } from '../../state/notifications';
import { getBookingMeta, savePlanValue, selectedShared } from '../../state/plan';
import type { ChildCard, SavedBooking } from '../../lib/types';
import * as api from '../../lib/api';
import * as engine from '../../lib/engine';

const card: ChildCard = { name: 'Айдан', age: 6, district: 'Бостандыкский', features: ['РАС'], comm: 'Отдельные слова', react: 'Нужно время, чтобы привыкнуть', goals: ['Речь', 'Общение'], disability: 'В процессе' };
const booking: SavedBooking = { id: 'booking-1', specialist_id: 1, slot: '2026-11-15T15:00:00+05:00', format: 'Кабинет', created_at: '2026-11-14T00:00:00Z' };
function show(ui: ReactNode, path = '/', route = '*', extra?: ReactNode) {
  return render(<I18nProvider><AppStateProvider><ToastProvider><MemoryRouter initialEntries={[path]}>{extra}<Routes><Route path={route} element={ui} /><Route path="/my" element={<My />} /><Route path="/booked/:id" element={<Booked />} /></Routes></MemoryRouter></ToastProvider></AppStateProvider></I18nProvider>);
}
function Unread() { return <output data-testid="unread-count">{useUnreadCount()}</output>; }
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('demeu.onboarded', 'true');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-14T06:00:00Z'));
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function saveCard(value: ChildCard = card) { localStorage.setItem('demeu.card', JSON.stringify(value)); }

describe('support plan and step', () => {
  test('builds a different plan for each card: four stages, starting in the clinic', async () => {
    saveCard();
    const first = show(<Plan />);
    expect(await screen.findByRole('heading', { name: /Поликлиника и обследования/ })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent).slice(0, 4)).toEqual(['Поликлиника и обследования', 'Заключения и статус', 'Льготы и выплаты', 'Занятия и развитие']);
    expect(screen.getByRole('link', { name: /Прикрепление к детской поликлинике/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Консультация логопеда/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Довести оформление инвалидности/ })).toBeInTheDocument(); // disability «В процессе»
    first.unmount();
    saveCard({ ...card, features: ['ДЦП'], goals: ['Моторика'], comm: 'Говорит фразами', disability: 'Нет' });
    show(<Plan />);
    expect(await screen.findByRole('link', { name: /Реабилитолог: двигательные навыки/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Установление инвалидности/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Консультация логопеда/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Довести оформление/ })).not.toBeInTheDocument();
  });
  test('Irisha adds a personal summary and comments on top of the plan; the plan works while it loads', async () => {
    saveCard();
    vi.spyOn(api, 'planAi').mockResolvedValue({ generated_by: 'ai', summary: 'Начните с поликлиники: отсюда идут все направления.', first_week: ['Проверить прикрепление', 'Записаться к педиатру', 'Собрать заключения'], notes: { 'c-attach': { personal: 'В 6 лет важно заранее знать форму обучения.', ask: ['Как записаться к неврологу?'] } } });
    show(<Plan />);
    expect(screen.getByRole('link', { name: /Прикрепление к детской поликлинике/ })).toBeInTheDocument();
    expect(screen.getByText(/Иришка подбирает пояснения/)).toBeInTheDocument();
    expect(await screen.findByText(/отсюда идут все направления/)).toBeInTheDocument();
    expect(screen.getByText('Записаться к педиатру')).toBeInTheDocument();
    expect(JSON.stringify(Object.keys(localStorage))).toContain('demeu.plan.ai.');
  });
  test('when Irisha is unavailable the plan stays and says so honestly', async () => {
    saveCard();
    vi.spyOn(api, 'planAi').mockRejectedValue(new api.AssistantError('unavailable', 'API 503'));
    show(<Plan />);
    expect(await screen.findByText(/Иришка сейчас недоступна/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Прикрепление к детской поликлинике/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Попробовать ещё раз' })).toBeInTheDocument();
  });
  test('completion survives remount and updates the progress', async () => {
    saveCard();
    const first = show(<Plan />);
    fireEvent.click(await screen.findByRole('button', { name: 'Отметить: ПМПК — психолого-медико-педагогическая консультация' }));
    expect(JSON.parse(localStorage.getItem('demeu.planDone')!)).toContain('s-pmpk');
    first.unmount();
    show(<Plan />);
    expect(await screen.findByRole('button', { name: 'Отметить: ПМПК — психолого-медико-педагогическая консультация' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  });
  test('document checks persist; invalid step paths have a way back', async () => {
    saveCard();
    const first = show(<Step />, '/plan/0', '/plan/:idx');
    fireEvent.click(await screen.findByRole('checkbox', { name: /Удостоверение личности/ }));
    first.unmount();
    const second = show(<Step />, '/plan/0', '/plan/:idx');
    expect(await screen.findByRole('checkbox', { name: /Удостоверение личности/ })).toHaveAttribute('aria-checked', 'true');
    second.unmount();
    show(<Step />, '/plan/999', '/plan/:idx');
    expect(await screen.findByRole('link', { name: 'К плану поддержки' })).toHaveAttribute('href', '/plan');
  });
  test('without a card the plan invites filling one out', () => {
    show(<Plan />);
    expect(screen.getByRole('link', { name: 'Заполнить карточку' })).toHaveAttribute('href', '/quiz');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});

describe('booking privacy and saved bookings', () => {
  test('unchecked fields disappear from preview; manual message survives format changes', async () => {
    saveCard();
    show(<Book />, '/book/1', '/book/:id');
    await screen.findByRole('textbox', { name: 'Сообщение' });
    expect(screen.getByRole('checkbox', { name: /Имя: Айдан/ })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('checkbox', { name: /Особенности:/ }));
    const preview = screen.getByTestId('booking-preview');
    expect(preview).not.toHaveTextContent('РАС');
    expect(preview).not.toHaveTextContent('Бостандыкский');
    fireEvent.change(screen.getByRole('textbox', { name: 'Сообщение' }), { target: { value: 'Здравствуйте! Хочу уточнить время.' } });
    const formats = screen.queryAllByRole('button', { name: 'Онлайн' });
    if (formats.length) fireEvent.click(formats[0]);
    expect(screen.getByRole('textbox', { name: 'Сообщение' })).toHaveValue('Здравствуйте! Хочу уточнить время.');
    fireEvent.click(screen.getByRole('switch', { name: 'Отправить карточку' }));
    expect(preview).toHaveTextContent('Здравствуйте! Хочу уточнить время.');
    expect(preview).not.toHaveTextContent('О ребёнке');
    expect(preview).not.toHaveTextContent('Айдан');
  });
  test('actual booking API excludes disabled fields and encodes the WhatsApp URL', async () => {
    const shared = selectedShared(card, { ...DEFAULT_SHARE, name: true, features: false });
    const response = await api.createBooking({ specialist_id: 1, slot: booking.slot, format: 'Кабинет', shared });
    expect(response.data.message).not.toContain('РАС');
    expect(response.data.message).not.toContain('Бостандыкский');
    expect(response.data.message).toContain('Айдан');
    expect(response.data.wa_url).toContain('%D0');
    expect(new URL(response.data.wa_url).searchParams.get('text')).toBe(response.data.message);
  });
  test('my specialists never invents bookings; real entries reopen the saved WhatsApp URL', async () => {
    const first = show(<My />);
    expect(screen.getByText('Здесь появятся ваши специалисты')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Найти специалиста' })).toHaveAttribute('href', '/specialists');
    first.unmount();
    localStorage.setItem('demeu.bookings', JSON.stringify([booking]));
    savePlanValue(`booking.${booking.id}`, { wa_url: 'https://wa.me/?text=hello%20world', direct: false });
    show(<My />);
    expect(await screen.findByRole('link', { name: 'Написать в WhatsApp' })).toHaveAttribute('href', 'https://wa.me/?text=hello%20world');
    fireEvent.click(screen.getByRole('switch', { name: 'За 2 часа' }));
    expect(localStorage.getItem('demeu.plan.rem2h')).toBe('false');
  });
});

describe('post-session checklist and reports', () => {
  test('four no answers show same-role alternatives excluding the current specialist', async () => {
    saveCard();
    const send = vi.spyOn(api, 'sendFeedback');
    show(<Feedback />, '/feedback/1', '/feedback/:id');
    for (let index = 0; index < 4; index++) fireEvent.click(await screen.findByRole('button', { name: 'Нет' }));
    expect(await screen.findByRole('heading', { name: 'Давайте найдём другого' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole('link').filter(link => link.getAttribute('href')?.startsWith('/specialists/')).length).toBeGreaterThan(0));
    const links = screen.getAllByRole('link').filter(link => link.getAttribute('href')?.startsWith('/specialists/'));
    expect(links.every(link => link.getAttribute('href') !== '/specialists/1')).toBe(true);
    const current = engine.getSpecialist(1);
    for (const link of links) expect(engine.getSpecialist(Number(link.getAttribute('href')!.split('/').at(-1))).role).toBe(current.role);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ answers: [false, false, false, false] }));
  });
  test('mostly yes allows a review; reports use a private bottom sheet', async () => {
    const feedback = vi.spyOn(api, 'sendFeedback');
    const report = vi.spyOn(api, 'sendReport');
    show(<Feedback />, '/feedback/1', '/feedback/:id');
    for (let index = 0; index < 4; index++) fireEvent.click(await screen.findByRole('button', { name: index === 3 ? 'Нет' : 'Да' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Что изменилось, что понравилось…' }), { target: { value: 'Специалист внимательно слушает ребёнка.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Опубликовать отзыв' }));
    expect(await screen.findByRole('heading', { name: 'Спасибо!' })).toBeInTheDocument();
    expect(feedback).toHaveBeenCalledWith(expect.objectContaining({ answers: [true, true, true, false], comment: 'Специалист внимательно слушает ребёнка.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Сообщить о серьёзной проблеме' }));
    const sheet = screen.getByRole('dialog', { name: 'Сообщить о проблеме' });
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Другое' }));
    fireEvent.change(within(sheet).getByRole('textbox'), { target: { value: 'Прошу уточнить информацию о занятиях.' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Отправить модераторам' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(report).toHaveBeenCalledWith({ specialist_id: 1, category: 'Другое', text: 'Прошу уточнить информацию о занятиях.' });
  });
});

describe('notifications', () => {
  test('mark all read zeroes every subscribed counter and survives remount', async () => {
    saveCard();
    const first = show(<Notifications />, '/notifications', '*', <Unread />);
    await screen.findByText('Новый шаг плана');
    await waitFor(() => expect(Number(screen.getByTestId('unread-count').textContent)).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: 'Прочитать все' }));
    await waitFor(() => expect(screen.getByTestId('unread-count')).toHaveTextContent(/^0$/));
    first.unmount();
    show(<Notifications />, '/notifications', '*', <Unread />);
    await screen.findByText('Новый шаг плана');
    expect(screen.getByTestId('unread-count')).toHaveTextContent(/^0$/);
  });
  test('tomorrow and past bookings generate real notifications; pending requests do not', () => {
    const specialists = engine.listSpecialists().items;
    const notices = deriveNotifications([booking, { ...booking, id: 'past', slot: '2026-11-13T15:00:00+05:00' }], specialists, undefined, true);
    expect(notices.map(item => item.title)).toEqual(['tomorrowLesson', 'timeToRate']);
    expect(notices.some(item => item.demo)).toBe(false);
    expect(notices[1].go).toBe('/feedback/1');
    act(() => savePlanValue(`booking.${booking.id}`, { direct: true, wa_url: 'https://wa.me/?text=hello' }));
    expect(getBookingMeta(booking.id)?.direct).toBe(true);
    expect(deriveNotifications([booking], specialists, undefined, true)).toEqual([]);
  });
  test('no card and no bookings shows the quiet state', async () => {
    show(<Notifications />);
    expect(await screen.findByText('Пока тихо')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Прочитать все' })).not.toBeInTheDocument();
  });
});
