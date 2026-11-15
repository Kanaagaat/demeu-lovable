import { useEffect, useRef } from 'react';
import type { PropsWithChildren, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ScreenHeader } from '../ScreenHeader';
import { Icon } from '../Icon';
import { useT } from '../../i18n';
import type { SpecialistCard } from '../../lib/types';
import './plan.css';

export function Page({ title, onBack, children, hideTabs = true, className = '' }: PropsWithChildren<{ title?: string; onBack?: () => void; hideTabs?: boolean; className?: string }>) {
  return <section className={`pl-page ${className}`} data-hide-tabs={hideTabs}>{title && <ScreenHeader title={title} onBack={onBack} />}{children}</section>;
}
export function Content({ children, className = '' }: PropsWithChildren<{ className?: string }>) { return <div className={`pl-content ${className}`}>{children}</div>; }
export function Panel({ children, className = '' }: PropsWithChildren<{ className?: string }>) { return <div className={`pl-panel ${className}`}>{children}</div>; }
export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return <button type="button" role="switch" aria-label={label} aria-checked={checked} className="pl-toggle" style={{ background: checked ? '#6755B2' : '#DAD5E6' }} onClick={onChange}><span style={{ left: checked ? 23 : 3 }} /></button>;
}
export function Check({ checked }: { checked: boolean }) { return <span className={`pl-check ${checked ? 'is-checked' : ''}`}>{checked && <Icon name="checkmark" color="FFFFFF" size={14} />}</span>; }
export function Empty({ mascot = 'm-search', title, text, action }: { mascot?: string; title: string; text?: string; action?: ReactNode }) {
  return <div className="pl-empty"><img src={`/mascot/${mascot}.png`} alt="" /><h2>{title}</h2>{text && <p>{text}</p>}{action}</div>;
}
export function ResourceState({ loading, retry }: { loading?: boolean; retry?: () => void }) {
  const { t } = useT();
  return loading ? <div className="pl-content" role="status" aria-label={t('plan.loading')}>{[1, 2, 3].map(n => <div key={n} className="pl-skeleton" />)}</div> : <Empty title={t('plan.loadError')} text={t('plan.tryAgain')} action={<button className="pl-primary" onClick={retry}>{t('plan.retry')}</button>} />;
}
export function SpecSummary({ specialist, subtitle, flat = false }: { specialist: SpecialistCard; subtitle?: string; flat?: boolean }) {
  return <Link className={flat ? 'pl-spec pl-spec-flat' : 'pl-spec'} to={`/specialists/${specialist.id}`}><span className="pl-avatar" style={{ background: specialist.tint }}>{specialist.initials}</span><span className="min-w-0 flex-1"><strong>{specialist.name}</strong><small>{subtitle ?? specialist.role}</small></span></Link>;
}
export function Sheet({ title, onClose, children }: PropsWithChildren<{ title: string; onClose: () => void }>) {
  const { t } = useT();
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
      if (event.key !== 'Tab') return;
      const controls = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, textarea, [tabindex="0"]');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); previous?.focus(); };
  }, []);
  return <div className="pl-overlay" onClick={onClose}><div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="pl-sheet" onClick={event => event.stopPropagation()}><div className="pl-handle" /><div className="flex items-center gap-2"><h2 className="flex-1">{title}</h2><button className="pl-close" aria-label={t('plan.close')} onClick={onClose}><Icon name="cancel" size={20} /></button></div>{children}</div></div>;
}
