import { useEffect, useRef, type PropsWithChildren, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../Icon';
import { useT } from '../../i18n';
import { useAppState } from '../../state/AppState';
import { clearDemeuStorage } from '../../state/support';
import './support.css';

export function Page({ children, className = '' }: PropsWithChildren<{ className?: string }>) { return <section className={`support-page ${className}`}>{children}</section>; }
export function Header({ title, fallback = '/support', children }: { title?: string; fallback?: string; children?: ReactNode }) {
  const navigate = useNavigate(); const { t } = useT();
  const back = () => { if (typeof window.history.state?.idx === 'number' && window.history.state.idx > 0) navigate(-1); else navigate(fallback); };
  return <header className="support-header"><button className="support-back" aria-label={t('support.back')} onClick={back}><Icon name="back" size={22} /></button>{title && <h1>{title}</h1>}{children}</header>;
}
export function TileLink({ to, icon, title, subtitle, large = false }: { to: string; icon: string; title: string; subtitle?: string; large?: boolean }) {
  return <Link className={`support-card support-tile ${large ? 'support-tile-large' : ''}`} to={to}><span className="support-icon-box"><Icon name={icon} size={large ? 30 : 26} /></span><span className="support-grow"><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}</span><span aria-hidden="true" className="support-chevron">›</span></Link>;
}
export function Sheet({ title, children, onClose }: PropsWithChildren<{ title: string; onClose: () => void }>) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current; node?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex="0"]')];
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', key); return () => { document.removeEventListener('keydown', key); previous?.focus(); };
  }, [onClose]);
  const { t } = useT();
  return <div className="support-overlay" onClick={onClose}><div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="support-sheet" onClick={e => e.stopPropagation()}><div className="support-sheet-handle" /><div className="support-row"><h2 className="support-grow">{title}</h2><button className="support-close" aria-label={t('support.close')} onClick={onClose}><Icon name="cancel" size={22} /></button></div>{children}</div></div>;
}
export function ResetSheet({ onClose }: { onClose: () => void }) {
  const { t, setLanguage } = useT(); const { resetAll } = useAppState(); const navigate = useNavigate();
  const reset = () => { resetAll(); setLanguage('ru'); clearDemeuStorage(); navigate('/welcome', { replace: true }); };
  return <Sheet title={t('support.resetTitle')} onClose={onClose}><p className="support-muted">{t('support.resetText')}</p><button className="support-button support-danger-fill" onClick={reset}>{t('support.resetConfirm')}</button><button className="support-button support-secondary" onClick={onClose}>{t('support.cancel')}</button></Sheet>;
}
export function Empty({ title, text }: { title: string; text?: string }) { return <div className="support-empty"><img src="/mascot/m-sleep.png" alt="" /><h2>{title}</h2>{text && <p>{text}</p>}</div>; }
export function CrisisCard() { const { t } = useT(); return <aside className="support-crisis" role="region" aria-label={t('support.emergency')}><strong>{t('support.crisisTitle')}</strong><p>{t('support.crisisText')}</p><div className="support-row"><a href="tel:111">111</a><a href="tel:150">150</a><a href="tel:112">112</a></div><Link to="/sos">{t('support.emergency')}</Link></aside>; }
