import { useLocation } from 'react-router-dom';
import { ScreenHeader } from '../../components/ScreenHeader';
import { InvataxiBlock } from '../../components/rides/InvataxiBlock';
import { NewRideForm } from '../../components/rides/NewRideForm';
import { useT } from '../../i18n';
import { useSpecialist } from '../../lib/hooks';
import { useAppState } from '../../state/AppState';
import '../../components/rides/rides-new.css';

export default function NewRide() {
  const { t } = useT();
  const { card, bookings } = useAppState();
  const location = useLocation();
  const latest = bookings.reduce<(typeof bookings)[number] | undefined>((last, booking) =>
    !last || Date.parse(booking.created_at) >= Date.parse(last.created_at) ? booking : last, undefined);
  const { data: specialist } = useSpecialist(latest?.specialist_id);
  const state: unknown = location.state;
  const toAddress = state && typeof state === 'object' && 'to_address' in state && typeof state.to_address === 'string'
    ? state.to_address : undefined;

  return <section className="rd-new-page">
    <ScreenHeader title={t('ridesNew.title')} />
    <div className="rd-new-content">
      <InvataxiBlock card={card} />
      <NewRideForm card={card} toAddress={toAddress} specialist={specialist} />
    </div>
  </section>;
}
