import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import { AppStateProvider } from '../../state/AppState';
import { ToastProvider } from '../Toast';
import * as api from '../../lib/api';
import type { ReactNode } from 'react';
import Sos from '../../pages/Sos';
import Chat from '../../pages/Chat';
import Profile from '../../pages/Profile';
import Privacy from '../../pages/Privacy';
import Support from '../../pages/Support';
import Cabinet from '../../pages/Cabinet';
import Useful from '../../pages/Useful';
import Article from '../../pages/Article';
import { Markdown } from './Markdown';

function mount(component: ReactNode, path = '/test') {
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><I18nProvider><AppStateProvider><ToastProvider><Routes><Route path="/welcome" element={<div>Добро пожаловать</div>} /><Route path="/useful/:id" element={component} /><Route path="*" element={component} /></Routes></ToastProvider></AppStateProvider></I18nProvider></MemoryRouter>);
}
const booking = { id: 'booking-demo-1', specialist_id: 1, slot: '2026-11-15T15:00:00+05:00', format: 'Кабинет', created_at: '2026-11-14T09:12:00+05:00' };
beforeEach(() => { localStorage.clear(); localStorage.setItem('demeu.onboarded', 'true'); });
afterEach(() => { vi.restoreAllMocks(); });

describe('support safety and profile', () => {
  test('SOS exposes the correct emergency and WhatsApp links without onboarding', async () => {
    localStorage.removeItem('demeu.onboarded'); mount(<Sos />, '/sos');
    expect(screen.getByRole('link', { name: /111/ })).toHaveAttribute('href', 'tel:111');
    expect(screen.getByRole('link', { name: /^150/ })).toHaveAttribute('href', 'tel:150');
    expect(screen.getByRole('link', { name: /Экстренные службы/ })).toHaveAttribute('href', 'tel:112');
    expect(screen.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', 'https://wa.me/77081060810');
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(screen.getByText('Добро пожаловать')).toBeInTheDocument();
  });

  test('the assistant answers the actual question, sends the card without name and district, and keeps no history', async () => {
    const request = vi.spyOn(api, 'askAssistant').mockResolvedValue({ reply: ['Сначала запишитесь к педиатру в поликлинике по месту прикрепления.'], crisis: false, offer_psychologist: false });
    localStorage.setItem('demeu.card', JSON.stringify({ name: 'Айдан', age: 6, district: 'Бостандыкский', features: ['РАС'], comm: 'Отдельные слова', react: 'Спокойно', goals: ['Речь'], disability: 'Нет' }));
    const user = userEvent.setup(); mount(<Chat />);
    expect(screen.getByText(/^Здравствуйте\. Я Иришка/)).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Напишите сообщение' }), 'С чего начать оформление инвалидности?');
    await user.click(screen.getByRole('button', { name: 'Отправить' }));
    expect(await screen.findByText(/Сначала запишитесь к педиатру/)).toBeInTheDocument();
    const body = request.mock.calls[0][0];
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'С чего начать оформление инвалидности?' });
    expect(body.context).toEqual({ age: 6, features: ['РАС'], comm: 'Отдельные слова', react: 'Спокойно', goals: ['Речь'], disability: 'Нет' });
    expect(JSON.stringify(body)).not.toMatch(/Айдан|Бостандыкский/);
    expect(screen.queryByRole('link', { name: 'Да, подобрать' })).not.toBeInTheDocument();
    expect(Object.keys(localStorage).some(key => key.includes('chat') && key !== 'demeu.support.chatContext')).toBe(false);
  });

  test('the card can be switched off, and a failure is an honest message with retry, never a canned reply', async () => {
    const request = vi.spyOn(api, 'askAssistant').mockRejectedValueOnce(new api.AssistantError('timeout', 'API timeout')).mockResolvedValueOnce({ reply: ['Вот что обычно нужно взять на ПМПК.'], crisis: false, offer_psychologist: true });
    localStorage.setItem('demeu.card', JSON.stringify({ name: 'Айдан', age: 6, district: 'Бостандыкский', features: ['РАС'], comm: 'Отдельные слова', react: 'Спокойно', goals: ['Речь'], disability: 'Нет' }));
    const user = userEvent.setup(); mount(<Chat />);
    await user.click(screen.getByRole('checkbox', { name: /Учитывать анкету/ }));
    await user.type(screen.getByRole('textbox', { name: 'Напишите сообщение' }), 'Какие документы нужны на ПМПК?{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Иришка отвечает дольше обычного');
    expect(screen.queryByText(/Спасибо, что сказали/)).not.toBeInTheDocument();
    expect(request.mock.calls[0][0].context).toBeUndefined();
    await user.click(screen.getByRole('button', { name: 'Повторить вопрос' }));
    expect(await screen.findByText(/Вот что обычно нужно взять на ПМПК/)).toBeInTheDocument();
    expect(request.mock.calls[1][0].messages.filter(m => m.role === 'user')).toHaveLength(1); // the question is not duplicated
    expect(await screen.findByRole('link', { name: 'Да, подобрать' })).toHaveAttribute('href', '/specialists?kind=parent');
  });

  test('API crisis response places emergency card above the conversation', async () => {
    vi.spyOn(api, 'askAssistant').mockResolvedValue({ reply: ['Пожалуйста, обратитесь за поддержкой.'], crisis: true, offer_psychologist: false });
    const user = userEvent.setup(); mount(<Chat />);
    await user.type(screen.getByRole('textbox'), 'Не хочу жить{Enter}');
    const crisis = await screen.findByRole('region', { name: 'Экстренная помощь' });
    expect(within(crisis).getByRole('link', { name: '111' })).toHaveAttribute('href', 'tel:111');
    expect(within(crisis).getByRole('link', { name: '150' })).toHaveAttribute('href', 'tel:150');
    expect(within(crisis).getByRole('link', { name: '112' })).toHaveAttribute('href', 'tel:112');
    expect(screen.queryByRole('link', { name: 'Да, подобрать' })).not.toBeInTheDocument();
  });

  test('offline crisis phrase also displays emergency help', async () => {
    mount(<Chat />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Не хочу жить' } });
    fireEvent.submit(screen.getByRole('textbox').closest('form')!);
    expect(await screen.findByRole('region', { name: 'Экстренная помощь' })).toBeInTheDocument();
  });

  test('profile switches to Kazakh and persists the language', async () => {
    mount(<Profile />, '/profile'); await userEvent.click(screen.getByRole('button', { name: 'KZ' }));
    expect(localStorage.getItem('demeu.lang')).toBe('kz');
    expect(screen.getByText('Ата-ана')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'KZ' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: /Құпиялық/ })).toHaveAttribute('href', '/profile/privacy');
  });

  test('reset requires a sheet confirmation and clears all DEMEU data', async () => {
    const user = userEvent.setup(); localStorage.setItem('demeu.support.joined', '["1"]'); localStorage.setItem('demeu.lang', 'ru'); localStorage.setItem('demeu.bookings', JSON.stringify([booking]));
    mount(<Profile />, '/profile'); await user.click(screen.getByRole('button', { name: 'Выйти / сбросить данные' }));
    const sheet = screen.getByRole('dialog', { name: 'Удалить данные с этого устройства?' });
    expect(localStorage.getItem('demeu.bookings')).not.toBeNull();
    await user.click(within(sheet).getByRole('button', { name: 'Удалить все данные' }));
    expect(screen.getByText('Добро пожаловать')).toBeInTheDocument();
    expect(Object.keys(localStorage).filter(key => key.startsWith('demeu.'))).toEqual([]);
  });

  test('privacy revokes a booking locally and persists the change', async () => {
    localStorage.setItem('demeu.bookings', JSON.stringify([booking])); const user = userEvent.setup(); const view = mount(<Privacy />);
    await user.click(screen.getByRole('button', { name: 'Отозвать' }));
    expect(screen.getByRole('button', { name: 'Доступ отозван' })).toBeDisabled();
    expect(JSON.parse(localStorage.getItem('demeu.support.revoked')!)).toEqual([booking.id]);
    view.unmount(); mount(<Privacy />);
    expect(screen.getByRole('button', { name: 'Доступ отозван' })).toBeDisabled();
  });

  test('privacy sharing switch updates the common field defaults', async () => {
    mount(<Privacy />); const user = userEvent.setup(); const toggle = screen.getByRole('switch');
    await user.click(toggle); expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(JSON.parse(localStorage.getItem('demeu.shareDefaults')!).age).toBe(true);
    await user.click(toggle); expect(JSON.parse(localStorage.getItem('demeu.shareDefaults')!).age).toBe(false);
  });

  test('communities are real organisations grouped by condition, opened from support and useful', async () => {
    mount(<Support />, '/support');
    expect(screen.getByRole('link', { name: /Сообщества/ })).toHaveAttribute('href', '/resources#communities');
    expect(screen.queryByText(/участников/)).not.toBeInTheDocument(); // no invented chat sizes
  });

  test('cabinet keeps edited selections and shows that no application was sent yet', async () => {
    mount(<Cabinet />); const user = userEvent.setup();
    const day = screen.getByRole('button', { name: 'Ср' }); await user.click(day);
    expect(day).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(localStorage.getItem('demeu.support.cabDays')!)).toContain('Ср');
    await user.click(screen.getByRole('tab', { name: 'Проверка' }));
    expect(screen.getByText('Заявка не отправлена')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Отправить на проверку' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Заявки' }));
    expect(screen.getByText('Пока нет заявок')).toBeInTheDocument();
  });

  test('cabinet never exposes the current child card without booking consent', async () => {
    localStorage.setItem('demeu.bookings', JSON.stringify([booking]));
    localStorage.setItem('demeu.card', JSON.stringify({ name: 'Скрытое имя', age: 6, district: 'Бостандыкский', features: ['РАС'], comm: 'Отдельные слова', react: 'Спокойно', goals: ['Речь'], disability: 'Нет' }));
    mount(<Cabinet />); await userEvent.click(screen.getByRole('tab', { name: 'Заявки' }));
    expect(screen.queryByText(/Скрытое имя/)).not.toBeInTheDocument();
    expect(screen.getByText(/Отправленные поля не сохранены/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ответить в WhatsApp' }).getAttribute('href')).toMatch(/^https:\/\/wa.me\/\?text=/);
  });

  test('useful category filtering preserves the design article cards and external resources', async () => {
    mount(<Useful />); const user = userEvent.setup();
    expect(screen.queryByRole('link', { name: /Ozim Platform/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Налоговые льготы/ })).toHaveAttribute('href', '/useful/benefits-tax');
    await user.click(screen.getByRole('button', { name: /Документы/ }));
    expect(screen.getByRole('link', { name: /Какие документы собрать/ })).toHaveAttribute('href', '/useful/disability-documents');
    expect(screen.queryByRole('link', { name: /Как пройти ПМПК/ })).not.toBeInTheDocument();
  });

  test('benefit material article shows its info-graphic', async () => {
    mount(<Article />, '/useful/benefits-tax');
    expect(await screen.findByRole('heading', { name: /Налоговые льготы/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Налоговые льготы/ })).toHaveAttribute('src', '/materials/tax-ru.jpg');
  });

  test('article loads seed content and unknown articles have a recovery link', async () => {
    const view = mount(<Article />, '/useful/parent'); expect(await screen.findByRole('heading', { name: 'Родителю тоже нужна поддержка' })).toBeInTheDocument();
    view.unmount(); mount(<Article />, '/useful/missing');
    expect(await screen.findByRole('heading', { name: 'Статья не найдена' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'К полезному' })).toHaveAttribute('href', '/useful');
  });

  test('markdown renders structure, escapes HTML and rejects unsafe links', async () => {
    const { container } = render(<Markdown body={'## Заголовок\n\n- Один\n- Два\n\n1. Первый\n2. Второй\n\n<script>alert(1)</script>\n\n[Опасно](javascript:evil)\n\n[Ссылка](https://ozim.kz)\n\n## \n- '} />);
    expect(screen.getByRole('heading', { name: 'Заголовок' })).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull(); expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(screen.getByRole('link', { name: 'Ссылка' })).toHaveAttribute('href', 'https://ozim.kz/');
    await waitFor(() => expect(screen.getAllByRole('list')).toHaveLength(3));
  });
});
