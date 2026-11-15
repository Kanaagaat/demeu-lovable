import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../Button';
import { useT } from '../../i18n';
import { createRide, errorText } from '../../lib/rides';
import { categoriesFromCard, hintsFor, isValidPrice } from '../../lib/ridesRules';
import { CATEGORIES, NEEDS, PRICE_MAX, PRICE_MIN, PRICE_STEP } from '../../lib/ridesTypes';
import type { Category, Need, RideMode } from '../../lib/ridesTypes';
import type { ChildCard, SpecialistDetail } from '../../lib/types';
import { DISTRICTS } from '../../state/home';
import { useEstimate } from '../../state/rides';
import { placeFromDistrict } from '../../lib/places';
import type { Place } from '../../lib/places';
import { pointFor } from '../specs/SpecialistMap';
import { AddressPicker } from './AddressPicker';

const MIN_LEAD_MS = 30 * 60 * 1000;
function localParts(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return { date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`, time: `${pad(date.getHours())}:${pad(date.getMinutes())}` };
}
const earliest = () => new Date(Math.ceil((Date.now() + MIN_LEAD_MS) / 60000) * 60000);
function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter(v => v !== value) : [...values, value];
}

export function NewRideForm({ card, toAddress, specialist }: {
  card: ChildCard | null;
  toAddress?: string;
  specialist: SpecialistDetail | null;
}) {
  const { t, language } = useT();
  const text = (key: string) => t(`ridesNew.${key}`);
  const navigate = useNavigate();
  const [mode, setMode] = useState<RideMode>('express');
  const [fromPlace, setFromPlace] = useState<Place>(() => placeFromDistrict(card && DISTRICTS.includes(card.district) ? card.district : ''));
  // Null means the parent has not edited this field. Async specialist data can still supply its default.
  const [destination, setDestination] = useState<Place | null>(null);
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);
  const defaultTo = useMemo<Place | null>(() => {
    const address = toAddress ?? specialist?.address ?? '';
    if (!address) return null;
    const district = specialist && DISTRICTS.includes(specialist.district) ? specialist.district : fromPlace.district;
    const point = specialist && DISTRICTS.includes(specialist.district) ? pointFor(specialist) : null;
    return { address, district, lat: point?.[0] ?? null, lng: point?.[1] ?? null };
  }, [toAddress, specialist, fromPlace.district]);
  const toPlace = destination ?? defaultTo;
  const fromDistrict = fromPlace.district;
  const toDistrict = toPlace?.district ?? fromDistrict;
  const to = toPlace?.address ?? '';
  const [minimum, setMinimum] = useState(earliest);
  const [schedule, setSchedule] = useState(() => localParts(earliest()));
  const [needsEscort, setNeedsEscort] = useState(false);
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [categories, setCategories] = useState<Category[]>(() => categoriesFromCard(card));
  const [categoryOther, setCategoryOther] = useState('');
  const [needs, setNeeds] = useState<Need[]>([]);
  const [comment, setComment] = useState('');
  const [price, setPrice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const { data: estimate } = useEstimate(fromDistrict || null, toDistrict || null);

  useEffect(() => {
    if (estimate) setPrice(current => current === null ? String(estimate.suggested) : current);
  }, [estimate]);
  useEffect(() => {
    const timer = setInterval(() => setMinimum(earliest()), 30000);
    return () => clearInterval(timer);
  }, []);

  const min = localParts(minimum);
  const scheduledTime = Date.parse(`${schedule.date}T${schedule.time}`);
  const validSchedule = Number.isFinite(scheduledTime) && scheduledTime >= minimum.getTime();
  const validPrice = isValidPrice(Number(price));
  const reason = !DISTRICTS.includes(fromDistrict) ? text('chooseFrom')
    : !to.trim() || !DISTRICTS.includes(toDistrict) ? text('enterDestination')
    : mode === 'scheduled' && !validSchedule ? text('scheduleError')
    : !validPrice ? t('rides.err.price_out_of_range') : null;
  const hints = hintsFor(categories);
  const priceChanged = (value: string) => { setPrice(value); setError(null); };
  const stepPrice = (step: number) => {
    const current = Number(price);
    const next = (Number.isFinite(current) ? current : estimate?.suggested ?? PRICE_MIN) + step;
    priceChanged(String(Math.max(PRICE_MIN, Math.min(PRICE_MAX, next))));
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reason || submitting.current) return;
    // Recheck at submission, including after the app has been backgrounded.
    if (mode === 'scheduled' && scheduledTime < Date.now() + MIN_LEAD_MS) {
      setMinimum(earliest());
      return;
    }
    submitting.current = true;
    setSending(true);
    setError(null);
    try {
      const ride = await createRide({
        mode, from_district: fromDistrict, from_address: fromPlace.address.trim(), to_address: to.trim(),
        scheduled_at: mode === 'scheduled' ? new Date(scheduledTime).toISOString() : null,
        repeat_days: mode === 'scheduled' ? [...repeatDays].sort((a, b) => a - b) : [],
        needs_escort: mode === 'scheduled' && needsEscort,
        categories, category_other: categories.includes('other') ? categoryOther.trim() : '',
        show_category: true, needs, comment: comment.trim(), parent_price: Number(price),
      });
      navigate(`/rides/${ride.id}`, { replace: true });
    } catch (cause) {
      setError(errorText(t, cause));
    } finally {
      submitting.current = false;
      setSending(false);
    }
  }

  const districtName = (district: string) => DISTRICTS.includes(district) ? t(`home.districts.${DISTRICTS.indexOf(district)}`) : '';
  // A pin without a known street still gives the driver something concrete: coordinates.
  const withAddress = (place: Place): Place => place.address || place.lat == null || place.lng == null ? place
    : { ...place, address: `${text('pinOnMap')} · ${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}` };
  const fromText = fromPlace.address || (fromDistrict ? districtName(fromDistrict) : '');
  const routeRow = (which: 'from' | 'to', value: string, sub: string) =>
    <button type="button" className="rd-route-row" onClick={() => setPicking(which)}>
      <span className={`rd-route-dot rd-route-dot-${which}`} aria-hidden="true" />
      <span className="rd-route-text"><small>{text(which)}</small><b className={value ? '' : 'rd-route-empty'}>{value || text(which === 'from' ? 'chooseFrom' : 'enterDestination')}</b>{sub && <em>{sub}</em>}</span>
      <span className="rd-route-chev" aria-hidden="true">›</span>
    </button>;

  return <form className="rd-new-form" onSubmit={submit} noValidate aria-label={text('title')}>
    <fieldset disabled={sending} className="rd-new-fields">
      <div className="rd-new-mode">
        <div className="rd-new-segments" role="group" aria-label={text('mode')}>
          {(['express', 'scheduled'] as const).map(value => <button key={value} type="button" aria-pressed={mode === value}
            onClick={() => { setMode(value); setError(null); }}>{t(`rides.mode.${value}`)}</button>)}
        </div>
        <p className="rd-new-muted">{text(mode === 'express' ? 'expressHint' : 'scheduledHint')}</p>
      </div>

      <section className="rd-new-panel rd-route" aria-label={`${text('from')} → ${text('to')}`}>
        {routeRow('from', fromText, fromPlace.address && fromDistrict ? districtName(fromDistrict) : '')}
        {routeRow('to', to, to && toDistrict ? districtName(toDistrict) : '')}
      </section>

      {mode === 'scheduled' && <section className="rd-new-panel" aria-labelledby="rd-schedule-title">
        <h2 id="rd-schedule-title">{text('dateTime')}</h2>
        <div className="rd-new-date-row">
          <label className="rd-new-field" htmlFor="rd-date">{text('date')}
            <input type="date" id="rd-date" min={min.date} value={schedule.date} required
              onChange={e => setSchedule(current => ({ ...current, date: e.target.value }))} aria-describedby="rd-schedule-hint" />
          </label>
          <label className="rd-new-field" htmlFor="rd-time">{text('time')}
            <input type="time" id="rd-time" min={schedule.date === min.date ? min.time : undefined} value={schedule.time} required
              onChange={e => setSchedule(current => ({ ...current, time: e.target.value }))} aria-describedby="rd-schedule-hint" />
          </label>
        </div>
        <p className={validSchedule ? 'rd-new-muted' : 'rd-new-error'} id="rd-schedule-hint">{text('scheduleError')}</p>
        <button type="button" role="switch" aria-checked={needsEscort} className="rd-new-switch-row" onClick={() => setNeedsEscort(v => !v)}>
          <span>{text('escort')}</span><span className="rd-new-switch" aria-hidden="true" />
        </button>
        <div className="rd-new-field" role="group" aria-label={text('repeat')}>
          <span>{text('repeat')}</span>
          <div className="rd-new-days">{Array.from({ length: 7 }, (_, day) => <button type="button" key={day}
            aria-label={t(`rides.weekday.${day}`)} aria-pressed={repeatDays.includes(day)}
            onClick={() => setRepeatDays(current => toggle(current, day))}>{t(`rides.weekday.${day}`)}</button>)}</div>
        </div>
        <p className="rd-new-muted">{text('repeatHint')}</p>
      </section>}

      <section className="rd-new-panel" aria-labelledby="rd-categories-title">
        <h2 id="rd-categories-title">{text('categories')}</h2>
        <div className="rd-new-chips" role="group" aria-label={text('categories')}>{CATEGORIES.map(category =>
          <button type="button" key={category} aria-pressed={categories.includes(category)}
            onClick={() => setCategories(current => toggle(current, category))}>{t(`rides.category.${category}`)}</button>)}</div>
        {categories.includes('other') && <label className="rd-new-field" htmlFor="rd-other">{text('other')}
          <input id="rd-other" value={categoryOther} maxLength={120} onChange={e => setCategoryOther(e.target.value)} />
        </label>}
        <div className="rd-new-hints"><h3>{text('driverSees')}</h3>
          {categories.length > 0 && <p className="rd-new-hints-categories">{t('driver.feedCategories')}: {categories.map(category => category === 'other' && categoryOther.trim() ? `${t('rides.category.other')}: ${categoryOther.trim()}` : t(`rides.category.${category}`)).join(', ')}</p>}
          {hints.length ? <ul>{hints.map(hint => <li key={hint}>{t(`rides.hint.${hint}`)}</li>)}</ul> : !categories.length && <p>{text('noHints')}</p>}
        </div>
      </section>

      <section className="rd-new-panel" aria-labelledby="rd-needs-title">
        <h2 id="rd-needs-title">{text('needs')}</h2>
        <div className="rd-new-chips" role="group" aria-label={text('needs')}>{NEEDS.map(need => <button type="button" key={need}
          aria-pressed={needs.includes(need)} onClick={() => setNeeds(current => toggle(current, need))}>{t(`rides.need.${need}`)}</button>)}</div>
        <label className="rd-new-field" htmlFor="rd-comment">{text('comment')}
          <textarea id="rd-comment" value={comment} maxLength={500} rows={3} onChange={e => setComment(e.target.value)} />
        </label>
      </section>

      <section className="rd-new-panel">
        <label className="rd-new-title" id="rd-price-title" htmlFor="rd-price">{text('price')}</label>
        <div className="rd-new-price">
          <button type="button" aria-label={text('priceDown')} disabled={price === null || Number(price) <= PRICE_MIN} onClick={() => stepPrice(-PRICE_STEP)}>−</button>
          <input type="number" id="rd-price" inputMode="numeric" min={PRICE_MIN} max={PRICE_MAX} step={PRICE_STEP}
            value={price ?? ''} onChange={e => priceChanged(e.target.value)} required aria-invalid={price !== null && !validPrice}
            aria-describedby={`rd-price-hint${price !== null && !validPrice ? ' rd-price-error' : ''}`} />
          <button type="button" aria-label={text('priceUp')} disabled={price === null || Number(price) >= PRICE_MAX} onClick={() => stepPrice(PRICE_STEP)}>+</button>
        </div>
        {price !== null && !validPrice && <p className="rd-new-error" id="rd-price-error">{t('rides.err.price_out_of_range')}</p>}
        <p className="rd-new-muted" id="rd-price-hint">{estimate
          ? text('estimate').replace('{low}', new Intl.NumberFormat(language === 'kz' ? 'kk-KZ' : 'ru-RU').format(estimate.low))
            .replace('{high}', new Intl.NumberFormat(language === 'kz' ? 'kk-KZ' : 'ru-RU').format(estimate.high))
          : text('estimateWaiting')}</p>
        <p className="rd-new-cash">{t('rides.cash')}</p>
      </section>
    </fieldset>
    <footer className="rd-new-footer">
      {error && <p role="alert" className="rd-new-error">{error}</p>}
      <p id="rd-new-reason" className="rd-new-muted" aria-live="polite">{reason}</p>
      <Button type="submit" disabled={!!reason || sending} aria-describedby={reason ? 'rd-new-reason' : undefined} aria-busy={sending}>
        {text(sending ? 'sending' : 'submit')}
      </Button>
    </footer>
    {picking && createPortal(<AddressPicker key={picking} title={text(picking)}
      initial={picking === 'from' ? fromPlace : toPlace ?? placeFromDistrict(fromDistrict)}
      suggestions={picking === 'from' ? (card && DISTRICTS.includes(card.district) ? [placeFromDistrict(card.district)] : []) : defaultTo ? [defaultTo] : []}
      onClose={() => setPicking(null)}
      onPick={place => { const next = withAddress(place); if (picking === 'from') setFromPlace(next); else setDestination(next); setPicking(null); setError(null); }} />, document.body)}
  </form>;
}
