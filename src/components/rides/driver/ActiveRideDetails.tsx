import { type PropsWithChildren, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../../../i18n';
import type { RideView } from '../../../lib/ridesTypes';
import { ScreenHeader } from '../../ScreenHeader';
import './driver-feed.css';
import { formatDate } from '../../../lib/dates';

export function ActiveRidePage({ title, children }: PropsWithChildren<{ title: string }>) {
  const navigate = useNavigate();
  return <section className="dr-feed-page"><ScreenHeader title={title} onBack={() => navigate('/driver')} /><div className="dr-feed-content">{children}</div></section>;
}

export function ActiveRideRoute({ ride }: { ride: RideView }) {
  const { t } = useT();
  return <div className="dr-feed-route"><div><span>{t('driver.feedFrom')}</span><strong>{[ride.from_district, ride.from_address].filter(Boolean).join(', ')}</strong></div><span aria-hidden="true">↓</span><div><span>{t('driver.feedTo')}</span><strong>{ride.to_address}</strong></div></div>;
}

export function ActiveRideDetails({ ride, large = false }: { ride: RideView; large?: boolean }) {
  const { t } = useT();
  return <section className={`dr-feed-important ${large ? 'dr-feed-important-large' : ''}`}>
    <h2>{t(large ? 'driver.activeImportant' : 'driver.feedImportant')}</h2>
    {ride.categories.length > 0 && <p className="dr-feed-categories">{t('driver.feedCategories')}: {ride.categories.map(category => category === 'other' && ride.category_other ? `${t('rides.category.other')}: ${ride.category_other}` : t(`rides.category.${category}`)).join(', ')}</p>}
    {ride.hints.length > 0 && <ul>{ride.hints.map(hint => <li key={hint}>{t(`rides.hint.${hint}`)}</li>)}</ul>}
    {ride.comment && <p className="dr-feed-comment">{ride.comment}</p>}
    {ride.needs.length > 0 && <ul className="dr-feed-chips">{ride.needs.map(need => <li key={need}>{t(`rides.need.${need}`)}</li>)}</ul>}
    {!ride.hints.length && !ride.categories.length && !ride.comment && !ride.needs.length && <p>{t('driver.feedNoWishes')}</p>}
  </section>;
}

/** Uses the existing toast view without the provider's sound effect. */
export function useActiveRideNotice() {
  const [notice, setNotice] = useState<{ text: string; key: number } | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [notice]);
  return { notice, notify: (text: string) => setNotice(previous => ({ text, key: (previous?.key ?? 0) + 1 })) };
}

export function feedDate(value: string, language: 'ru' | 'kz') {
  return formatDate(value, language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
