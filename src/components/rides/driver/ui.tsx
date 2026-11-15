import { useEffect, useState, type PropsWithChildren } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../../i18n';
import { ScreenHeader } from '../../ScreenHeader';
import { Icon } from '../../Icon';
import { RidesError, type Driver } from '../../../lib/ridesTypes';
import './driver.css';

export const KIT_AGE_MS = 12 * 60 * 60 * 1000;
export function useKitValid(driver: Driver | null) {
  const [now, setNow] = useState(Date.now);
  const checkedAt = driver?.kit_checked_at;
  useEffect(() => {
    const expiry = Date.parse(checkedAt ?? '') + KIT_AGE_MS;
    if (!Number.isFinite(expiry)) return;
    setNow(Date.now());
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, expiry - Date.now() + 1));
    return () => clearTimeout(timer);
  }, [checkedAt]);
  const checked = Date.parse(checkedAt ?? '');
  return !!driver?.kit_ok && checked <= now && now - checked <= KIT_AGE_MS;
}
export function DriverPage({ title, onBack, children }: PropsWithChildren<{ title: string; onBack?: () => void }>) {
  return <section className="dr-page"><ScreenHeader title={title} onBack={onBack} /><div className="dr-content">{children}</div></section>;
}
export function ReadyMark({ ready }: { ready: boolean }) {
  const { t } = useT();
  return <span className={`dr-mark ${ready ? 'dr-mark-ready' : ''}`} role="img" aria-label={t(ready ? 'driver.regReady' : 'driver.regPending')}>
    {ready && <Icon name="checkmark" color="FFFFFF" size={16} />}
  </span>;
}
export function DriverError({ error }: { error: unknown }) {
  const { t } = useT();
  if (!error) return null;
  const missing = error instanceof RidesError && error.code === 'not_ready' && Array.isArray(error.extra?.missing)
    ? error.extra.missing.filter((item): item is string => typeof item === 'string' && ['verified', 'trained', 'kit'].includes(item)) : [];
  const labels: Record<string, string> = { verified: 'driver.regVerification', trained: 'driver.regTraining', kit: 'driver.regChecklist' };
  const paths: Record<string, string> = { verified: '/driver', trained: '/driver/training', kit: '/driver/checklist' };
  return <div className="dr-error" role="alert">{missing.length ? <>
    <p>{t('driver.regMissing').replace('{missing}', missing.map(item => t(labels[item])).join(', '))}</p>
    <div className="dr-links">{missing.map(item => <Link key={item} to={paths[item]}>{t(labels[item])}</Link>)}</div>
  </> : <p>{t('driver.regError')}</p>}</div>;
}
export function DriverLoading({ retry }: { retry?: () => void }) {
  const { t } = useT();
  return <div role="status" className="dr-panel"><p>{t(retry ? 'driver.regLoadError' : 'driver.regLoading')}</p>{retry && <button className="dr-secondary" onClick={retry}>{t('driver.regRetry')}</button>}</div>;
}
