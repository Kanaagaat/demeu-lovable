import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../lib/api', () => ({ API_URL: 'http://api.test' }));
import { I18nProvider } from '../../i18n';
import { AppStateProvider } from '../../state/AppState';
import { ToastProvider } from '../Toast';
import Cabinet from '../../pages/Cabinet';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
function mount() {
  return render(<MemoryRouter initialEntries={['/cabinet']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><I18nProvider><AppStateProvider><ToastProvider><Cabinet /></ToastProvider></AppStateProvider></I18nProvider></MemoryRouter>);
}
async function openVerification() {
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole('tab', { name: 'Проверка' }));
  return user;
}
beforeEach(() => { localStorage.clear(); localStorage.setItem('demeu.onboarded', 'true'); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('specialist cabinet is linked to the moderator console', () => {
  test('sending the application posts the profile with documents and shows the review status', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit = {}) => init.method === 'POST' ? json({ id: 'app-1', status: 'new' }, 201) : json({ id: 'app-1', status: 'new', note: '', specialist_id: null, updated_at: new Date().toISOString() }));
    vi.stubGlobal('fetch', fetchMock);
    const user = await openVerification();
    await user.click(screen.getByRole('button', { name: 'Отправить на проверку' }));
    expect(await screen.findByText('На проверке у Мама Про')).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === 'POST');
    const body = JSON.parse(String((post?.[1] as RequestInit).body));
    expect(body).toMatchObject({ name: 'Анна Сергеева', role: 'Логопед', price: 8000, district: 'Бостандыкский' });
    expect(body.documents.map((d: { kind: string }) => d.kind)).toEqual(['diploma', 'certificate', 'certificate']);
    expect(JSON.parse(localStorage.getItem('demeu.support.cabApp')!)).toMatchObject({ id: 'app-1', status: 'new' });
    expect(screen.queryByRole('button', { name: 'Отправить на проверку' })).not.toBeInTheDocument();
  });

  test('a moderator request for documents is shown with the comment and can be answered', async () => {
    localStorage.setItem('demeu.support.cabApp', JSON.stringify({ id: 'app-1', status: 'new', note: '', specialist_id: null, updated_at: '2026-11-14T10:00:00Z' }));
    let status = { id: 'app-1', status: 'docs', note: 'Пришлите скан диплома лучшего качества', specialist_id: null, updated_at: '2026-11-14T11:00:00Z' };
    const fetchMock = vi.fn(async (_url: string, init: RequestInit = {}) => init.method === 'PUT' ? (status = { ...status, status: 'new', note: '' }, json({ id: 'app-1', status: 'new' })) : json(status));
    vi.stubGlobal('fetch', fetchMock);
    const user = await openVerification();
    expect(await screen.findByText('Нужны документы')).toBeInTheDocument();
    expect(screen.getByText('Пришлите скан диплома лучшего качества')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Отправить обновление' }));
    expect(await screen.findByText('На проверке у Мама Про')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith('/api/applications/app-1') && (init as RequestInit)?.method === 'PUT')).toBe(true);
  });

  test('approval shows the verified status with a link to the public profile', async () => {
    localStorage.setItem('demeu.support.cabApp', JSON.stringify({ id: 'app-1', status: 'new', note: '', specialist_id: null, updated_at: '2026-11-14T10:00:00Z' }));
    vi.stubGlobal('fetch', vi.fn(async () => json({ id: 'app-1', status: 'approved', note: '', specialist_id: 41, updated_at: '2026-11-14T12:00:00Z' })));
    await openVerification();
    expect(await screen.findByText('Проверено')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Посмотреть профиль в каталоге' })).toHaveAttribute('href', '/specialists/41');
  });

  test('a rejection shows the reason and allows a new application', async () => {
    localStorage.setItem('demeu.support.cabApp', JSON.stringify({ id: 'app-1', status: 'new', note: '', specialist_id: null, updated_at: '2026-11-14T10:00:00Z' }));
    vi.stubGlobal('fetch', vi.fn(async () => json({ id: 'app-1', status: 'rejected', note: 'Скан диплома не читается', specialist_id: null, updated_at: '2026-11-14T12:00:00Z' })));
    await openVerification();
    expect(await screen.findByText('Заявка отклонена')).toBeInTheDocument();
    expect(screen.getByText('Скан диплома не читается')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Подать заявку заново' })).toBeInTheDocument();
  });

  test('without a connection the last known status stays visible with a clear message, and sending explains the failure', async () => {
    localStorage.setItem('demeu.support.cabApp', JSON.stringify({ id: 'app-1', status: 'new', note: '', specialist_id: null, updated_at: '2026-11-14T10:00:00Z' }));
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network'); }));
    await openVerification();
    expect(await screen.findByText(/Нет связи с сервером/)).toBeInTheDocument();
    expect(screen.getByText('На проверке у Мама Про')).toBeInTheDocument();
  });

  test('a failed send keeps the form, explains the problem and can be retried', async () => {
    let online = false;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit = {}) => { if (!online) throw new TypeError('network'); return init.method === 'POST' ? json({ id: 'app-2', status: 'new' }, 201) : json({}, 404); }));
    const user = await openVerification();
    await user.click(screen.getByRole('button', { name: 'Отправить на проверку' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Нет связи с сервером');
    expect(screen.getByRole('button', { name: 'Отправить на проверку' })).toBeEnabled();
    online = true;
    await user.click(screen.getByRole('button', { name: 'Отправить на проверку' }));
    await waitFor(() => expect(screen.getByText('На проверке у Мама Про')).toBeInTheDocument());
  });

  test('invalid experience is caught before anything is sent', async () => {
    const fetchMock = vi.fn(async () => json({}));
    vi.stubGlobal('fetch', fetchMock);
    const user = await openVerification();
    const exp = screen.getByLabelText('Стаж, лет');
    await user.clear(exp); await user.type(exp, '99');
    await user.click(screen.getByRole('button', { name: 'Отправить на проверку' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('от 0 до 60');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
