import { Link, Navigate, useParams } from 'react-router-dom';
import { useT } from '../../i18n';
import { errorText, getDriverId } from '../../lib/rides';
import { RIDE_FLOW } from '../../lib/ridesTypes';
import { useDriver, useDriverRide } from '../../state/rides';
import { Toast } from '../../components/Toast';
import { ActiveRideDetails, ActiveRidePage, ActiveRideRoute, useActiveRideNotice } from '../../components/rides/driver/ActiveRideDetails';
import { ActiveRideControls } from '../../components/rides/driver/ActiveRideControls';
import { DriverDone } from '../../components/rides/driver/DriverDone';

export default function DriverRide() {
  const { id } = useParams();
  const { t } = useT();
  const driverId = getDriverId();
  const driver = useDriver();
  const state = useDriverRide(id);
  const { notice, notify } = useActiveRideNotice();
  if (!driverId) return <Navigate to="/driver" replace />;
  const ride = state.data;
  const mine = ride?.driver_id === driverId;
  const pending = ride?.status === 'searching' && ride.offers.some(offer => offer.driver_id === driverId && offer.status === 'pending');
  return <ActiveRidePage title={t(ride?.status === 'completed' && mine ? 'driver.doneTitle' : 'driver.activeTitle')}>
    {(state.offline || driver.offline) && <p className="dr-feed-banner" role="status">{t('rides.offline')}</p>}
    {state.error ? <div className="dr-feed-card" role="alert"><p>{errorText(t, state.error)}</p><button className="dr-feed-secondary" onClick={state.refresh}>{t('rides.button.retry')}</button></div> : !ride ? <p role="status">{t('rides.loading')}</p> : <>
      <section className="dr-feed-card"><p className="dr-feed-ride-status" role="status">{pending ? t('driver.activeWaiting') : mine && ride.status === 'accepted' ? t('driver.activeChosen') : t(`rides.status.driver.${ride.status}`)}</p><ActiveRideRoute ride={ride} /></section>
      {mine && ride.status === 'completed' ? <DriverDone key={ride.id} ride={ride} driverId={driverId} /> : mine && RIDE_FLOW.includes(ride.status) ? <>
        <ActiveRideDetails ride={ride} large />
        <ActiveRideControls key={`${ride.id}:${ride.status}`} ride={ride} driverId={driverId} refresh={state.refresh} notify={notify} offline={state.offline} />
      </> : <>{!pending && <p className="dr-feed-banner">{t(ride.status === 'cancelled' ? 'driver.activeCancelled' : 'driver.activeUnavailable')}</p>}<Link className="dr-feed-primary" to="/driver/feed">{t('driver.doneToFeed')}</Link></>}
    </>}
    <Toast message={notice?.text ?? null} />
  </ActiveRidePage>;
}
