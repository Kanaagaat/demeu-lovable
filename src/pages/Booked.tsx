import { RIDES_ENABLED } from '../lib/flags';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useT } from '../i18n';
import { useAppState } from '../state/AppState';
import { useSpecialist } from '../lib/hooks';
import { dateText, savePlanValue, useBookingMeta } from '../state/plan';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { Page, Panel, ResourceState } from '../components/plan/ui';

export default function Booked() {
  const { id } = useParams();
  const { state } = useLocation() as { state: { bookingId?: string } | null };
  const { t, language } = useT();
  const { bookings } = useAppState();
  const navigate = useNavigate();
  const toast = useToast();
  const booking = bookings.find(item => item.id === state?.bookingId) ?? [...bookings].reverse().find(item => String(item.specialist_id) === id || item.id === id);
  const result = useSpecialist(booking?.specialist_id ?? null);
  const [meta] = useBookingMeta(booking?.id ?? '');
  return <Page>{booking && result.loading ? <ResourceState loading /> : <><div className="pl-success"><div className="pl-success-circle"><img src="/mascot/m-cheer.png" alt="" /></div><h1 className="!mt-3">{t(booking ? 'plan.booked' : 'plan.myEmpty')}</h1><p className="pl-muted !text-[17px] !leading-[25px]">{booking ? t('plan.bookedText').replace('{name}', result.data?.short ?? t('plan.specialists')) : t('plan.myEmptyText')}</p>{booking && <Panel className="mt-2 flex items-center gap-2 !rounded-2xl !px-4 !py-3 text-[15px] font-extrabold"><Icon name="calendar" size={20} />{meta?.direct ? t('plan.pendingTime') : dateText(booking.slot, language)}</Panel>}</div><div className="pl-footer !border-0">{booking && <button className="pl-primary" onClick={() => { savePlanValue('remDay', true); savePlanValue('rem2h', true); toast(t('plan.remindToast')); navigate('/my'); }}><Icon name="calendar" color="FFFFFF" size={22} />{t('plan.remind')}</button>}{RIDES_ENABLED && booking && result.data && <Link className="pl-secondary" to="/rides/new" state={{ to_address: result.data.address }}>{t('ridesEntry.booked')}</Link>}<Link className="pl-secondary" to="/my">{t('plan.my')}</Link><Link className="pl-text" to="/">{t('plan.toHome')}</Link></div></>}</Page>;
}
