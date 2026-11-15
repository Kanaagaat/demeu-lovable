import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../../i18n';
import { cancelRide, errorText } from '../../lib/rides';
import { formatPrice, timelineIndex } from '../../lib/ridesRules';
import type { RideScreenProps } from './RideSearch';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { ScreenHeader } from '../ScreenHeader';
import { useToast } from '../Toast';
import { PinCard } from './PinCard';
import { Timeline } from './Timeline';
import './rides-track.css';

export function RideTracking({ ride, offline, refresh }: RideScreenProps) {
  const { t, language } = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const cancelLock = useRef(false), shareLock = useRef(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const { driver } = ride;
  const canCancel = timelineIndex(ride.status) >= 0 && timelineIndex(ride.status) < timelineIndex('in_ride');
  const phone = driver?.phone?.replace(/\D/g, '');
  const share = async () => {
    if (!driver || shareLock.current) return;
    shareLock.current = true;
    const text = t('ridesTrack.trackShareText').replace('{name}', driver.name).replace('{car}', driver.car)
      .replace('{plate}', driver.plate).replace('{from}', ride.from_address || ride.from_district).replace('{to}', ride.to_address);
    try {
      if (navigator.share) {
        try { await navigator.share({ text }); return; }
        catch (error) { if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return; }
      }
      await navigator.clipboard.writeText(text);
      toast(t('ridesTrack.trackCopied'));
    } catch { toast(t('ridesTrack.trackShareError')); }
    finally { shareLock.current = false; }
  };
  const cancel = async () => {
    if (!canCancel || cancelLock.current) return;
    cancelLock.current = true; setBusy(true); setCancelError(null);
    try { await cancelRide(ride.id); navigate('/rides', { replace: true }); }
    catch (error) { setCancelError(errorText(t, error)); refresh(); }
    finally { cancelLock.current = false; setBusy(false); }
  };
  return <section className="rd-track-page">
    <ScreenHeader title={t('ridesTrack.trackTitle')} onBack={() => navigate('/rides')} />
    <div className="rd-track-content">
      {offline && <p className="rd-track-offline" role="status">{t('rides.offline')}</p>}
      <h2 className="rd-track-status" aria-live="polite">{t(ride.status === 'driver_on_way' ? 'ridesTrack.trackOnWay' : `rides.status.${ride.status}`)}</h2>
      <Timeline status={ride.status} />
      <PinCard ride={ride} />
      <section className="rd-track-card rd-track-route" aria-label={t('ridesTrack.trackRoute')}>
        <p>{ride.from_address || ride.from_district}</p><span aria-hidden="true">→</span><p>{ride.to_address}</p>
      </section>
      {driver && <article className="rd-track-card rd-track-driver" aria-label={driver.name}>
        <div className="rd-track-driver-head">
          <span className="rd-track-avatar" aria-hidden="true">{driver.initials}</span>
          <div className="rd-track-driver-info"><h3>{driver.name}</h3><p>{driver.car} · {driver.plate}</p></div>
          <span className="rd-track-rating" aria-label={`${t('ridesTrack.trackRating')}: ${driver.rating.toLocaleString(language === 'kz' ? 'kk-KZ' : 'ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`}><span aria-hidden="true">★ </span>{driver.rating.toFixed(1).replace('.', ',')}</span>
        </div>
        <ul className="rd-track-badges" aria-label={t('ridesTrack.trackDriverDetails')}>
          {driver.trained && <li>{t('rides.badge.trained')}</li>}
          {driver.kit_ok && <li>{t('rides.badge.kit_ok')}</li>}
          {driver.worked_with.some(category => ride.categories.includes(category)) && <li>{t('rides.badge.worked_with')}</li>}
        </ul>
        {ride.final_price !== null && <p className="rd-track-price">{t('ridesTrack.trackCash').replace('{price}', formatPrice(ride.final_price))}</p>}
        {phone && <div className="rd-track-contact">
          <a className="rd-track-link" href={`tel:+${phone}`}><Icon name="conference-call" size={22} />{t('rides.button.call')}</a>
          <a className="rd-track-link" href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size={22} />{t('ridesTrack.trackWhatsapp')}</a>
        </div>}
        <Button variant="secondary" onClick={() => { void share(); }}>{t('ridesTrack.trackShare')}</Button>
      </article>}
      <Button className="rd-track-sos" onClick={() => navigate('/sos')}>{t('ridesTrack.trackSos')}</Button>
      <section className="rd-track-camera" aria-disabled="true" aria-label={t('ridesTrack.trackCamera')}>
        <h3>{t('ridesTrack.trackCamera')}</h3><p>{t('ridesTrack.trackCameraHint')}</p>
      </section>
      {canCancel && (confirmCancel ? <section className="rd-track-card rd-track-confirm" role="group" aria-label={t('ridesTrack.trackCancelTitle')}>
        <h3>{t('ridesTrack.trackCancelTitle')}</h3>
        {cancelError && <p className="rd-track-error" role="alert">{cancelError}</p>}
        <Button variant="secondary" disabled={busy} onClick={() => setConfirmCancel(false)}>{t('ridesTrack.trackKeepRide')}</Button>
        <button type="button" className="rd-track-text" disabled={busy} onClick={() => { void cancel(); }}>{busy ? t('rides.loading') : t('ridesTrack.trackCancelConfirm')}</button>
      </section> : <button type="button" className="rd-track-text" onClick={() => { setCancelError(null); setConfirmCancel(true); }}>{t('rides.button.cancel')}</button>)}
    </div>
  </section>;
}
