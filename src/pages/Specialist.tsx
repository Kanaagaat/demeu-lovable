import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { ScreenHeader } from '../components/ScreenHeader';
import { useToast } from '../components/Toast';
import { Avatar, Empty, Loading, MatchBadge, Section, Sheet, useCompareAction, useSpecText, Verified } from '../components/specs/ui';
import { useMatch, useSpecialist } from '../lib/hooks';
import { sendReport } from '../lib/api';
import { useAppState } from '../state/AppState';
import { formatDate } from '../lib/dates';

export default function Specialist() {
  const { id } = useParams();
  const numericId = Number(id);
  const validId = Number.isInteger(numericId) && numericId > 0;
  const { card, compare } = useAppState();
  const resource = useSpecialist(validId ? numericId : null, card?.district);
  const matching = useMatch(card);
  const { text, label, money, minutes, reviews, years, childDative, language } = useSpecText();
  const navigate = useNavigate();
  const toast = useToast();
  const onCompare = useCompareAction();
  const [method, setMethod] = useState<string | null>(null);
  const [allReviews, setAllReviews] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [reportText, setReportText] = useState('');
  const [sending, setSending] = useState(false);
  const closeReport = useCallback(() => setReportOpen(false), []);
  const sp = resource.data;
  if (resource.loading) return <div className="sp-page"><Loading /></div>;
  if (!validId || !sp || resource.error) return <><ScreenHeader title={text('profile')} /><Empty error title={text('notFound')} action={text('toList')} to="/specialists" /></>;
  const match = matching.data?.items.find(item => item.id === sp.id);
  const shownReviews = allReviews ? sp.reviews : sp.reviews.slice(0, 2);
  const slots = sp.slots.flatMap(day => day.times.map(time => ({ date: day.date, label: `${label(day.label.split(' ')[0])} ${day.label.split(' ')[1]} · ${time}`, time }))).slice(0, 4);
  const submitReport = async () => {
    if (!category || !reportText.trim() || sending) return;
    setSending(true);
    try {
      await sendReport({ specialist_id: sp.id, category, text: reportText.trim() });
      setReportOpen(false); setCategory(''); setReportText('');
      toast(text('reportThanks'));
    } catch { toast(text('reportError')); }
    finally { setSending(false); }
  };
  return <><div className="sp-profile">
    <header className="relative flex h-[60px] items-center justify-between px-5"><button className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-back" aria-label={text('back')} onClick={() => navigate(-1)}><Icon name="back" size={22} /></button><button className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-back" aria-label={text('compare')} aria-pressed={compare.includes(sp.id)} onClick={() => onCompare(sp.id)}><Icon name={compare.includes(sp.id) ? 'checkmark' : 'compare'} size={22} color="6755B2" /></button></header>
    <div className="sp-profile-content">
      <div className="sp-profile-hero"><Avatar initials={sp.initials} tint={sp.tint} size={96} /><h1 className="text-2xl font-black leading-[30px]">{sp.name}</h1><p className="text-[15px] leading-[22px] text-muted">{label(sp.role)} · {sp.exp_years} {years(sp.exp_years)}</p><div className="sp-rating !mt-0 !text-[15px]"><Icon name="star" color="E5A84B" size={18} />{String(sp.rating).replace('.', ',')}<span className="font-semibold text-muted">· {reviews(sp.reviews_count)}</span></div><div className="sp-badges justify-center">{match?.match && <MatchBadge childName={card?.name || undefined} />}{sp.verified && <Verified />}</div></div>
      {card && sp.kind === 'child' && match && match.reasons.length > 0 && <section className="sp-reasons"><h2 className="text-lg font-black leading-6">{text('whyMatches')} {childDative(card.name)}</h2>{match.reasons.map(reason => <div className="flex gap-2.5" key={reason}><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage"><Icon name="checkmark" color="FFFFFF" size={14} /></span>{label(reason)}</div>)}</section>}
      <p className="text-[15px] leading-[22px] text-muted">{label(sp.bio)}</p>
      <Section title={text(sp.kind === 'parent' ? 'worksWithParents' : 'worksWith')}><div className="flex flex-wrap gap-2">{sp.works_with.map(item => <span className="rounded-full border-[1.5px] border-line-strong bg-white px-3.5 py-2 text-sm font-bold" key={item}>{label(item)}</span>)}</div></Section>
      <Section title={text('methods')}><div className="rounded-[20px] bg-white px-4 shadow-card">{sp.methods.map(item => <div key={item.name} className="border-b border-line-soft last:border-0"><button className="flex min-h-[52px] w-full items-center gap-2 text-left text-base font-bold" aria-expanded={method === item.name} onClick={() => setMethod(method === item.name ? null : item.name)}><span className="flex-1">{label(item.name)}</span><Icon name={method === item.name ? 'collapse-arrow' : 'expand-arrow'} color="6E6880" size={18} /></button>{method === item.name && <p className="pb-3.5 text-[15px] leading-[22px] text-muted">{label(item.desc)}</p>}</div>)}</div></Section>
      <Section title={text('education')}><div className="flex flex-col gap-2">{sp.education.map(item => <div className="flex items-center gap-3 rounded-[18px] bg-white px-3.5 py-3 text-[15px] font-semibold leading-[21px] shadow-card" key={item}><Icon name="diploma" size={24} /><span>{label(item)}</span></div>)}{sp.verified && <div className="flex items-center gap-1.5 text-[13px] font-extrabold text-brand"><Icon name="shield" size={16} />{text('documentsVerified')}</div>}</div></Section>
      <Section title={text('achievements')}><div className="flex flex-col gap-2">{['achievementProgram', 'achievementConsultations'].map(key => <div className="flex items-start gap-3 text-[15px] leading-[22px]" key={key}><Icon name="prize" size={22} />{text(key)}</div>)}</div></Section>
      <Section title={text('costFormat')}><div className="grid grid-cols-2 gap-2">{[[text('session'), money(sp.price)], [text('duration'), text('durationValue')], [text('format'), sp.formats.map(label).join(' · ')], [text('sessions'), text(sp.group ? 'individualAndGroup' : 'individual')]].map(([title, value]) => <div key={title} className="rounded-[18px] bg-cream px-3.5 py-3"><div className="text-[13px] font-bold text-muted">{title}</div><div className="text-[15px] font-extrabold first:text-lg">{value}</div></div>)}</div>{sp.quota && <p className="mt-2 text-sm text-muted">{text('quotaNote')}</p>}</Section>
      <Section title={text('schedule')}><div className="mb-3 grid grid-cols-7 gap-1.5">{sp.slots.map(day => <div className={`flex h-10 items-center justify-center rounded-xl text-sm font-extrabold ${day.times.length ? 'bg-mist text-brand' : 'bg-surface text-disabled'}`} key={day.date}>{label(day.label.split(' ')[0])}</div>)}</div><h3 className="mb-2 text-sm font-bold text-muted">{text('nextSlots')}</h3><div className="flex flex-wrap gap-2">{slots.length ? slots.map(slot => <Link className="sp-chip !border-lilac !text-brand" key={`${slot.date}-${slot.time}`} to={`/book/${sp.id}?date=${slot.date}&time=${slot.time}`}>{slot.label}</Link>) : <Link to={`/book/${sp.id}`} className="sp-secondary">{text('arrangeTime')}</Link>}</div></Section>
      <Section title={text('location')}><div className="overflow-hidden rounded-[20px] bg-white shadow-card"><div className="sp-map !h-[120px]" style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent 0 34px,#FFF 34px 39px),repeating-linear-gradient(90deg,transparent 0 46px,#FFF 46px 51px)' }}><div className="absolute left-[58%] top-[40%] flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-white bg-brand"><Icon name="marker" color="FFFFFF" size={18} /></div>{card && <div className="absolute left-[24%] top-[55%] h-7 w-7 rounded-full border-[3px] border-white bg-honey" />}</div><div className="px-4 py-3"><p className="font-extrabold">{sp.address}</p><p className="sp-meta">{minutes(sp.travel_minutes)}{sp.travel_minutes !== null && sp.travel_minutes > 0 ? ` ${text('fromHomeCar')}` : ''}</p></div></div></Section>
      <Section title={text('parentReviews')}><div className="mb-2 text-right text-sm font-bold text-muted">{reviews(sp.reviews_count)}</div><div className="flex flex-col gap-2.5">{shownReviews.map(review => <article className="flex flex-col gap-2 rounded-[20px] bg-white px-4 py-3.5 shadow-card" key={review.id}><div className="flex items-center justify-between gap-2"><h3 className="text-[15px] font-extrabold">{review.author}</h3><span className={`rounded-full px-2.5 py-[3px] text-xs font-extrabold ${review.rating >= 4 ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'}`}>{text(review.rating >= 4 ? 'wasSuitable' : 'notSuitable')}</span></div><div className="self-start rounded-lg bg-mist px-2.5 py-[3px] text-[13px] font-bold text-brand">{review.child_context}</div><p className="text-[15px] leading-[22px]">{review.text}</p><div className="text-[13px] text-muted">{review.date ? formatDate(review.date, language, { month: 'long', year: 'numeric' }) : text('demoReview')}</div></article>)}{!sp.reviews.length && <p className="rounded-[20px] bg-mist p-4 text-[15px] text-muted">{text('noReviews')}</p>}{!allReviews && sp.reviews.length > 2 && <button className="sp-secondary !min-h-12 !rounded-[14px] !text-[15px]" onClick={() => setAllReviews(true)}>{text('allReviews')} ({sp.reviews.length})</button>}</div></Section>
      <button className="min-h-11 text-[15px] font-extrabold text-danger" onClick={() => setReportOpen(true)}>{text('report')}</button>
    </div>
  </div><div className="sp-profile-footer"><button className="sp-secondary" aria-pressed={compare.includes(sp.id)} onClick={() => onCompare(sp.id)}>{text(compare.includes(sp.id) ? 'inCompare' : 'compare')}</button><Link className="sp-primary" to={`/book/${sp.id}`}>{text('book')}</Link></div>
    {reportOpen && <Sheet title={text('report')} onClose={closeReport} footer={<button disabled={!category || !reportText.trim() || sending} className="sp-primary w-full" onClick={() => void submitReport()}>{text(sending ? 'sending' : 'sendReport')}</button>}><div className="flex items-center gap-2 rounded-[14px] bg-mist px-3 py-2.5 text-sm leading-5 text-muted"><Icon name="lock" size={18} />{text('reportPrivate')}</div><div className="flex flex-col gap-2" role="radiogroup" aria-label={text('reportCategory')}>{['Грубость', 'Давление на ребёнка', 'Другое'].map(value => <button className="sp-choice" role="radio" aria-checked={category === value} key={value} onClick={() => setCategory(value)}><span className="sp-radio" />{label(value)}</button>)}</div><textarea aria-label={text('reportDescribe')} placeholder={text('reportDescribe')} value={reportText} onChange={e => setReportText(e.target.value)} rows={3} className="w-full resize-none rounded-button border-2 border-line-strong bg-white px-3.5 py-3 text-base leading-[22px] outline-none focus:border-brand" /></Sheet>}
  </>;
}
