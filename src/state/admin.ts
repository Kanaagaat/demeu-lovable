import { AdminApiError } from '../lib/adminApi';
import type { AdminApplication, AdminBackend, AdminNews, AdminReport, AdminReview, AdminSummary } from '../lib/adminApi';

/** Offline demo of the moderator console: same surface as the server, data kept in localStorage. All people and texts are fictional. */

export const ADMIN_CODE = import.meta.env.VITE_ADMIN_DEMO_CODE || 'mamapro';
const SESSION = 'demeu.admin.session';
const STORE = 'demeu.admin.local';
const CHECKED = 'demeu.admin.checked';

export interface Session { mode: 'remote' | 'local'; code: string }
export function readSession(): Session | null {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(SESSION) ?? 'null');
    if (raw && typeof raw === 'object' && 'mode' in raw && ((raw as Session).mode === 'remote' || (raw as Session).mode === 'local')) return { mode: (raw as Session).mode, code: String((raw as Session).code ?? '') };
  } catch { /* signed out */ }
  return null;
}
export function writeSession(session: Session | null) {
  try { if (session) sessionStorage.setItem(SESSION, JSON.stringify(session)); else sessionStorage.removeItem(SESSION); } catch { /* memory only */ }
}

/** Which documents the moderator has looked at, per application (UI state, kept on this computer). */
export function readChecked(): Record<string, string[]> {
  try { const raw: unknown = JSON.parse(localStorage.getItem(CHECKED) ?? '{}'); return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, string[]> : {}; } catch { return {}; }
}
export function writeChecked(value: Record<string, string[]>) { try { localStorage.setItem(CHECKED, JSON.stringify(value)); } catch { /* ignore */ } }

/** Rule-based hints for the moderator (no AI judgement about people). */
export function applicationHints(app: Pick<AdminApplication, 'documents' | 'methods'>): string[] {
  const hints: string[] = [];
  if (!app.documents.some(doc => doc.kind === 'diploma')) hints.push('Не приложен диплом');
  if (app.methods.trim() && app.documents.filter(doc => doc.kind === 'certificate').length === 0) hints.push('Нет сертификатов по заявленным методикам');
  if (app.documents.some(doc => /0,[0-3] МБ/.test(doc.size))) hints.push('Скан очень маленького размера, возможно плохо читается');
  return hints;
}
export function reviewHints(text: string): string[] {
  const hints: string[] = [];
  if (/\+?\d[\d\s()-]{8,}\d/.test(text)) hints.push('Содержит номер телефона, скройте перед публикацией');
  if (/вылечил|излечил|исцелил|вылечит/i.test(text)) hints.push('Обещание «излечения», так сообщать нельзя');
  return hints;
}

const ago = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
const doc = (name: string, kind: 'diploma' | 'certificate' | 'other', size: string) => ({ name, kind, size });
const app = (id: number, name: string, role: string, exp: number, district: string, price: number, formats: string[], works: string[], methods: string, education: string, about: string, documents: AdminApplication['documents'], days: number, status: AdminApplication['status'] = 'new', note = ''): AdminApplication =>
  ({ id: `demo-application-${id}`, name, role, exp_years: exp, district, price, formats, works_with: works, methods, education, about, documents, status, note, specialist_id: null, created_at: ago(days), updated_at: null, demo: true });

interface Store { applications: AdminApplication[]; reports: AdminReport[]; reviews: AdminReview[]; news: AdminNews[]; log: { at: string; text: string }[]; verified: number }
const news = (id: number, kind: AdminNews['kind'], audience: AdminNews['audience'], title: string, body: string, link: string | null, inDays: number | null, pinned: boolean, days: number): AdminNews =>
  ({ id: `demo-news-${id}`, kind, audience, title, body, link, event_date: inDays ? new Date(Date.now() + inDays * 86400000).toISOString().slice(0, 10) : null, status: 'published', pinned, demo: true, created_at: ago(days), updated_at: null });
function seedStore(): Store {
  const reviewTexts: [string, string, boolean, number][] = [
    ['Анна Сергеева', 'Через месяц сын начал повторять первые слова за педагогом. Занятия спокойные, без давления, мне подробно объясняют домашние задания.', true, 1],
    ['Дана Мусина', 'Хороший специалист. Если нужна консультация вне занятий, пишите мне: +7 700 123 45 67, подскажу контакты.', true, 2],
    ['Тимур Жанибеков', 'За три занятия полностью вылечил проблемы с ходьбой, рекомендую всем!', true, 2],
    ['Динара Петрова', 'Нам не подошёл темп: ребёнок уставал уже к середине занятия. Специалист вежливая, но мы ищем другой формат.', false, 4],
  ];
  return {
    verified: 24, log: [],
    news: [
      news(1, 'event', 'all', 'Семейный день: открытая встреча для родителей и детей', 'Пример объявления. Знакомство с центрами и специалистами, игровая зона для детей и разговор с мамами, которые уже прошли этот путь. Вход свободный.', null, 21, true, 1),
      news(2, 'discount', 'all', 'Скидка на первое занятие для новых семей', 'Пример объявления. Партнёрские центры могут предлагать скидку на первое занятие. Условия и промокод будут указаны в объявлении.', null, 45, false, 2),
      news(3, 'benefit', 'parents', 'Если появится новая льгота, мы расскажем об этом здесь', 'Пример объявления. Когда меняются условия пособий или порядок оформления, модераторы Мама Про публикуют короткое пояснение и ссылку на официальный источник.', 'https://gov4c.kz', null, false, 3),
      news(4, 'course', 'parents', 'Курс «Лидерство для родителей»: 4 вечерние встречи онлайн', 'Пример объявления. Практика уверенного общения с врачами, школой и ведомствами, работа с усталостью и целями семьи.', null, 30, false, 4),
      news(5, 'course', 'children', 'Лидерская мастерская для подростков', 'Пример объявления. Групповые занятия по общению, выбору и самостоятельности для подростков в комфортном темпе, с поддержкой взрослого.', null, 40, false, 5),
      news(6, 'news', 'all', 'В каталоге появились новые проверенные специалисты', 'Пример объявления. Мы регулярно проверяем документы и добавляем специалистов. Фильтр «Проверено Мама Про» помогает быстрее найти нужного.', null, null, false, 6),
    ],
    applications: [
      app(1, 'Салтанат Рахимова', 'Логопед', 8, 'Бостандыкский', 9000, ['Кабинет', 'Онлайн'], ['РАС', 'Неговорящие дети'], 'PECS, артикуляционная гимнастика, работа с алалией', 'КазНПУ, дефектология, 2016', 'Работаю с неговорящими детьми, строю занятия вокруг интересов ребёнка. Родителей обучаю, как закреплять навыки дома.', [doc('Диплом о высшем образовании', 'diploma', 'diplom.pdf · 2,1 МБ'), doc('Сертификат PECS', 'certificate', 'pecs.jpg · 0,8 МБ')], 1),
      app(2, 'Данияр Омаров', 'АВА-терапевт', 4, 'Ауэзовский', 12000, ['Кабинет', 'На дом'], ['РАС', 'ЗПР / ЗРР'], 'АВА, дискретные пробы, натуралистическое обучение', 'КазНУ, психология, 2020', 'Прошёл стажировку в центре поведенческой терапии. Занимаюсь с детьми 3–9 лет, составляю индивидуальные программы вместе с семьёй.', [doc('Диплом о высшем образовании', 'diploma', 'diplom.pdf · 1,7 МБ')], 2),
      app(3, 'Жанар Кенжебаева', 'Нейропсихолог', 11, 'Медеуский', 15000, ['Кабинет'], ['ДЦП', 'ЗПР / ЗРР'], 'Нейропсихологическая диагностика и коррекция, сенсорная интеграция', 'МГУ, нейропсихология, 2013; переподготовка 2019', 'Помогаю подобрать комфортный темп занятий и понять сильные стороны ребёнка. Консультирую родителей по дому и школе.', [doc('Диплом о высшем образовании', 'diploma', 'diplom.pdf · 2,6 МБ'), doc('Сертификат по сенсорной интеграции', 'certificate', 'si.pdf · 1,2 МБ'), doc('Свидетельство о переподготовке', 'certificate', 'retrain.pdf · 0,9 МБ')], 3),
      app(4, 'Мирас Тлеубаев', 'Реабилитолог', 6, 'Алмалинский', 7000, ['На дом'], ['ДЦП'], 'Двигательная реабилитация, занятия в игровой форме', 'Не приложен', 'Выезжаю на дом, подбираю упражнения под возможности ребёнка и обучаю родителей.', [], 5),
      app(5, 'Айя Сулейменова', 'Психолог для родителей', 13, 'Жетысуский', 11000, ['Онлайн'], ['Поддержка родителей'], 'Семейное консультирование, группы поддержки', 'КазНУ, психология, 2011', 'Веду индивидуальные консультации и группу для мам детей с особенностями развития.', [doc('Диплом о высшем образовании', 'diploma', 'diplom.jpg · 0,3 МБ'), doc('Сертификат семейного консультанта', 'certificate', 'family.pdf · 1,0 МБ')], 6, 'docs', 'Запрошен скан диплома в лучшем качестве.'),
      app(6, 'Руслан Идрисов', 'Логопед', 1, 'Наурызбайский', 5000, ['Кабинет'], ['ЗПР / ЗРР'], 'Постановка звуков', 'КазНПУ, 2025', 'Начинающий специалист, хочу работать под наблюдением опытных коллег.', [doc('Диплом', 'diploma', 'scan.jpg · 0,1 МБ')], 12, 'rejected', 'Скан диплома не читается, просим подать заявку повторно.'),
    ],
    reports: [
      { id: 'demo-report-1', specialist_id: null, specialist: 'Гульмира Ахатова', role: 'Логопед', category: 'Грубость', text: 'Специалист повысила голос, когда ребёнок отказался сидеть за столом. Сын расстроился и два дня не хотел идти на занятие.', status: 'open', note: '', created_at: ago(1), updated_at: null },
      { id: 'demo-report-2', specialist_id: null, specialist: 'Бауыржан Сеитов', role: 'АВА-терапевт', category: 'Давление на ребёнка', text: 'Просили повторять задание, пока ребёнок не заплакал, и не разрешили сделать перерыв. Прошу проверить подход.', status: 'open', note: '', created_at: ago(3), updated_at: null },
      { id: 'demo-report-3', specialist_id: null, specialist: 'Зарина Мусаева', role: 'Дефектолог', category: 'Другое', text: 'Занятие перенесли дважды в день записи и не вернули предоплату. Хочу, чтобы фонд помог разобраться.', status: 'work', note: 'Связались со специалистом, ждём объяснение до пятницы.', created_at: ago(4), updated_at: null },
      { id: 'demo-report-4', specialist_id: null, specialist: 'Ербол Нурпеисов', role: 'Реабилитолог', category: 'Другое', text: 'Адрес в профиле не совпадает с тем, куда нас пригласили. Сначала подумали, что ошиблись домом.', status: 'closed', note: 'Специалист обновил адрес в профиле.', created_at: ago(8), updated_at: null },
    ],
    reviews: reviewTexts.map(([specialist, text, suitable, days], index) => ({ id: `demo-review-${index + 1}`, specialist_id: null, specialist, suitable, rating: suitable ? 5 : 2, text, status: 'pending' as const, hints: reviewHints(text), created_at: ago(days), updated_at: null })),
  };
}
function load(): Store {
  try { const raw: unknown = JSON.parse(localStorage.getItem(STORE) ?? 'null'); if (raw && typeof raw === 'object' && 'applications' in raw && 'reports' in raw && 'reviews' in raw) { const store = raw as Store; if (!Array.isArray(store.news)) store.news = seedStore().news; return store; } } catch { /* reseed */ }
  return seedStore();
}
export function resetLocalDemo() { try { localStorage.removeItem(STORE); localStorage.removeItem(CHECKED); } catch { /* ignore */ } }

/** The same rules as the server (api/app/schemas.py NewsInput + the publish check). */
function checkNews<T extends Pick<AdminNews, 'title' | 'body' | 'link' | 'event_date' | 'status'>>(value: T): T {
  const title = value.title.trim(), body = value.body.trim(), link = value.link?.trim() || null, date = value.event_date?.trim() || null;
  if (title.length < 3) throw new AdminApiError('validation', 'Заголовок: от 3 символов', 422);
  if (link && !/^https?:\/\//.test(link)) throw new AdminApiError('validation', 'Ссылка должна начинаться с https://', 422);
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AdminApiError('validation', 'Дата в формате ГГГГ-ММ-ДД', 422);
  if (value.status === 'published' && body.length < 10) throw new AdminApiError('validation', 'Перед публикацией добавьте текст новости (от 10 символов)', 422);
  return { ...value, title, body, link, event_date: date };
}

export function localBackend(): AdminBackend {
  const store = load();
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(store)); } catch { /* memory only */ } };
  const find = <T extends { id: string }>(list: T[], id: string, label: string) => {
    const item = list.find(entry => entry.id === id);
    if (!item) throw new AdminApiError('missing', `${label} не найдена. Обновите список`, 404);
    return item;
  };
  const log = (text: string) => { store.log = [{ at: new Date().toISOString(), text }, ...store.log].slice(0, 8); };
  return {
    mode: 'local',
    login: async code => { if (code.trim().toLowerCase() !== ADMIN_CODE.toLowerCase()) throw new AdminApiError('auth', 'Неверный код доступа', 401); },
    summary: async (): Promise<AdminSummary> => ({
      new_applications: store.applications.filter(item => item.status === 'new').length,
      open_reports: store.reports.filter(item => item.status === 'open').length,
      pending_reviews: store.reviews.filter(item => item.status === 'pending').length,
      verified_specialists: store.verified, published_news: store.news.filter(item => item.status === 'published').length, recent: store.log,
    }),
    applications: async () => structuredClone(store.applications),
    reports: async () => structuredClone(store.reports),
    reviews: async () => structuredClone(store.reviews),
    news: async () => structuredClone(store.news),
    createNews: async body => {
      const draft = checkNews(body);
      const item: AdminNews = { ...draft, id: `local-news-${Date.now()}`, demo: false, created_at: new Date().toISOString(), updated_at: null };
      store.news = [item, ...store.news]; log(`Новость создана: ${item.title}`); save();
      return structuredClone(item);
    },
    updateNews: async (id, body) => {
      const item = find(store.news, id, 'Новость');
      Object.assign(item, checkNews({ ...item, ...body }), { updated_at: new Date().toISOString() });
      log(`${item.status === 'published' ? 'Новость опубликована' : item.status === 'archived' ? 'Новость в архиве' : 'Новость сохранена'}: ${item.title}`); save();
      return structuredClone(item);
    },
    decideApplication: async (id, body) => {
      const item = find(store.applications, id, 'Заявка');
      if (item.status === 'approved' || item.status === 'rejected') throw new AdminApiError('conflict', 'Решение по заявке уже принято', 409);
      const note = body.note.trim();
      if (body.status !== 'approved' && note.length < 3) throw new AdminApiError('validation', 'Добавьте комментарий специалисту', 422);
      if (body.status === 'approved') {
        if (!item.documents.some(entry => entry.kind === 'diploma')) throw new AdminApiError('validation', 'Нельзя подтвердить заявку без диплома', 422);
        store.verified += 1;
      }
      item.status = body.status; item.note = note; item.updated_at = new Date().toISOString();
      log(`${{ approved: 'Проверено Мама Про', rejected: 'Заявка отклонена', docs: 'Запрошены документы' }[body.status]}: ${item.name}`); save();
      return structuredClone(item);
    },
    decideReport: async (id, body) => {
      const item = find(store.reports, id, 'Жалоба');
      const note = body.note.trim();
      if (body.status === 'closed' && note.length < 3) throw new AdminApiError('validation', 'Чтобы закрыть жалобу, добавьте заметку о результате', 422);
      item.status = body.status; item.note = note; item.updated_at = new Date().toISOString();
      log(`Жалоба «${{ open: 'открыта', work: 'в работе', closed: 'закрыта' }[body.status]}»: ${item.specialist}`); save();
      return structuredClone(item);
    },
    decideReview: async (id, body) => {
      const item = find(store.reviews, id, 'Отзыв');
      if (body.status === 'published' && item.hints.length) throw new AdminApiError('validation', `Публикация закрыта: ${item.hints.join('; ')}`, 422);
      item.status = body.status; item.updated_at = new Date().toISOString();
      log(`${body.status === 'published' ? 'Отзыв опубликован' : body.status === 'hidden' ? 'Отзыв скрыт' : 'Отзыв обновлён'}: ${item.specialist}`); save();
      return structuredClone(item);
    },
  };
}
