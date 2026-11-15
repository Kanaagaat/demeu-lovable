import * as engine from './engine';
import { ApiError } from './engine';
import newsDemo from '../data/news_demo.json';
import type { ApiResponse, BookingRequest, ChatRequest, ChatResult, ChildCard, NewsItem, NewsResult, PlanAiLayer, FeedbackRequest, Filters, ReportRequest, SavedBooking } from './types';

export const API_URL = import.meta.env.VITE_API_URL;

export async function request<T>(path: string, init: RequestInit = {}, fallback: () => T): Promise<ApiResponse<T>> {
  if (!API_URL?.trim()) return { data: fallback(), source: 'seed' };
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let httpError: ApiError | undefined;
  const abort = () => controller.abort();
  init.signal?.addEventListener('abort', abort, { once: true });
  if (init.signal?.aborted) controller.abort();
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(httpError ?? new Error('API timeout')); }, 4000);
    });
    const fetchData = async () => {
      const response = await fetch(`${API_URL.trim().replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`, { ...init, signal: controller.signal });
      if (response.status >= 500) throw new Error(`API ${response.status}`);
      if (!response.ok) {
        // Once a 4xx status is known, even a stalled error body must not trigger seed fallback.
        httpError = new ApiError(response.status, response.statusText);
        let detail: unknown = response.statusText;
        try { detail = (await response.json()).detail ?? detail; } catch { /* Non-JSON error response. */ }
        throw new ApiError(response.status, detail);
      }
      return await response.json() as T;
    };
    return { data: await Promise.race([fetchData(), timeout]), source: 'api' };
  } catch (error) {
    // Demo stability: only "not found" is surfaced; any other API failure falls back to the local engine.
    if (error instanceof ApiError && error.status === 404) throw error;
    if (error instanceof ApiError) console.warn('[api] fallback to seed after', error.status, path);
    return { data: fallback(), source: 'seed' };
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', abort);
  }
}

export function query(filters: Filters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value == null) continue;
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, String(item));
  }
  const value = params.toString();
  return value ? `?${value}` : '';
}
const post = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
function savedBookings(): SavedBooking[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('demeu.bookings') ?? '[]');
    return Array.isArray(value) ? value.filter((b): b is SavedBooking => !!b && typeof b.id === 'string' && typeof b.specialist_id === 'number') : [];
  } catch { return []; }
}

export const getMeta = () => request('/api/meta', {}, engine.getMeta);
export const listSpecialists = (filters: Filters = {}) => request(`/api/specialists${query(filters)}`, {}, () => engine.listSpecialists(filters));
export const getSpecialist = (id: number, district?: string | null) => request(`/api/specialists/${id}${query({ district })}`, {}, () => engine.getSpecialist(id, district));
export const match = (card: ChildCard, filters: Filters = {}) => request('/api/match', post({ card, filters }), () => engine.match(card, filters));
export const plan = (card: ChildCard) => request('/api/plan', post({ card }), () => engine.plan(card));
export const createBooking = (body: BookingRequest) => request('/api/bookings', post(body), () => engine.createBooking(body, crypto.randomUUID(), import.meta.env.VITE_DEMO_WA_PHONE));
export const sendFeedback = (body: FeedbackRequest) => request('/api/feedback', post(body), () => engine.sendFeedback(body, crypto.randomUUID(), savedBookings()));
export const sendReport = (body: ReportRequest) => request('/api/reports', post(body), () => engine.sendReport(body, crypto.randomUUID()));
export const chat = (body: ChatRequest) => request('/api/chat', post(body), () => engine.chat(body));

/**
 * Why the assistant could not answer. There is deliberately no canned reply: a made-up answer to a real question is worse
 * than an honest «try again».
 */
export class AssistantError extends Error {
  constructor(public kind: 'offline' | 'timeout' | 'unavailable', message: string) { super(message); this.name = 'AssistantError'; }
}
async function timedPost<T>(path: string, body: unknown, ms: number, signal?: AbortSignal): Promise<T> {
  const base = API_URL?.trim();
  if (!base) throw new AssistantError('offline', 'API is not configured');
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, ms);
  try {
    const response = await fetch(`${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`, { ...post(body), signal: controller.signal });
    if (!response.ok) throw new AssistantError('unavailable', `API ${response.status}`);
    return await response.json() as T;
  } catch (error) {
    if (error instanceof AssistantError) throw error;
    if (signal?.aborted) throw error;
    throw new AssistantError(timedOut ? 'timeout' : 'offline', timedOut ? 'API timeout' : 'API unreachable');
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
/** Crisis phrases are recognised on the device first, so help is shown even without a connection. */
export async function askAssistant(body: ChatRequest, signal?: AbortSignal): Promise<ChatResult> {
  const local = engine.chat(body);
  if (local.crisis) return local;
  return timedPost<ChatResult>('/api/chat', body, 45000, signal);
}
/** The AI layer of the family plan (summary, comments, questions). Slow (several seconds): never blocks the plan itself. */
export const planAi = (card: ChildCard, language: 'ru' | 'kz', signal?: AbortSignal) => timedPost<PlanAiLayer>('/api/plan/personal', { card, language }, 60000, signal);

type DemoNews = Omit<NewsItem, 'event_date'> & { days: number | null };
export const news = (audience?: 'parents' | 'children') => request(`/api/news${audience ? `?audience=${audience}` : ''}`, {}, (): NewsResult => ({
  items: (newsDemo as DemoNews[]).filter(n => !audience || n.audience === 'all' || n.audience === audience)
    .map(({ days, ...n }) => ({ ...n, event_date: days ? new Date(Date.now() + days * 86400000).toISOString().slice(0, 10) : null })),
}));
export const articles = () => request('/api/articles', {}, engine.articles);
export const article = (id: string) => request(`/api/articles/${encodeURIComponent(id)}`, {}, () => engine.article(id));
