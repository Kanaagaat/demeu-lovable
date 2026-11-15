import { useState } from 'react';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { Empty, Header, Page, ResetSheet } from '../components/support/ui';
import { sharedBookingCard } from '../components/support/bookingShared';
import { useT } from '../i18n';
import { useSpecialists } from '../lib/hooks';
import { DEFAULT_SHARE, useAppState } from '../state/AppState';
import { isBoolean, stringList, useSupportSetting } from '../state/support';
import { formatDate } from '../lib/dates';

export default function Privacy() {
  const { t, language } = useT(); const toast = useToast(); const { bookings, card, shareDefaults, setShareDefaults, planDone } = useAppState();
  const specialists = useSpecialists(); const parents = useSpecialists({ kind: 'parent' });
  const viewers = [...bookings].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).filter((booking, index, all) => { const shared = sharedBookingCard(booking); return (shared === null || Object.keys(shared).length > 0) && all.findIndex(item => item.specialist_id === booking.specialist_id) === index; }); const [revoked, setRevoked] = useSupportSetting<string[]>('revoked', [], stringList);
  const [sharing, setSharing] = useSupportSetting('shareDefault', false, isBoolean); const [reset, setReset] = useState(false);
  function download() {
    const blob = new Blob([JSON.stringify({ card, bookings, shareDefaults, planDone, revoked }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'demeu-data.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast(t('support.exported'));
  }
  return <Page className="support-fullscreen"><Header title={t('support.privacy')} fallback="/profile" /><div className="support-content"><div className="support-card" style={{ background: '#F5F1FF', boxShadow: 'none', padding: 16 }}><div className="support-row"><Icon name="shield" /><h2>{t('support.storedTitle')}</h2></div><p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: '20px', color: '#6E6880' }}>{t('support.storedText')}</p></div>
    <div><h2 style={{ marginBottom: 10 }}>{t('support.viewers')}</h2>{viewers.length === 0 ? <Empty title={t('support.noViewers')} text={t('support.noViewersSub')} /> : <><p className="support-muted" style={{ fontSize: 13, margin: '0 0 10px' }}>{t('support.accessNotice')}</p><div className="support-stack">{viewers.map(booking => { const person = [...(specialists.data?.items ?? []), ...(parents.data?.items ?? [])].find(item => item.id === booking.specialist_id); const isRevoked = revoked.includes(booking.id); return <div key={booking.id} className="support-card support-row"><div className="support-grow"><strong style={{ fontSize: 16, fontWeight: 800 }}>{person?.name ?? `${t('support.provider')} #${booking.specialist_id}`}</strong><small>{person?.role} · {t('support.bookingDate')} {formatDate(booking.created_at, language, { day: 'numeric', month: 'long' })}</small></div><button className="support-button support-secondary" style={{ minHeight: 44, width: 'auto', fontSize: 14, borderRadius: 14, color: isRevoked ? '#8A849A' : undefined, background: isRevoked ? '#F4F2F7' : undefined }} disabled={isRevoked} onClick={() => { setRevoked(previous => [...new Set([...previous, ...bookings.filter(item => item.specialist_id === booking.specialist_id).map(item => item.id)])]); toast(t('support.revokeToast')); }}>{t(isRevoked ? 'support.revoked' : 'support.revoke')}</button></div>; })}</div><p className="support-muted" style={{ fontSize: 12, marginBottom: 0 }}>{t('support.localRevoke')}</p></>}</div>
    <div className="support-card support-row" style={{ padding: 16 }}><div className="support-grow"><strong style={{ fontWeight: 800 }}>{t('support.shareDefault')}</strong><small style={{ fontSize: 14, lineHeight: '20px' }}>{t('support.shareDefaultSub')}</small></div><button className="support-toggle" role="switch" aria-label={t('support.shareDefault')} aria-checked={sharing} onClick={() => { const next = !sharing; setSharing(next); setShareDefaults(next ? { ...DEFAULT_SHARE } : { name: false, age: false, district: false, features: false, comm: false, react: false, goals: false, disability: false }); }}><span /></button></div>
    <button className="support-button support-secondary" onClick={download}>{t('support.export')}</button><button className="support-button support-danger" onClick={() => setReset(true)}><Icon name="cancel" size={20} />{t('support.resetConfirm')}</button>
  </div>{reset && <ResetSheet onClose={() => setReset(false)} />}</Page>;
}
