import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { SpecialistCard } from '../components/SpecialistCard';
import { FiltersSheet } from '../components/specs/FiltersSheet';
import { SpecialistMap } from '../components/specs/SpecialistMap';
import { Empty, Loading, Sheet, useCompareAction, useSpecText } from '../components/specs/ui';
import { useToast } from '../components/Toast';
import { useMatch, useSpecialists } from '../lib/hooks';
import { useAppState } from '../state/AppState';
import { filterCount, matchesQuick, quickOptions, readFilters, readQuick, resetFilters, sorts, withQuick } from '../state/specs';
import type { FilterKey } from '../state/specs';

export default function Specialists() {
  const [params, setParams] = useSearchParams();
  const { card, compare, toggleCompare } = useAppState();
  const { text, specialists } = useSpecText();
  const toast = useToast();
  const onCompare = useCompareAction();
  const [pin, setPin] = useState<number | null>(null);
  const parent = params.get('kind') === 'parent';
  const quick = readQuick(params);
  const base = readFilters(params, card?.district);
  const filters = parent ? { kind: 'parent' as const, district: card?.district } : withQuick(base, quick);
  const listing = useSpecialists(filters);
  const matching = useMatch(parent ? null : card, filters);
  const resource = card && !parent ? matching : listing;
  const items = (resource.data?.items ?? []).filter(item => parent || matchesQuick(item, quick));
  const demoState = params.get('state');
  const state = demoState === 'loading' || resource.loading ? 'loading' : demoState === 'error' || resource.error ? 'error' : demoState === 'empty' || !items.length ? 'empty' : 'normal';
  const map = params.get('view') === 'map' && !parent;
  const count = filterCount(params);
  const update = useCallback((key: string, value: string | null) => {
    setParams(current => { const next = new URLSearchParams(current); next.delete(key); if (value !== null) next.set(key, value); return next; }, { replace: true });
  }, [setParams]);
  const closeSheet = useCallback(() => update('sheet', null), [update]);
  const toggle = (key: FilterKey | 'quick', value: string) => {
    if (key === 'quick' && value === 'near' && !card?.district) { toast(text('needDistrict')); return; }
    setParams(current => { const next = new URLSearchParams(current); const values = next.getAll(key); next.delete(key); for (const item of values.includes(value) ? values.filter(v => v !== value) : [...values, value]) next.append(key, item); next.delete('state'); return next; }, { replace: true });
    setPin(null);
  };
  const reset = () => { setParams(resetFilters(params), { replace: true }); setPin(null); };
  const retry = () => { update('state', null); resource.reload(); };
  const setKind = (kind: string) => { setParams(current => { const next = new URLSearchParams(current); next.set('kind', kind); if (kind === 'parent') next.set('view', 'list'); return next; }, { replace: true }); setPin(null); };
  return <div className="pb-[110px] pt-2">
    <div className="sp-stack px-5"><h1 className="sp-title">{text('title')}</h1><div className="sp-segments"><button aria-pressed={!parent} onClick={() => setKind('child')}>{text('forChild')}</button><button aria-pressed={parent} onClick={() => setKind('parent')}>{text('forMe')}</button></div>
      {!parent && <div className="flex gap-2"><label className="flex h-[52px] min-w-0 flex-1 items-center gap-2 rounded-button border-[1.5px] border-line-strong bg-white px-3.5"><Icon name="search" color="6E6880" size={20} /><input className="min-w-0 flex-1 bg-transparent text-base outline-none" aria-label={text('search')} placeholder={text('search')} value={params.get('q') ?? ''} onChange={e => { update('q', e.target.value); setPin(null); }} /></label><div className="flex shrink-0 gap-0.5 rounded-button bg-surface p-1">{['list', 'map'].map(view => <button key={view} aria-label={text(view)} aria-pressed={(map ? 'map' : 'list') === view} onClick={() => { update('view', view); setPin(null); }} className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: (map ? 'map' : 'list') === view ? '#6755B2' : 'transparent' }}><Icon name={view} color={(map ? 'map' : 'list') === view ? 'FFFFFF' : '6E6880'} size={20} /></button>)}</div></div>}
    </div>
    {!parent && <div className="flex gap-2 overflow-x-auto px-5 pb-1 pt-3"><button className="sp-chip sp-chip-active font-extrabold" onClick={() => update('sheet', 'filters')}><Icon name="filter" size={18} />{text('filters')}{count > 0 && <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-brand px-1.5 text-xs text-white">{count}</span>}</button>{quickOptions.map(key => <button key={key} className="sp-chip whitespace-nowrap px-4" aria-pressed={quick.includes(key)} onClick={() => toggle('quick', key)}>{text(`quick.${key}`)}</button>)}</div>}
    <div className="sp-stack px-5 pt-2">
      {!parent && !map && <div className="flex min-h-11 items-center justify-between gap-1"><span className="text-sm font-bold text-muted" role="status">{text('found')} {specialists(items.length)}</span><button className="flex min-h-11 items-center gap-1 text-sm font-extrabold text-brand" onClick={() => update('sheet', 'sort')}><Icon name="sort" size={18} />{text(`sort.${base.sort}`)}</button></div>}
      {parent && <p className="rounded-[20px] bg-cream px-4 py-3.5 text-[15px] leading-[22px]">{text('parentIntro')}</p>}
      {state === 'loading' && <Loading />}
      {state === 'error' && <Empty error title={text('loadError')} description={text('loadErrorSub')} action={text('retry')} onAction={retry} />}
      {state === 'empty' && <Empty title={text('empty')} description={text('emptySub')} action={text('resetFilters')} onAction={reset} />}
      {state === 'normal' && !map && items.map((item, index) => <SpecialistCard key={item.id} item={item} showMatch={index < 3 || base.sort !== 'best'} childName={card?.name || undefined} inCompare={compare.includes(item.id)} onCompare={onCompare} />)}
    </div>
    {map && state === 'normal' && <SpecialistMap items={items} selectedId={pin} onSelect={setPin} showHome={!!card?.district} homeDistrict={card?.district} onList={() => { update('view', 'list'); setPin(null); }} />}
    {!map && compare.length >= 2 && <div className="sp-compare-bar"><Icon name="compare" color="FFFFFF" size={22} /><span className="flex-1">{text('selectedCompare')}</span><button aria-label={text('clearCompare')} className="flex h-11 w-8 shrink-0 items-center justify-center" onClick={() => compare.forEach(toggleCompare)}><Icon name="cancel" color="FFFFFF" size={18} /></button><Link to="/compare">{text('compare')} ({compare.length})</Link></div>}
    {params.get('sheet') === 'filters' && <FiltersSheet params={params} count={items.length} district={card?.district} onToggle={toggle} onValue={update} onReset={reset} onClose={closeSheet} onApply={() => { setParams(current => { const next = new URLSearchParams(current); next.delete('sheet'); next.delete('state'); return next; }, { replace: true }); }} />}
    {params.get('sheet') === 'sort' && <Sheet title={text('sortTitle')} onClose={closeSheet}><div className="flex flex-col gap-2" role="radiogroup" aria-label={text('sortTitle')}>{sorts.map(sort => <button key={sort} className="sp-choice" role="radio" aria-checked={base.sort === sort} onClick={() => { if (sort === 'near' && !card?.district) { toast(text('needDistrict')); return; } setParams(current => { const next = new URLSearchParams(current); next.set('sort', sort); next.delete('sheet'); return next; }, { replace: true }); }}><span className="sp-radio" />{text(`sort.${sort}`)}</button>)}</div></Sheet>}
  </div>;
}
