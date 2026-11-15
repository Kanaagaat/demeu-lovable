import { API_URL } from './api';

export type AppStatus = 'new' | 'docs' | 'approved' | 'rejected';
export type ReportStatus = 'open' | 'work' | 'closed';
export type ReviewStatus = 'pending' | 'published' | 'hidden';

export interface AdminDoc { name: string; kind: 'diploma' | 'certificate' | 'other'; size: string }
export interface AdminApplication {
  id: string; name: string; role: string; exp_years: number; district: string; price: number; formats: string[];
  works_with: string[]; methods: string; education: string; about: string; documents: AdminDoc[];
  status: AppStatus; note: string; specialist_id: number | null; created_at: string; updated_at: string | null; demo: boolean;
}
export interface AdminReport {
  id: string; specialist_id: number | null; specialist: string; role: string; category: string; text: string;
  status: ReportStatus; note: string; created_at: string; updated_at: string | null;
}
export interface AdminReview {
  id: string; specialist_id: number | null; specialist: string; suitable: boolean; rating: number; text: string;
  status: ReviewStatus; hints: string[]; created_at: string; updated_at: string | null;
}
export type NewsKind = 'news' | 'event' | 'benefit' | 'discount' | 'course';
export type NewsAudience = 'all' | 'parents' | 'children';
export type NewsStatus = 'draft' | 'published' | 'archived';
export interface NewsDraft { kind: NewsKind; audience: NewsAudience; title: string; body: string; link: string | null; event_date: string | null; pinned: boolean; status: NewsStatus }
export interface AdminNews extends NewsDraft { id: string; demo: boolean; created_at: string; updated_at: string | null }
export interface AdminSummary {
  new_applications: number; open_reports: number; pending_reviews: number; verified_specialists: number; published_news?: number;
  recent: { at: string; text: string }[];
}

/** Every failure the console knows how to explain to a moderator. */
export type AdminErrorKind = 'network' | 'config' | 'auth' | 'limit' | 'validation' | 'conflict' | 'missing' | 'server';
export class AdminApiError extends Error {
  constructor(public kind: AdminErrorKind, message: string, public status = 0) { super(message); }
}

/** The same surface is implemented by the server (remote) and by the in-browser demo (state/admin.ts). */
export interface AdminBackend {
  mode: 'remote' | 'local';
  login(code: string): Promise<void>;
  summary(): Promise<AdminSummary>;
  applications(): Promise<AdminApplication[]>;
  decideApplication(id: string, body: { status: 'docs' | 'approved' | 'rejected'; note: string }): Promise<AdminApplication>;
  reports(): Promise<AdminReport[]>;
  decideReport(id: string, body: { status: ReportStatus; note: string }): Promise<AdminReport>;
  reviews(): Promise<AdminReview[]>;
  decideReview(id: string, body: { status: ReviewStatus }): Promise<AdminReview>;
  news(): Promise<AdminNews[]>;
  createNews(body: NewsDraft): Promise<AdminNews>;
  updateNews(id: string, body: Partial<NewsDraft>): Promise<AdminNews>;
}

function detailText(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(item => (item && typeof item === 'object' && 'msg' in item ? String((item as { msg: unknown }).msg) : '')).filter(Boolean).join('; ');
  return '';
}

async function call<T>(path: string, code: string, init: RequestInit = {}): Promise<T> {
  const base = API_URL?.trim();
  if (!base) throw new AdminApiError('config', 'Сервер не подключён к этой версии приложения');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/+$/, '')}/api/admin/${path}`, {
      ...init, signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'X-Admin-Code': code, ...init.headers },
    });
  } catch {
    throw new AdminApiError('network', 'Нет связи с сервером. Проверьте интернет и повторите');
  } finally { clearTimeout(timer); }
  if (response.ok) return await response.json() as T;
  let detail = '';
  try { detail = detailText((await response.json() as { detail?: unknown }).detail); } catch { /* not JSON */ }
  const status = response.status;
  if (status === 401) throw new AdminApiError('auth', detail || 'Неверный код доступа', status);
  if (status === 429) throw new AdminApiError('limit', detail || 'Слишком много попыток, подождите несколько минут', status);
  if (status === 503) throw new AdminApiError('config', detail || 'Кабинет модератора не настроен на сервере', status);
  if (status === 404) throw new AdminApiError('missing', detail || 'Запись не найдена. Обновите список', status);
  if (status === 409) throw new AdminApiError('conflict', detail || 'Решение уже принято', status);
  if (status === 422 || status === 400) throw new AdminApiError('validation', detail || 'Проверьте введённые данные', status);
  throw new AdminApiError('server', 'Сервер временно недоступен. Повторите чуть позже', status);
}

export function remoteBackend(code: string): AdminBackend {
  const patch = (body: unknown): RequestInit => ({ method: 'PATCH', body: JSON.stringify(body) });
  return {
    mode: 'remote',
    login: async value => { await call<{ ok: boolean }>('login', value, { method: 'POST', body: JSON.stringify({ code: value }) }); },
    summary: () => call<AdminSummary>('summary', code),
    applications: async () => (await call<{ items: AdminApplication[] }>('applications', code)).items,
    decideApplication: (id, body) => call<AdminApplication>(`applications/${encodeURIComponent(id)}`, code, patch(body)),
    reports: async () => (await call<{ items: AdminReport[] }>('reports', code)).items,
    decideReport: (id, body) => call<AdminReport>(`reports/${encodeURIComponent(id)}`, code, patch(body)),
    reviews: async () => (await call<{ items: AdminReview[] }>('reviews', code)).items,
    decideReview: (id, body) => call<AdminReview>(`reviews/${encodeURIComponent(id)}`, code, patch(body)),
    news: async () => (await call<{ items: AdminNews[] }>('news', code)).items,
    createNews: body => call<AdminNews>('news', code, { method: 'POST', body: JSON.stringify(body) }),
    updateNews: (id, body) => call<AdminNews>(`news/${encodeURIComponent(id)}`, code, patch(body)),
  };
}

/** Login probe used before a session exists. */
export const remoteLogin = (code: string) => remoteBackend(code).login(code);

// ---- public specialist application (phone cabinet → console) ----------------------------------------------
export interface ApplicationPayload {
  name: string; role: string; exp_years: number; district: string; price: number; formats: string[];
  works_with: string[]; methods: string; education: string; about: string; documents: AdminDoc[];
}
export interface ApplicationStatus { id: string; status: AppStatus; note: string; specialist_id: number | null; updated_at: string }

async function publicCall<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = API_URL?.trim();
  if (!base) throw new AdminApiError('config', 'Сервер не подключён: заявку нельзя отправить в офлайн-режиме');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/+$/, '')}/api/applications${path}`, { ...init, signal: controller.signal, headers: { 'Content-Type': 'application/json' } });
  } catch { throw new AdminApiError('network', 'Нет связи с сервером. Заявка сохранена, отправьте её ещё раз'); }
  finally { clearTimeout(timer); }
  if (response.ok) return await response.json() as T;
  let detail = '';
  try { detail = detailText((await response.json() as { detail?: unknown }).detail); } catch { /* not JSON */ }
  if (response.status === 404) throw new AdminApiError('missing', 'Заявка не найдена на сервере', 404);
  if (response.status === 422) throw new AdminApiError('validation', detail || 'Проверьте заполненные поля', 422);
  if (response.status === 409) throw new AdminApiError('conflict', detail || 'По заявке уже принято решение', 409);
  throw new AdminApiError('server', 'Сервер временно недоступен. Повторите чуть позже', response.status);
}
export const submitApplication = (body: ApplicationPayload) => publicCall<{ id: string; status: AppStatus }>('', { method: 'POST', body: JSON.stringify(body) });
export const updateApplication = (id: string, body: ApplicationPayload) => publicCall<{ id: string; status: AppStatus }>(`/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) });
export const getApplicationStatus = (id: string) => publicCall<ApplicationStatus>(`/${encodeURIComponent(id)}`);
