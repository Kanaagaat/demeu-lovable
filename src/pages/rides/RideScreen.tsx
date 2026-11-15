import { Link, useParams } from 'react-router-dom';
import { Placeholder } from '../../components/Placeholder';
import { RideDone } from '../../components/rides/RideDone';
import { RideSearch } from '../../components/rides/RideSearch';
import { RideTracking } from '../../components/rides/RideTracking';
import { useT } from '../../i18n';
import { useRide } from '../../state/rides';

function RideMessage({ title, hint }: { title: string; hint: string }) {
  const { t } = useT();
  return <Placeholder title={title} back>
    <p className="mt-2 text-[15px] leading-[22px] text-[#6B6880]">{hint}</p>
    <div className="mt-5 flex flex-col gap-3">
      <Link className="flex h-[52px] items-center justify-center rounded-[18px] bg-[#6755B2] text-[16px] font-extrabold text-white" to="/rides/new">{t('ridesEntry.newRide')}</Link>
      <Link className="flex h-[52px] items-center justify-center rounded-[18px] bg-[#F5F1FF] text-[16px] font-extrabold text-[#6755B2]" to="/rides">{t('rides.toList')}</Link>
    </div>
  </Placeholder>;
}

/** Dispatcher (tech lead): picks the screen by ride status. Polling lives in useRide. */
export default function RideScreen() {
  const { id } = useParams();
  const { t } = useT();
  const { data: ride, loading, offline, refresh } = useRide(id);
  if (!ride) return loading ? <Placeholder title={t('rides.loading')} back /> : <RideMessage title={t('rides.notFound')} hint={t('rides.notFoundHint')} />;
  if (ride.status === 'searching') return <RideSearch ride={ride} offline={offline} refresh={refresh} />;
  if (ride.status === 'completed') return <RideDone ride={ride} />;
  if (ride.status === 'cancelled') return <RideMessage title={t('rides.status.cancelled')} hint={t('rides.cancelledHint')} />;
  return <RideTracking ride={ride} offline={offline} refresh={refresh} />;
}
