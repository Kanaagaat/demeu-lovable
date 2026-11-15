import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { ReactNode } from 'react';
import { I18nProvider } from '../../i18n';
import { AppStateProvider } from '../../state/AppState';
import { completeCard, emptyDraft, formatPhone, readDraft, toggleFeature, voiceToDraft } from '../../state/home';
import { ToastProvider } from '../Toast';
import { OnboardingGuard } from '../OnboardingGuard';
import type { ChildCard } from '../../lib/types';
import Quiz from '../../pages/Quiz';
import Voice from '../../pages/Voice';
import Login from '../../pages/Login';
import Welcome from '../../pages/Welcome';
import Consent from '../../pages/Consent';
import Home from '../../pages/Home';
import Result from '../../pages/Result';
const originalMediaDevices = navigator.mediaDevices;
const card: ChildCard = { name: 'Айдан', age: 6, district: 'Бостандыкский', features: ['РАС'], comm: 'Отдельные слова', react: 'Нужно время, чтобы привыкнуть', goals: ['Речь', 'Общение'], disability: 'В процессе' };
function Location() { return <div data-testid="path">{useLocation().pathname}</div>; }
function wrap(children: ReactNode, path = '/quiz', onboarded = true) {
  if (onboarded)
    localStorage.setItem('demeu.onboarded', 'true');
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <I18nProvider>
      <AppStateProvider>
        <ToastProvider>
          <Location />
          {children}
        </ToastProvider>
      </AppStateProvider>
    </I18nProvider>
  </MemoryRouter>);
}
function quiz() {
  return wrap(<Routes>
    <Route path="/quiz" element={<Quiz />} />
    <Route path="/result" element={<div>Результат открыт</div>} />
  </Routes>);
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: originalMediaDevices }); });
describe('home group', () => {
  test('seven questionnaire steps save the card and open /result', async () => {
    const user = userEvent.setup();
    quiz();
    await user.type(screen.getByLabelText('Как зовут ребёнка? (необязательно)'), 'Айдан');
    await user.click(screen.getByRole('button', { name: '6' }));
    await user.click(screen.getByRole('button', { name: 'Далее' }));
    await user.click(screen.getByRole('button', { name: 'Бостандыкский район' }));
    await user.click(screen.getByRole('button', { name: 'Далее' }));
    await user.click(screen.getByRole('button', { name: 'РАС' }));
    await user.click(screen.getByRole('button', { name: 'Далее' }));
    await user.click(screen.getByRole('button', { name: 'Отдельные слова' }));
    await user.click(screen.getByRole('button', { name: 'Далее' }));
    await user.click(screen.getByRole('button', { name: 'Нужно время, чтобы привыкнуть' }));
    await user.click(screen.getByRole('button', { name: 'Далее' }));
    await user.click(screen.getByRole('button', { name: 'Речь' }));
    await user.click(screen.getByRole('button', { name: 'Общение' }));
    await user.click(screen.getByRole('button', { name: 'Далее' }));
    await user.click(screen.getByRole('button', { name: 'В процессе' }));
    await user.click(screen.getByRole('button', { name: 'Готово' }));
    expect(screen.getByTestId('path')).toHaveTextContent('/result');
    expect(JSON.parse(localStorage.getItem('demeu.card')!)).toEqual(card);
    expect(localStorage.getItem('demeu.home.draft')).toBeNull();
  });
  test('unknown feature clears the other choices, and a specific feature clears unknown', async () => {
    const user = userEvent.setup();
    quiz();
    await user.click(screen.getByRole('button', { name: 'Далее' }));
    await user.click(screen.getByRole('button', { name: 'Далее' }));
    const ras = screen.getByRole('button', { name: 'РАС' });
    const dcp = screen.getByRole('button', { name: 'ДЦП' });
    const unknown = screen.getByRole('button', { name: 'Пока не знаю / не хочу указывать' });
    await user.click(ras);
    await user.click(dcp);
    await user.click(unknown);
    expect(ras).toHaveAttribute('aria-pressed', 'false');
    expect(dcp).toHaveAttribute('aria-pressed', 'false');
    expect(unknown).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(localStorage.getItem('demeu.home.draft')!).features).toEqual(['Пока не знаю / не хочу указывать']);
    await user.click(ras);
    expect(unknown).toHaveAttribute('aria-pressed', 'false');
  });
  test('new answers are blank and age supports 0 and 18+', () => {
    quiz();
    expect(screen.getByLabelText('Как зовут ребёнка? (необязательно)')).toHaveValue('');
    expect(screen.getByRole('button', { name: '0' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '18+' })).toHaveAttribute('aria-pressed', 'false');
  });
  test('consent must be checked before continuing', async () => {
    const user = userEvent.setup();
    wrap(<Consent />, '/consent');
    expect(screen.getByRole('button', { name: 'Продолжить' })).toBeDisabled();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Продолжить' }));
    expect(screen.getByTestId('path')).toHaveTextContent('/login');
  });
  test('login accepts four digits after 450ms and marks onboarded', async () => {
    vi.useFakeTimers();
    wrap(<Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<div>Главная открыта</div>} />
    </Routes>, '/login', false);
    fireEvent.change(screen.getByLabelText('Номер телефона'), { target: { value: '+7 700 123 45 67' } });
    expect(screen.getByLabelText('Номер телефона')).toHaveValue('(700) 123-45-67');
    fireEvent.click(screen.getByRole('button', { name: 'Получить код' }));
    expect(screen.getByText('Отправить снова через 0:59')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Код из SMS' }), { target: { value: '1a234' } });
    act(() => vi.advanceTimersByTime(449));
    expect(screen.getByTestId('path')).toHaveTextContent('/login');
    await act(async () => vi.advanceTimersByTime(1));
    expect(screen.getByTestId('path')).toHaveTextContent(/^\/$/);
    expect(localStorage.getItem('demeu.onboarded')).toBe('true');
  });
  test('resend becomes available after 59 seconds', () => {
    vi.useFakeTimers();
    wrap(<Login />, '/login');
    fireEvent.change(screen.getByLabelText('Номер телефона'), { target: { value: '7001234567' } });
    fireEvent.click(screen.getByRole('button', { name: 'Получить код' }));
    act(() => vi.advanceTimersByTime(59000));
    fireEvent.click(screen.getByRole('button', { name: 'Отправить код снова' }));
    expect(screen.getByText('Отправить снова через 0:59')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Код отправлен повторно');
  });
  test('voice without speech recognition or API says so honestly and never shows a fake example', async () => {
    vi.stubEnv('VITE_API_URL', '');
    vi.stubGlobal('MediaRecorder', undefined);
    const user = userEvent.setup();
    wrap(<Voice />, '/quiz/voice');
    await user.click(screen.getByRole('button', { name: 'Начать запись' }));
    expect(await screen.findByText(/распознавание речи недоступно/)).toBeInTheDocument();
    expect(screen.queryByText('Айдан')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Начать запись' })).toBeInTheDocument();
  });
  test('browser speech recognition fills the review from what the parent actually said', async () => {
    const said = 'Дочку зовут Камила, ей 4 года, Алмалинский район, синдром Дауна, говорит фразами, хотим развивать моторику';
    class FakeRecognition {
      onresult: ((e: unknown) => void) | null = null; onend: (() => void) | null = null; onerror: unknown = null;
      lang = ''; continuous = false; interimResults = false;
      start() { queueMicrotask(() => this.onresult?.({ results: [Object.assign([{ transcript: said }], { isFinal: true })] })); }
      stop() { queueMicrotask(() => this.onend?.()); }
      abort() { this.onend?.(); }
    }
    vi.stubGlobal('SpeechRecognition', FakeRecognition);
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockRejectedValue(new Error('no')) } });
    const user = userEvent.setup();
    wrap(<Voice />, '/quiz/voice');
    await user.click(screen.getByRole('button', { name: 'Начать запись' }));
    expect(await screen.findByText(said)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Остановить запись' }));
    expect(await screen.findByText(`«${said}»`)).toBeInTheDocument();
    expect(screen.getByText('Камила')).toBeInTheDocument();
    expect(screen.getByText('Алмалинский')).toBeInTheDocument();
    expect(screen.getByText('Синдром Дауна')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Сохранить в карточку' }));
    const draft = JSON.parse(localStorage.getItem('demeu.home.draft')!);
    expect(draft).toMatchObject({ name: 'Камила', age: 4, district: 'Алмалинский', features: ['Синдром Дауна'], comm: 'Говорит фразами', goals: ['Моторика'] });
  });
  test('voice records audio, sends multipart to API and stops microphone tracks', async () => {
    vi.stubEnv('VITE_API_URL', 'https://demo.example');
    const stopTrack = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
    class Recorder {
      state = 'inactive';
      mimeType = 'audio/webm';
      onstop: (() => void) | null = null;
      onerror: (() => void) | null = null;
      ondataavailable: ((event: {
        data: Blob;
      }) => void) | null = null;
      start() { this.state = 'recording'; }
      stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) }); this.onstop?.(); }
    }
    vi.stubGlobal('MediaRecorder', Recorder);
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ transcript: 'Ему 7 лет, ДЦП, говорит фразами, хотим развивать моторику', fields: { age: 7 } }) });
    vi.stubGlobal('fetch', fetcher);
    localStorage.setItem('demeu.card', JSON.stringify(card));
    const user = userEvent.setup();
    wrap(<Routes>
      <Route path="/quiz/voice" element={<Voice />} />
      <Route path="/result" element={<div>Результат открыт</div>} />
    </Routes>, '/quiz/voice');
    await user.click(screen.getByRole('button', { name: 'Начать запись' }));
    await user.click(screen.getByRole('button', { name: 'Остановить запись' }));
    await screen.findByText('Проверьте, правильно ли мы поняли', {}, { timeout: 2500 });
    expect(fetcher).toHaveBeenCalledWith('https://demo.example/api/voice/parse', expect.objectContaining({ method: 'POST', body: expect.any(FormData) }));
    expect((fetcher.mock.calls[0][1].body as FormData).get('audio')).toBeInstanceOf(Blob);
    expect(stopTrack).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Сохранить в карточку' }));
    expect(screen.getByTestId('path')).toHaveTextContent('/result');
    expect(JSON.parse(localStorage.getItem('demeu.card')!)).toEqual({ ...card, age: 7, features: ['ДЦП'], comm: 'Говорит фразами', goals: ['Моторика'] });
  });
  test('home empty and result empty offer real questionnaire navigation', async () => {
    const user = userEvent.setup();
    const view = wrap(<Home />, '/');
    await user.click(screen.getByRole('button', { name: 'Заполнить карточку' }));
    expect(screen.getByTestId('path')).toHaveTextContent('/quiz');
    view.unmount();
    wrap(<Result />, '/result');
    expect(screen.getByRole('button', { name: 'Заполнить карточку' })).toBeInTheDocument();
  });
  test('result uses actual plan and matched specialist data', async () => {
    vi.stubEnv('VITE_API_URL', '');
    localStorage.setItem('demeu.card', JSON.stringify(card));
    wrap(<Result />, '/result');
    await waitFor(() => expect(screen.getAllByRole('link').length).toBeGreaterThanOrEqual(3));
    expect(screen.getByText('Рекомендации: Айдан')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Открыть план' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Все специалисты' })).toBeInTheDocument();
    expect(screen.getAllByRole('list', { name: 'Почему подходит' })).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: /Логопед\s*Поможет/ }));
    expect(screen.getByTestId('path')).toHaveTextContent('/specialists');
  });
  test('onboarding guard redirects to welcome and language switch works', async () => {
    const user = userEvent.setup();
    wrap(<Routes>
      <Route path="/" element={<OnboardingGuard>
        <Home />
      </OnboardingGuard>} />
      <Route path="/welcome" element={<Welcome />} />
    </Routes>, '/', false);
    expect(screen.getByTestId('path')).toHaveTextContent('/welcome');
    await user.click(screen.getByRole('button', { name: 'KZ' }));
    expect(screen.getByRole('heading', { name: 'Балаңызға арналған қолдау' })).toBeInTheDocument();
    expect(localStorage.getItem('demeu.lang')).toBe('kz');
  });
  test('map sheet picks a district and the list stays usable', async () => {
    const user = userEvent.setup();
    quiz();
    await user.click(screen.getByRole('button', { name: 'Далее' }));
    await user.click(screen.getByRole('button', { name: 'Указать на карте' }));
    const dialog = screen.getByRole('dialog', { name: 'Укажите район на карте' });
    await user.click(within(dialog).getByRole('button', { name: 'Турксибский' }));
    await user.click(within(dialog).getByRole('button', { name: 'Выбрать: Турксибский район' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Турксибский район' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Медеуский район' }));
    expect(screen.getByRole('button', { name: 'Медеуский район' })).toHaveAttribute('aria-pressed', 'true');
  });
  test('custom feature words select «Другое» and are kept on the device', async () => {
    const user = userEvent.setup();
    quiz();
    await user.click(screen.getByRole('button', { name: 'Далее' }));
    await user.click(screen.getByRole('button', { name: 'Далее' }));
    await user.type(screen.getByLabelText('Своё'), 'Эпилепсия{Enter}');
    expect(screen.getByRole('button', { name: 'Убрать: Эпилепсия' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Другое' })).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(localStorage.getItem('demeu.home.customFeatures') ?? '[]')).toEqual(['Эпилепсия']);
    await user.click(screen.getByRole('button', { name: 'Другое' }));
    expect(screen.queryByRole('button', { name: 'Убрать: Эпилепсия' })).not.toBeInTheDocument();
  });
});
test('voice mapping rejects unsupported values, preserves existing fields and enforces exclusive unknown', () => {
  expect(voiceToDraft([{ key: 'age', value: '90' }, { key: 'comm', value: 'неизвестно' }, { key: 'goals', value: 'Неверная цель' }, { key: 'concern', value: 'Текст' }], card)).toEqual(card);
  expect(voiceToDraft([{ key: 'features', value: 'РАС, Пока не знаю / не хочу указывать' }], card).features).toEqual(['Пока не знаю / не хочу указывать']);
  expect(toggleFeature(['РАС'], 'Пока не знаю / не хочу указывать')).toEqual(['Пока не знаю / не хочу указывать']);
  expect(voiceToDraft([{ key: 'name', value: '' }, { key: 'features', value: '' }, { key: 'goals', value: '' }], card)).toEqual({ ...card, name: null, features: [], goals: [] });
  expect(completeCard(emptyDraft())).toBeNull();
  localStorage.setItem('demeu.home.draft', '{broken');
  expect(readDraft(null)).toEqual(emptyDraft());
  expect(formatPhone('7001234567')).toBe('(700) 123-45-67');
});

test('microphone permission rejection explains how to allow it and shows no example', async () => {
  vi.stubGlobal('MediaRecorder', class {});
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockRejectedValue(new Error('Permission denied')) } });
  wrap(<Voice />, '/quiz/voice');
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Начать запись' })); });
  expect(await screen.findByText(/Нет доступа к микрофону/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Редактировать:/ })).not.toBeInTheDocument();
});
