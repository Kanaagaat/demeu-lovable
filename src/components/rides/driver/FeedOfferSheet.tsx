import { useEffect, useRef, useState } from 'react';
import { useT } from '../../../i18n';
import { canOffer, formatPrice, nextOfferPrice, offerLimit } from '../../../lib/ridesRules';
import { OFFER_UI_STEP, PRICE_MAX, type FeedItem } from '../../../lib/ridesTypes';

export function FeedOfferSheet({ item, busy, onClose, onSend }: { item: FeedItem; busy: boolean; onClose: () => void; onSend: (price: number) => Promise<boolean> }) {
  const { t } = useT();
  const limit = Math.min(offerLimit(item.parent_price), PRICE_MAX);
  const [price, setPrice] = useState(Math.max(item.parent_price, Math.min(item.my_offer?.price ?? item.parent_price, limit)));
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    if (element?.showModal) element.showModal(); else element?.setAttribute('open', '');
    close.current?.focus();
    return () => { if (previous instanceof HTMLElement) previous.focus(); };
  }, []);
  async function submit() { if (!busy && canOffer(item.parent_price, price) && await onSend(price)) onClose(); }
  return <dialog ref={dialog} className="dr-feed-sheet" aria-labelledby="dr-offer-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="dr-feed-sheet-body"><div className="dr-feed-sheet-head"><h2 id="dr-offer-title">{t('driver.feedOfferPrice')}</h2><button ref={close} className="dr-feed-secondary" disabled={busy} onClick={onClose}>{t('rides.button.close')}</button></div>
      <p>{t('driver.feedParentPrice').replace('{price}', formatPrice(item.parent_price))}</p>
      <div className="dr-feed-stepper"><button aria-label={t('driver.feedDecrease')} disabled={busy || price <= item.parent_price} onClick={() => setPrice(Math.max(item.parent_price, price - OFFER_UI_STEP))}>−</button><output aria-live="polite">{formatPrice(price)}</output><button aria-label={t('driver.feedIncrease')} disabled={busy || price >= limit} onClick={() => setPrice(nextOfferPrice(item.parent_price, price))}>+</button></div>
      <p className="dr-feed-muted">{t('driver.feedLimit').replace('{price}', formatPrice(limit))}</p>
      <button className="dr-feed-primary" disabled={busy || !canOffer(item.parent_price, price)} onClick={() => void submit()}>{t('driver.feedSend').replace('{price}', formatPrice(price))}</button>
    </div>
  </dialog>;
}
