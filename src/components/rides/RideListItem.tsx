import { Link } from 'react-router-dom';
import { useT } from '../../i18n';
import type { RideView } from '../../lib/ridesTypes';
import { Icon } from '../Icon';
import './rides-list.css';
import { formatDate } from '../../lib/dates';

export function RideListItem({ ride }: { ride: RideView }) {
  const { t, language } = useT();
  const locale = language === 'kz' ? 'kk-KZ' : 'ru-RU';
  const days = [...new Set(ride.repeat_days)].sort((a, b) => a - b);
  return <Link className="rd-list-item" to={`/rides/${ride.id}`}>
    <div className="rd-list-top"><span className="rd-list-mode">{t(`rides.mode.${ride.mode}`)}</span><strong>{(ride.final_price ?? ride.parent_price).toLocaleString(locale)} ₸</strong></div>
    <div className="rd-list-route"><Icon name="car" size={24} /><span>{ride.from_address || ride.from_district}<span className="rd-list-destination"><span aria-hidden="true">→ </span>{ride.to_address}</span></span></div>
    {ride.mode === 'scheduled' && ride.scheduled_at && <time dateTime={ride.scheduled_at}>{formatDate(ride.scheduled_at, language, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</time>}
    {days.length > 0 && <p className="rd-list-regular">{t('rides.regular')}: {days.map(day => t(`rides.weekday.${day}`)).join(', ')}</p>}
    <p className="rd-list-status">{t(`rides.status.parent.${ride.status}`)}</p>
  </Link>;
}
