import { useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { AdminApiError, remoteBackend, remoteLogin } from '../lib/adminApi';
import type { AdminApplication, AdminBackend, AdminNews, AdminReport, AdminReview, AppStatus, NewsAudience, NewsDraft, NewsKind, NewsStatus, ReportStatus, ReviewStatus } from '../lib/adminApi';
import { ADMIN_CODE, applicationHints, localBackend, readChecked, readSession, resetLocalDemo, writeChecked, writeSession } from '../state/admin';
import type { Session } from '../state/admin';
import { toAdminError, useAdminData } from '../state/adminData';
import './admin.css';

type Tab = 'summary' | 'apps' | 'complaints' | 'reviews' | 'news';
type Console = ReturnType<typeof useAdminData> & { backend: AdminBackend };

const APP_STATUS: Record<AppStatus, { label: string; tone: string }> = {
  new: { label: 'Новая', tone: 'ad-tone-new' }, docs: { label: 'Ждём документы', tone: 'ad-tone-wait' },
  approved: { label: 'Проверено', tone: 'ad-tone-ok' }, rejected: { label: 'Отклонена', tone: 'ad-tone-bad' },
};
const REPORT_STATUS: Record<ReportStatus, { label: string; tone: string }> = {
  open: { label: 'Открыта', tone: 'ad-tone-bad' }, work: { label: 'В работе', tone: 'ad-tone-wait' }, closed: { label: 'Закрыта', tone: 'ad-tone-ok' },
};
const REVIEW_STATUS: Record<ReviewStatus, { label: string; tone: string }> = {
  pending: { label: 'На модерации', tone: 'ad-tone-new' }, published: { label: 'Опубликован', tone: 'ad-tone-ok' }, hidden: { label: 'Скрыт', tone: 'ad-tone-bad' },
};

const NEWS_STATUS: Record<NewsStatus, { label: string; tone: string }> = {
  draft: { label: 'Черновик', tone: 'ad-tone-wait' }, published: { label: 'Опубликовано', tone: 'ad-tone-ok' }, archived: { label: 'В архиве', tone: 'ad-tone-bad' },
};
const NEWS_KINDS: Record<NewsKind, string> = { news: 'Новость', event: 'Событие', benefit: 'Новая льгота', discount: 'Скидка', course: 'Курс' };
const NEWS_AUDIENCES: Record<NewsAudience, string> = { all: 'Для всех', parents: 'Для родителей', children: 'Для детей' };

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
const daysAgo = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
const waiting = (iso: string) => { const days = daysAgo(iso); return days === 0 ? 'сегодня' : days === 1 ? 'вчера' : `${days} дн. назад`; };
const years = (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'год' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'года' : 'лет'} опыта`;
const money = (value: number) => value === 0 ? 'Бесплатно' : `${value.toLocaleString('ru-RU')} ₸`;
const time = (value: string | Date) => new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

function Badge({ tone, children }: { tone: string; children: ReactNode }) { return <span className={`ad-badge ${tone}`}>{children}</span>; }
function Hints({ items }: { items: string[] }) {
  if (!items.length) return null;
  return <div className="ad-hints" role="note"><strong>На что обратить внимание</strong><ul>{items.map(item => <li key={item}>{item}</li>)}</ul></div>;
}
function Banner({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="ad-banner" role="alert"><span className="ad-grow">{children}</span>{action}</div>;
}
function useAction() {
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const run = async (task: () => Promise<string | null>) => { setBusy(true); setError(null); const message = await task(); setBusy(false); setError(message); return message === null; };
  return { busy, error, run };
}
const ProfileLink = ({ id, label }: { id: number | null; label: string }) => id ? <a className="ad-link-out" href={`/specialists/${id}`} target="_blank" rel="noreferrer">{label}</a> : null;

// ---- login ------------------------------------------------------------------------------------------------
function Login({ onOk }: { onOk: (session: Session) => void }) {
  const [code, setCode] = useState(''); const [error, setError] = useState<AdminApiError | null>(null); const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(null);
    try { await remoteLogin(code.trim()); onOk({ mode: 'remote', code: code.trim() }); }
    catch (caught) { setError(toAdminError(caught)); setBusy(false); }
  };
  const offline = () => {
    if (code.trim().toLowerCase() === ADMIN_CODE.toLowerCase()) onOk({ mode: 'local', code: '' });
    else setError(new AdminApiError('auth', 'Для офлайн-демо введите демо-код'));
  };
  const unreachable = error && ['network', 'config', 'server'].includes(error.kind);
  return <main className="ad-login"><form className="ad-login-card" onSubmit={event => void submit(event)}>
    <img src="/mascot/m-logo.png" alt="DEMEU" height={44} />
    <h1>Кабинет модератора</h1>
    <p>Мама Про · проверка специалистов и обращений родителей</p>
    <label htmlFor="ad-code">Код доступа</label>
    <input id="ad-code" type="password" autoFocus autoComplete="off" value={code} aria-invalid={!!error && !unreachable} onChange={event => { setCode(event.target.value); setError(null); }} />
    {error && <div className="ad-error" role="alert">{error.message}</div>}
    <button className="ad-primary" type="submit" disabled={!code.trim() || busy}>{busy ? 'Проверяем…' : 'Войти'}</button>
    {unreachable && <button type="button" className="ad-secondary" onClick={offline}>Открыть офлайн-демо</button>}
    <small>Демо-код: <b>{ADMIN_CODE}</b>. Все данные в кабинете вымышленные. Без связи с сервером доступно офлайн-демо: данные хранятся только в этом браузере.</small>
  </form></main>;
}

// ---- summary ----------------------------------------------------------------------------------------------
function Summary({ admin, go }: { admin: Console; go: (tab: Tab, id?: string) => void }) {
  const { applications, reports, reviews, summary } = admin.data;
  const queue = [
    ...applications.filter(app => app.status === 'new').map(app => ({ key: app.id, tab: 'apps' as Tab, title: `Заявка: ${app.name}`, sub: app.role, at: app.created_at })),
    ...reports.filter(item => item.status === 'open').map(item => ({ key: item.id, tab: 'complaints' as Tab, title: `Жалоба: ${item.category}`, sub: item.specialist, at: item.created_at })),
    ...reviews.filter(item => item.status === 'pending').map(item => ({ key: item.id, tab: 'reviews' as Tab, title: `Отзыв о специалисте ${item.specialist}`, sub: item.suitable ? 'Подошёл' : 'Не подошёл', at: item.created_at })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  const counters: [string, number, Tab, string][] = [['Новые заявки', summary?.new_applications ?? 0, 'apps', 'diploma'], ['Открытые жалобы', summary?.open_reports ?? 0, 'complaints', 'shield'], ['Отзывы на модерации', summary?.pending_reviews ?? 0, 'reviews', 'chat']];
  return <>
    <div className="ad-counters">{counters.map(([label, value, tab, icon]) => <button key={label} className="ad-counter" onClick={() => go(tab)}><span className="ad-counter-icon"><Icon name={icon} size={24} /></span><strong>{value}</strong><span>{label}</span></button>)}
      <div className="ad-counter ad-counter-static"><span className="ad-counter-icon ad-sage"><Icon name="checkmark" size={24} color="4F7454" /></span><strong>{summary?.verified_specialists ?? 0}</strong><span>Проверено специалистов</span></div></div>
    <div className="ad-columns">
      <section className="ad-panel"><h2>Ждут решения</h2>
        {queue.length === 0 ? <p className="ad-empty">Всё разобрано. Новых обращений нет.</p> : <ul className="ad-queue">{queue.slice(0, 7).map(item => <li key={item.key}><button onClick={() => go(item.tab, item.key)}><span><strong>{item.title}</strong><small>{item.sub}</small></span><small className="ad-muted">{waiting(item.at)}</small></button></li>)}</ul>}</section>
      <section className="ad-panel"><h2>Последние действия</h2>
        {!summary?.recent.length ? <p className="ad-empty">Пока действий нет. Решения модератора появятся здесь.</p> : <ul className="ad-log">{summary.recent.map(entry => <li key={`${entry.at}${entry.text}`}><span>{entry.text}</span><small className="ad-muted">{time(entry.at)}</small></li>)}</ul>}</section>
    </div>
  </>;
}

function Filters<T extends string>({ options, value, onChange }: { options: [T | 'all', string][]; value: T | 'all'; onChange: (value: T | 'all') => void }) {
  return <div className="ad-filters" role="group" aria-label="Фильтр">{options.map(([key, label]) => <button key={key} className="ad-chip" aria-pressed={value === key} onClick={() => onChange(key)}>{label}</button>)}</div>;
}

// ---- applications -----------------------------------------------------------------------------------------
function Applications({ admin, selected, select }: { admin: Console; selected?: string; select: (id: string) => void }) {
  const [filter, setFilter] = useState<AppStatus | 'all'>('all');
  const list = admin.data.applications.filter(app => filter === 'all' || app.status === filter);
  const current = admin.data.applications.find(app => app.id === selected) ?? list[0];
  return <>
    <Filters value={filter} onChange={setFilter} options={[['all', 'Все'], ['new', 'Новые'], ['docs', 'Ждём документы'], ['approved', 'Проверено'], ['rejected', 'Отклонены']]} />
    <div className="ad-split">
      <ul className="ad-list">{list.length === 0 && <li className="ad-empty">В этом статусе заявок нет.</li>}{list.map(app => <li key={app.id}><button aria-current={current?.id === app.id} onClick={() => select(app.id)}>
        <span className="ad-avatar">{initials(app.name)}</span><span className="ad-grow"><strong>{app.name}</strong><small>{app.role} · {years(app.exp_years)}</small></span>
        <span className="ad-end"><Badge tone={APP_STATUS[app.status].tone}>{APP_STATUS[app.status].label}</Badge><small className="ad-muted">{waiting(app.created_at)}</small></span></button></li>)}</ul>
      {current ? <ApplicationDetail key={current.id} app={current} admin={admin} /> : <section className="ad-panel ad-empty">Выберите заявку слева.</section>}
    </div>
  </>;
}

function ApplicationDetail({ app, admin }: { app: AdminApplication; admin: Console }) {
  const [note, setNote] = useState('');
  const [checkedAll, setCheckedAll] = useState(readChecked);
  const action = useAction();
  const checked = checkedAll[app.id] ?? [];
  const docId = (index: number) => `d${index}`;
  const toggle = (id: string) => setCheckedAll(previous => {
    const current = previous[app.id] ?? []; const next = { ...previous, [app.id]: current.includes(id) ? current.filter(x => x !== id) : [...current, id] };
    writeChecked(next); return next;
  });
  const decided = app.status === 'approved' || app.status === 'rejected';
  const allChecked = app.documents.length > 0 && app.documents.every((_, index) => checked.includes(docId(index)));
  const hasDiploma = app.documents.some(doc => doc.kind === 'diploma');
  const canApprove = hasDiploma && allChecked;
  const decide = (status: 'docs' | 'approved' | 'rejected') => void action.run(() => admin.decide(() => admin.backend.decideApplication(app.id, { status, note: note.trim() }), 'applications'));
  return <section className="ad-panel ad-detail" aria-label={`Заявка: ${app.name}`}>
    <header className="ad-detail-head"><span className="ad-avatar ad-avatar-lg">{initials(app.name)}</span><div className="ad-grow"><h2>{app.name}</h2><p>{app.role} · {years(app.exp_years)} · {app.district} район</p></div><Badge tone={APP_STATUS[app.status].tone}>{APP_STATUS[app.status].label}</Badge></header>
    <p className="ad-about">{app.about || 'Специалист не добавил описание.'}</p>
    <dl className="ad-facts">
      <div><dt>Стоимость занятия</dt><dd>{money(app.price)}</dd></div><div><dt>Формат</dt><dd>{app.formats.join(', ') || 'Не указан'}</dd></div>
      <div><dt>Работал(а) с</dt><dd>{app.works_with.join(', ') || 'Не указано'}</dd></div><div><dt>Образование</dt><dd>{app.education || 'Не указано'}</dd></div>
      <div className="ad-wide"><dt>Методики</dt><dd>{app.methods || 'Не указаны'}</dd></div>
    </dl>
    <h3>Документы</h3>
    {app.documents.length === 0 ? <p className="ad-empty ad-warn">Документы не приложены.</p> : <ul className="ad-docs">{app.documents.map((doc, index) => <li key={`${doc.name}${index}`}>
      <label><input type="checkbox" checked={checked.includes(docId(index))} disabled={decided} onChange={() => toggle(docId(index))} /><Icon name={doc.kind === 'diploma' ? 'school' : 'diploma'} size={22} /><span className="ad-grow"><strong>{doc.name}</strong><small>{doc.size || 'размер не указан'}</small></span><span className="ad-muted">{checked.includes(docId(index)) ? 'Проверен' : 'Не проверен'}</span></label></li>)}</ul>}
    <Hints items={applicationHints(app)} />
    {app.note && <p className="ad-note"><strong>Комментарий:</strong> {app.note}</p>}
    {app.status === 'approved' && <p className="ad-decided">Специалист получил отметку «Проверено Мама Про» и виден родителям в каталоге. <ProfileLink id={app.specialist_id} label="Открыть профиль" /></p>}
    {app.status === 'rejected' && <p className="ad-decided ad-decided-bad">Заявка отклонена, специалист видит причину в своём кабинете.</p>}
    {!decided && <>
      <label className="ad-field" htmlFor={`note-${app.id}`}>Комментарий специалисту <small>(обязателен, чтобы отклонить или запросить документы)</small></label>
      <textarea id={`note-${app.id}`} rows={3} maxLength={500} value={note} onChange={event => setNote(event.target.value)} placeholder="Например: пришлите скан диплома лучшего качества" />
      <div className="ad-actions">
        <button className="ad-primary" disabled={!canApprove || action.busy} onClick={() => decide('approved')}><Icon name="checkmark" color="FFFFFF" size={20} />Подтвердить «Проверено Мама Про»</button>
        <button className="ad-secondary" disabled={note.trim().length < 3 || action.busy} onClick={() => decide('docs')}>Запросить документы</button>
        <button className="ad-danger" disabled={note.trim().length < 3 || action.busy} onClick={() => decide('rejected')}>Отклонить</button>
      </div>
      {action.busy && <p className="ad-muted ad-hint-line" role="status">Сохраняем решение…</p>}
      {!canApprove && !action.busy && <p className="ad-muted ad-hint-line">{!hasDiploma ? 'Подтвердить нельзя: нет диплома.' : 'Чтобы подтвердить, отметьте все документы как проверенные.'}</p>}
    </>}
    {action.error && <Banner>{action.error}</Banner>}
  </section>;
}

// ---- news and events (shown on the parent's home screen) -----------------------------------------------------
const blankNews = (): NewsDraft => ({ kind: 'news', audience: 'all', title: '', body: '', link: null, event_date: null, pinned: false, status: 'draft' });
function News({ admin }: { admin: Console }) {
  const [filter, setFilter] = useState<NewsStatus | 'all'>('all');
  const [editing, setEditing] = useState<string | 'new'>('new');
  const list = admin.data.news.filter(item => filter === 'all' || item.status === filter);
  const current = editing === 'new' ? undefined : admin.data.news.find(item => item.id === editing);
  return <>
    <Filters value={filter} onChange={setFilter} options={[['all', 'Все'], ['published', 'Опубликованы'], ['draft', 'Черновики'], ['archived', 'Архив']]} />
    <div className="ad-split">
      <ul className="ad-list"><li><button onClick={() => setEditing('new')} aria-current={editing === 'new'}><span className="ad-avatar">+</span><span className="ad-grow"><strong>Новая запись</strong><small>Новость, событие, льгота, скидка или курс</small></span></button></li>
        {list.length === 0 && <li className="ad-empty">В этом разделе записей нет.</li>}
        {list.map(item => <li key={item.id}><button aria-current={editing === item.id} onClick={() => setEditing(item.id)}>
          <span className="ad-avatar">{NEWS_KINDS[item.kind][0]}</span><span className="ad-grow"><strong>{item.title}</strong><small>{NEWS_KINDS[item.kind]} · {NEWS_AUDIENCES[item.audience]}{item.pinned ? ' · закреплено' : ''}</small></span>
          <span className="ad-end"><Badge tone={NEWS_STATUS[item.status].tone}>{NEWS_STATUS[item.status].label}</Badge><small className="ad-muted">{waiting(item.created_at)}</small></span></button></li>)}</ul>
      <NewsEditor key={current?.id ?? 'new'} item={current} admin={admin} onCreated={id => setEditing(id)} />
    </div>
  </>;
}

function NewsEditor({ item, admin, onCreated }: { item?: AdminNews; admin: Console; onCreated: (id: string) => void }) {
  const [draft, setDraft] = useState<NewsDraft>(item ? { kind: item.kind, audience: item.audience, title: item.title, body: item.body, link: item.link, event_date: item.event_date, pinned: item.pinned, status: item.status } : blankNews());
  const action = useAction();
  const set = <K extends keyof NewsDraft>(key: K, value: NewsDraft[K]) => setDraft(previous => ({ ...previous, [key]: value }));
  const save = (status: NewsStatus) => void action.run(async () => {
    const body: NewsDraft = { ...draft, status, link: draft.link?.trim() || null, event_date: draft.event_date || null };
    if (item) return admin.decide(() => admin.backend.updateNews(item.id, body), 'news');
    let createdId: string | null = null;
    const message = await admin.decide(async () => { const created = await admin.backend.createNews(body); createdId = created.id; return created; }, 'news', true);
    if (message === null && createdId) onCreated(createdId);
    return message;
  });
  const titleOk = draft.title.trim().length >= 3, textOk = draft.body.trim().length >= 10;
  const id = item?.id ?? 'new';
  return <section className="ad-panel ad-detail" aria-label={item ? `Запись: ${item.title}` : 'Новая запись'}>
    <header className="ad-detail-head"><div className="ad-grow"><h2>{item ? 'Редактирование' : 'Новая запись'}</h2><p>{item ? `Создано ${waiting(item.created_at)}` : 'Появится на главном экране родителей после публикации'}</p></div>{item && <Badge tone={NEWS_STATUS[item.status].tone}>{NEWS_STATUS[item.status].label}</Badge>}</header>
    <label className="ad-field" htmlFor={`nk-${id}`}>Вид</label>
    <select id={`nk-${id}`} value={draft.kind} onChange={event => set('kind', event.target.value as NewsKind)}>{(Object.keys(NEWS_KINDS) as NewsKind[]).map(key => <option key={key} value={key}>{NEWS_KINDS[key]}</option>)}</select>
    <label className="ad-field" htmlFor={`na-${id}`}>Для кого</label>
    <select id={`na-${id}`} value={draft.audience} onChange={event => set('audience', event.target.value as NewsAudience)}>{(Object.keys(NEWS_AUDIENCES) as NewsAudience[]).map(key => <option key={key} value={key}>{NEWS_AUDIENCES[key]}</option>)}</select>
    <label className="ad-field" htmlFor={`nt-${id}`}>Заголовок <small>(от 3 символов)</small></label>
    <input id={`nt-${id}`} maxLength={120} value={draft.title} onChange={event => set('title', event.target.value)} />
    <label className="ad-field" htmlFor={`nb-${id}`}>Текст <small>(для публикации от 10 символов)</small></label>
    <textarea id={`nb-${id}`} rows={5} maxLength={1200} value={draft.body} onChange={event => set('body', event.target.value)} placeholder="Что, где и когда. Без обещаний лечения и личных контактов" />
    <label className="ad-field" htmlFor={`nl-${id}`}>Ссылка <small>(необязательно, https://…)</small></label>
    <input id={`nl-${id}`} inputMode="url" maxLength={400} value={draft.link ?? ''} onChange={event => set('link', event.target.value)} />
    <label className="ad-field" htmlFor={`nd-${id}`}>Дата события <small>(после неё запись скроется само)</small></label>
    <input id={`nd-${id}`} type="date" value={draft.event_date ?? ''} onChange={event => set('event_date', event.target.value || null)} />
    <label className="ad-docs"><input type="checkbox" checked={draft.pinned} onChange={event => set('pinned', event.target.checked)} />Закрепить вверху списка</label>
    <div className="ad-actions">
      <button className="ad-primary" disabled={!titleOk || !textOk || action.busy} onClick={() => save('published')}>{item?.status === 'published' ? 'Сохранить изменения' : 'Опубликовать'}</button>
      <button className="ad-secondary" disabled={!titleOk || action.busy} onClick={() => save('draft')}>{item?.status === 'published' ? 'Снять с публикации' : 'Сохранить черновик'}</button>
      {item && item.status !== 'archived' && <button className="ad-secondary" disabled={action.busy} onClick={() => save('archived')}>В архив</button>}
    </div>
    {action.busy && <p className="ad-muted ad-hint-line" role="status">Сохраняем…</p>}
    {!textOk && titleOk && !action.busy && <p className="ad-muted ad-hint-line">Чтобы опубликовать, добавьте текст.</p>}
    {action.error && <Banner>{action.error}</Banner>}
  </section>;
}

// ---- complaints -------------------------------------------------------------------------------------------
function Complaints({ admin, selected, select }: { admin: Console; selected?: string; select: (id: string) => void }) {
  const [filter, setFilter] = useState<ReportStatus | 'all'>('all');
  const list = admin.data.reports.filter(item => filter === 'all' || item.status === filter);
  const current = admin.data.reports.find(item => item.id === selected) ?? list[0];
  return <>
    <Filters value={filter} onChange={setFilter} options={[['all', 'Все'], ['open', 'Открытые'], ['work', 'В работе'], ['closed', 'Закрытые']]} />
    <div className="ad-split">
      <ul className="ad-list">{list.length === 0 && <li className="ad-empty">Жалоб в этом статусе нет.</li>}{list.map(item => <li key={item.id}><button aria-current={current?.id === item.id} onClick={() => select(item.id)}>
        <span className="ad-avatar">{initials(item.specialist)}</span><span className="ad-grow"><strong>{item.specialist}</strong><small>{item.category}{item.role ? ` · ${item.role}` : ''}</small></span>
        <span className="ad-end"><Badge tone={REPORT_STATUS[item.status].tone}>{REPORT_STATUS[item.status].label}</Badge><small className="ad-muted">{waiting(item.created_at)}</small></span></button></li>)}</ul>
      {current ? <ComplaintDetail key={current.id} item={current} admin={admin} /> : <section className="ad-panel ad-empty">Выберите жалобу слева.</section>}
    </div>
  </>;
}

function ComplaintDetail({ item, admin }: { item: AdminReport; admin: Console }) {
  const [note, setNote] = useState(item.note);
  const action = useAction();
  const decide = (status: ReportStatus) => void action.run(() => admin.decide(() => admin.backend.decideReport(item.id, { status, note: note.trim() }), 'reports'));
  return <section className="ad-panel ad-detail" aria-label={`Жалоба: ${item.specialist}`}>
    <header className="ad-detail-head"><span className="ad-avatar ad-avatar-lg">{initials(item.specialist)}</span><div className="ad-grow"><h2>{item.specialist}</h2><p>{item.role || 'Специальность не указана'} · {waiting(item.created_at)}</p></div><Badge tone={REPORT_STATUS[item.status].tone}>{REPORT_STATUS[item.status].label}</Badge></header>
    <dl className="ad-facts"><div><dt>Тема</dt><dd>{item.category}</dd></div><div><dt>Профиль специалиста</dt><dd>{item.specialist_id ? <ProfileLink id={item.specialist_id} label="Открыть в каталоге" /> : 'Не указан'}</dd></div></dl>
    <blockquote className="ad-quote">{item.text}</blockquote>
    <p className="ad-muted ad-hint-line">Обращение анонимное: имя родителя модераторам не передаётся.</p>
    <label className="ad-field" htmlFor={`cnote-${item.id}`}>Заметка модератора</label>
    <textarea id={`cnote-${item.id}`} rows={3} maxLength={500} value={note} onChange={event => setNote(event.target.value)} placeholder="Что сделали, с кем связались" />
    <div className="ad-actions">
      {item.status !== 'work' && <button className="ad-secondary" disabled={action.busy} onClick={() => decide('work')}>Взять в работу</button>}
      {item.status !== 'closed' && <button className="ad-primary" disabled={note.trim().length < 3 || action.busy} onClick={() => decide('closed')}>Закрыть жалобу</button>}
      {item.status === 'closed' && <button className="ad-secondary" disabled={action.busy} onClick={() => decide('open')}>Открыть снова</button>}
    </div>
    {action.busy && <p className="ad-muted ad-hint-line" role="status">Сохраняем…</p>}
    {item.status !== 'closed' && note.trim().length < 3 && !action.busy && <p className="ad-muted ad-hint-line">Чтобы закрыть жалобу, добавьте заметку о результате.</p>}
    {action.error && <Banner>{action.error}</Banner>}
  </section>;
}

// ---- reviews ----------------------------------------------------------------------------------------------
function Reviews({ admin }: { admin: Console }) {
  const [filter, setFilter] = useState<ReviewStatus | 'all'>('pending');
  const list = admin.data.reviews.filter(item => filter === 'all' || item.status === filter);
  return <>
    <Filters value={filter} onChange={setFilter} options={[['pending', 'На модерации'], ['published', 'Опубликованы'], ['hidden', 'Скрыты'], ['all', 'Все']]} />
    <div className="ad-cards">{list.length === 0 && <section className="ad-panel ad-empty">Отзывов в этом статусе нет.</section>}{list.map(item => <ReviewCard key={item.id} item={item} admin={admin} />)}</div>
  </>;
}

function ReviewCard({ item, admin }: { item: AdminReview; admin: Console }) {
  const action = useAction();
  const decide = (status: ReviewStatus) => void action.run(() => admin.decide(() => admin.backend.decideReview(item.id, { status }), 'reviews'));
  return <article className="ad-panel ad-review">
    <header className="ad-detail-head"><div className="ad-grow"><h2>{item.specialist}</h2><p>{waiting(item.created_at)} <ProfileLink id={item.specialist_id} label="Открыть профиль" /></p></div><Badge tone={REVIEW_STATUS[item.status].tone}>{REVIEW_STATUS[item.status].label}</Badge></header>
    <p className="ad-stars" aria-label={`Оценка ${item.rating} из 5`}>{Array.from({ length: item.rating }, (_, i) => <Icon key={i} name="star" size={18} color="E5A84B" />)}<span className="ad-muted">{item.rating} из 5</span><Badge tone={item.suitable ? 'ad-tone-ok' : 'ad-tone-bad'}>{item.suitable ? 'Подошёл' : 'Не подошёл'}</Badge></p>
    <blockquote className="ad-quote">{item.text}</blockquote>
    <Hints items={item.hints} />
    <div className="ad-actions">
      {item.status !== 'published' && <button className="ad-primary" disabled={item.hints.length > 0 || action.busy} onClick={() => decide('published')}>Опубликовать</button>}
      {item.status !== 'hidden' && <button className="ad-danger" disabled={action.busy} onClick={() => decide('hidden')}>Скрыть</button>}
    </div>
    {item.hints.length > 0 && item.status !== 'published' && <p className="ad-muted ad-hint-line">Публикация закрыта, пока в тексте есть замечания. Скройте отзыв или попросите автора исправить.</p>}
    {action.busy && <p className="ad-muted ad-hint-line" role="status">Сохраняем…</p>}
    {action.error && <Banner>{action.error}</Banner>}
  </article>;
}

// ---- shell ------------------------------------------------------------------------------------------------
function ConsoleView({ session, onExit, onLocal, onReset }: { session: Session; onExit: () => void; onLocal: () => void; onReset: () => void }) {
  const backend: AdminBackend = useMemo(() => session.mode === 'remote' ? remoteBackend(session.code) : localBackend(), [session]);
  const { data, reload, decide } = useAdminData(backend, onExit);
  const admin: Console = { data, reload, decide, backend };
  const [tab, setTab] = useState<Tab>('summary');
  const [selected, setSelected] = useState<Record<string, string | undefined>>({});
  const go = (next: Tab, id?: string) => { setTab(next); if (id) setSelected(previous => ({ ...previous, [next]: id })); };
  const counts: Record<Tab, number> = { summary: 0, apps: data.summary?.new_applications ?? 0, complaints: data.summary?.open_reports ?? 0, reviews: data.summary?.pending_reviews ?? 0, news: 0 };
  const nav: [Tab, string, string][] = [['summary', 'Сводка', 'home'], ['apps', 'Заявки специалистов', 'diploma'], ['complaints', 'Жалобы родителей', 'shield'], ['reviews', 'Отзывы', 'chat'], ['news', 'Новости и события', 'calendar']];
  const title = nav.find(([key]) => key === tab)?.[1] ?? '';
  const local = session.mode === 'local';
  const retry = <button className="ad-secondary" onClick={reload} disabled={data.loading}>{data.loading ? 'Загружаем…' : 'Повторить'}</button>;
  return <div className="ad-shell">
    <aside className="ad-side"><img src="/mascot/m-logo.png" alt="DEMEU" className="ad-logo" />
      <nav aria-label="Разделы">{nav.map(([key, label, icon]) => <button key={key} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}>
        <Icon name={icon} size={22} /><span className="ad-grow">{label}</span>{counts[key] > 0 && <span className="ad-count" aria-label={`Ждут решения: ${counts[key]}`}>{counts[key]}</span>}</button>)}</nav>
      <div className="ad-side-foot"><small>Мама Про · модератор</small><button className="ad-link" onClick={onExit}>Выйти</button>
        {local && <button className="ad-link" onClick={() => { resetLocalDemo(); onReset(); }}>Сбросить демо-данные</button>}</div>
    </aside>
    <main className="ad-main"><header className="ad-top"><h1>{title}</h1>
      <span className="ad-sync"><Badge tone={local ? 'ad-tone-wait' : 'ad-tone-ok'}>{local ? 'Офлайн-демо: данные только в этом браузере' : 'Онлайн: данные с сервера'}</Badge>
        {data.updatedAt && <small className="ad-muted">Обновлено в {time(data.updatedAt)}</small>}
        {!local && <button className="ad-link" onClick={reload} disabled={data.loading}>Обновить</button>}</span></header>
      {data.error && data.loaded && <Banner action={retry}>Не удалось обновить данные: {data.error.message}. Показаны последние загруженные.</Banner>}
      {!data.loaded && data.loading && <div className="ad-skeleton" role="status" aria-label="Загружаем данные"><span /><span /><span /></div>}
      {!data.loaded && data.error && <section className="ad-panel ad-failure" role="alert"><h2>Не удалось загрузить данные</h2><p>{data.error.message}</p>
        <div className="ad-actions">{retry}{!local && <button className="ad-secondary" onClick={onLocal}>Открыть офлайн-демо</button>}</div></section>}
      {data.loaded && <>
        {tab === 'summary' && <Summary admin={admin} go={go} />}
        {tab === 'apps' && <Applications admin={admin} selected={selected.apps} select={id => go('apps', id)} />}
        {tab === 'complaints' && <Complaints admin={admin} selected={selected.complaints} select={id => go('complaints', id)} />}
        {tab === 'reviews' && <Reviews admin={admin} />}
        {tab === 'news' && <News admin={admin} />}
      </>}
    </main>
  </div>;
}

export default function Admin() {
  const [session, setSession] = useState<Session | null>(readSession);
  const [epoch, setEpoch] = useState(0);
  const change = (next: Session | null) => { writeSession(next); setSession(next); setEpoch(value => value + 1); };
  if (!session) return <Login onOk={change} />;
  return <ConsoleView key={`${session.mode}${epoch}`} session={session} onExit={() => change(null)} onLocal={() => change({ mode: 'local', code: '' })} onReset={() => setEpoch(value => value + 1)} />;
}
