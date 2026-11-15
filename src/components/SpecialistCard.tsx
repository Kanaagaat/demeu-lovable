import { Link, useNavigate } from 'react-router-dom';
import type { MatchItem, SpecialistCard as Spec } from '../lib/types';
import { Icon } from './Icon';
import { Avatar, MatchBadge, useSpecText, Verified } from './specs/ui';

export interface SpecialistCardProps {
  item: Spec | MatchItem;
  /** Child's name for the match badge. */
  childName?: string;
  inCompare?: boolean;
  onCompare?: (id: number) => void;
  /** Smaller variant for result/home lists. */
  compact?: boolean;
  /** Hide the match badge to keep long lists calm (default: shown). */
  showMatch?: boolean;
}

export function SpecialistCard({ item, childName, inCompare = false, onCompare, compact = false, showMatch = true }: SpecialistCardProps) {
  const { text, label, money, minutes, reviews, years } = useSpecText();
  const navigate = useNavigate();
  return <article className="sp-card cursor-pointer" data-specialist-id={item.id} onClick={event => { if (!(event.target as HTMLElement).closest('a, button')) navigate(`/specialists/${item.id}`); }}>
    <div className="flex items-start gap-2">
      <Link to={`/specialists/${item.id}`} className="sp-card-heading">
        <Avatar initials={item.initials} tint={item.tint} size={compact ? 52 : 64} />
        <div className="min-w-0 flex-1"><h2 className="sp-card-name">{item.name}</h2><div className="sp-meta">{label(item.role)} · {item.exp_years} {years(item.exp_years)}</div>
          <div className="sp-rating"><Icon name="star" color="E5A84B" size={16} />{String(item.rating).replace('.', ',')}<span className="font-semibold text-muted">· {reviews(item.reviews_count)}</span></div>
        </div>
      </Link>
      {onCompare && item.kind === 'child' && <button className="sp-compare-button" aria-label={`${text(inCompare ? 'removeCompare' : 'addCompare')}: ${item.name}`} aria-pressed={inCompare} onClick={() => onCompare(item.id)}><Icon name={inCompare ? 'checkmark' : 'compare'} color={inCompare ? 'FFFFFF' : '6E6880'} size={20} /></button>}
    </div>
    {item.verified || (showMatch && 'match' in item && item.match) ? <div className="sp-badges">{showMatch && 'match' in item && item.match && <MatchBadge childName={childName} />}{item.verified && <Verified />}</div> : null}
    <Link to={`/specialists/${item.id}`} className="sp-card-price"><strong>{money(item.price)}</strong><span>{text('perSession')}</span><span className="flex-1" /><span className="flex items-center gap-1"><Icon name="marker" color="6E6880" size={16} />{minutes(item.travel_minutes)}{item.travel_minutes !== null && item.travel_minutes > 0 ? ` ${text('fromHome')}` : ''}</span></Link>
    <div className="sp-meta -mt-1.5 flex items-center gap-1.5"><Icon name="video-call" color="6E6880" size={16} />{item.formats.map(label).join(' · ')}</div>
  </article>;
}
