import { useEffect, useId, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../../i18n';
import { errorText } from '../../lib/rides';
import { PRICE_MAX, PRICE_STEP } from '../../lib/ridesTypes';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { formatSearchPrice } from './OfferCard';
import './rides-search.css';

/** Shared only by the two P3 sheets. Keeps keyboard focus inside and restores it on close. */
export function SearchSheet({ title, onClose, children }: PropsWithChildren<{ title: string; onClose: () => void }>) {
  const { t } = useT();
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    const controls = () => Array.from(dialog.current?.querySelectorAll<HTMLElement>('*') ?? [])
      .filter(element => element.matches('button, input, [tabindex="0"]') && !element.matches(':disabled'));
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const all = controls(), first = all[0], last = all[all.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
    };
    const focus = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.current?.contains(event.target)) dialog.current?.focus();
    };
    document.addEventListener('keydown', keydown);
    document.addEventListener('focusin', focus);
    return () => {
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('focusin', focus);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return createPortal(<div className="rd-search-overlay" onClick={onClose}>
    <div className="rd-search-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialog} tabIndex={-1} onClick={event => event.stopPropagation()}>
      <div className="rd-search-handle" aria-hidden="true" />
      <div className="rd-search-sheet-header"><h2 id={titleId}>{title}</h2><button type="button" className="rd-search-close" aria-label={t('rides.button.close')} onClick={onClose}><Icon name="cancel" size={22} /></button></div>
      {children}
    </div>
  </div>, document.body);
}

export function RaisePriceSheet({ currentPrice, onClose, onRaise }: {
  currentPrice: number; onClose: () => void; onRaise: (price: number) => Promise<void>;
}) {
  const { t, language } = useT();
  const fieldId = useId(), hintId = useId(), errorId = useId();
  const [value, setValue] = useState(String(Math.min(currentPrice + PRICE_STEP, PRICE_MAX)));
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const price = Number(value);
  const validation = !value || !Number.isInteger(price) || price % PRICE_STEP !== 0 || price > PRICE_MAX
    ? t('ridesTrack.searchPriceRule') : price <= currentPrice ? t('rides.err.price_not_higher') : null;
  const message = error ?? validation;
  const change = (next: string) => { setValue(next); setError(null); };
  const close = () => { if (!lock.current) onClose(); };
  return <SearchSheet title={t('ridesTrack.searchRaisePrice')} onClose={close}>
    <p className="rd-search-muted">{t('ridesTrack.searchCurrentPrice').replace('{price}', formatSearchPrice(currentPrice, language))}</p>
    <form className="rd-search-price-form" noValidate onSubmit={async event => {
      event.preventDefault();
      if (validation || lock.current) return;
      lock.current = true; setBusy(true); setError(null);
      try { await onRaise(price); onClose(); }
      catch (reason) { setError(errorText(t, reason)); }
      finally { lock.current = false; setBusy(false); }
    }}>
      <div className="rd-search-chips">{[100, 200, 500].map(increase => <button type="button" key={increase} disabled={busy || currentPrice + increase > PRICE_MAX} aria-label={t('ridesTrack.searchAddPrice').replace('{amount}', String(increase))} aria-pressed={price === currentPrice + increase} onClick={() => change(String(currentPrice + increase))}>+{increase} ₸</button>)}</div>
      <label className="rd-search-price-label" htmlFor={fieldId}>{t('ridesTrack.searchNewPrice')}</label>
      <input id={fieldId} type="number" inputMode="numeric" min={currentPrice + PRICE_STEP} max={PRICE_MAX} step={PRICE_STEP} value={value} disabled={busy} aria-invalid={!!message} aria-describedby={`${hintId}${message ? ` ${errorId}` : ''}`} onChange={event => change(event.target.value)} />
      <p id={hintId} className="rd-search-muted">{t('ridesTrack.searchPriceHint')}</p>
      {message && <p id={errorId} role="alert" className="rd-search-error">{message}</p>}
      <Button type="submit" disabled={busy || !!validation} aria-label={t('ridesTrack.searchRaisePrice')}>{busy ? t('rides.loading') : t('ridesTrack.searchRaisePrice')}</Button>
    </form>
  </SearchSheet>;
}
