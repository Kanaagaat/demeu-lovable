import { useId } from 'react';
import { useT } from '../../i18n';
import type { OfferView, RideView } from '../../lib/ridesTypes';
import { Button } from '../Button';
import './rides-search.css';

export function formatSearchPrice(price: number, language: string) {
  return `${new Intl.NumberFormat(language === 'kz' ? 'kk-KZ' : 'ru-RU').format(price).replace(/\s/g, ' ')} ₸`;
}

const avatarPalette = ['#ECE6FF', '#E4EFE5', '#F7D6C7', '#FFF1D9', '#E5EDF7'];
function avatarColor(id: string) {
  let hash = 0;
  for (const character of id) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) | 0;
  return avatarPalette[(hash >>> 0) % avatarPalette.length];
}

export function OfferCard({ offer, ride, busy, onAccept, onDecline }: {
  offer: OfferView; ride: RideView; busy: boolean;
  onAccept: (id: string) => void; onDecline: (id: string) => void;
}) {
  const { t, language } = useT();
  const titleId = useId();
  const { driver } = offer;
  const samePrice = offer.price === ride.parent_price;
  const rating = driver.rating.toFixed(1).replace('.', ',');
  const experience = driver.worked_with.some(category => ride.categories.includes(category));
  return <article className="rd-search-offer" aria-labelledby={titleId} aria-busy={busy}>
    <div className="rd-search-driver">
      <span className="rd-search-avatar" style={{ background: avatarColor(driver.id) }} aria-hidden="true">{driver.initials}</span>
      <div className="rd-search-driver-info"><h3 id={titleId}>{driver.name}</h3><p>{driver.car} · {driver.plate}</p></div>
      <span className="rd-search-rating" aria-label={`${t('ridesTrack.searchRating')}: ${rating}`}><span aria-hidden="true">★ </span>{rating}</span>
    </div>
    <ul className="rd-search-badges" aria-label={t('ridesTrack.searchDriverDetails')}>
      {driver.trained && <li>{t('rides.badge.trained')}</li>}
      {driver.kit_ok && <li>{t('rides.badge.kit_ok')}</li>}
      {experience && <li>{t('rides.badge.worked_with')}</li>}
    </ul>
    <p className={`rd-search-offer-price${samePrice ? '' : ' rd-search-counter-price'}`}>{samePrice
      ? formatSearchPrice(offer.price, language)
      : t('ridesTrack.searchCounterPrice').replace('{price}', formatSearchPrice(offer.price, language)).replace('{parentPrice}', formatSearchPrice(ride.parent_price, language))}</p>
    <p className="rd-search-eta">{ride.mode === 'scheduled' ? t('ridesTrack.searchScheduledEta') : t('ridesTrack.searchEta').replace('{minutes}', String(offer.eta_minutes))}</p>
    <div className="rd-search-offer-actions">
      <Button disabled={busy} aria-label={`${t('ridesTrack.searchAccept')}: ${driver.name}`} onClick={() => onAccept(offer.id)}>{t('ridesTrack.searchAccept')}</Button>
      <Button variant="secondary" disabled={busy} aria-label={`${t('rides.button.decline')}: ${driver.name}`} onClick={() => onDecline(offer.id)}>{t('rides.button.decline')}</Button>
    </div>
  </article>;
}
