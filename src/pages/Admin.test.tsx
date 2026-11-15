import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../lib/api', () => ({ API_URL: 'http://api.test' }));
import Admin from './Admin';
import { applicationHints, reviewHints } from '../state/admin';

const apps = [
  { id: 'a1', name: 'Салтанат Рахимова', role: 'Логопед', exp_years: 8, district: 'Бостандыкский', price: 9000, formats: ['Кабинет'], works_with: ['РАС'], methods: 'PECS', education: 'КазНПУ', about: 'О себе',
    documents: [{ name: 'Диплом', kind: 'diploma', size: 'd.pdf · 2,1 МБ' }, { name: 'Сертификат PECS', kind: 'certificate', size: 'p.jpg · 0,8 МБ' }], status: 'new', note: '', specialist_id: null, created_at: new Date().toISOString(), updated_at: null, demo: false },
  { id: 'a2', name: 'Мирас Тлеубаев', role: 'Реабилитолог', exp_years: 6, district: 'Алмалинский', price: 7000, formats: ['На дом'], works_with: ['ДЦП'], methods: 'ЛФК', education: '', about: '',
    documents: [], status: 'new', note: '', specialist_id: null, created_at: new Date().toISOString(), updated_at: null, demo: false },
];
const reports = [{ id: 'r1', specialist_id: 1, specialist: 'Анна Сергеева', role: 'Логопед', category: 'Грубость', text: 'Повысили голос', status: 'open', note: '', created_at: new Date().toISOString(), updated_at: null }];
const reviews = [{ id: 'v1', specialist_id: 1, specialist: 'Анна Сергеева', suitable: true, rating: 5, text: 'Бережный подход', status: 'pending', hints: [], created_at: new Date().toISOString(), updated_at: null }];

const news = [{ id: 'n1', kind: 'event', audience: 'all', title: 'Семейный день', body: 'Открытая встреча для родителей и детей.', link: null, event_date: null, status: 'draft', pinned: false, demo: false, created_at: new Date().toISOString(), updated_at: null }];

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
function server(overrides: Handler = () => json({}, 599)) {
  const summary = () => ({ new_applications: 2, open_reports: 1, pending_reviews: 1, verified_specialists: 20, recent: [] });
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const path = url.replace('http://api.test/api/admin/', '');
    const custom = await overrides(path, init);
    if (custom.status !== 599) return custom;
    if (path === 'login') return (JSON.parse(String(init.body)).code === 'good' ? json({ ok: true }) : json({ detail: 'Неверный код доступа' }, 401));
    if (path === 'summary') return json(summary());
    if (path === 'applications') return json({ items: apps });
    if (path === 'reports') return json({ items: reports });
    if (path === 'reviews') return json({ items: reviews });
    if (path === 'news') return init.method === 'POST' ? json({ ...JSON.parse(String(init.body)), id: 'n9', demo: false, created_at: new Date().toISOString(), updated_at: null }, 201) : json({ items: news });
    if (path.startsWith('news/')) return json({ ...news[0], ...JSON.parse(String(init.body)), updated_at: new Date().toISOString() });
    return json({ detail: 'нет' }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
async function login(code = 'good') {
  const user = userEvent.setup();
  render(<Admin />);
  await user.type(screen.getByLabelText('Код доступа'), code);
  await user.click(screen.getByRole('button', { name: 'Войти' }));
  return user;
}
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('moderator console linked to the server', () => {
  test('a wrong code is rejected by the server and no data is loaded', async () => {
    const fetchMock = server();
    await login('bad');
    expect(await screen.findByRole('alert')).toHaveTextContent('Неверный код доступа');
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/summary'))).toBe(false);
  });

  test('correct code loads the server queue and shows the online badge', async () => {
    server();
    await login();
    expect(await screen.findByRole('heading', { name: 'Сводка' })).toBeInTheDocument();
    expect(await screen.findByText('Онлайн: данные с сервера')).toBeInTheDocument();
    expect(screen.getByText('Заявка: Салтанат Рахимова')).toBeInTheDocument();
    expect(screen.getByText('Жалоба: Грубость')).toBeInTheDocument();
  });

  test('sends the access code with every request', async () => {
    const fetchMock = server();
    await login();
    await screen.findByText('Онлайн: данные с сервера');
    const calls = fetchMock.mock.calls.filter(([url]) => !String(url).endsWith('/login'));
    expect(calls.length).toBeGreaterThan(0);
    for (const [, init] of calls) expect((init as RequestInit).headers).toMatchObject({ 'X-Admin-Code': 'good' });
  });

  test('approval needs every document checked, is sent to the server and updates the card', async () => {
    const fetchMock = server((path, init) => {
      if (path === 'applications/a1' && init.method === 'PATCH') return json({ ...apps[0], status: 'approved', specialist_id: 41, updated_at: new Date().toISOString() });
      return json({}, 599);
    });
    const user = await login();
    await user.click(await screen.findByRole('button', { name: /Заявки специалистов/ }));
    const detail = screen.getByRole('region', { name: 'Заявка: Салтанат Рахимова' });
    const approve = within(detail).getByRole('button', { name: /Подтвердить/ });
    expect(approve).toBeDisabled();
    for (const box of within(detail).getAllByRole('checkbox')) await user.click(box);
    await user.click(approve);
    expect(await within(screen.getByRole('region', { name: 'Заявка: Салтанат Рахимова' })).findByText(/получил отметку/)).toBeInTheDocument();
    const patch = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === 'PATCH');
    expect(JSON.parse(String((patch?.[1] as RequestInit).body))).toMatchObject({ status: 'approved' });
    expect(screen.getByRole('link', { name: 'Открыть профиль' })).toHaveAttribute('href', '/specialists/41');
  });

  test('an application without a diploma cannot be approved and rejecting needs a reason', async () => {
    server();
    const user = await login();
    await user.click(await screen.findByRole('button', { name: /Заявки специалистов/ }));
    await user.click(screen.getByRole('button', { name: /Мирас Тлеубаев/ }));
    const detail = screen.getByRole('region', { name: 'Заявка: Мирас Тлеубаев' });
    expect(within(detail).getByText('Не приложен диплом', { selector: 'li' })).toBeInTheDocument();
    expect(within(detail).getByRole('button', { name: /Подтвердить/ })).toBeDisabled();
    expect(within(detail).getByRole('button', { name: 'Отклонить' })).toBeDisabled();
  });

  test('a server rejection of a decision is shown next to the form and the card is unchanged', async () => {
    server((path, init) => (path === 'reports/r1' && init.method === 'PATCH' ? json({ detail: 'Чтобы закрыть жалобу, добавьте заметку о результате' }, 422) : json({}, 599)));
    const user = await login();
    await user.click(await screen.findByRole('button', { name: /Жалобы родителей/ }));
    const detail = screen.getByRole('region', { name: 'Жалоба: Анна Сергеева' });
    await user.click(within(detail).getByRole('button', { name: 'Взять в работу' }));
    expect(await within(detail).findByRole('alert')).toHaveTextContent('добавьте заметку');
    expect(within(detail).getByText('Открыта')).toBeInTheDocument();
  });

  test('a network failure on a decision explains the problem and allows a retry', async () => {
    let failing = true;
    server((path, init) => {
      if (path === 'reviews/v1' && init.method === 'PATCH') {
        if (failing) throw new TypeError('network');
        return json({ ...reviews[0], status: 'published', updated_at: new Date().toISOString() });
      }
      return json({}, 599);
    });
    const user = await login();
    await screen.findByText('Онлайн: данные с сервера');
    await user.click(within(screen.getByRole('navigation', { name: 'Разделы' })).getByRole('button', { name: /^Отзывы/ }));
    await user.click(screen.getByRole('button', { name: 'Опубликовать' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Нет связи с сервером');
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Опубликовать' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  test('losing the connection on load offers retry and the offline demo', async () => {
    server((path) => { if (path === 'applications') throw new TypeError('network'); return json({}, 599); });
    await login();
    expect(await screen.findByText('Не удалось загрузить данные')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Открыть офлайн-демо' }));
    expect(await screen.findByText('Офлайн-демо: данные только в этом браузере')).toBeInTheDocument();
  });

  test('the server being unreachable at login still allows the offline demo with the demo code', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network'); }));
    const user = await login('mamapro');
    expect(await screen.findByRole('alert')).toHaveTextContent('Нет связи с сервером');
    await user.click(screen.getByRole('button', { name: 'Открыть офлайн-демо' }));
    expect(await screen.findByRole('heading', { name: 'Сводка' })).toBeInTheDocument();
    expect(await screen.findByText('Заявка: Мирас Тлеубаев')).toBeInTheDocument();
  });

  test('an expired or wrong code during a session returns to the login screen', async () => {
    server();
    const user = await login();
    await screen.findByText('Онлайн: данные с сервера');
    vi.stubGlobal('fetch', vi.fn(async () => json({ detail: 'Неверный код доступа' }, 401)));
    await user.click(screen.getByRole('button', { name: 'Обновить' }));
    expect(await screen.findByLabelText('Код доступа')).toBeInTheDocument();
  });
});

describe('rule-based hints', () => {
  test('flag missing documents, phone numbers and cure promises', () => {
    expect(applicationHints({ documents: [{ name: 'Диплом', kind: 'diploma', size: 'x' }], methods: 'АВА' })).toContain('Нет сертификатов по заявленным методикам');
    expect(applicationHints({ documents: [], methods: '' })).toContain('Не приложен диплом');
    expect(reviewHints('пишите +7 700 123 45 67')[0]).toMatch(/телефон/);
    expect(reviewHints('вылечил за три занятия')[0]).toMatch(/излечения/);
    expect(reviewHints('Бережный подход')).toEqual([]);
  });
});

describe('news and events tab', () => {
  test('a moderator creates a record and publishes it for the parents', async () => {
    const fetchMock = server();
    const user = await login();
    await user.click(await screen.findByRole('button', { name: /Новости и события/ }));
    expect(await screen.findByText('Семейный день')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Опубликовать' })).toBeDisabled();
    await user.type(screen.getByLabelText(/Заголовок/), 'Курс лидерства для родителей');
    await user.type(screen.getByLabelText(/^Текст/), 'Четыре вечерние встречи онлайн.');
    await user.type(screen.getByLabelText(/Ссылка/), 'https://example.org/course');
    await user.click(screen.getByRole('button', { name: 'Опубликовать' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith('/api/admin/news') && (init as RequestInit).method === 'POST')).toBe(true));
    const post = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith('/api/admin/news') && (init as RequestInit).method === 'POST')!;
    expect(JSON.parse(String((post[1] as RequestInit).body))).toMatchObject({ title: 'Курс лидерства для родителей', status: 'published', link: 'https://example.org/course', kind: 'news' });
    expect((await screen.findAllByText('Опубликовано')).length).toBeGreaterThan(0);
  });
});
