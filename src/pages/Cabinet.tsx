import { useState } from 'react';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { Empty, Header, Page, Sheet } from '../components/support/ui';
import { sharedBookingCard } from '../components/support/bookingShared';
import { CabinetVerification } from '../components/support/CabinetVerification';
import { useT } from '../i18n';
import { useAppState } from '../state/AppState';
import { initialCabinet, isCabinet, isString, stringList, useSupportSetting } from '../state/support';
import type { CabinetProfile } from '../state/support';
import { formatDate } from '../lib/dates';

const kids = ['РАС', 'ДЦП', 'Синдром Дауна', 'ЗПР / ЗРР', 'Неговорящие дети', 'Нарушения слуха'];
const formats = ['Кабинет', 'На дом', 'Онлайн']; const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const roles = ['Логопед', 'Дефектолог', 'Психолог для родителей', 'Реабилитолог'];
export default function Cabinet() {
  const { t, language } = useT(); const toast = useToast(); const { bookings } = useAppState();
  const [tab, setTab] = useSupportSetting<'edit' | 'ver' | 'in'>('cab', 'edit', (v): v is 'edit' | 'ver' | 'in' => ['edit', 'ver', 'in'].includes(String(v)));
  const [profile, setProfile] = useSupportSetting('cabProfile', initialCabinet, isCabinet);
  const [cabKids, setCabKids] = useSupportSetting('cabKids', ['РАС', 'Неговорящие дети'], stringList);
  const [cabFmt, setCabFmt] = useSupportSetting('cabFmt', ['Кабинет', 'Онлайн'], stringList);
  const [cabDays, setCabDays] = useSupportSetting('cabDays', ['Пн', 'Вт', 'Чт', 'Пт', 'Сб'], stringList);
  const [documents, setDocuments] = useSupportSetting<string[]>('cabDocuments', [], stringList);
  const [avatar, setAvatar] = useSupportSetting('cabAvatar', 'initials', isString);
  const [avatarSheet, setAvatarSheet] = useState(false);
  const field = (key: keyof CabinetProfile, text: string) => setProfile(previous => ({ ...previous, [key]: text }));
  function chips(values: string[], selected: string[], update: (next: string[]) => void, key: string) {
    return <div className="support-chips" style={key === 'day' ? { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 } : undefined}>{values.map((value, i) => <button key={value} type="button" className="support-chip" style={key === 'day' ? { padding: 0, borderRadius: 12 } : undefined} aria-pressed={selected.includes(value)} onClick={() => update(selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value])}>{t(`support.${key}${i}`)}</button>)}</div>;
  }
  function input(key: keyof CabinetProfile, label: string, type = 'text') {
    return <label className="support-field">{t(`support.${label}`)}<input value={profile[key]} type={type} min={type === 'number' ? key === 'duration' ? 1 : 0 : undefined} maxLength={200} onChange={event => field(key, event.target.value)} /></label>;
  }
  return <Page className="support-fullscreen"><Header title={t('support.cabinet')} fallback="/profile" /><div role="tablist" aria-label={t('support.cabinet')} className="support-tabs">{(['edit', 'ver', 'in'] as const).map((key, i) => <button key={key} role="tab" id={`cab-tab-${key}`} aria-controls={`cab-panel-${key}`} aria-selected={tab === key} onClick={() => setTab(key)}>{t(`support.${['cabProfile', 'verification', 'incoming'][i]}`)}</button>)}</div>
    <div className="support-content" style={{ paddingTop: 12, gap: 14 }}><span className="support-cabinet-demo">{t('support.demoCabinet')}</span><div role="tabpanel" id={`cab-panel-${tab}`} aria-labelledby={`cab-tab-${tab}`}>
      {tab === 'edit' && <form className="support-stack" style={{ gap: 18 }} onSubmit={event => { event.preventDefault(); if (!profile.name.trim() || !profile.price.trim() || !Number.isFinite(Number(profile.price)) || Number(profile.price) < 0 || !Number.isFinite(Number(profile.duration)) || Number(profile.duration) <= 0) toast(t('support.required')); else toast(t('support.saved')); }}>
        <div className="support-row" style={{ gap: 14 }}><div className="support-avatar" style={{ width: 88, height: 88, borderRadius: 28, background: '#F5F1FF', color: '#6755B2' }}>{avatar === 'mascot' ? <img src="/mascot/m-laptop.png" alt="" style={{ width: 78 }} /> : profile.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('')}</div><button className="support-button support-secondary" type="button" style={{ width: 'auto', minHeight: 44, borderRadius: 14, fontSize: 14 }} onClick={() => setAvatarSheet(true)}><Icon name="user" size={18} />{t('support.uploadPhoto')}</button></div>
        {input('name', 'name')}<label className="support-field">{t('support.specialty')}<select value={profile.specialty} onChange={event => field('specialty', event.target.value)}>{roles.map((role, i) => <option key={role} value={role}>{t(`support.role${i}`)}</option>)}</select></label>
        <div className="support-field">{t('support.worksWith')}{chips(kids, cabKids, setCabKids, 'kid')}</div><label className="support-field">{t('support.methods')}<textarea rows={2} value={profile.methods} maxLength={1000} onChange={event => field('methods', event.target.value)} /></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{input('price', 'price', 'number')}{input('duration', 'duration', 'number')}</div><div className="support-field">{t('support.formats')}{chips(formats, cabFmt, setCabFmt, 'fmt')}</div><div className="support-field">{t('support.days')}{chips(days, cabDays, setCabDays, 'day')}</div>{input('address', 'address')}<button className="support-button" style={{ minHeight: 56, fontSize: 17 }} type="submit">{t('support.save')}</button>
      </form>}
      {tab === 'ver' && <CabinetVerification profile={profile} kids={cabKids} formats={cabFmt} documents={documents} setDocuments={setDocuments} />}
      {tab === 'in' && (bookings.length === 0 ? <Empty title={t('support.noIncoming')} text={t('support.noIncomingSub')} /> : <div className="support-stack" style={{ gap: 14 }}>{bookings.map(booking => { const shared = sharedBookingCard(booking); return <div key={booking.id} className="support-card support-stack" style={{ borderRadius: 22, padding: 16, gap: 14 }}><div className="support-row"><span className="support-avatar" style={{ width: 48, height: 48, fontSize: 18 }}>{t('support.parent').slice(0, 1)}</span><div className="support-grow"><strong style={{ fontWeight: 800 }}>{t('support.parent')}{shared?.name ? ` · ${shared.name}` : ''}</strong><small>{formatDate(booking.slot, language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {booking.format}</small></div><span className="support-pill" style={{ fontSize: 12 }}>{t('support.new')}</span></div><div className="support-bubble" style={{ fontSize: 15, lineHeight: '22px' }}>{t('support.incomingMessage')}</div><div><strong style={{ fontSize: 14, fontWeight: 800 }}>{t('support.allowed')}</strong>{shared && Object.keys(shared).length > 0 ? <div className="support-stack" style={{ gap: 6, marginTop: 8 }}>{Object.entries(shared).map(([key, value]) => <div key={key} className="support-row" style={{ fontSize: 15, gap: 8 }}><Icon name="checkmark" color="4F7454" size={18} /><span>{t(`support.field_${key}`)}: {Array.isArray(value) ? value.join(', ') : String(value)}</span></div>)}</div> : <p className="support-muted" style={{ fontSize: 14, margin: '8px 0 0' }}>{t('support.noSharedFields')}</p>}</div><div className="support-row support-muted" style={{ background: '#F4F2F7', borderRadius: 14, padding: '10px 12px', fontSize: 14, lineHeight: '20px', gap: 8 }}><Icon name="shield" size={18} />{t('support.hidden')}</div><a className="support-button" href={`https://wa.me/?text=${encodeURIComponent(t('support.replyMessage'))}`} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" color="6755B2" size={22} />{t('support.replyWa')}</a></div>; })}</div>)}
    </div></div>{avatarSheet && <Sheet title={t('support.uploadPhoto')} onClose={() => setAvatarSheet(false)}><p className="support-muted">{t('support.avatarNote')}</p>{['initials', 'mascot'].map(value => <button key={value} className="support-button support-secondary" onClick={() => { setAvatar(value); setAvatarSheet(false); }}>{t(`support.${value}`)}</button>)}</Sheet>}</Page>;
}
