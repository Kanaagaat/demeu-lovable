import seed from '../data/seed.json';
import { ALMATY_CENTER, DISTRICT_GEO, districtAt } from './geo';

/** A picked address. `address` may be empty when only the district is known. */
export interface Place { address: string; district: string; lat: number | null; lng: number | null }

const PHOTON = 'https://photon.komoot.io';
// Almaty bounding box: lon min, lat min, lon max, lat max.
const BBOX = '76.70,43.10,77.15,43.45';
const TIMEOUT_MS = 4000;

// Urban centres from the seed (polygon centroids of mountain districts fall into the hills).
const CENTERS = (seed as unknown as { district_centers: Record<string, { latitude: number; longitude: number }> }).district_centers;
export const districtCenter = (district: string): [number, number] => {
  const c = CENTERS[district];
  return c ? [c.latitude, c.longitude] : ALMATY_CENTER;
};

/** District of a point: exact polygon first, otherwise the closest district centre (suburbs, boundary rounding). */
export function districtFor(lat: number, lng: number): string {
  const exact = districtAt(lat, lng);
  if (exact) return exact;
  let best = DISTRICT_GEO.features[0].properties.district, bestDistance = Infinity;
  for (const { properties } of DISTRICT_GEO.features) {
    const d = (properties.lat - lat) ** 2 + (properties.lon - lng) ** 2;
    if (d < bestDistance) { bestDistance = d; best = properties.district; }
  }
  return best;
}

export const placeFromPoint = (lat: number, lng: number, address = ''): Place => ({ address, district: districtFor(lat, lng), lat, lng });
export const placeFromDistrict = (district: string): Place => {
  const [lat, lng] = districtCenter(district);
  return { address: '', district, lat, lng };
};

interface PhotonFeature { geometry?: { coordinates?: [number, number] }; properties?: Record<string, string | undefined> }
function describe(properties: Record<string, string | undefined> = {}): string {
  const street = [properties.street, properties.housenumber].filter(Boolean).join(', ');
  const name = properties.name && properties.name !== properties.street ? properties.name : '';
  return [name, street].filter(Boolean).join(', ') || properties.district || properties.city || '';
}
function toPlace(feature: PhotonFeature): Place | null {
  const coordinates = feature.geometry?.coordinates;
  if (!coordinates) return null;
  const [lng, lat] = coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const address = describe(feature.properties);
  return address ? placeFromPoint(lat, lng, address) : null;
}

async function getJson(url: string, signal?: AbortSignal): Promise<{ features?: PhotonFeature[] }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`geocoder ${response.status}`);
    return await response.json() as { features?: PhotonFeature[] };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

/** Address search inside Almaty (Photon / OpenStreetMap). Rejects on network errors — callers fall back to `localPlaces`. */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `${PHOTON}/api/?q=${encodeURIComponent(q)}&limit=6&lat=${ALMATY_CENTER[0]}&lon=${ALMATY_CENTER[1]}&bbox=${BBOX}`;
  const data = await getJson(url, signal);
  const seen = new Set<string>();
  return (data.features ?? []).map(toPlace).filter((p): p is Place => {
    if (!p || seen.has(p.address)) return false;
    seen.add(p.address);
    return true;
  });
}

/** Address of a map point; '' when unknown or offline. */
export async function reversePlace(lat: number, lng: number, signal?: AbortSignal): Promise<string> {
  try {
    const data = await getJson(`${PHOTON}/reverse?lat=${lat}&lon=${lng}&limit=1`, signal);
    return describe(data.features?.[0]?.properties);
  } catch {
    return '';
  }
}

interface SeedSpecialist { address?: string; district?: string; map_x?: number; map_y?: number }
/** Offline fallback: (fictional) specialist addresses from the demo seed and district names. */
export function localPlaces(query: string): Place[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const result: Place[] = [];
  for (const district of DISTRICT_GEO.features.map(f => f.properties.district)) {
    if (district.toLowerCase().includes(q)) result.push(placeFromDistrict(district));
  }
  for (const s of (seed as unknown as { specialists: SeedSpecialist[] }).specialists) {
    if (!s.address || !s.district || !s.address.toLowerCase().includes(q)) continue;
    const [lat, lng] = districtCenter(s.district);
    const point: [number, number] = [lat + (50 - (s.map_y ?? 50)) / 50 * .01, lng + ((s.map_x ?? 50) - 50) / 50 * .015];
    if (!result.some(p => p.address === s.address)) result.push({ address: s.address, district: s.district, lat: point[0], lng: point[1] });
  }
  return result.slice(0, 6);
}
