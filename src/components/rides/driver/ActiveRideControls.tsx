import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../../i18n';
import { errorText, setRideStatus } from '../../../lib/rides';
import { nextStatus } from '../../../lib/ridesRules';
import { RidesError, type RideView } from '../../../lib/ridesTypes';

export function ActiveRideControls({ ride, driverId, refresh, notify, offline }: { ride: RideView; driverId: string; refresh: () => void; notify: (text: string) => void; offline: boolean }) {
  const { t } = useT();
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const next = nextStatus(ride.status);
  const needsPin = ride.status === 'arrived';
  async function advance() {
    if (!next || busy || submitted || offline) return;
    if (needsPin && !pinOpen) { setPinOpen(true); return; }
    if (needsPin && !/^\d{4}$/.test(pin)) return;
    setBusy(true); setPinError(null);
    try {
      if (needsPin) await setRideStatus(ride.id, driverId, next, pin);
      else await setRideStatus(ride.id, driverId, next);
      setSubmitted(true); refresh();
    } catch (error) {
      if (error instanceof RidesError && error.code === 'wrong_pin') {
        setPinError(errorText(key => key === 'rides.err.wrong_pin' ? t('driver.activeWrongPin') : t(key), error));
      } else notify(errorText(t, error));
      refresh();
    } finally { setBusy(false); }
  }
  return <>
    <div className="dr-feed-contact"><Link className="dr-feed-secondary" to="/driver/training?lesson=seizure">{t('driver.activeFirstAid')}</Link><a className="dr-feed-secondary" href="tel:+77000000099">{t('driver.activeCallParent')}{' '}<small>{t('driver.activeDemoNumber')}</small></a></div>
    {next && <div className="dr-feed-controls">
      {needsPin && pinOpen && <label className="dr-feed-pin"><span id="dr-pin-label">{t('driver.activePin')}</span><input aria-labelledby="dr-pin-label" autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{4}" maxLength={4} value={pin} onChange={event => { setPin(event.target.value.replace(/\D/g, '').slice(0, 4)); setPinError(null); }} aria-invalid={!!pinError} aria-describedby={pinError ? 'dr-pin-error' : 'dr-pin-help'} /><small id="dr-pin-help">{t('driver.activePinHelp')}</small></label>}
      {pinError && <p className="dr-feed-error" id="dr-pin-error" role="alert">{pinError}</p>}
      <button className="dr-feed-primary" disabled={busy || submitted || offline || (needsPin && pinOpen && pin.length !== 4)} onClick={() => void advance()}>{t(`driver.activeNext_${ride.status}`)}</button>
      {(busy || submitted) && <p role="status" className="dr-feed-muted">{t('driver.activeUpdating')}</p>}
    </div>}
  </>;
}
