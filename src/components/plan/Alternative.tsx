import { Link } from 'react-router-dom';
import { useT } from '../../i18n';
import type { Feature, SpecialistCard } from '../../lib/types';
import { Icon } from '../Icon';
import { priceText } from './booking';

export function Alternative({ item, features }: { item: SpecialistCard; features: Feature[] }) {
  const { t } = useT();
  const similar = features.some(feature => item.experiences.includes(feature));
  return <Link to={`/specialists/${item.id}`} className="pl-panel flex items-center gap-3 !p-3.5 text-ink"><span className="pl-avatar" style={{ background: item.tint }}>{item.initials}</span><span className="min-w-0 flex-1"><strong className="block text-base font-extrabold">{item.name}</strong><span className="block text-sm leading-5 text-muted">{item.role} · {priceText(item.price, t)}{item.travel_minutes != null && ` · ${item.travel_minutes} ${t('plan.minutes')}`}</span>{similar && <span className="mt-1.5 inline-flex rounded-full bg-[#EAF2EB] px-2.5 py-[3px] text-xs font-extrabold text-[#4F7454]">{t('plan.similarExperience')}</span>}</span><span className="-rotate-90"><Icon name="expand-arrow" color="6E6880" size={20} /></span></Link>;
}
