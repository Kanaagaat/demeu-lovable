import { Link } from 'react-router-dom';
import { useT } from '../i18n';
import { useAppState } from '../state/AppState';
import { useSpecialist } from '../lib/hooks';
import type { SavedBooking } from '../lib/types';
import { dateText, getBookingMeta, isBoolean, useBookingMeta, usePlanValue } from '../state/plan';
import { Icon } from '../components/Icon';
import { formatText } from '../components/plan/booking';
import { Content, Empty, Page, Panel, ResourceState, SpecSummary, Toggle } from '../components/plan/ui';
import { formatDate } from '../lib/dates';

function BookingCard({ booking, upcoming = false }: { booking: SavedBooking; upcoming?: boolean }) {
  const { t, language } = useT();
  const { data, loading, reload } = useSpecialist(booking.specialist_id);
  const [meta] = useBookingMeta(booking.id);
  const when = meta?.direct ? t('plan.pendingTime') : dateText(booking.slot, language);
  if (loading || !data) return <ResourceState loading={loading} retry={reload} />;
  if (upcoming) return <div className="flex items-center gap-3.5 rounded-[22px] bg-brand p-4 text-white"><div className="flex h-16 w-[60px] shrink-0 flex-col items-center justify-center rounded-2xl bg-white/15"><span className="text-xs font-bold text-[#E9E3FF]">{formatDate(booking.slot, language, { weekday: 'short', timeZone: 'Asia/Almaty' })}</span><span className="text-2xl font-black">{new Intl.DateTimeFormat('ru-RU', { day: 'numeric', timeZone: 'Asia/Almaty' }).format(new Date(booking.slot))}</span></div><div><div className="text-[17px] font-extrabold">{when}</div><div className="text-sm leading-5 text-[#E9E3FF]">{data.role} {data.short} · {formatText(booking.format, t)}{booking.format === 'Кабинет' && ` · ${data.address}`}</div></div></div>;
  const fallbackUrl = `https://wa.me/?text=${encodeURIComponent(`${t('plan.greeting').replace('{name}', data.name)} ${when} (${formatText(booking.format, t)})`)}`;
  return <Panel className="!p-3.5"><SpecSummary flat specialist={data} subtitle={`${data.role} · ${when} · ${formatText(booking.format, t)}`} /><div className="mt-3 flex flex-col gap-2"><a className="pl-secondary" href={meta?.wa_url ?? fallbackUrl}><Icon name="whatsapp" size={20} />{t('plan.whatsapp')}</a><Link className="pl-secondary" to={`/feedback/${data.id}`}>{t('plan.suitable')}</Link></div></Panel>;
}
export default function My() {
  const { t } = useT();
  const { bookings } = useAppState();
  const [remDay, setRemDay] = usePlanValue('remDay', true, isBoolean);
  const [rem2h, setRem2h] = usePlanValue('rem2h', true, isBoolean);
  const ordered = [...bookings].sort((a, b) => Date.parse(a.slot) - Date.parse(b.slot));
  const upcoming = ordered.filter(item => Date.parse(item.slot) >= Date.now() && !getBookingMeta(item.id)?.direct);
  return <Page title={t('plan.my')}>{!bookings.length ? <Empty mascot="m-laptop" title={t('plan.myEmpty')} text={t('plan.myEmptyText')} action={<Link className="pl-primary" to="/specialists">{t('plan.find')}</Link>} /> : <Content>
    {!!upcoming.length && <div><h3>{t('plan.upcoming')}</h3><div className="flex flex-col gap-2.5">{upcoming.map(booking => <BookingCard booking={booking} key={booking.id} upcoming />)}</div></div>}
    <div><h3>{t('plan.specialists')}</h3><div className="flex flex-col gap-2.5">{ordered.map(booking => <BookingCard booking={booking} key={booking.id} />)}</div></div>
    <div><h3>{t('plan.reminders')}</h3><Panel className="!px-4 !py-1"><div className="pl-reminder"><Icon name="calendar" size={22} /><span>{t('plan.remDay')}</span><Toggle label={t('plan.remDay')} checked={remDay} onChange={() => setRemDay(!remDay)} /></div><div className="pl-reminder"><Icon name="hourglass" size={22} /><span>{t('plan.rem2h')}</span><Toggle label={t('plan.rem2h')} checked={rem2h} onChange={() => setRem2h(!rem2h)} /></div></Panel><p className="pl-muted mt-2 !text-[13px] !leading-[18px]">{t('plan.localReminders')}</p></div>
  </Content>}</Page>;
}
