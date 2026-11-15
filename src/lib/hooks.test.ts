import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import * as api from './api';
import { useArticles, useMatch, usePlan, useSpecialist, useSpecialists } from './hooks';
import oracle from './__fixtures__/parity.json';
import type { ApiResponse, ChildCard, Filters, SpecialistList } from './types';

vi.mock('./api', () => ({ listSpecialists: vi.fn(), getSpecialist: vi.fn(), match: vi.fn(), plan: vi.fn(), articles: vi.fn() }));
const card = oracle.cases[0].card as ChildCard;
beforeEach(() => vi.resetAllMocks());

describe('data hooks', () => {
  test('loading, source, errors, and reload', async () => {
    vi.mocked(api.listSpecialists).mockResolvedValue({ data: { items: [], total: 0 }, source: 'seed' });
    const { result } = renderHook(() => useSpecialists());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.source).toBe('seed'));
    expect(result.current.data).toEqual({ items: [], total: 0 });
    expect(result.current.error).toBeNull();
    vi.mocked(api.listSpecialists).mockRejectedValue(new Error('404'));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.error?.message).toBe('404'));
    expect(result.current.loading).toBe(false);
    expect(result.current.source).toBeNull();
    vi.mocked(api.listSpecialists).mockResolvedValue({ data: { items: [], total: 0 }, source: 'api' });
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.source).toBe('api'));
  });
  test('inline equivalent filters do not refetch; stale requests cannot overwrite newer data', async () => {
    let finishOld!: (value: ApiResponse<SpecialistList>) => void;
    vi.mocked(api.listSpecialists).mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
      .mockResolvedValue({ data: { items: [], total: 2 }, source: 'api' });
    const { result, rerender } = renderHook(({ sort }: Filters) => useSpecialists({ sort }), { initialProps: { sort: 'cheap' } as Filters });
    rerender({ sort: 'cheap' });
    expect(api.listSpecialists).toHaveBeenCalledTimes(1);
    rerender({ sort: 'rating' });
    await waitFor(() => expect(result.current.data?.total).toBe(2));
    await act(async () => finishOld({ data: { items: [], total: 1 }, source: 'seed' }));
    expect(result.current.data?.total).toBe(2);
    expect(result.current.source).toBe('api');
  });
  test('missing card disables match and plan until it exists', async () => {
    vi.mocked(api.match).mockResolvedValue({ data: { items: [], plan: [] }, source: 'seed' });
    vi.mocked(api.plan).mockResolvedValue({ data: { steps: [] }, source: 'seed' });
    const { result, rerender } = renderHook(({ child }: { child: ChildCard | null }) => ({ match: useMatch(child, {}), plan: usePlan(child) }), { initialProps: { child: null } as { child: ChildCard | null } });
    expect(result.current.match).toMatchObject({ data: null, loading: false, error: null });
    expect(api.match).not.toHaveBeenCalled();
    expect(api.plan).not.toHaveBeenCalled();
    rerender({ child: card });
    await waitFor(() => expect(result.current.plan.source).toBe('seed'));
    expect(api.match).toHaveBeenCalledWith(card, {});
    rerender({ child: { ...card } });
    expect(api.match).toHaveBeenCalledTimes(1);
    rerender({ child: null });
    expect(result.current.plan.data).toBeNull();
  });
  test('specialist and articles load through their API methods', async () => {
    vi.mocked(api.getSpecialist).mockRejectedValue(new Error('Специалист не найден'));
    vi.mocked(api.articles).mockResolvedValue({ data: { items: [] }, source: 'api' });
    const { result } = renderHook(() => ({ specialist: useSpecialist(999, 'Бостандыкский'), articles: useArticles() }));
    await waitFor(() => expect(result.current.specialist.error?.message).toBe('Специалист не найден'));
    expect(api.getSpecialist).toHaveBeenCalledWith(999, 'Бостандыкский');
    expect(result.current.articles.data).toEqual({ items: [] });
    expect(result.current.articles.source).toBe('api');
  });
});
