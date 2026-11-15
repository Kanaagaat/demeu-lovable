import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ALMATY_CENTER } from '../../lib/geo';

export type LatLng = [number, number];

/** Map with a fixed pin in the middle (like taxi apps): dragging the map moves the point. */
export function PlaceMap({ center, zoom, onMove, label }: { center: LatLng | null; zoom: number; onMove: (lat: number, lng: number) => void; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const moveRef = useRef(onMove);
  moveRef.current = onMove;
  const programmatic = useRef(false);
  const start = useRef(center ?? ALMATY_CENTER);

  useEffect(() => {
    if (!box.current || map.current) return;
    let instance: L.Map;
    try { instance = L.map(box.current, { center: start.current, zoom, zoomControl: false, attributionControl: true }); }
    catch { return; }
    map.current = instance;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>' }).addTo(instance);
    L.control.zoom({ position: 'bottomright' }).addTo(instance);
    instance.on('moveend', () => {
      if (programmatic.current) { programmatic.current = false; return; }
      const c = instance.getCenter();
      moveRef.current(c.lat, c.lng);
    });
    const timer = setTimeout(() => instance.invalidateSize(), 250);
    return () => { clearTimeout(timer); instance.remove(); map.current = null; };
    // Created once; recentring happens below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !center) return;
    const c = instance.getCenter();
    if (Math.abs(c.lat - center[0]) < 1e-6 && Math.abs(c.lng - center[1]) < 1e-6) return;
    programmatic.current = true;
    instance.setView(center, Math.max(instance.getZoom(), zoom), { animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center]);

  return <div className="rd-map" role="application" aria-label={label}>
    <div ref={box} className="rd-map-canvas" />
    <svg className="rd-map-pin" width="34" height="44" viewBox="0 0 34 44" aria-hidden="true">
      <path d="M17 43C17 43 31 28 31 16.5C31 8.5 24.7 2 17 2S3 8.5 3 16.5C3 28 17 43 17 43Z" fill="#6755B2" stroke="#fff" strokeWidth="2.5" />
      <circle cx="17" cy="16.5" r="5.5" fill="#fff" />
    </svg>
    <span className="rd-map-dot" aria-hidden="true" />
  </div>;
}
