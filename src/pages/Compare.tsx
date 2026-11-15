import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { ScreenHeader } from '../components/ScreenHeader';
import { Avatar, Empty, Loading, useSpecText } from '../components/specs/ui';
import { useMatch, useSpecialists } from '../lib/hooks';
import { useAppState } from '../state/AppState';
import type { SpecialistCard } from '../lib/types';
const score = (item: SpecialistCard) => 'score' in item && typeof item.score === 'number' ? item.score : null;

export default function Compare() {
  const { compare, toggleCompare, card } = useAppState();
  const { text, label, money, minutes } = useSpecText();
  const listing = useSpecialists({ district: card?.district });
  const matching = useMatch(card);
  const parents = useSpecialists({ kind: 'parent', district: card?.district });
  const resource = card ? matching : listing;
  const available = [...(resource.data?.items ?? []), ...(parents.data?.items ?? [])];
  const items = compare.flatMap(id => { const item = available.find(p => p.id === id); return item ? [item] : []; });
  const minPrice = Math.min(...items.map(p => p.price));
  const travel = items.flatMap(p => p.travel_minutes == null ? [] : [p.travel_minutes]);
  const minTime = Math.min(...travel);
  const maxMatch = Math.max(...items.map(p => score(p) ?? 0));
  const columns = { gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))` };
  const experiences = [...new Set([...(card?.features.filter(f => f !== 'Пока не знаю / не хочу указывать') ?? ['РАС']), ...(card && ['Пока не говорит', 'Жесты или карточки', 'Отдельные слова'].includes(card.comm) ? ['Неговорящие дети'] : !card ? ['Неговорящие дети'] : [])])];
  const rows: { title: string; cells: { value: string; best: boolean; icon?: string }[] }[] = [
    { title: text('price'), cells: items.map(p => ({ value: money(p.price), best: p.price === minPrice })) },
    { title: text('travelTime'), cells: items.map(p => ({ value: minutes(p.travel_minutes), best: p.travel_minutes != null && p.travel_minutes === minTime })) },
    { title: text('format'), cells: items.map(p => ({ value: p.formats.map(label).join(', '), best: false })) },
    ...experiences.map(exp => ({ title: `${text('experienceShort')}: ${label(exp)}`, cells: items.map(p => ({ value: p.experiences.includes(exp) ? text('yes') : '—', best: p.experiences.includes(exp), icon: p.experiences.includes(exp) ? 'checkmark' : undefined })) })),
    { title: text('verified'), cells: items.map(p => ({ value: p.verified ? text('yes') : '—', best: false, icon: p.verified ? 'shield' : undefined })) },
    { title: text('rating'), cells: items.map(p => ({ value: `${String(p.rating).replace('.', ',')} · ${p.reviews_count}`, best: false })) },
    { title: text('nextSlot'), cells: items.map(p => ({ value: p.next_slot || text('arrangeTime'), best: false })) },
    ...(card ? [{ title: text('match'), cells: items.map(p => ({ value: score(p) !== null ? `${score(p)}%` : '—', best: score(p) !== null && score(p) === maxMatch })) }] : []),
  ];
  return <div className="sp-compare-page"><ScreenHeader title={text('compareTitle')} />{(resource.loading || parents.loading) && compare.length >= 2 ? <div className="px-4"><Loading /></div> : resource.error ? <Empty error title={text('loadError')} action={text('retry')} onAction={resource.reload} /> : items.length < 2 ? <Empty title={text('compareEmpty')} description={text('compareEmptySub')} action={text('chooseSpecialists')} to="/specialists" /> : <div className="px-4 pb-8 pt-2"><div className="sp-compare-grid sticky top-0 z-[2] bg-bg pb-2.5" style={columns}>{items.map(p => <div key={p.id} data-testid="compare-column" className="relative flex flex-col items-center gap-1.5 rounded-[20px] bg-white px-1.5 pb-3 pt-6 text-center shadow-card"><button aria-label={`${text('removeCompare')}: ${p.name}`} className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-full" onClick={() => toggleCompare(p.id)}><Icon name="cancel" size={14} /></button><Link to={`/specialists/${p.id}`}><Avatar initials={p.initials} tint={p.tint} size={52} /></Link><Link className="text-sm font-extrabold leading-[18px] text-ink" to={`/specialists/${p.id}`}>{p.short}</Link><span className="text-xs leading-4 text-muted">{label(p.role)}</span></div>)}</div>
    {rows.map(row => <section key={row.title} className="border-b border-line-soft py-2.5"><h2 className="px-1 pb-1.5 text-[13px] font-extrabold leading-[18px] text-muted">{row.title}</h2><div className="sp-compare-grid" style={columns}>{row.cells.map((cell, index) => <div className="sp-compare-cell" style={{ background: cell.best ? '#EAF2EB' : 'transparent' }} key={items[index].id}>{'icon' in cell && cell.icon ? <><Icon name={cell.icon} size={22} color={cell.icon === 'shield' ? '6755B2' : '4F7454'} /><span className="sr-only">{cell.value}</span></> : cell.value}</div>)}</div></section>)}
    <div className="sp-compare-grid mt-4" style={columns}>{items.map(p => <Link className="sp-primary !min-h-12 !rounded-[14px] !px-1 !text-sm" key={p.id} to={`/book/${p.id}`}>{text('book')}</Link>)}</div><div className="mt-3.5 flex items-center gap-2 text-[13px] leading-[18px] text-muted"><span className="h-3.5 w-3.5 shrink-0 rounded bg-success-bg" />{text('bestValue')}</div>
  </div>}</div>;
}
