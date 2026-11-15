import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useT } from '../../i18n';
import { DISTRICTS } from '../../state/home';
import { DISTRICT_GEO, districtAt } from '../../lib/geo';
import { Icon } from '../Icon';
import { Primary } from './ui';

// Real OpenStreetMap with the actual district borders. Tap the map (or use geolocation): the district is
// computed on the device; coordinates are never sent to DEMEU or stored.
const style = (on: boolean): L.PathOptions => ({ color: on ? '#4E3F99' : '#6755B2', weight: on ? 3 : 1.5, fillColor: '#6755B2', fillOpacity: on ? .35 : .06 });
const CITY: [number, number] = [43.245, 76.905];
const pinIcon = L.divIcon({ className: 'dm-pin', html: '<span></span>', iconSize: [28, 28], iconAnchor: [14, 28] });

export function DistrictMap({ value, onPick, onClose, toast }: { value: string; onPick: (district: string) => void; onClose: () => void; toast: (text: string) => void }) {
  const { t } = useT();
  const [selected, setSelected] = useState(DISTRICTS.includes(value) ? value : '');
  const [locating, setLocating] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef(new Map<string, L.Polygon>());
  const pin = useRef<L.Marker | null>(null);
  const label = (district: string) => t(`home.districts.${DISTRICTS.indexOf(district)}`);
  const labelRef = useRef(label);
  labelRef.current = label;
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const choosePoint = (lat: number, lng: number, fly: boolean) => {
    const district = districtAt(lat, lng);
    if (!district) { toastRef.current(t('home.quiz.mapFar')); return; }
    setSelected(district);
    if (map.current) {
      pin.current?.remove();
      pin.current = L.marker([lat, lng], { icon: pinIcon, keyboard: false }).addTo(map.current);
      if (fly) map.current.flyTo([lat, lng], 13, { duration: .8 });
    }
  };
  const chooseRef = useRef(choosePoint);
  chooseRef.current = choosePoint;

  useEffect(() => {
    if (!box.current || map.current) return;
    let instance: L.Map;
    try {
      instance = L.map(box.current, { center: CITY, zoom: 11, zoomControl: true, attributionControl: true });
    }
    catch { return; }
    map.current = instance;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors' }).addTo(instance);
    for (const feature of DISTRICT_GEO.features) {
      const geo = L.geoJSON(feature as unknown as GeoJSON.Feature, { style: () => style(false) });
      geo.eachLayer(layer => {
        const polygon = layer as L.Polygon;
        layers.current.set(feature.properties.district, polygon);
        polygon.bindTooltip(labelRef.current(feature.properties.district).split(' ')[0], { permanent: true, direction: 'center', className: 'dm-label' });
        polygon.on('click', e => chooseRef.current(e.latlng.lat, e.latlng.lng, false));
      });
      geo.addTo(instance);
    }
    instance.on('click', e => chooseRef.current(e.latlng.lat, e.latlng.lng, false));
    // The sheet animates in; recompute size once it has settled, then frame the city itself.
    const timer = setTimeout(() => { instance.invalidateSize(); instance.setView(CITY, 11); }, 400);
    const polygons = layers.current;
    return () => { clearTimeout(timer); instance.remove(); map.current = null; polygons.clear(); pin.current = null; };
  }, []);

  useEffect(() => {
    layers.current.forEach((polygon, district) => {
      polygon.setStyle(style(district === selected));
      if (district === selected) polygon.bringToFront();
    });
  }, [selected]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  const locate = () => {
    if (!navigator.geolocation) { toast(t('home.quiz.mapDenied')); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      setLocating(false);
      const district = districtAt(position.coords.latitude, position.coords.longitude);
      if (!district) { toast(t('home.quiz.mapFar')); return; }
      choosePoint(position.coords.latitude, position.coords.longitude, true);
      toast(t('home.quiz.mapFound').replace('{district}', label(district)));
    }, () => { setLocating(false); toast(t('home.quiz.mapDenied')); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 });
  };

  return <div className="hm-sheet-backdrop" onClick={onClose}>
    <div className="hm-sheet" role="dialog" aria-modal="true" aria-labelledby="home-map-title" onClick={e => e.stopPropagation()}>
      <div className="hm-sheet-handle" />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h2 id="home-map-title" style={{ fontSize: 22 }}>{t('home.quiz.mapTitle')}</h2>
          <p className="hm-sub" style={{ fontSize: 15, lineHeight: '21px', marginTop: 4 }}>{t('home.quiz.mapSub')}</p>
        </div>
        <button className="hm-icon-tile" style={{ border: 0, background: '#F4F2F7', width: 40, height: 40, borderRadius: '50%' }} aria-label={t('home.close')} onClick={onClose}><Icon name="cancel" size={16} color="6755B2" /></button>
      </div>
      <div ref={box} className="dm-map" aria-label={t('home.quiz.mapTitle')} />
      {/* Accessible fallback: the same choice as a list of districts. */}
      <div className="dm-district-chips" role="group" aria-label={t('home.quiz.mapTitle')}>
        {DISTRICTS.map(district => <button key={district} aria-pressed={selected === district} onClick={() => setSelected(district)}>{label(district).split(' ')[0]}</button>)}
      </div>
      <button className="hm-text-button" disabled={locating} onClick={locate} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44 }}>
        <Icon name="marker" size={20} color="6E6880" />{t(locating ? 'home.quiz.mapLocating' : 'home.quiz.mapLocate')}
      </button>
      <p style={{ fontSize: 13, lineHeight: '18px', color: '#8A849A', textAlign: 'center' }}>{t('home.quiz.mapPrivacy')}</p>
      <Primary disabled={!selected} onClick={() => { onPick(selected); onClose(); }}>{selected ? `${t('home.quiz.mapDone')}: ${label(selected)}` : t('home.quiz.mapDone')}</Primary>
    </div>
  </div>;
}
