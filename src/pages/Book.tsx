import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useT } from '../i18n';
import { useAppState } from '../state/AppState';
import type { ShareDefaults } from '../state/AppState';
import { useSpecialist } from '../lib/hooks';
import { createBooking } from '../lib/api';
import type { Format } from '../lib/types';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { savePlanValue, selectedShared, slotISO, usePlanValue } from '../state/plan';
import { FEATURES, readCustomFeatures } from '../state/home';
import { play } from '../lib/sfx';
import { bookingIntroduction, fieldKeys, fieldText, formatText, messagePreview, priceText } from '../components/plan/booking';
import { Check, Content, Page, Panel, ResourceState, SpecSummary, Toggle } from '../components/plan/ui';
import { formatDate } from '../lib/dates';

const validFields = (value: unknown): value is ShareDefaults => !!value && typeof value === 'object' && fieldKeys.every(key => typeof (value as ShareDefaults)[key] === 'boolean');
export default function Book() {
  const { id } = useParams();
  const specialistId = id && /^\d+$/.test(id) ? Number(id) : null;
  const { t, language } = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const { card, addBooking, shareDefaults, setShareDefaults } = useAppState();
  const result = useSpecialist(specialistId, card?.district);
  const specialist = result.data;
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [chosenFormat, setFormat] = useState<Format | null>(null);
  const [direct, setDirect] = useState(false);
  const [editedMessage, setMessage] = useState<string | null>(null);
  const [sharing, setSharing] = useState(true);
  const [fields, setFields] = usePlanValue<ShareDefaults>('shareFields', { ...shareDefaults, name: true }, validFields);
  const [sending, setSending] = useState(false);
  const sendLock = useRef(false);
  const slots = (specialist?.slots ?? []).map(item => ({ ...item, times: item.times.filter(value => new Date(slotISO(item.date, value)).getTime() > Date.now()) }));
  const selectedDay = slots.find(item => item.date === day && item.times.length) ?? slots.find(item => item.times.length);
  const selectedTime = selectedDay?.times.find(value => value === time) ?? selectedDay?.times[0];
  const format = chosenFormat && specialist?.formats.includes(chosenFormat) ? chosenFormat : specialist?.formats[0] ?? 'Кабинет';
  const slot = selectedDay && selectedTime ? slotISO(selectedDay.date, selectedTime) : new Date(Date.now() + 86400000).toISOString();
  const shared = selectedShared(card, fields, sharing);
  const custom = sharing && fields.features && card?.features.includes(FEATURES[6]) ? readCustomFeatures() : [];
  const customLine = custom.length ? ` ${t('plan.customFeatures').replace('{list}', custom.join(', '))}` : '';
  const introduction = specialist ? editedMessage ?? bookingIntroduction(specialist.name, slot, formatText(format, t), direct, language, t) + customLine : '';
  const preview = messagePreview(introduction, shared, t);
  const changeFields = (key: keyof ShareDefaults) => { const next = { ...fields, [key]: !fields[key] }; setFields(next); setShareDefaults(next); };
  const send = async () => {
    if (!specialist || sendLock.current || (!direct && !selectedTime) || !introduction.trim()) return;
    sendLock.current = true;
    setSending(true);
    try {
      const response = await createBooking({ specialist_id: specialist.id, slot, format, shared, message: introduction.trim() });
      savePlanValue(`booking.${response.data.id}`, { wa_url: response.data.wa_url, direct });
      play('success');
      addBooking({ id: response.data.id, specialist_id: specialist.id, slot, format, created_at: new Date().toISOString(), shared });
      navigate(`/booked/${specialist.id}`, { replace: true, state: { bookingId: response.data.id } });
      window.location.href = response.data.wa_url;
    } catch { toast(t('plan.sendError')); }
    finally { sendLock.current = false; setSending(false); }
  };
  return <Page title={t('plan.booking')}>
    {result.loading || !specialist ? <ResourceState loading={result.loading} retry={result.reload} /> : <><Content>
      <SpecSummary specialist={specialist} subtitle={`${specialist.role} · ${priceText(specialist.price, t)}`} />
      <div className="pl-segments"><button aria-pressed={!direct} onClick={() => { setDirect(false); setMessage(null); }}>{t('plan.chooseTime')}</button><button aria-pressed={direct} onClick={() => { setDirect(true); setMessage(null); }}>{t('plan.direct')}</button></div>
      {!direct ? <div className="flex flex-col gap-3"><h3 className="!mb-0 capitalize">{slots[0] && formatDate(slotISO(slots[0].date, '12:00'), language, { month: 'long', timeZone: 'Asia/Almaty' })}</h3><div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">{slots.map(item => { const selected = selectedDay?.date === item.date; const date = new Date(slotISO(item.date, '12:00')); return <button key={item.date} disabled={!item.times.length} aria-pressed={selected} onClick={() => { setDay(item.date); setTime(item.times[0]); }} className="flex h-[84px] w-[68px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-[18px] border-[1.5px]" style={{ background: selected ? '#6755B2' : '#FFFFFF', borderColor: selected ? '#6755B2' : '#EEE9F7', color: selected ? '#FFFFFF' : item.times.length ? '#2E2A3B' : '#B3AEC0' }}><span className="text-[13px] font-bold">{formatDate(date, language, { weekday: 'short', timeZone: 'Asia/Almaty' })}</span><span className="text-[22px] font-black">{date.getUTCDate()}</span><span className="text-[11px] font-bold" style={{ color: selected ? '#CBBFF5' : '#8A849A' }}>{item.times.length ? `${item.times.length} ${t(language === 'kz' || item.times.length % 10 !== 1 && ![2, 3, 4].includes(item.times.length % 10) || [11, 12, 13, 14].includes(item.times.length % 100) ? 'plan.slots' : item.times.length % 10 === 1 ? 'plan.slotOne' : 'plan.slotFew')}` : t('plan.noPlaces')}</span></button>; })}</div><div className="flex flex-wrap gap-2">{selectedDay?.times.map(value => <button key={value} className="pl-chip" aria-pressed={selectedTime === value} onClick={() => setTime(value)}>{value}</button>)}</div>{!selectedTime && <p className="pl-muted">{t('plan.noSlots')}</p>}</div> : <div className="rounded-[20px] bg-[#FFF8F1] px-4 py-3.5 text-[15px] leading-[22px]">{t('plan.directText')}</div>}
      <div><h3>{t('plan.format')}</h3><div className="flex flex-wrap gap-2">{specialist.formats.map(value => <button className="pl-chip" key={value} aria-pressed={format === value} onClick={() => setFormat(value)}>{formatText(value, t)}</button>)}</div></div>
      <div><div className="mb-2.5 flex items-center justify-between"><h3 className="!mb-0">{t('plan.message')}</h3><span className="text-[13px] font-bold text-muted">{t('plan.editable')}</span></div><textarea aria-label={t('plan.message')} value={introduction} maxLength={1500} onChange={event => setMessage(event.target.value)} rows={5} style={{ borderRadius: '20px 20px 6px 20px', background: '#F5F1FF', padding: '14px 16px' }} /></div>
      {card && <Panel className="!rounded-[22px]"><div className="mb-2.5 flex items-center gap-3"><div className="flex-1"><div className="text-[17px] font-extrabold">{t('plan.share')}</div><div className="text-sm leading-5 text-muted">{t('plan.prepare')}</div></div><Toggle label={t('plan.shareShort')} checked={sharing} onChange={() => setSharing(!sharing)} /></div>{sharing && fieldKeys.map(key => <button role="checkbox" aria-checked={fields[key]} className="pl-check-row !min-h-12 !text-[15px] last:border-0" key={key} onClick={() => changeFields(key)}><Check checked={fields[key]} />{fieldText(key, card[key], t)}</button>)}</Panel>}
      <div><h3>{t('plan.preview')}</h3><div className="whitespace-pre-wrap rounded-[20px] bg-[#F5F1FF] p-4 text-[15px] leading-[22px]" data-testid="booking-preview">{preview}</div></div>
    </Content><div className="pl-footer"><button className="pl-primary" disabled={sending || (!direct && !selectedTime) || !introduction.trim()} onClick={() => void send()}><Icon name="whatsapp" color="FFFFFF" />{t(sending ? 'plan.sending' : 'plan.whatsapp')}</button><div className="text-center text-[13px] text-muted">{t('plan.waHint')}</div></div></>}
  </Page>;
}
