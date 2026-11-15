import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useT } from '../i18n';
import { useAppState } from '../state/AppState';
import { useMatch, useSpecialist, useSpecialists } from '../lib/hooks';
import { sendFeedback, sendReport } from '../lib/api';
import type { FeedbackRequest } from '../lib/types';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { Alternative } from '../components/plan/Alternative';
import { Content, Page, ResourceState, Sheet, SpecSummary } from '../components/plan/ui';

const categories = [{ key: 'rude', value: 'Грубость' }, { key: 'pressure', value: 'Давление на ребёнка' }, { key: 'other', value: 'Другое' }];
export default function Feedback() {
  const { id } = useParams();
  return <FeedbackFlow key={id} id={id && /^\d+$/.test(id) ? Number(id) : null} />;
}
function FeedbackFlow({ id }: { id: number | null }) {
  const { t } = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const { card, bookings } = useAppState();
  const specialist = useSpecialist(id);
  const filters = { kind: specialist.data?.kind ?? 'child', specialty: specialist.data ? [specialist.data.role] : undefined };
  const matching = useMatch(specialist.data?.kind === 'parent' ? null : card, filters);
  const list = useSpecialists(filters);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [comment, setComment] = useState('');
  const [reviewSent, setReviewSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checklistError, setChecklistError] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [reportText, setReportText] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const submitLock = useRef(false);
  const reportLock = useRef(false);
  const done = answers.length === 4;
  const good = answers.filter(Boolean).length >= 3;
  const alternatives = (card && specialist.data?.kind !== 'parent' ? matching.data?.items : list.data?.items)?.filter(item => item.id !== id && item.role === specialist.data?.role).slice(0, 3) ?? [];
  const submit = async (next: boolean[], review?: string) => {
    if (id == null || submitLock.current) return;
    submitLock.current = true;
    setBusy(true);
    setChecklistError(false);
    const booking = [...bookings].reverse().find(item => item.specialist_id === id);
    try {
      await sendFeedback({ specialist_id: id, ...(booking ? { booking_id: booking.id } : {}), answers: next as FeedbackRequest['answers'], ...(review !== undefined ? { comment: review } : {}) });
      if (review !== undefined) { setReviewSent(true); toast(t('plan.reviewToast')); }
    } catch { setChecklistError(true); toast(t('plan.sendError')); }
    finally { submitLock.current = false; setBusy(false); }
  };
  const answer = (value: boolean) => {
    const next = [...answers, value];
    setAnswers(next);
    if (next.length === 4 && next.filter(Boolean).length < 3) void submit(next);
  };
  const report = async () => {
    if (id == null || !category || reportText.trim().length < 3 || reportLock.current) return;
    reportLock.current = true;
    setReportBusy(true);
    try {
      await sendReport({ specialist_id: id, category, text: reportText.trim() });
      setReportOpen(false); setCategory(null); setReportText(''); toast(t('plan.reportSent'));
    } catch { toast(t('plan.sendError')); }
    finally { reportLock.current = false; setReportBusy(false); }
  };
  return <Page title={t('plan.suitable')} onBack={() => answers.length && !done ? setAnswers(answers.slice(0, -1)) : navigate(-1)}>
    {specialist.loading || !specialist.data ? <ResourceState loading={specialist.loading} retry={specialist.reload} /> : <><Content>
      {!done ? <div className="flex flex-col gap-[18px]"><SpecSummary specialist={specialist.data} subtitle={t('plan.after')} /><div className="flex gap-1.5" aria-label={t('plan.question').replace('{n}', String(answers.length + 1))}>{[0, 1, 2, 3].map(index => <span key={index} className="h-1.5 flex-1 rounded" style={{ background: index <= answers.length ? '#6755B2' : '#E6E0F5' }} />)}</div><div><div className="text-sm font-extrabold text-muted">{t('plan.question').replace('{n}', String(answers.length + 1))}</div><h2 className="!mt-1.5">{t(`plan.q${answers.length}`)}</h2></div><div className="pl-answers"><button onClick={() => answer(true)}><span><Icon name="thumb-up" /></span>{t('plan.yes')}</button><button onClick={() => answer(false)}><span><Icon name="thumbs-down" /></span>{t('plan.no')}</button></div></div> : good ? <div className="flex flex-col items-center gap-2.5 text-center"><img src="/mascot/m-thumbs.png" alt="" className="w-[200px]" /><h2>{t(reviewSent ? 'plan.thanks' : 'plan.great')}</h2>{reviewSent ? <div className="flex items-center gap-2 rounded-2xl bg-[#EAF2EB] px-4 py-3 font-extrabold text-[#4F7454]"><Icon name="checkmark" color="4F7454" size={20} />{t('plan.moderation')}</div> : <><p className="pl-muted">{t('plan.reviewInvite')}</p><div className="mt-1.5 flex w-full flex-col gap-2.5"><textarea rows={4} maxLength={2000} aria-label={t('plan.reviewPlaceholder')} placeholder={t('plan.reviewPlaceholder')} value={comment} onChange={event => setComment(event.target.value)} /><button className="pl-primary" disabled={busy || !comment.trim()} onClick={() => void submit(answers, comment.trim())}>{t(busy ? 'plan.sending' : 'plan.publish')}</button><button className="pl-text" onClick={() => navigate('/my')}>{t('plan.later')}</button></div></>}</div> : <div className="flex flex-col gap-3"><h2>{t('plan.findAnother')}</h2><p className="pl-muted">{t('plan.kindText')}</p>{checklistError && <button className="pl-secondary" disabled={busy} onClick={() => void submit(answers)}>{t('plan.retry')}</button>}<h3 className="!mb-0 !text-base">{t('plan.alternatives')}</h3>{matching.loading || list.loading ? <ResourceState loading /> : alternatives.length ? alternatives.map(item => <Alternative key={item.id} item={item} features={card?.features ?? []} />) : <><p className="pl-muted">{t('plan.noAlternatives')}</p><Link to="/specialists" className="pl-secondary">{t('plan.find')}</Link></>}</div>}
    </Content><div className="px-5 pb-[30px] pt-2 text-center"><button className="min-h-11 text-sm font-bold text-[#A6463A] underline" onClick={() => setReportOpen(true)}>{t('plan.reportLink')}</button></div></>}
    {reportOpen && <Sheet title={t('plan.reportTitle')} onClose={() => { if (!reportBusy) setReportOpen(false); }}><div className="flex items-center gap-2 rounded-[14px] bg-[#F5F1FF] px-3 py-2.5 text-sm leading-5 text-muted"><Icon name="shield" size={18} />{t('plan.reportPrivacy')}</div><div role="radiogroup" aria-label={t('plan.reportTitle')} className="flex flex-col gap-2">{categories.map(item => <button key={item.key} role="radio" aria-checked={category === item.value} onClick={() => setCategory(item.value)} className="flex min-h-[52px] items-center gap-3 rounded-2xl border-2 px-4 text-left text-base font-bold" style={{ borderColor: category === item.value ? '#6755B2' : '#EEE9F7', background: category === item.value ? '#F5F1FF' : '#FFFFFF' }}><span className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-2" style={{ borderColor: category === item.value ? '#6755B2' : '#CFC8E0' }}>{category === item.value && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}</span>{t(`plan.${item.key}`)}</button>)}</div><textarea rows={3} maxLength={3000} aria-label={t('plan.reportPlaceholder')} placeholder={t('plan.reportPlaceholder')} value={reportText} onChange={event => setReportText(event.target.value)} /><button className="pl-primary" disabled={reportBusy || !category || reportText.trim().length < 3} onClick={() => void report()}>{t(reportBusy ? 'plan.sending' : 'plan.sendReport')}</button></Sheet>}
  </Page>;
}
