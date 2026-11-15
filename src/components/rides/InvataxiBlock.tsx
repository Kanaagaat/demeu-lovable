import { Link } from 'react-router-dom';
import { useT } from '../../i18n';
import invataxi from '../../data/invataxi.json';
import { isInvataxiEligible } from '../../lib/ridesRules';
import type { ChildCard } from '../../lib/types';

export function InvataxiBlock({ card }: { card: ChildCard | null }) {
  const { t } = useT();
  if (!isInvataxiEligible(card)) return null;

  return <aside className="rd-new-invataxi" aria-labelledby="rd-invataxi-title">
    <h2 id="rd-invataxi-title">{t('ridesNew.invataxiTitle')}</h2>
    <p>{t('ridesNew.invataxiBody')}</p>
    <a className="rd-new-secondary" href={`tel:${invataxi.phone}`}>{t('ridesNew.invataxiCall')}</a>
    <p className="rd-new-phone">{invataxi.phoneLabel} · {t('ridesNew.demoNumber')}</p>
    <Link className="rd-new-article" to={`/useful/${invataxi.articleId}`}>{t('ridesNew.invataxiArticle')}</Link>
  </aside>;
}
