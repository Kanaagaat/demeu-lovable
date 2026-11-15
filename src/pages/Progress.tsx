import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { optionLabel } from '../components/home/labels';
import { Header, Page, Primary } from '../components/home/ui';
import { useT } from '../i18n';
import { formatDate } from '../lib/dates';
import { useAppState } from '../state/AppState';
import { GOALS } from '../state/home';
import { LEVELS, WIN_MAX, monthStats, parseYmd, useProgress, ymd } from '../state/progress';
import type { LevelEntry } from '../state/progress';

const COLORS = ['#E07A6B', '#F2A65A', '#FFC97A', '#9DB8A0', '#4F7454'];
/** Readable text colours for the same levels (the bar colours are too light for text on white). */
const TEXT = ['#A6593F', '#8F4F12', '#7A5A00', '#4F7454', '#3F6244'];

function History({ entries, label }: { entries: LevelEntry[]; label: string }) {
  const last = entries.slice(-8);
  return <div role="img" aria-label={label} style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 52 }}>
    {last.map(entry => <span key={entry.date} title={entry.date} style={{ flex: 1, maxWidth: 28, height: `${entry.level * 20}%`, borderRadius: 6, background: COLORS[entry.level - 1] }} />)}
  </div>;
}

export default function Progress() {
  const { t, language } = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const { card, bookings } = useAppState();
  const { sessions, marks, levels, wins, setLevel, addWin, removeWin } = useProgress();
  const [win, setWin] = useState('');
  const today = ymd(new Date());
  const goals = card?.goals.length ? card.goals : GOALS;
  const stats = monthStats(parseYmd(today), today, sessions, bookings, marks);
  const short = (date: string) => formatDate(parseYmd(date), language, { day: 'numeric', month: 'short' });

  return <Page>
    <Header title={t('progress.progressTitle')} />
    <div className="hm-stack" style={{ padding: '4px 20px 28px' }}>
      <p className="hm-sub" style={{ fontSize: 15, lineHeight: '22px' }}>{t('progress.progressSub')}</p>

      <button className="hm-navigation-card" style={{ background: '#6755B2', color: 'white', boxShadow: '0 8px 24px #6755B238' }} onClick={() => navigate('/calendar')}>
        <span className="hm-icon-tile" style={{ background: '#FFFFFF26' }}><Icon name="calendar" color="FFFFFF" /></span>
        <div style={{ flex: 1 }}>
          <small style={{ color: '#E9E3FF', fontWeight: 700 }}>{t('progress.attendance')}</small>
          <strong style={{ color: 'white' }}>{t('progress.attendanceText').replace('{done}', String(stats.done)).replace('{missed}', String(stats.missed)).replace('{planned}', String(stats.planned))}</strong>
        </div>
      </button>

      <div>
        <h2 style={{ fontSize: 20, lineHeight: '26px' }}>{t('progress.goals')}</h2>
        <p className="hm-sub" style={{ fontSize: 14, lineHeight: '20px', marginTop: 4 }}>{t('progress.goalsHint')}</p>
        {!card && <p className="hm-sub" style={{ fontSize: 13, lineHeight: '18px', marginTop: 6 }}>{t('progress.noCard')}</p>}
      </div>

      {goals.map(goal => {
        const entries = levels.filter(e => e.goal === goal);
        const latest = entries[entries.length - 1];
        const todays = entries.find(e => e.date === today);
        const delta = entries.length > 1 ? latest.level - entries[0].level : 0;
        const name = optionLabel(goal, t);
        return <section key={goal} className="hm-card hm-stack" style={{ gap: 10 }} aria-label={name}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
            <h3 style={{ fontSize: 17 }}>{name}</h3>
            <span style={{ fontSize: 13, fontWeight: 800, color: latest ? TEXT[latest.level - 1] : '#8A849A', textAlign: 'right' }}>{latest ? t(`progress.level.${latest.level}`) : t('progress.noLevel')}</span>
          </div>
          {entries.length > 0 && <History entries={entries} label={`${t('progress.history')}: ${entries.slice(-8).map(e => `${short(e.date)} — ${t(`progress.level.${e.level}`)}`).join('; ')}`} />}
          {delta !== 0 && <p style={{ fontSize: 13, fontWeight: 700, color: delta > 0 ? '#4F7454' : '#6E6880' }}>{t('progress.changed').replace('{delta}', `${delta > 0 ? '+' : ''}${delta}`)}</p>}
          <div role="group" aria-label={name} style={{ display: 'flex', gap: 6 }}>
            {LEVELS.map(level => <button key={level} aria-pressed={todays?.level === level} aria-label={t(`progress.level.${level}`)} title={t(`progress.level.${level}`)}
              onClick={() => { setLevel(goal, level, today); toast(t('progress.saved')); }}
              style={{ flex: 1, height: 40, borderRadius: 12, border: `2px solid ${todays?.level === level ? COLORS[level - 1] : '#EEE9F7'}`, background: todays?.level === level ? COLORS[level - 1] : 'white', color: todays?.level === level ? (level === 3 ? '#2E2A3B' : 'white') : '#2E2A3B', fontSize: 15, fontWeight: 900 }}>{level}</button>)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8A849A', fontWeight: 700 }}><span>{t('progress.level.1')}</span><span>{t('progress.level.5')}</span></div>
        </section>;
      })}

      <h2 style={{ fontSize: 20, lineHeight: '26px', marginTop: 4 }}>{t('progress.wins')}</h2>
      <div className="hm-card hm-stack" style={{ gap: 10 }}>
        <p className="hm-sub" style={{ fontSize: 14, lineHeight: '20px' }}>{t('progress.winsHint')}</p>
        <textarea value={win} maxLength={WIN_MAX} rows={2} aria-label={t('progress.wins')} placeholder={t('progress.winPlaceholder')} onChange={e => setWin(e.target.value)}
          style={{ width: '100%', border: '2px solid #E6E0F5', borderRadius: 14, padding: '10px 12px', fontSize: 16, resize: 'none', fontFamily: 'inherit' }} />
        <Primary style={{ height: 48, minHeight: 48, fontSize: 15 }} disabled={!win.trim()} onClick={() => { addWin(win, today); setWin(''); toast(t('progress.winAdded')); }}>{t('progress.addWin')}</Primary>
      </div>
      {wins.length === 0 ? <p className="hm-sub" style={{ fontSize: 14 }}>{t('progress.winsEmpty')}</p> : wins.slice(0, 20).map(item => <div key={item.id} className="hm-card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span className="hm-icon-tile" style={{ background: '#FFF1D9' }}><Icon name="prize" /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <small style={{ color: '#8A849A', fontWeight: 700 }}>{short(item.date)}</small>
          <p style={{ fontSize: 15, lineHeight: '22px', overflowWrap: 'anywhere' }}>{item.text}</p>
        </div>
        <button className="hm-text-button" style={{ fontSize: 13, minHeight: 36 }} onClick={() => removeWin(item.id)}>{t('progress.remove')}</button>
      </div>)}
    </div>
  </Page>;
}
