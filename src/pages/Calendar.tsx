import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { Header, Page, Primary } from '../components/home/ui';
import { useT } from '../i18n';
import { formatDate } from '../lib/dates';
import { useAppState } from '../state/AppState';
import { TITLE_MAX, monthGrid, monthStats, occurrencesOn, parseYmd, useProgress, ymd } from '../state/progress';
import type { Mark } from '../state/progress';

const field = { width: '100%', height: 48, border: '2px solid #E6E0F5', borderRadius: 14, background: 'white', padding: '0 12px', fontSize: 16, fontWeight: 700 } as const;

export default function Calendar() {
  const { t, language } = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const { bookings } = useAppState();
  const { sessions, marks, addSession, removeSession, mark } = useProgress();
  const today = ymd(new Date());
  const [month, setMonth] = useState(() => parseYmd(today));
  const [selected, setSelected] = useState(today);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('10:00');
  const [repeat, setRepeat] = useState(true);
  const grid = useMemo(() => monthGrid(month), [month]);
  const items = occurrencesOn(selected, sessions, bookings);
  const stats = monthStats(month, today, sessions, bookings, marks);
  const shift = (delta: number) => setMonth(m => new Date(m.getFullYear(), m.getMonth() + delta, 1, 12));
  const monthTitle = formatDate(month, language, { month: 'long', year: 'numeric' }).replace(/\s*г\.$/, '');
  const add = () => {
    if (!title.trim() || !date || !time) return;
    addSession({ title, date, time, repeat });
    setTitle('');
    setSelected(date);
    setMonth(parseYmd(date));
    toast(t('progress.added'));
  };
  const markButton = (key: string, value: Mark) => <button key={value} aria-pressed={marks[key] === value} onClick={() => mark(key, value)}
    style={{ flex: 1, minHeight: 40, borderRadius: 12, border: 0, fontSize: 14, fontWeight: 800, background: marks[key] === value ? (value === 'done' ? '#4F7454' : '#A6593F') : (value === 'done' ? '#EAF2EB' : '#FBE6DA'), color: marks[key] === value ? 'white' : (value === 'done' ? '#4F7454' : '#71442F') }}>
    {t(`progress.${value}`)}</button>;

  return <Page>
    <Header title={t('progress.calendarTitle')} />
    <div className="hm-stack" style={{ padding: '4px 20px 28px' }}>
      <p className="hm-sub" style={{ fontSize: 15, lineHeight: '22px' }}>{t('progress.calendarSub')}</p>

      <div className="hm-card hm-stack" style={{ gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="hm-back" style={{ width: 40, height: 40 }} aria-label={t('progress.prevMonth')} onClick={() => shift(-1)}><Icon name="back" size={18} /></button>
          <strong style={{ flex: 1, textAlign: 'center', fontSize: 17, textTransform: 'capitalize' }} aria-live="polite">{monthTitle}</strong>
          <button className="hm-back" style={{ width: 40, height: 40, transform: 'rotate(180deg)' }} aria-label={t('progress.nextMonth')} onClick={() => shift(1)}><Icon name="back" size={18} /></button>
        </div>
        <div role="grid" aria-label={monthTitle} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {Array.from({ length: 7 }, (_, i) => <span key={`w${i}`} style={{ textAlign: 'center', fontSize: 12, fontWeight: 800, color: '#8A849A' }}>{t(`progress.weekdays.${i}`)}</span>)}
          {grid.map((day, i) => {
            if (!day) return <span key={`e${i}`} />;
            const list = occurrencesOn(day, sessions, bookings);
            const isSelected = day === selected, isToday = day === today;
            const allDone = list.length > 0 && list.every(item => marks[item.key] === 'done');
            return <button key={day} aria-pressed={isSelected} aria-label={`${formatDate(parseYmd(day), language, { day: 'numeric', month: 'long' })}${list.length ? `, ${list.length}` : ''}`} onClick={() => setSelected(day)}
              style={{ height: 44, borderRadius: 12, border: isToday && !isSelected ? '2px solid #CBBFF5' : '2px solid transparent', background: isSelected ? '#6755B2' : list.length ? '#F5F1FF' : 'transparent', color: isSelected ? 'white' : '#2E2A3B', fontSize: 15, fontWeight: 800, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              {Number(day.slice(8))}
              {list.length > 0 && <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 3, background: isSelected ? 'white' : allDone ? '#4F7454' : '#E07A6B' }} />}
            </button>;
          })}
        </div>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#6755B2' }}>{t('progress.monthStats').replace('{done}', String(stats.done)).replace('{planned}', String(stats.planned))}</p>
      </div>

      <h2 style={{ fontSize: 20, lineHeight: '26px', textTransform: 'capitalize' }}>{selected === today ? t('progress.today') : formatDate(parseYmd(selected), language, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
      {items.length === 0 ? <p className="hm-sub" style={{ fontSize: 15 }}>{t('progress.dayEmpty')}</p> : items.map(item => <div key={item.key} className="hm-card hm-stack" style={{ gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="hm-icon-tile"><Icon name={item.kind === 'booking' ? 'conference-call' : 'calendar'} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ display: 'block', fontSize: 16, overflowWrap: 'anywhere' }}>{item.kind === 'booking' ? t('progress.booking') : item.title}</strong>
            <small style={{ color: '#6E6880', fontSize: 14 }}>{item.time}{item.kind === 'session' && sessions.find(s => s.id === item.sessionId)?.repeat ? ` · ${t('progress.weekly')}` : ''}</small>
          </div>
          {item.kind === 'session' ? <button className="hm-text-button" style={{ fontSize: 14, minHeight: 40 }} onClick={() => { removeSession(item.sessionId!); toast(t('progress.removed')); }}>{t('progress.remove')}</button>
            : <button className="hm-text-button" style={{ fontSize: 14, minHeight: 40 }} onClick={() => navigate('/my')}>{t('progress.bookingOpen')}</button>}
        </div>
        {item.date <= today && <div style={{ display: 'flex', gap: 8 }}>{markButton(item.key, 'done')}{markButton(item.key, 'missed')}</div>}
      </div>)}

      <div className="hm-card hm-stack" style={{ gap: 12 }}>
        <h3>{t('progress.addTitle')}</h3>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 700 }}>{t('progress.name')}
          <input style={field} value={title} maxLength={TITLE_MAX} placeholder={t('progress.namePlaceholder')} onChange={e => setTitle(e.target.value)} /></label>
        <div style={{ display: 'flex', gap: 10 }}>
          <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 700 }}>{t('progress.date')}
            <input style={field} type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
          <label style={{ width: 120, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 700 }}>{t('progress.time')}
            <input style={field} type="time" value={time} onChange={e => setTime(e.target.value)} /></label>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700 }}>
          <input type="checkbox" checked={repeat} onChange={e => setRepeat(e.target.checked)} style={{ width: 22, height: 22, flex: 'none', accentColor: '#6755B2' }} />{t('progress.repeat')}</label>
        <Primary style={{ height: 52, minHeight: 52, fontSize: 16 }} disabled={!title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)} onClick={add}>{t('progress.add')}</Primary>
      </div>

      <button className="hm-navigation-card" onClick={() => navigate('/progress')}>
        <span className="hm-icon-tile"><Icon name="prize" /></span>
        <strong style={{ flex: 1 }}>{t('progress.toProgress')}</strong>
      </button>
    </div>
  </Page>;
}
