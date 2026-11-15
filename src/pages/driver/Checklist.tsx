import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useT } from '../../i18n';
import { useDriver } from '../../state/rides';
import { kitCheck, setOnline } from '../../lib/rides';
import { KIT_ALL, KIT_REQUIRED, type Driver, type KitItem } from '../../lib/ridesTypes';
import { DriverError, DriverLoading, DriverPage, KIT_AGE_MS, useKitValid } from '../../components/rides/driver/ui';

function readDraft(driver: Driver): KitItem[] {
  try {
    const stored = JSON.parse(localStorage.getItem('demeu.kitDraft') ?? 'null');
    const expiry = Date.parse(driver.kit_checked_at ?? '') + KIT_AGE_MS;
    if (stored?.driverId !== driver.id || stored.kitCheckedAt !== driver.kit_checked_at || !Array.isArray(stored.items) || (Date.now() > expiry && !(stored.savedAt > expiry))) return [];
    return KIT_ALL.filter(item => stored.items.includes(item));
  } catch { return []; }
}
function KitForm({ driver }: { driver: Driver }) {
  const { t } = useT();
  const navigate = useNavigate();
  const [items, setItems] = useState<KitItem[]>(() => readDraft(driver));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    try { localStorage.setItem('demeu.kitDraft', JSON.stringify({ driverId: driver.id, kitCheckedAt: driver.kit_checked_at, items, savedAt: Date.now() })); }
    catch { /* The checklist still works without storage. */ }
  }, [items, driver.id, driver.kit_checked_at]);
  const ready = KIT_REQUIRED.every(item => items.includes(item));
  async function submit() {
    if (!ready || busy) return;
    setBusy(true); setError(null);
    try {
      const checked = await kitCheck(driver.id, items);
      // Preserve the confirmed checklist against the new server timestamp.
      try { localStorage.setItem('demeu.kitDraft', JSON.stringify({ driverId: driver.id, kitCheckedAt: checked.kit_checked_at, items, savedAt: Date.now() })); } catch { /* In-memory state remains usable. */ }
      await setOnline(driver.id, true); navigate('/driver/feed');
    } catch (error) { setError(error); } finally { setBusy(false); }
  }
  return <><h2>{t('driver.kitIntro')}</h2><p className="dr-muted">{t('driver.kitHint')}</p><div className="dr-panel">
    {KIT_ALL.map(item => <label key={item} className="dr-check"><input type="checkbox" checked={items.includes(item)} onChange={event => setItems(current => event.target.checked ? [...current, item] : current.filter(value => value !== item))} />
      <span>{t(`driver.kitItem_${item}`)}<small>{t(KIT_REQUIRED.includes(item) ? 'driver.kitRequired' : 'driver.kitRecommended')}</small></span>
    </label>)}
  </div><DriverError error={error} /><button className="dr-primary" disabled={!ready || busy} onClick={() => void submit()}>{t(busy ? 'driver.kitSaving' : 'driver.regGoOnline')}</button></>;
}
export default function Checklist() {
  const { t } = useT();
  const { data: driver, loading, error, offline, refresh } = useDriver();
  const valid = useKitValid(driver);
  if (!loading && !driver && !error && !offline) return <Navigate to="/driver" replace />;
  return <DriverPage title={t('driver.kitTitle')}>
    {loading || !driver ? <DriverLoading retry={loading ? undefined : refresh} /> : <KitForm key={`${driver.id}:${driver.kit_checked_at}:${valid}`} driver={driver} />}
  </DriverPage>;
}
