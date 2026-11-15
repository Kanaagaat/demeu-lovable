import districts from '../data/almaty-districts.json';

// Real Almaty district boundaries (OpenStreetMap, ODbL, simplified). Used on-device only.
type Ring = [number, number][];
interface DistrictFeature { type: 'Feature'; properties: { district: string; lat: number; lon: number }; geometry: { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] } }
export const DISTRICT_GEO = districts as unknown as { type: 'FeatureCollection'; attribution: string; features: DistrictFeature[] };
export const ALMATY_CENTER: [number, number] = [43.2389, 76.8897];

function inRing([x, y]: [number, number], ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inPolygon = (point: [number, number], rings: Ring[]) => inRing(point, rings[0]) && !rings.slice(1).some(hole => inRing(point, hole));

/** District containing the point, or null when outside Almaty. */
export function districtAt(lat: number, lng: number): string | null {
  const point: [number, number] = [lng, lat];
  for (const feature of DISTRICT_GEO.features) {
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    if (polygons.some(rings => inPolygon(point, rings))) return feature.properties.district;
  }
  return null;
}
