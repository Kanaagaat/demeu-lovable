import { useEffect, useRef, useState } from 'react';
import { useT } from '../../i18n';
import { DISTRICTS } from '../../state/home';
import { districtCenter, localPlaces, placeFromPoint, reversePlace, searchPlaces } from '../../lib/places';
import type { Place } from '../../lib/places';
import { PlaceMap } from './PlaceMap';

const districtLabel = (t: (key: string) => string, district: string) => {
  const i = DISTRICTS.indexOf(district);
  return i >= 0 ? t(`home.districts.${i}`) : district;
};

/** Full-screen address picker: search on top, map with a centre pin below (Yandex-style). */
export function AddressPicker({ title, initial, suggestions = [], onPick, onClose }: {
  title: string;
  initial: Place;
  suggestions?: Place[];
  onPick: (place: Place) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const text = (key: string) => t(`ridesNew.${key}`);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const [point, setPoint] = useState<Place>(initial);
  const [center, setCenter] = useState<[number, number] | null>(initial.lat != null && initial.lng != null ? [initial.lat, initial.lng] : districtCenter(initial.district));
  const [zoom, setZoom] = useState(initial.address ? 16 : 14);
  const [resolving, setResolving] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults(null); setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      searchPlaces(q, controller.signal).then(
        found => { setOffline(false); setResults(found.length ? found : localPlaces(q)); },
        () => { if (!controller.signal.aborted) { setOffline(true); setResults(localPlaces(q)); } },
      ).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  async function moved(lat: number, lng: number) {
    const id = ++seq.current;
    setPoint(placeFromPoint(lat, lng, ''));
    setResolving(true);
    const address = await reversePlace(lat, lng);
    if (id !== seq.current) return;
    setPoint(placeFromPoint(lat, lng, address));
    setResolving(false);
  }
  function choose(place: Place) {
    seq.current++;
    setPoint(place);
    setResolving(false);
    if (place.lat != null && place.lng != null) { setZoom(place.address ? 16 : 14); setCenter([place.lat, place.lng]); }
    setQuery('');
    setResults(null);
  }
  const free = query.trim();
  const showList = free.length >= 2;
  const pointText = point.address || (resolving ? text('locating') : text('pinPoint'));

  return <div className="rd-pick" role="dialog" aria-modal="true" aria-label={title}>
    <header className="rd-pick-head">
      <button type="button" className="rd-pick-back" aria-label={t('common.back')} onClick={onClose}>‹</button>
      <input className="rd-pick-search" type="search" value={query} onChange={e => setQuery(e.target.value)} autoFocus={false}
        placeholder={`${title}: ${text('searchPlaceholder')}`} aria-label={text('searchLabel')} enterKeyHint="search" autoComplete="off" />
    </header>
    {showList ? <div className="rd-pick-list" role="listbox" aria-label={text('results')}>
      {loading && !results && <p className="rd-pick-note">{text('searching')}</p>}
      {offline && <p className="rd-pick-note">{text('offlineSearch')}</p>}
      {results?.map(place => <button type="button" role="option" aria-selected={false} key={`${place.address}${place.lat}`} className="rd-pick-row" onClick={() => choose(place)}>
        <strong>{place.address || districtLabel(t, place.district)}</strong><span>{districtLabel(t, place.district)}</span></button>)}
      {results && results.length === 0 && !loading && <p className="rd-pick-note">{text('noResults')}</p>}
      <button type="button" className="rd-pick-row rd-pick-free" onClick={() => choose({ ...point, address: free })}>
        <strong>{text('useAsIs').replace('{text}', free)}</strong><span>{districtLabel(t, point.district)}</span></button>
    </div> : <>
      {suggestions.length > 0 && <div className="rd-pick-chips" aria-label={text('suggestions')}>{suggestions.map(place => <button type="button" key={`${place.address}${place.district}`} onClick={() => choose(place)}>
        {place.address || `${districtLabel(t, place.district)}`}</button>)}</div>}
      <PlaceMap center={center} zoom={zoom} onMove={moved} label={text('mapLabel')} />
    </>}
    {!showList && <footer className="rd-pick-foot">
      <div className="rd-pick-addr"><strong>{pointText}</strong><span>{districtLabel(t, point.district)}</span></div>
      <button type="button" className="rd-pick-ok" disabled={resolving} onClick={() => onPick(point)}>{text('choose')}</button>
    </footer>}
  </div>;
}
