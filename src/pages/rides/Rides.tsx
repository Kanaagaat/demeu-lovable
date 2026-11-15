import { Link } from 'react-router-dom';
import { ScreenHeader } from '../../components/ScreenHeader';
import { RideListItem } from '../../components/rides/RideListItem';
import { useT } from '../../i18n';
import { useMyRides } from '../../state/rides';
import '../../components/rides/rides-list.css';

export default function Rides() {
  const { t } = useT();
  const { data, loading, error, offline, refresh } = useMyRides();
  const rides = data ?? [];
  const history = rides.filter(ride => ride.status === 'completed' || ride.status === 'cancelled');
  const unfinished = rides.filter(ride => ride.status !== 'completed' && ride.status !== 'cancelled');
  // Once the driver leaves, a scheduled ride belongs with the active rides.
  const planned = unfinished.filter(ride => ride.mode === 'scheduled' && (ride.status === 'searching' || ride.status === 'accepted'))
    .sort((a, b) => Date.parse(a.scheduled_at ?? '') - Date.parse(b.scheduled_at ?? ''));
  const active = unfinished.filter(ride => !planned.includes(ride));
  const sections = [['active', active], ['planned', planned], ['history', history]] as const;
  return <div className="rd-list-page">
    <ScreenHeader title={t('ridesEntry.myRides')} />
    <div className="rd-list-content">
      {offline && <p className="rd-list-notice" role="status">{t(data ? 'rides.offline' : 'ridesEntry.offlineEmpty')}</p>}
      {error && <p className="rd-list-notice" role="alert">{t('ridesEntry.loadError')}</p>}
      {(offline || error) && <button className="rd-list-retry" onClick={refresh}>{t('rides.button.retry')}</button>}
      {loading && !data ? <p className="rd-list-muted" role="status">{t('rides.loading')}</p> : data && rides.length === 0 ?
        <div className="rd-list-empty"><img src="/mascot/m-hug.png" alt="" /><h2>{t('ridesEntry.empty')}</h2></div> :
        sections.map(([key, items]) => items.length > 0 && <section className="rd-list-section" key={key} aria-labelledby={`rd-list-${key}`}>
          <h2 id={`rd-list-${key}`}>{t(`ridesEntry.${key}`)}</h2>
          <ul>{items.map(ride => <li key={ride.id}><RideListItem ride={ride} /></li>)}</ul>
        </section>)}
      <Link className="rd-list-primary" to="/rides/new">{t('ridesEntry.newRide')}</Link>
    </div>
  </div>;
}
