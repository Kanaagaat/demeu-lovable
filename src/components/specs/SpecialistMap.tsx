import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Icon } from '../Icon';
import type { MatchItem, SpecialistCard } from '../../lib/types';
import { ALMATY_CENTER, DISTRICT_GEO, districtAt } from '../../lib/geo';
import { Avatar, useSpecText } from './ui';

const centre = (district?: string | null): [number, number] | null => {
  const feature = DISTRICT_GEO.features.find(f => f.properties.district === district);
  return feature ? [feature.properties.lat, feature.properties.lon] : null;
};
// Fictional specialists get a stable demo point inside their real district (derived from map_x/map_y).
export function pointFor(item: Pick<SpecialistCard, 'district' | 'map_x' | 'map_y'>): [number, number] {
  const base = centre(item.district) ?? ALMATY_CENTER;
  for (let scale = 1; scale > .05; scale /= 2) {
    const point: [number, number] = [base[0] + (50 - item.map_y) / 50 * .018 * scale, base[1] + (item.map_x - 50) / 50 * .028 * scale];
    if (districtAt(point[0], point[1]) === item.district) return point;
  }
  return base;
}

export function SpecialistMap({ items, selectedId, onSelect, onList, showHome, homeDistrict }: { items: (SpecialistCard | MatchItem)[]; selectedId: number | null; onSelect: (id: number | null) => void; onList: () => void; showHome: boolean; homeDistrict?: string | null }) {
  const { text, label, money, minutes } = useSpecText();
  const selected = items.find(p => p.id === selectedId);
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pins = useRef<L.LayerGroup | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    if (!box.current || map.current) return;
    let instance: L.Map;
    try { instance = L.map(box.current, { center: ALMATY_CENTER, zoom: 11, zoomControl: false }); }
    catch { return; }
    map.current = instance;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors' }).addTo(instance);
    L.control.zoom({ position: 'bottomright' }).addTo(instance);
    L.geoJSON(DISTRICT_GEO as unknown as GeoJSON.FeatureCollection, { style: { color: '#6755B2', weight: 1, opacity: .5, fillOpacity: 0 }, interactive: false }).addTo(instance);
    pins.current = L.layerGroup().addTo(instance);
    instance.on('click', () => selectRef.current(null));
    const home = showHome ? centre(homeDistrict) : null;
    if (home) {
      L.marker(home, { icon: L.divIcon({ className: 'dm-home', html: `<span><img src="/icons/fluency-systems-regular/6755B2/home.png" alt="" width="22" height="22"></span><b>${text('home')}</b>`, iconSize: [60, 64], iconAnchor: [30, 24] }), interactive: false, keyboard: false }).addTo(instance);
      instance.setView(home, 11);
    }
    const timer = setTimeout(() => instance.invalidateSize(), 300);
    return () => { clearTimeout(timer); instance.remove(); map.current = null; pins.current = null; };
    // The map is created once; pins are refreshed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const group = pins.current;
    if (!group) return;
    group.clearLayers();
    const shown = items.slice(0, 24);
    if (selected && !shown.includes(selected)) shown.push(selected);
    for (const p of shown) {
      const on = p.id === selectedId;
      const match = 'match' in p && p.match;
      const marker = L.marker(pointFor(p), {
        icon: L.divIcon({ className: `dm-price${on ? ' dm-price-on' : match ? ' dm-price-match' : ''}`, html: `<span>${money(p.price)}</span>`, iconSize: undefined, iconAnchor: [0, 0] }),
        title: `${p.name}, ${money(p.price)}`, zIndexOffset: on ? 1000 : match ? 100 : 0,
      });
      marker.on('click', e => { L.DomEvent.stopPropagation(e); selectRef.current(p.id); });
      group.addLayer(marker);
      marker.getElement()?.setAttribute('aria-label', `${p.name}, ${money(p.price)}`);
      marker.getElement()?.setAttribute('aria-pressed', String(on));
    }
    if (selected && map.current) map.current.panTo(pointFor(selected), { animate: true });
  }, [items, selectedId, selected, money]);

  return <><div className="sp-map sp-map-real mt-2" aria-label={text('map')}>
    <div ref={box} className="absolute inset-0" />
    <button className="absolute left-1/2 top-4 z-[500] flex h-11 -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-[18px] text-[15px] font-extrabold text-brand shadow-card" onClick={onList}><Icon name="list" color="6E6880" size={18} />{text('showList')}</button>
  </div>{selected && <div className="sp-pin-preview"><div className="sp-handle !mt-0" /><div className="flex items-center gap-3"><Avatar initials={selected.initials} tint={selected.tint} size={56} /><div className="flex-1"><h2 className="text-[17px] font-extrabold">{selected.name}</h2><div className="sp-meta">{label(selected.role)} · {minutes(selected.travel_minutes)}</div><div className="sp-rating"><Icon name="star" color="E5A84B" size={15} />{selected.rating}<span className="font-semibold text-muted">· {money(selected.price)}</span></div></div><button className="sp-close" aria-label={text('close')} onClick={() => onSelect(null)}><Icon name="cancel" size={16} /></button></div><div className="flex gap-2.5"><Link className="sp-secondary flex-1" to={`/specialists/${selected.id}`}>{text('details')}</Link><Link className="sp-primary flex-1" to={`/book/${selected.id}`}>{text('book')}</Link></div></div>}</>;
}
