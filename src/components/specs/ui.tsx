import { useEffect, useRef } from 'react';
import type { PropsWithChildren, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../Icon';
import { useT } from '../../i18n';
import { useAppState } from '../../state/AppState';
import { useToast } from '../Toast';
import './specs.css';

export function useSpecText() {
  const { t, language } = useT();
  const text = (key: string) => t(`specs.${key}`);
  const label = (value: string): string => {
    const result = text(`values.${value}`);
    if (!result.startsWith('specs.values.')) return result;
    if (language === 'kz' && value.startsWith('Работал(а) с ')) return `${value.slice('Работал(а) с '.length).split(', ').map(label).join(', ')} ${text('workedWith')}`;
    if (language === 'kz' && /^\d+ мин от дома/.test(value)) return `${value.match(/^\d+/)?.[0]} ${text('distanceEstimate')}`;
    if (value === 'Вымышленный профиль для демонстрации DEMEU. Помогаем развивать навыки в комфортном темпе, обсуждаем цели вместе с семьёй.') return text('demoBio');
    return value;
  };
  const money = (price: number) => price === 0 ? text('free') : `${price.toLocaleString(language === 'kz' ? 'kk-KZ' : 'ru-RU')} ₸`;
  const minutes = (value: number | null) => value == null ? text('distanceUnknown') : value === 0 ? text('online') : `≈ ${value} ${text('min')}`;
  const reviews = (count: number) => `${count} ${text(language === 'kz' ? 'reviewsWord' : count % 10 === 1 && count % 100 !== 11 ? 'reviewOne' : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100) ? 'reviewFew' : 'reviewsWord')}`;
  const years = (count: number) => language === 'kz' ? text('yearsExperience') : text(count % 10 === 1 && count % 100 !== 11 ? 'yearOne' : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100) ? 'yearFew' : 'yearsExperience');
  const specialists = (count: number, accusative = false) => {
    const mod = count % 100;
    const key = language === 'kz' ? 'specialistsWord' : count % 10 === 1 && mod !== 11 ? (accusative ? 'specialistFew' : 'specialistOne') : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(mod) ? 'specialistFew' : 'specialistsWord';
    return `${count} ${text(key)}`;
  };
  const childDative = (name?: string | null) => name ? language === 'ru' && /[бвгджзклмнпрстфхцчшщ]$/i.test(name) ? `${name}у` : name : text('childDative');
  return { text, label, money, minutes, reviews, years, specialists, childDative, language };
}
export function useCompareAction() {
  const { compare, toggleCompare } = useAppState();
  const toast = useToast();
  const { text } = useSpecText();
  return (id: number) => {
    const result = toggleCompare(id);
    if (result === 'limit') toast(text('compareLimit'));
    if (result === 'added' && compare.length === 0) toast(text('compareFirst'));
  };
}
export function Avatar({ initials, tint, size = 64 }: { initials: string; tint: string; size?: number }) {
  return <div className="sp-avatar" style={{ backgroundColor: tint, width: size, height: size, borderRadius: size >= 90 ? 32 : size >= 60 ? 20 : 18, fontSize: size >= 90 ? 30 : size >= 60 ? 20 : 17 }}>{initials}</div>;
}
export function Verified() {
  const { text } = useSpecText();
  return <span className="sp-badge"><Icon name="shield" size={14} />{text('verified')}</span>;
}
export function MatchBadge({ childName }: { childName?: string }) {
  const { text, childDative } = useSpecText();
  return <span className="sp-badge sp-match"><Icon name="checkmark" color="4F7454" size={14} />{childName ? `${text('suitableFor')} ${childDative(childName)}` : text('similarChildren')}</span>;
}
export function Section({ title, children }: PropsWithChildren<{ title: string }>) {
  return <section><h2 className="sp-section-title">{title}</h2>{children}</section>;
}
export function Loading() {
  const { text } = useSpecText();
  return <div className="sp-stack" role="status" aria-label={text('loading')}>{[1, .7, .45].map(opacity => <div key={opacity} className="sp-skeleton" style={{ opacity }} />)}</div>;
}
export function Empty({ title, description, action, onAction, to, error = false }: { title: string; description?: string; action: string; onAction?: () => void; to?: string; error?: boolean }) {
  return <div className="sp-empty"><img src={`/mascot/m-${error ? 'sleep' : 'search'}.png`} alt="" /><h2>{title}</h2>{description && <p>{description}</p>}{to ? <Link className="sp-primary" to={to}>{action}</Link> : <button className="sp-primary" onClick={onAction}>{action}</button>}</div>;
}
export function Sheet({ title, onClose, children, footer, full = false }: PropsWithChildren<{ title: string; onClose: () => void; footer?: ReactNode; full?: boolean }>) {
  const { text } = useSpecText();
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const nodes = ref.current?.querySelectorAll<HTMLElement>('button, a[href], input, textarea, select, [tabindex="0"]');
      if (!nodes?.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handle);
    return () => { document.removeEventListener('keydown', handle); previous?.focus(); };
  }, []);
  return <div className="sp-overlay" onClick={onClose}><div className={`sp-sheet ${full ? 'sp-sheet-full' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1} onClick={e => e.stopPropagation()}>
    <div className="sp-handle" /><header className="sp-sheet-header"><h2>{title}</h2><button className="sp-close" aria-label={text('close')} onClick={onClose}><Icon name="cancel" size={18} /></button></header>
    <div className="sp-sheet-body">{children}</div>{footer && <footer className="sp-sheet-footer">{footer}</footer>}
  </div></div>;
}
