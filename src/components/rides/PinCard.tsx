import { useT } from '../../i18n';
import { timelineIndex } from '../../lib/ridesRules';
import type { RideView } from '../../lib/ridesTypes';
import './rides-track.css';

export function PinCard({ ride }: { ride: RideView }) {
  const { t } = useT();
  const boarded = timelineIndex(ride.status) >= timelineIndex('child_in_car');
  return <section className={`rd-track-pin${boarded ? ' is-confirmed' : ''}`} aria-label={t('ridesTrack.trackBoarding')}>
    {boarded ? <p>{t('ridesTrack.trackBoarded')}</p> : <>
      <p>{t('ridesTrack.trackPinHint')}</p>
      {ride.pin && <div className="rd-track-pin-digits" aria-label={`${t('ridesTrack.trackPin')}: ${ride.pin}`}>
        {Array.from(ride.pin).map((digit, index) => <span key={index} aria-hidden="true">{digit}</span>)}
      </div>}
    </>}
  </section>;
}
