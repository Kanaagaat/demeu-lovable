import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../Icon';
import { useToast } from '../Toast';
import { useT } from '../../i18n';
import { AdminApiError, getApplicationStatus, submitApplication, updateApplication } from '../../lib/adminApi';
import type { AdminDoc, ApplicationPayload, AppStatus } from '../../lib/adminApi';
import { DISTRICTS } from '../../state/home';
import { isString, stringList, useSupportSetting } from '../../state/support';
import type { CabinetProfile } from '../../state/support';

interface StoredApp { id: string; status: AppStatus; note: string; specialist_id: number | null; updated_at: string }
const isStoredApp = (v: unknown): v is StoredApp | null =>
  v === null || (!!v && typeof v === 'object' && typeof (v as StoredApp).id === 'string' && ['new', 'docs', 'approved', 'rejected'].includes((v as StoredApp).status));

const kindOf = (name: string): AdminDoc['kind'] => /диплом|diplom|diploma/i.test(name) ? 'diploma' : /сертиф|certif|sert|pecs|sensor/i.test(name) ? 'certificate' : 'other';
const sizeOf = (bytes: number) => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1).replace('.', ',')} МБ` : `${Math.max(1, Math.round(bytes / 1024))} КБ`;

interface Props { profile: CabinetProfile; kids: string[]; formats: string[]; documents: string[]; setDocuments: (next: string[] | ((previous: string[]) => string[])) => void }

/** Verification tab of the specialist cabinet: sends the application to the moderators and shows their decision. */
export function CabinetVerification({ profile, kids, formats, documents, setDocuments }: Props) {
  const { t } = useT(); const toast = useToast();
  const [app, setApp] = useSupportSetting<StoredApp | null>('cabApp', null, isStoredApp);
  const [exp, setExp] = useSupportSetting('cabExp', '5', isString);
  const [district, setDistrict] = useSupportSetting('cabDistrict', 'Бостандыкский', isString);
  const [education, setEducation] = useSupportSetting('cabEducation', '', isString);
  const [about, setAbout] = useSupportSetting('cabAbout', '', isString);
  const [sizes, setSizes] = useSupportSetting<string[]>('cabDocSizes', [], stringList);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false); const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const upload = useRef<HTMLInputElement>(null);
  const appRef = useRef(app); const setAppRef = useRef(setApp);
  useEffect(() => { appRef.current = app; setAppRef.current = setApp; });
  const status: AppStatus | 'none' = app?.status ?? 'none';

  const refresh = useCallback(async () => {
    const current = appRef.current; if (!current) return;
    try {
      const next = await getApplicationStatus(current.id);
      setAppRef.current({ id: next.id, status: next.status, note: next.note, specialist_id: next.specialist_id, updated_at: next.updated_at });
      setOffline(false); setSyncedAt(new Date());
    } catch (caught) {
      if (caught instanceof AdminApiError && caught.kind === 'missing') { setAppRef.current(null); setError(t('support.cabLost')); return; }
      setOffline(true);
    }
  }, [t]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (status !== 'new' && status !== 'docs') return undefined;
    const timer = setInterval(() => void refresh(), 8000);
    return () => clearInterval(timer);
  }, [status, refresh]);

  const demoDocs: AdminDoc[] = [
    { name: t('support.diploma'), kind: 'diploma', size: 'diplom.pdf · 2,4 МБ' },
    { name: t('support.pecs'), kind: 'certificate', size: 'pecs.jpg · 1,1 МБ' },
    { name: t('support.sensory'), kind: 'certificate', size: 'sensor.pdf · 0,8 МБ' },
  ];
  const allDocs: AdminDoc[] = [...demoDocs, ...documents.map((name, index) => ({ name, kind: kindOf(name), size: sizes[index] ?? '' }))];

  function addDocument(file: File | undefined) {
    if (!file) return;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) { toast(t('support.fileInvalid')); return; }
    setDocuments(previous => [...previous, file.name]); setSizes(previous => [...previous, `${file.name.split('.').pop()?.toLowerCase() ?? ''} · ${sizeOf(file.size)}`]); toast(t('support.fileAdded'));
    if (upload.current) upload.current.value = '';
  }
  function removeDocument(index: number) { setDocuments(previous => previous.filter((_, i) => i !== index)); setSizes(previous => previous.filter((_, i) => i !== index)); }

  async function send() {
    const years = Number(exp);
    if (!profile.name.trim() || !Number.isFinite(Number(profile.price)) || Number(profile.price) < 0 || profile.price.trim() === '') { setError(t('support.required')); return; }
    if (exp.trim() === '' || !Number.isInteger(years) || years < 0 || years > 60) { setError(t('support.cabExpInvalid')); return; }
    if (formats.length === 0) { setError(t('support.cabFormatNeeded')); return; }
    const payload: ApplicationPayload = {
      name: profile.name.trim(), role: profile.specialty, exp_years: years, district, price: Number(profile.price), formats, works_with: kids,
      methods: profile.methods.trim(), education: education.trim(), about: about.trim(), documents: allDocs,
    };
    setBusy(true); setError(null);
    try {
      if (app && app.status === 'docs') { await updateApplication(app.id, payload); setApp({ ...app, status: 'new', note: '', updated_at: new Date().toISOString() }); toast(t('support.cabUpdated')); }
      else { const created = await submitApplication(payload); setApp({ id: created.id, status: 'new', note: '', specialist_id: null, updated_at: new Date().toISOString() }); toast(t('support.cabSent')); }
      setOffline(false); setSyncedAt(new Date());
    } catch (caught) { setError(caught instanceof AdminApiError ? caught.message : t('support.cabFailed')); }
    finally { setBusy(false); }
  }

  const tone = { none: ['#F4F2F7', 'help'], new: ['#FFF1D9', 'hourglass'], docs: ['#FFF1D9', 'diploma'], approved: ['#EAF2EB', 'shield'], rejected: ['#FCEBE8', 'cancel'] }[status];
  const title = { none: 'cabNone', new: 'review', docs: 'cabDocsNeeded', approved: 'verified', rejected: 'cabRejected' }[status];
  const sub = { none: 'cabNoneSub', new: 'reviewTime', docs: 'cabDocsNeededSub', approved: 'verifiedSub', rejected: 'cabRejectedSub' }[status];
  const locked = status === 'new' || status === 'approved';
  const label = status === 'docs' ? 'cabResend' : status === 'rejected' ? 'cabSendAgain' : 'cabSend';

  return <div className="support-stack" style={{ gap: 14 }}>
    <div className="support-row" style={{ background: tone[0], borderRadius: 22, padding: 16, alignItems: 'flex-start' }} role="status">
      <Icon name={tone[1]} size={30} />
      <div className="support-grow"><strong style={{ fontSize: 17, fontWeight: 900 }}>{t(`support.${title}`)}</strong><small style={{ fontSize: 14, lineHeight: '20px' }}>{t(`support.${sub}`)}</small>
        {app && app.note && (status === 'docs' || status === 'rejected') && <p style={{ margin: '8px 0 0', fontSize: 15, lineHeight: '22px', fontWeight: 700 }}><span className="support-muted">{t('support.cabModeratorNote')}: </span>{app.note}</p>}
        {status === 'approved' && app?.specialist_id && <Link className="support-text-button" style={{ marginTop: 6, display: 'inline-block' }} to={`/specialists/${app.specialist_id}`}>{t('support.cabOpenProfile')}</Link>}</div>
    </div>
    {app && <div className="support-row" style={{ justifyContent: 'space-between', gap: 8 }}><small className="support-muted">{syncedAt ? t('support.cabUpdatedAt').replace('{time}', syncedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })) : ''}</small><button className="support-text-button" onClick={() => void refresh()}>{t('support.cabRefresh')}</button></div>}
    {offline && <div className="support-row" role="alert" style={{ background: '#FCEBE8', color: '#A6463A', borderRadius: 14, padding: '10px 14px', fontSize: 14, fontWeight: 700 }}>{t('support.cabOffline')}</div>}
    <div className="support-card" style={{ padding: '0 16px' }}>{allDocs.map((doc, i) => <div className="support-document" key={`${doc.name}-${i}`}><Icon name={doc.kind === 'diploma' ? 'school' : i < 3 ? 'training' : 'todo-list'} size={26} /><div className="support-grow"><strong>{doc.name}</strong><small>{doc.size || t('support.review')}</small></div>
      {i >= 3 && !locked ? <button className="support-close" aria-label={`${t('support.close')}: ${doc.name}`} onClick={() => removeDocument(i - 3)}><Icon name="cancel" size={18} /></button> : <Icon name={status === 'approved' ? 'checkmark' : 'hourglass'} color={status === 'approved' ? '4F7454' : '6755B2'} size={22} />}</div>)}</div>
    {!locked && <>
      <input ref={upload} type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" aria-label={t('support.uploadDocument')} onChange={event => addDocument(event.target.files?.[0])} />
      <button className="support-button support-dashed" style={{ minHeight: 56 }} onClick={() => upload.current?.click()}><Icon name="todo-list" size={20} />{t('support.uploadDocument')}</button>
      <small>{t('support.uploadNote')}</small>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <label className="support-field">{t('support.cabExp')}<input type="number" inputMode="numeric" min={0} max={60} value={exp} onChange={event => setExp(event.target.value)} /></label>
        <label className="support-field">{t('support.cabDistrict')}<select value={district} onChange={event => setDistrict(event.target.value)}>{DISTRICTS.map((name, i) => <option key={name} value={name}>{t(`home.districts.${i}`)}</option>)}</select></label>
      </div>
      <label className="support-field">{t('support.cabEducation')}<input value={education} maxLength={300} onChange={event => setEducation(event.target.value)} /></label>
      <label className="support-field">{t('support.cabAbout')}<textarea rows={3} maxLength={1500} value={about} onChange={event => setAbout(event.target.value)} /></label>
      {error && <div className="support-row" role="alert" style={{ background: '#FCEBE8', color: '#A6463A', borderRadius: 14, padding: '10px 14px', fontSize: 14, fontWeight: 700 }}>{error}</div>}
      <button className="support-button" style={{ minHeight: 56, fontSize: 17 }} disabled={busy} onClick={() => void send()}>{busy ? t('support.cabSending') : t(`support.${label}`)}</button>
    </>}
    {locked && error && <div className="support-row" role="alert" style={{ background: '#FCEBE8', color: '#A6463A', borderRadius: 14, padding: '10px 14px', fontSize: 14, fontWeight: 700 }}>{error}</div>}
  </div>;
}
