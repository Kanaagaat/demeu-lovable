import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../../i18n';
import { formatPrice } from '../../../lib/ridesRules';
import type { RideView } from '../../../lib/ridesTypes';
import { useDriverRides } from '../../../state/rides';
import { ActiveRideRoute, feedDate } from './ActiveRideDetails';
import { errorText } from '../../../lib/rides';

export function DriverDone({ ride, driverId }: { ride: RideView; driverId: string }) {
  const { t, language } = useT();
  const [received, setReceived] = useState(false);
  const history = useDriverRides(driverId);
  // The status endpoint may return before the next list poll. Include this completed ride once.
  const completed = history.data ? [ride, ...history.data.filter(item => item.id !== ride.id)]
    .filter(item => item.driver_id === driverId && item.status === 'completed')
    .sort((a, b) => Date.parse(b.status_changed_at) - Date.parse(a.status_changed_at)) : [];
  const today = new Date().toDateString();
  const todaysRides = completed.filter(item => new Date(item.status_changed_at).toDateString() === today);
  const earned = todaysRides.reduce((sum, item) => sum + (item.final_price ?? item.parent_price), 0);
  return <>
    <section className="dr-feed-card dr-feed-cash"><h2>{t('driver.doneCash').replace('{price}', formatPrice(ride.final_price ?? ride.parent_price))}</h2><button className={received ? 'dr-feed-secondary dr-feed-received' : 'dr-feed-primary'} aria-pressed={received} disabled={received} onClick={() => setReceived(true)}>{t(received ? 'driver.doneConfirmed' : 'driver.doneReceive')}</button></section>
    {history.offline && <p role="status" className="dr-feed-banner">{t('rides.offline')}</p>}
    {history.error && <div className="dr-feed-error" role="alert"><p>{errorText(t, history.error)}</p><button className="dr-feed-secondary" onClick={history.refresh}>{t('rides.button.retry')}</button></div>}
    <section className="dr-feed-card"><h2>{t('driver.doneTodayTitle')}</h2>{history.data ? <p className="dr-feed-earnings">{t('driver.doneToday').replace('{price}', formatPrice(earned)).replace('{count}', String(todaysRides.length)).replace('{trips}', t(`driver.doneTrips_${new Intl.PluralRules(language === 'kz' ? 'kk-KZ' : 'ru-RU').select(todaysRides.length)}`))}</p> : <p role="status">{t('rides.loading')}</p>}</section>
    <section className="dr-feed-history"><h2>{t('driver.doneHistory')}</h2>{completed.slice(0, 10).map(item => <article className="dr-feed-card" key={item.id}><ActiveRideRoute ride={item} /><div className="dr-feed-history-total"><strong>{formatPrice(item.final_price ?? item.parent_price)}</strong><time dateTime={item.status_changed_at}>{feedDate(item.status_changed_at, language)}</time></div></article>)}</section>
    <Link className="dr-feed-primary" to="/driver/feed">{t('driver.doneToFeed')}</Link>
  </>;
}
