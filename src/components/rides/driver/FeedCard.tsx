import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../../i18n';
import { formatPrice } from '../../../lib/ridesRules';
import type { FeedItem, OfferView } from '../../../lib/ridesTypes';
import { ActiveRideDetails, ActiveRideRoute, feedDate } from './ActiveRideDetails';

export function FeedCard({ item, fresh, busy, onOffer, onPrice }: { item: FeedItem; fresh: boolean; busy: boolean; onOffer: (price: number) => Promise<OfferView | null>; onPrice: () => void }) {
  const { t, language } = useT();
  const [sent, setSent] = useState<{ source: FeedItem; offer: OfferView } | null>(null);
  const offer = sent?.source === item ? sent.offer : item.my_offer;
  async function accept() {
    const result = await onOffer(item.parent_price);
    if (result) setSent({ source: item, offer: result });
  }
  return <article className={`dr-feed-card ${fresh ? 'dr-feed-new' : ''}`}>
    <div className="dr-feed-card-top"><span className={`dr-feed-badge dr-feed-${item.mode}`}>{t(`rides.mode.${item.mode}`)}</span><strong>{item.mode === 'express' ? t('driver.feedNow') : item.scheduled_at ? feedDate(item.scheduled_at, language) : ''}</strong></div>
    {item.regular_label_days.length > 0 && <p className="dr-feed-regular">{t('driver.feedRegular').replace('{days}', [...new Set(item.regular_label_days)].sort((a, b) => a - b).map(day => t(`rides.weekday.${day}`)).join(', '))}</p>}
    <ActiveRideRoute ride={item} />
    {item.needs_escort && <p className="dr-feed-escort">{t('driver.feedEscort')}</p>}
    <ActiveRideDetails ride={item} />
    <p className="dr-feed-price">{t('driver.feedParentPrice').replace('{price}', formatPrice(item.parent_price))}</p>
    {offer ? <><p className="dr-feed-waiting" role="status">{t('driver.feedOffered').replace('{price}', formatPrice(offer.price))}</p><Link className="dr-feed-link" to={`/driver/ride/${item.id}`}>{t('driver.feedOpenOffer')}</Link></> : <button className="dr-feed-primary" disabled={busy} onClick={() => void accept()}>{t('driver.feedAccept').replace('{price}', formatPrice(item.parent_price))}</button>}
    <button className="dr-feed-secondary" disabled={busy} onClick={onPrice}>{t(offer ? 'driver.feedChangePrice' : 'driver.feedOfferPrice')}</button>
  </article>;
}
