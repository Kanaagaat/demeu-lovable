import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../Icon';
import { useT } from '../../i18n';
import './home.css';
export function Page({ children, className = '' }: PropsWithChildren<{
  className?: string;
}>) {
  return <section className={`hm-page ${className}`}>{children}</section>;
}
export function Back({ onClick }: {
  onClick?: () => void;
}) {
  const navigate = useNavigate();
  const { t } = useT();
  return <button className="hm-back" aria-label={t('common.back')} onClick={onClick ?? (() => navigate(-1))}>
    <Icon name="back" size={22} />
  </button>;
}
export function Header({ title, onBack }: {
  title?: string;
  onBack?: () => void;
}) {
  return <header className="hm-header">
    <Back onClick={onBack} />
    {title && <div className="hm-header-title">{title}</div>}
  </header>;
}
export function Primary({ children, className = '', ...props }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return <button className={`hm-primary ${className}`} {...props}>{children}</button>;
}
export function Arrow({ white = false }: {
  white?: boolean;
}) {
  return <span className="hm-arrow" style={white ? { filter: 'brightness(0) invert(1)' } : undefined}>
    <Icon name="back" size={20} />
  </span>;
}
export function Safety({ result = false }: {
  result?: boolean;
}) {
  const { t } = useT();
  return <p className="hm-safety">
    <Icon name="help" color="6755B2" size={16} />
    {t(result ? 'home.result.safety' : 'home.voice.safety')}
  </p>;
}
export function Loading() {
  const { t } = useT();
  return <div className="hm-skeletons" role="status" aria-label={t('home.loading')}>{[0, 1, 2].map(i => <div key={i} />)}</div>;
}
export function ResourceError({ retry }: {
  retry: () => void;
}) {
  const { t } = useT();
  return <div className="hm-card">
    <p>{t('home.loadError')}</p>
    <button className="hm-text-button" onClick={retry}>{t('home.retry')}</button>
  </div>;
}
