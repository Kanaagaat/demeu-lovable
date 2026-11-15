import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { listSpecialists as seedList } from './engine';

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('VITE_API_URL', 'https://api.example.test/');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('API transport', () => {
  test('network error returns seed data and source=seed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const api = await import('./api');
    const response = await api.listSpecialists();
    expect(response).toEqual({ data: seedList(), source: 'seed' });
  });
  test('200 returns API data and source=api', async () => {
    const data = { items: [], total: 0 };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(data)));
    vi.stubGlobal('fetch', fetch);
    const api = await import('./api');
    expect(await api.listSpecialists()).toEqual({ data, source: 'api' });
    expect(fetch).toHaveBeenCalledWith('https://api.example.test/api/specialists', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });
  test('404 propagates without invoking fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'Проверьте запрос' }), { status: 404 })));
    const api = await import('./api');
    const fallback = vi.fn(() => 'fallback');
    await expect(api.request('/api/specialists/404', {}, fallback)).rejects.toMatchObject({ status: 404, message: 'Проверьте запрос' });
    expect(fallback).not.toHaveBeenCalled();
  });
  test.each([400, 422, 429])('%i falls back to seed (demo stability, DECISIONS D-20)', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'Проверьте запрос' }), { status })));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const api = await import('./api');
    const fallback = vi.fn(() => 'fallback');
    await expect(api.request('/api/match', {}, fallback)).resolves.toEqual({ data: 'fallback', source: 'seed' });
    expect(fallback).toHaveBeenCalledOnce();
  });
  test('non-JSON 404 still propagates', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Not found', { status: 404 })));
    const api = await import('./api');
    await expect(api.getSpecialist(404)).rejects.toMatchObject({ status: 404 });
  });
  test('a stalled 404 error body still propagates at the deadline', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not found', json: () => new Promise(() => {}) }));
    const api = await import('./api');
    const fallback = vi.fn(() => 'fallback');
    const rejection = expect(api.request('/api/specialists/404', {}, fallback)).rejects.toMatchObject({ status: 404 });
    await vi.advanceTimersByTimeAsync(4000);
    await rejection;
    expect(fallback).not.toHaveBeenCalled();
  });
  test.each([500, 503])('%i uses fallback', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status })));
    const api = await import('./api');
    expect((await api.getMeta()).source).toBe('seed');
  });
  test('empty URL never calls fetch', async () => {
    vi.stubEnv('VITE_API_URL', '');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const api = await import('./api');
    expect((await api.articles()).source).toBe('seed');
    expect(fetch).not.toHaveBeenCalled();
  });
  test('4 second timeout aborts and falls back even if fetch ignores abort', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal('fetch', fetch);
    const api = await import('./api');
    const pending = api.getMeta();
    await vi.advanceTimersByTimeAsync(3999);
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect((await pending).source).toBe('seed');
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  test('arrays repeat query keys, false and zero survive serialization', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{"items":[],"total":0}'));
    vi.stubGlobal('fetch', fetch);
    const api = await import('./api');
    await api.listSpecialists({ exp: ['РАС', 'ДЦП'], specialty: ['Логопед', 'Психолог'], group: false, max_minutes: 0, district: 'Бостандыкский' });
    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.searchParams.getAll('exp')).toEqual(['РАС', 'ДЦП']);
    expect(url.searchParams.getAll('specialty')).toEqual(['Логопед', 'Психолог']);
    expect(url.searchParams.get('group')).toBe('false');
    expect(url.searchParams.get('max_minutes')).toBe('0');
  });
  test('booking posts only the provided shared fields and uses the demo phone offline', async () => {
    vi.stubEnv('VITE_DEMO_WA_PHONE', '70000000000');
    const fetch = vi.fn().mockRejectedValue(new TypeError('Offline'));
    vi.stubGlobal('fetch', fetch);
    const api = await import('./api');
    const body = { specialist_id: 1, slot: '2099-12-01T10:00:00Z', format: 'Онлайн' as const, shared: { age: 6 } };
    const response = await api.createBooking(body);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(body);
    expect(response.source).toBe('seed');
    expect(response.data.wa_url).toContain('https://wa.me/70000000000?text=');
    expect(response.data.message).not.toContain('Особенности:');
  });
});
