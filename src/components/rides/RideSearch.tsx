import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../../i18n';
import { acceptOffer, cancelRide, declineOffer, errorText, raisePrice } from '../../lib/rides';
import type { RideView } from '../../lib/ridesTypes';
import { Button } from '../Button';
import { ScreenHeader } from '../ScreenHeader';
import { useToast } from '../Toast';
import { OfferCard, formatSearchPrice } from './OfferCard';
import { RaisePriceSheet, SearchSheet } from './RaisePriceSheet';
import './rides-search.css';
import { formatDate } from '../../lib/dates';

export interface RideScreenProps { ride: RideView; offline: boolean; refresh: () => void }

export function RideSearch({ ride, offline, refresh }: RideScreenProps) {
  const { t, language } = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const [sheet, setSheet] = useState<'price' | 'cancel' | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const offers = ride.offers.filter(offer => offer.status === 'pending').sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const scheduled = ride.mode === 'scheduled' && ride.scheduled_at
    ? formatDate(ride.scheduled_at, language, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : null;
  const closeSheet = () => { if (!lock.current) setSheet(null); };
  const actOnOffer = async (id: string, accept: boolean) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await (accept ? acceptOffer(id) : declineOffer(id)); refresh(); }
    catch (error) { toast(errorText(t, error)); }
    finally { lock.current = false; setBusy(false); }
  };
  return <section className="rd-search-page">
    <div aria-hidden={sheet ? true : undefined}>
      <ScreenHeader title={t('ridesTrack.searchTitle')} onBack={() => navigate('/rides')} />
      <div className="rd-search-content">
        {offline && <p className="rd-search-offline" role="status">{t('rides.offline')}</p>}
        <section className="rd-search-route" aria-label={t('ridesTrack.searchRoute')}>
          <p className="rd-search-route-address"><span><span className="sr-only">{t('ridesTrack.searchFrom')}: </span>{ride.from_address || ride.from_district}</span><span className="rd-search-route-arrow" aria-hidden="true">→</span><span><span className="sr-only">{t('ridesTrack.searchTo')}: </span>{ride.to_address}</span></p>
          <p className="rd-search-muted">{t(`rides.mode.${ride.mode}`)}{scheduled && <> · {scheduled}</>}</p>
          {ride.mode === 'scheduled' && ride.repeat_days.length > 0 && <p className="rd-search-muted">{t('rides.regular')}: {ride.repeat_days.map(day => t(`rides.weekday.${day}`)).join(', ')}</p>}
          {ride.mode === 'scheduled' && ride.needs_escort && <p className="rd-search-muted">{t('ridesTrack.searchEscort')}</p>}
          <p className="rd-search-parent-price">{t('ridesTrack.searchYourPrice').replace('{price}', formatSearchPrice(ride.parent_price, language))}</p>
        </section>
        {offers.length ? <section className="rd-search-offers" aria-labelledby="rd-search-offers-title">
          <h2 id="rd-search-offers-title">{t('ridesTrack.searchOffers')}</h2>
          {offers.map(offer => <OfferCard key={offer.id} offer={offer} ride={ride} busy={busy} onAccept={id => { void actOnOffer(id, true); }} onDecline={id => { void actOnOffer(id, false); }} />)}
        </section> : <div className="rd-search-empty" role="status">
          <div className="rd-search-mascot"><img src="/mascot/m-search.png" alt="" /><span className="rd-search-pulse" aria-hidden="true" /></div>
          <h2>{t('rides.status.searching')}</h2><p>{t('ridesTrack.searchWaitingText')}</p>
        </div>}
        <footer className="rd-search-actions">
          <Button variant="secondary" disabled={busy} aria-label={t('ridesTrack.searchRaisePrice')} onClick={() => setSheet('price')}>{t('ridesTrack.searchRaisePrice')}</Button>
          <button type="button" className="rd-search-text-button" disabled={busy} aria-label={t('ridesTrack.searchCancel')} onClick={() => { setCancelError(null); setSheet('cancel'); }}>{t('ridesTrack.searchCancel')}</button>
        </footer>
      </div>
    </div>
    {sheet === 'price' && <RaisePriceSheet currentPrice={ride.parent_price} onClose={closeSheet} onRaise={async price => {
      if (lock.current) return;
      lock.current = true; setBusy(true);
      try { await raisePrice(ride.id, price); refresh(); }
      finally { lock.current = false; setBusy(false); }
    }} />}
    {sheet === 'cancel' && <SearchSheet title={t('ridesTrack.searchCancelTitle')} onClose={closeSheet}>
      <p className="rd-search-muted">{t('ridesTrack.searchCancelText')}</p>
      {cancelError && <p role="alert" className="rd-search-error">{cancelError}</p>}
      <Button variant="secondary" disabled={busy} aria-label={t('ridesTrack.searchKeepSearching')} onClick={closeSheet}>{t('ridesTrack.searchKeepSearching')}</Button>
      <button type="button" className="rd-search-text-button" disabled={busy} aria-label={t('ridesTrack.searchCancelConfirm')} onClick={async () => {
        if (lock.current) return;
        lock.current = true; setBusy(true); setCancelError(null);
        try { await cancelRide(ride.id); navigate('/rides', { replace: true }); }
        catch (error) { setCancelError(errorText(t, error)); }
        finally { lock.current = false; setBusy(false); }
      }}>{busy ? t('rides.loading') : t('ridesTrack.searchCancelConfirm')}</button>
    </SearchSheet>}
  </section>;
}
