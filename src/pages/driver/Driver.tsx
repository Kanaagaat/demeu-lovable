import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useT } from '../../i18n';
import { useDriver } from '../../state/rides';
import { patchDriver, registerDriver, setDriverId, setOnline } from '../../lib/rides';
import { isValidCar, isValidPersonName, normalizePhone, normalizePlate } from '../../lib/ridesRules';
import type { DriverDraft } from '../../lib/ridesTypes';
import { DriverError, DriverLoading, DriverPage, ReadyMark, useKitValid } from '../../components/rides/driver/ui';

function Registration({ onRegistered }: { onRegistered: () => void }) {
  const { t } = useT();
  const [draft, setDraft] = useState<DriverDraft>({ name: '', phone: '', car: '', plate: '' });
  const [documents, setDocuments] = useState([false, false]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const phone = normalizePhone(draft.phone), plate = normalizePlate(draft.plate);
  const ok = { name: isValidPersonName(draft.name), phone: phone !== null, car: isValidCar(draft.car), plate: plate !== null };
  const valid = ok.name && ok.phone && ok.car && ok.plate;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true); setError(null);
    try {
      const driver = await registerDriver({ name: draft.name.trim(), car: draft.car.trim(), phone: phone ?? draft.phone, plate: plate ?? draft.plate });
      setDriverId(driver.id); onRegistered();
    } catch (error) { setError(error); } finally { setBusy(false); }
  }
  return <form onSubmit={submit}>
    <div><h2>{t('driver.regTitle')}</h2><p className="dr-muted">{t('driver.regDemoData')}</p></div>
    {(['name', 'phone', 'car', 'plate'] as const).map(field => <div className="dr-field-wrap" key={field}><label className="dr-field">
      {t(`driver.regField_${field}`)}<input required name={field} type={field === 'phone' ? 'tel' : 'text'} inputMode={field === 'phone' ? 'tel' : undefined} autoComplete="off"
        maxLength={field === 'name' || field === 'car' ? 80 : 20} aria-invalid={touched[field] && !ok[field] ? true : undefined} aria-describedby={touched[field] && !ok[field] ? `dr-err-${field}` : undefined}
        placeholder={field === 'phone' ? '+7 7XX XXX XX XX' : field === 'plate' ? '123 ABC 02' : field === 'car' ? 'Toyota Camry, белая' : undefined}
        value={draft[field]} onBlur={() => setTouched(current => ({ ...current, [field]: true }))}
        onChange={event => setDraft({ ...draft, [field]: field === 'plate' ? event.target.value.toUpperCase() : event.target.value })} />
    </label>{touched[field] && !ok[field] && <span className="dr-field-error" id={`dr-err-${field}`} role="alert">{t(`driver.regError_${field}`)}</span>}</div>)}
    <div className="dr-panel">{documents.map((uploaded, index) => <button key={index} className="dr-secondary" type="button" aria-pressed={uploaded} onClick={() => setDocuments(current => current.map((value, i) => i === index ? true : value))}>
      {t(index === 0 ? 'driver.regLicense' : 'driver.regCarDocument')}{uploaded ? ` — ${t('driver.regUploaded')}` : ''}
    </button>)}<p className="dr-muted dr-small">{t('driver.regDocumentsHint')}</p></div>
    <DriverError error={error} /><button className="dr-primary" type="submit" disabled={!valid || busy}>{t(busy ? 'driver.regSaving' : 'driver.regSubmit')}</button>
  </form>;
}

export default function Driver() {
  const { t } = useT();
  const navigate = useNavigate();
  const { data: driver, loading, error: loadError, offline, refresh } = useDriver();
  const kitValid = useKitValid(driver);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function act(action: 'verify' | 'online' | 'offline') {
    if (!driver || busy) return;
    setBusy(true); setError(null);
    try {
      if (action === 'verify') await patchDriver(driver.id, { verified: true });
      else await setOnline(driver.id, action === 'online');
      refresh();
      if (action === 'online') navigate('/driver/feed');
    } catch (error) { setError(error); } finally { setBusy(false); }
  }
  return <DriverPage title={t('driver.regTitle')}>
    {loading ? <DriverLoading /> : !driver && (loadError || offline) ? <DriverLoading retry={refresh} /> : !driver ? <Registration onRegistered={refresh} /> : <>
      <div className="dr-panel"><h2>{driver.name}</h2><p className="dr-muted">{driver.car} · {driver.plate}</p><h3>{t(driver.verified ? 'driver.regVerified' : 'driver.regReview')}</h3>
        {!driver.verified && <><p className="dr-muted dr-small">{t('driver.regVerificationDemo')}</p><button className="dr-secondary" disabled={busy} onClick={() => void act('verify')}>{t('driver.regConfirm')}</button></>}
        {driver.trained && <span className="dr-badge">{t('driver.trainBadge')}</span>}
      </div>
      <div className="dr-panel"><h3>{t('driver.regReadiness')}</h3><ul className="dr-list">
        <li className="dr-ready-row"><ReadyMark ready={driver.verified} /><span>{t('driver.regVerification')}</span></li>
        <li className="dr-ready-row"><ReadyMark ready={driver.trained} /><Link to="/driver/training">{t('driver.regTraining')}</Link></li>
        <li className="dr-ready-row"><ReadyMark ready={kitValid} /><Link to="/driver/checklist">{t('driver.regChecklist')}</Link></li>
      </ul></div>
      <DriverError error={error} /><div className="dr-actions">{driver.online ? <>
        <Link className="dr-primary" to="/driver/feed">{t('driver.regOpenFeed')}</Link><button className="dr-secondary" disabled={busy} onClick={() => void act('offline')}>{t('driver.regGoOffline')}</button>
      </> : <button className="dr-primary" disabled={busy || !driver.verified || !driver.trained || !kitValid} onClick={() => void act('online')}>{t('driver.regGoOnline')}</button>}</div>
    </>}
  </DriverPage>;
}
