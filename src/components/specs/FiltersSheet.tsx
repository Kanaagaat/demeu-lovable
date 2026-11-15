import { useSpecText, Sheet } from './ui';
import { Icon } from '../Icon';
import { filterGroups } from '../../state/specs';
import type { FilterKey } from '../../state/specs';

export function FiltersSheet({ params, count, district, onToggle, onValue, onReset, onClose, onApply }: {
  params: URLSearchParams; count: number; district?: string | null;
  onToggle: (key: FilterKey, value: string) => void;
  onValue: (key: string, value: string | null) => void;
  onReset: () => void; onClose: () => void; onApply: () => void;
}) {
  const { text, label, specialists } = useSpecText();
  const group = (index: number) => {
    const g = filterGroups[index];
    return <section key={g.key}><h3 className="mb-2.5 text-base font-extrabold">{text(g.title)}</h3><div className="flex flex-wrap gap-2">{g.options.map(o => <button key={o} className="sp-chip" aria-pressed={params.getAll(g.key).includes(o)} onClick={() => onToggle(g.key, o)}>{g.key === 'price' && o === 'free' ? text('freeQuota') : g.key === 'price' || g.key === 'group' ? text(o) : label(o)}</button>)}</div></section>;
  };
  const time = Number(params.get('max_minutes') ?? 60);
  return <Sheet title={text('filters')} full onClose={onClose} footer={<><button className="sp-secondary" onClick={onReset}>{text('reset')}</button><button className="sp-primary flex-1" onClick={onApply}>{count ? `${text('show')} ${specialists(count, true)}` : text('loosenFilters')}</button></>}>
    {[0, 1, 2].map(group)}
    <section><div className="mb-1.5 flex justify-between gap-2"><label htmlFor="specs-time" className="font-extrabold">{text('travelTime')}</label><span className="font-extrabold text-brand">{time >= 60 ? text('anyTime') : `${text('upTo')} ${time} ${text('min')}`}</span></div><input id="specs-time" type="range" min={10} max={60} step={5} value={time} disabled={!district} onChange={e => onValue('max_minutes', e.target.value)} className="h-8 w-full accent-brand" /><div className="flex justify-between text-[13px] text-muted"><span>10 {text('min')}</span><span>{text('oneHour')}</span></div>{!district && <p className="mt-2 text-sm text-muted">{text('needDistrict')}</p>}</section>
    {[3, 4, 5].map(group)}
    <div className="flex items-center gap-3 rounded-[20px] bg-mist px-4 py-3.5"><Icon name="shield" size={24} /><span className="flex-1 font-extrabold">{text('verifiedOnly')}</span><button role="switch" aria-checked={params.get('verified') === 'true'} aria-label={text('verifiedOnly')} onClick={() => onValue('verified', params.get('verified') === 'true' ? null : 'true')} className="relative h-8 w-[52px] shrink-0 rounded-full" style={{ background: params.get('verified') === 'true' ? '#6755B2' : '#D8D2E6' }}><span className="absolute top-[3px] h-[26px] w-[26px] rounded-full bg-white shadow transition-[left]" style={{ left: params.get('verified') === 'true' ? 23 : 3 }} /></button></div>
  </Sheet>;
}
