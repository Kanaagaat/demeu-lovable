import { RIDES_ENABLED } from '../lib/flags';
import { useNavigate } from 'react-router-dom';
import { featureList } from '../state/home';
import { useT } from '../i18n';
import { useAppState } from '../state/AppState';
import { useUnreadCount } from '../state/notifications';
import { useNews, useSpecialist } from '../lib/hooks';
import { usePersonalPlan } from '../lib/personalHooks';
import { SpecialistCard } from '../components/SpecialistCard';
import { Icon } from '../components/Icon';
import { Arrow, Loading, Page, Primary, ResourceError } from '../components/home/ui';
import type { NewsItem } from '../lib/types';
import { ageLabel, optionLabel } from '../components/home/labels';
import { formatDate } from '../lib/dates';
import DEMO_NEWS from '../data/news_demo.json';
export default function Home() {
  const { t, language } = useT();
  const { card, planDone, bookings } = useAppState();
  const navigate = useNavigate();
  const unread = useUnreadCount();
  const plan = usePersonalPlan(card);
  const news = useNews();
  const upcoming = bookings.filter(b => new Date(b.slot).getTime() >= Date.now()).sort((a, b) => Date.parse(a.slot) - Date.parse(b.slot))[0];
  // «Your specialist»: the next booking, otherwise the most recent one. Nobody is guessed for the parent.
  const latest = [...bookings].sort((a, b) => Date.parse(b.slot) - Date.parse(a.slot))[0];
  const mine = upcoming ?? latest;
  const bookedSpecialist = useSpecialist(mine?.specialist_id);
  const steps = plan?.steps ?? [];
  const done = steps.filter(s => planDone.includes(s.id)).length;
  const current = steps.find(s => !planDone.includes(s.id));
  return <Page className="hm-home">
    <div className="hm-home-bg" />
    <header className="hm-home-top">
      <img src="/mascot/m-logo.png" alt="DEMEU" style={{ height: 40, width: 'auto' }} />
      <button className="hm-back" style={{ position: 'relative' }} aria-label={t('screens.notifications')} onClick={() => navigate('/notifications')}>
        <Icon name="appointment-reminders" />
        {unread > 0 && <span style={{ position: 'absolute', top: 4, right: 4, width: 10, height: 10, borderRadius: '50%', background: '#E07A6B', border: '2px solid white' }} />}
      </button>
    </header>

    <div className="hm-home-hello">
      <div>
        <h1>{t('home.hi')}</h1>
        <p>{t('home.hiSub')}</p>
      </div>
      <img src="/mascot/m-peek.png" alt="" />
    </div>

    <div className="hm-stack" style={{ position: 'relative' }}>

      {!card ? <div className="hm-card hm-stack" style={{ borderRadius: 24, padding: 20 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <span className="hm-icon-tile" style={{ width: 56, height: 56, borderRadius: 18 }}>
            <Icon name="user" size={30} />
          </span>
          <div>
            <h3>{t('home.fillT')}</h3>
            <p className="hm-sub" style={{ marginTop: 4, fontSize: 15, lineHeight: '22px' }}>{t('home.fillS')}</p>
          </div>
        </div>
        <Primary style={{ height: 52, minHeight: 52, fontSize: 16 }} onClick={() => navigate('/quiz')}>
          {t('home.fillB')}
          <Arrow white />
        </Primary>
      </div> : <>

        <div className="hm-card hm-stack" style={{ borderRadius: 24, gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, flex: 'none', borderRadius: '50%', background: '#EAF2EB', color: '#4F7454', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900 }}>{card.name?.trim().slice(0, 1).toUpperCase() || <Icon name="user" />}</div>
            <div style={{ flex: 1 }}>
              <h3>{card.name?.trim() || t('home.child')}, {ageLabel(card.age, language, t)}</h3>
              <p style={{ fontSize: 13, lineHeight: '18px', color: '#6E6880' }}>{t('screens.quiz')}</p>
            </div>
            <button className="hm-icon-tile" style={{ width: 48, height: 48, border: 0 }} aria-label={t('home.edit')} onClick={() => navigate('/quiz')}>
              <Icon name="edit" size={22} />
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{[...featureList(card.features).slice(0, 1), card.comm].filter(Boolean).map(v => <span className="hm-chip" key={v}>{optionLabel(v, t)}</span>)}{card.goals[0] && <span className="hm-chip">{t('home.developing')} {optionLabel(card.goals[0], t).toLowerCase()}</span>}</div>
        </div>

        {plan && <button onClick={() => navigate('/plan')} className="hm-stack" style={{ border: 0, textAlign: 'left', background: '#6755B2', color: 'white', borderRadius: 24, padding: 18, gap: 12, boxShadow: '0 8px 24px #6755B238' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#E9E3FF' }}>{t('home.planT')}</span>
            <span style={{ fontSize: 15, fontWeight: 900 }}>{t('home.progress').replace('{done}', String(done)).replace('{total}', String(steps.length))}</span>
          </div>
          <div className="hm-progress" style={{ background: '#FFFFFF40', width: '100%' }}>
            <div style={{ width: `${steps.length ? done / steps.length * 100 : 0}%`, background: '#FFC97A' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
            <span style={{ flex: 1, fontSize: 17, lineHeight: '22px', fontWeight: 800 }}>{current ? `${t('home.now')}: ${language === 'kz' ? current.title_kk : current.title}` : t('home.allDone')}</span>
            <Arrow white />
          </div>
        </button>}

        {upcoming && <button className="hm-navigation-card" style={{ background: '#FFF8F1', padding: '14px 16px', gap: 12, boxShadow: 'none' }} onClick={() => navigate('/my')}>
          <span className="hm-icon-tile" style={{ background: '#F7D6C7' }}>
            <Icon name="calendar" />
          </span>
          <div style={{ flex: 1 }}>
            <small style={{ fontWeight: 700 }}>{t('home.upcoming')}</small>
            <strong style={{ fontSize: 16 }}>{formatDate(upcoming.slot, language, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}{bookedSpecialist.data && ` — ${bookedSpecialist.data.short}`}</strong>
          </div>
          <Arrow />
        </button>}

      </>}

      {!card && <h2 style={{ fontSize: 22, lineHeight: '28px', marginTop: 10 }}>{t('home.next')}</h2>}

      {['/plan', '/specialists', '/support', '/useful'].map((path, i) => card && i < 3 ? null : <button key={path} className="hm-navigation-card" onClick={() => navigate(path)}>
        <span className="hm-icon-tile" style={{ width: 56, height: 56, borderRadius: 18, background: ['#FFF8F1', '#EAF2EB', '#F5F1FF', '#FFF8F1'][i] }}>
          <Icon name={['todo-list', 'conference-call', 'like', 'school'][i]} size={30} />
        </span>
        <div style={{ flex: 1 }}>
          <strong>{t(`home.n${i + 1}`)}</strong>
          <small>{t(`home.n${i + 1}s`)}</small>
        </div>
        <Arrow />
      </button>)}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {(['calendar', 'progress'] as const).map(path => <button key={path} className="hm-navigation-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 10 }} onClick={() => navigate(`/${path}`)}>
          <span className="hm-icon-tile" style={{ background: path === 'calendar' ? '#FFF8F1' : '#EAF2EB' }}><Icon name={path === 'calendar' ? 'calendar' : 'prize'} /></span>
          <div><strong style={{ fontSize: 16 }}>{t(path === 'calendar' ? 'progress.homeCalendar' : 'progress.homeProgress')}</strong><small style={{ fontSize: 13, lineHeight: '18px' }}>{t(path === 'calendar' ? 'progress.homeCalendarSub' : 'progress.homeProgressSub')}</small></div>
        </button>)}
      </div>

      {RIDES_ENABLED && <button className="hm-navigation-card" style={{ minHeight: 56, padding: '10px 14px', boxShadow: 'none', background: '#F5F1FF' }} onClick={() => navigate('/rides/new')}>
        <Icon name="car" size={24} /><strong style={{ flex: 1, fontSize: 16 }}>{t('ridesEntry.home')}</strong><Arrow />
      </button>}

      <h2 style={{ fontSize: 22, lineHeight: '28px', marginTop: 10 }}>{t('home.yourSpecialist')}</h2>
      {!mine ? <div className="hm-card hm-stack" style={{ borderRadius: 22, gap: 10 }}>
        <div><strong style={{ fontSize: 17 }}>{t('home.noSpecialist')}</strong><p className="hm-sub" style={{ marginTop: 4 }}>{t('home.noSpecialistText')}</p></div>
        <Primary className="hm-secondary" style={{ height: 48, minHeight: 48, fontSize: 15 }} onClick={() => navigate('/specialists')}>{t('home.findSpecialist')}</Primary>
      </div> : bookedSpecialist.loading ? <Loading /> : bookedSpecialist.error || !bookedSpecialist.data ? <ResourceError retry={bookedSpecialist.reload} /> : <div className="hm-stack" style={{ gap: 6 }}>
        <small className="hm-sub" style={{ fontWeight: 700 }}>{t(upcoming ? 'home.nextVisit' : 'home.lastVisit')}: {formatDate(mine.slot, language, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</small>
        <SpecialistCard item={bookedSpecialist.data} compact showMatch={false} />
      </div>}

      <h2 style={{ fontSize: 22, lineHeight: '28px', marginTop: 10 }}>{t('home.news')}</h2>
      {news.loading ? <Loading /> : news.error ? <p className="hm-sub">{t('home.newsError')}</p> : !news.data?.items.length ? <p className="hm-sub">{t('home.newsEmpty')}</p> : news.data.items.slice(0, 5).map(item => <NewsCard key={item.id} item={item} />)}

      <button className="hm-navigation-card" style={{ background: '#FFF8F1', marginTop: 4 }} onClick={() => navigate('/sos')}>
        <span className="hm-icon-tile" style={{ background: '#F7D6C7' }}>
          <Icon name="hand" />
        </span>
        <div style={{ flex: 1 }}>
          <strong>{t('screens.sos')}</strong>
          <small>{t('home.sosSub')}</small>
        </div>
        <Arrow />
      </button>

    </div>

  </Page>;
}

const NEWS_TINT: Record<NewsItem['kind'], string> = { news: '#F5F1FF', event: '#FFF1D9', benefit: '#EAF2EB', discount: '#FBE6DA', course: '#ECE6FF' };
function NewsCard({ item }: { item: NewsItem }) {
  const { t, language } = useT();
  const date = item.event_date ? formatDate(`${item.event_date}T12:00:00`, language, { day: 'numeric', month: 'long' }) : null;
  // Demo announcements ship with both languages while untouched; items written or edited by moderators are shown as written.
  const demo = DEMO_NEWS.find(news => news.id === item.id && news.title === item.title && news.body === item.body);
  const title = demo ? t(`home.newsDemo.${item.id}.title`) : item.title;
  const body = demo ? t(`home.newsDemo.${item.id}.body`) : item.body;
  return <article className="hm-card hm-stack" style={{ borderRadius: 20, gap: 8 }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      <span className="hm-chip" style={{ background: NEWS_TINT[item.kind] }}>{t(`home.newsKind.${item.kind}`)}</span>
      {item.audience !== 'all' && <span className="hm-chip">{t(item.audience === 'parents' ? 'home.forParents' : 'home.forChildren')}</span>}
      {date && <span className="hm-chip">{t('home.newsOn').replace('{date}', date)}</span>}
    </div>
    <strong style={{ fontSize: 17, lineHeight: '22px' }}>{title}</strong>
    {body && <p className="hm-sub" style={{ fontSize: 14, lineHeight: '20px' }}>{body}</p>}
    {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ color: '#6755B2', fontWeight: 800, fontSize: 15 }}>{t('home.newsMore')} ↗</a>}
  </article>;
}
