/** Local, lazy demo backend. No timers: only parent reads advance demo rides. */
import seed from '../data/seed.json';
import { CATEGORIES, KIT_ALL, KIT_REQUIRED, NEEDS, RIDE_FLOW, RidesError } from './ridesTypes';
import type { Driver, DriverDraft, DriverPublic, FeedItem, KitItem, OfferView, RatingTag, RideDraft, RideStatus, RideView } from './ridesTypes';
import { canOffer, canTransition, hintsFor, isValidPrice, nextStatus, offerLimit } from './ridesRules';

export const DEMO_REPLY_MS = 4000;
export const DEMO_STEP_MS = 8000;
const KEY = 'demeu.ridesMock';
const KIT_AGE_MS = 12 * 60 * 60 * 1000;
type Store = { drivers: Driver[]; rides: RideView[] };
const now = () => new Date().toISOString();
const id = () => `local-${crypto.randomUUID()}`;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function initial(): Store {
  const names = ['Айбар Демеуов', 'Аружан Жолбаева', 'Ерасыл Нуржолин', 'Мирас Демежанов', 'Дана Жолсенова', 'Нурлан Демеубеков'];
  const cars = ['Demo Sedan, серый', 'Demo Wagon, белый', 'Demo Van, синий', 'Demo Sedan, бежевый', 'Demo Wagon, зелёный', 'Demo Van, серебристый'];
  const experience: Driver['worked_with'][] = [['asd', 'zpr'], ['cp', 'wheelchair'], ['hearing', 'vision'], ['asd', 'epilepsy'], ['cp', 'down'], ['wheelchair', 'zpr']];
  return { rides: [], drivers: names.map((name, i) => ({ id: `drv-${i + 1}`, name, phone: `+7 700 000 00 0${i + 1}`, car: cars[i], plate: `00${i + 1} DMU 02`, rating: 4.8,
    verified: true, trained: true, online: true, kit_checked_at: now(), kit_ok: true, worked_with: experience[i], is_demo: i >= 3 })) };
}
let memory: Store | undefined;
let memoryOnly = false;
function read(): Store {
  if (memoryOnly && memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Store;
      if (Array.isArray(parsed.rides) && Array.isArray(parsed.drivers)) return memory = parsed;
    }
    // Missing key means an intentional reset (including clearing the demo).
    return memory = initial();
  } catch { return memory ??= initial(); }
}
function save(store: Store) {
  memory = clone(store);
  try { localStorage.setItem(KEY, JSON.stringify(store)); memoryOnly = false; } catch { memoryOnly = true; }
}
function fail(status: number, code: string, extra?: Record<string, unknown>): never { throw new RidesError(status, code, extra); }
function driver(store: Store, driverId: string): Driver {
  const found = store.drivers.find(d => d.id === driverId);
  if (!found) fail(404, 'not_found');
  found.kit_ok = !!found.kit_checked_at && Date.now() >= Date.parse(found.kit_checked_at) && Date.now() - Date.parse(found.kit_checked_at) <= KIT_AGE_MS;
  return found;
}
function ready(d: Driver) { return d.online && d.verified && d.trained && d.kit_ok; }
function ride(store: Store, rideId: string): RideView {
  const found = store.rides.find(r => r.id === rideId);
  if (!found) fail(404, 'not_found');
  return found;
}
function owned(store: Store, rideId: string, parentRef: string) {
  const r = ride(store, rideId);
  if (r.parent_ref !== parentRef) fail(403, 'not_your_ride');
  return r;
}
function publicDriver(d: Driver, revealPhone = false): DriverPublic {
  return { id: d.id, name: d.name, initials: d.name.split(/\s+/).map(s => s[0]).slice(0, 2).join(''), car: d.car, plate: d.plate,
    rating: d.rating, trained: d.trained, verified: d.verified, kit_ok: d.kit_ok, worked_with: [...d.worked_with], phone: revealPhone ? d.phone : null, is_demo: d.is_demo };
}
function offerView(store: Store, r: RideView, o: OfferView): OfferView {
  return { ...clone(o), driver: publicDriver(driver(store, o.driver_id), r.driver_id === o.driver_id && RIDE_FLOW.includes(r.status)) };
}
function view(store: Store, r: RideView, perspective: 'parent' | 'driver' = 'parent', driverId?: string): RideView {
  const v = clone(r);
  v.driver = r.driver_id ? publicDriver(driver(store, r.driver_id), RIDE_FLOW.includes(r.status)) : null;
  v.offers = r.offers.filter(o => perspective === 'parent' || o.driver_id === driverId).map(o => offerView(store, r, o));
  if (perspective === 'parent' && !RIDE_FLOW.includes(r.status)) delete v.pin;
  if (perspective === 'driver') {
    delete v.parent_ref; delete v.child_ref; delete v.pin;
  }
  return v;
}
function makeOffer(store: Store, r: RideView, driverId: string, price: number): OfferView {
  const d = driver(store, driverId);
  if (r.status !== 'searching') fail(409, 'not_searching');
  if (!ready(d)) fail(403, 'driver_not_ready');
  if (!canOffer(r.parent_price, price)) fail(422, 'price_out_of_range');
  const previous = r.offers.find(o => o.driver_id === driverId && o.status === 'pending');
  if (previous?.price === price) return previous;
  if (previous) previous.status = 'withdrawn';
  const offerId = id();
  const hash = [...offerId].reduce((sum, c) => (sum * 31 + c.charCodeAt(0)) >>> 0, 0);
  const result: OfferView = { id: offerId, ride_id: r.id, driver_id: driverId, price, status: 'pending', created_at: now(), eta_minutes: 3 + hash % 8, driver: publicDriver(d) };
  r.offers.push(result);
  return result;
}
function advance(store: Store, r: RideView) {
  if (r.status === 'searching' && !r.offers.length && Date.now() - Math.max(Date.parse(r.created_at), Date.parse(r.price_changed_at)) >= DEMO_REPLY_MS) {
    const responders = store.drivers.filter(d => d.is_demo && ready(driver(store, d.id))).slice(0, 2);
    responders.forEach((d, i) => makeOffer(store, r, d.id, Math.min(r.parent_price + i * 500, offerLimit(r.parent_price), 50000)));
  }
  if (r.driver_id && driver(store, r.driver_id).is_demo) {
    if (nextStatus(r.status) && Date.now() - Date.parse(r.status_changed_at) >= DEMO_STEP_MS) {
      r.status = nextStatus(r.status)!;
      r.status_changed_at = now();
    }
  }
}
export function createRide(draft: RideDraft): RideView {
  if (!isValidPrice(draft.parent_price)) fail(422, 'price_out_of_range');
  if (!['express', 'scheduled'].includes(draft.mode) || !seed.districts.includes(draft.from_district) || !draft.to_address.trim()
    || (draft.comment?.length ?? 0) > 500 || (draft.category_other?.length ?? 0) > 120
    || !!draft.category_other && !draft.categories?.includes('other')
    || draft.categories?.some(c => !CATEGORIES.includes(c)) || draft.needs?.some(n => !NEEDS.includes(n))) fail(422, 'validation_error');
  if (draft.mode === 'scheduled' ? !draft.scheduled_at || !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(draft.scheduled_at) || !(Date.parse(draft.scheduled_at) > Date.now())
    : !!draft.scheduled_at || !!draft.repeat_days?.length || !!draft.needs_escort) fail(422, 'validation_error');
  if (draft.repeat_days?.some(d => !Number.isInteger(d) || d < 0 || d > 6)) fail(422, 'validation_error');
  const stamp = now();
  const r: RideView = { ...draft, id: id(), child_ref: draft.child_ref ?? null, from_address: draft.from_address ?? '',
    scheduled_at: draft.scheduled_at ?? null, repeat_days: [...new Set(draft.repeat_days ?? [])], needs_escort: draft.needs_escort ?? false,
    categories: [...new Set(draft.categories ?? [])], category_other: draft.category_other ?? '', show_category: true,
    needs: [...new Set(draft.needs ?? [])], comment: draft.comment ?? '', hints: hintsFor(draft.categories ?? []), initial_price: draft.parent_price,
    final_price: null, status: 'searching', driver_id: null, driver: null, pin: null, rating_stars: null, rating_tags: [],
    created_at: stamp, status_changed_at: stamp, price_changed_at: stamp, offers: [] };
  const store = read(); store.rides.push(r); save(store); return view(store, r);
}
export function getRide(rideId: string, perspective: 'parent' | 'driver' = 'parent', driverId?: string): RideView {
  const store = read(), r = ride(store, rideId);
  if (perspective === 'parent') advance(store, r);
  save(store); return view(store, r, perspective, driverId);
}
export function listRides(parentRef: string): RideView[] {
  const store = read();
  return store.rides.filter(r => r.parent_ref === parentRef).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).map(r => ({ ...view(store, r), offers: [] }));
}
export function raisePrice(rideId: string, parentRef: string, price: number): RideView {
  const store = read(), r = owned(store, rideId, parentRef);
  if (r.status !== 'searching') fail(409, 'not_searching');
  if (!isValidPrice(price)) fail(422, 'price_out_of_range');
  if (price <= r.parent_price) fail(409, 'price_not_higher');
  r.parent_price = price; r.price_changed_at = now(); save(store); return view(store, r);
}
export function cancelRide(rideId: string, parentRef: string): RideView {
  const store = read(), r = owned(store, rideId, parentRef);
  if (r.status === 'cancelled') fail(409, 'bad_transition');
  if (!['searching', 'accepted', 'driver_on_way', 'arrived', 'child_in_car'].includes(r.status)) fail(409, 'too_late');
  r.status = 'cancelled'; r.status_changed_at = now();
  r.offers.filter(o => o.status === 'pending').forEach(o => { o.status = 'withdrawn'; });
  save(store); return view(store, r);
}
function findOffer(store: Store, offerId: string, parentRef: string) {
  const r = store.rides.find(r => r.offers.some(o => o.id === offerId));
  if (!r) fail(404, 'not_found');
  owned(store, r.id, parentRef);
  const o = r.offers.find(o => o.id === offerId)!;
  if (r.status !== 'searching') fail(409, 'not_searching');
  if (o.status !== 'pending') fail(409, 'bad_transition');
  return { r, o };
}
export function acceptOffer(offerId: string, parentRef: string): RideView {
  const store = read(), { r, o } = findOffer(store, offerId, parentRef);
  r.offers.filter(x => x.status === 'pending').forEach(x => { x.status = x.id === o.id ? 'accepted' : 'declined'; });
  r.status = 'accepted'; r.status_changed_at = now(); r.driver_id = o.driver_id; r.final_price = o.price;
  const random = new Uint32Array(1); crypto.getRandomValues(random); r.pin = String(random[0] % 10000).padStart(4, '0');
  save(store); return view(store, r);
}
export function declineOffer(offerId: string, parentRef: string): OfferView {
  const store = read(), { r, o } = findOffer(store, offerId, parentRef);
  o.status = 'declined'; save(store); return offerView(store, r, o);
}
export function rateRide(rideId: string, parentRef: string, stars: number, tags: RatingTag[]): RideView {
  const store = read(), r = owned(store, rideId, parentRef);
  if (r.status !== 'completed') fail(409, 'bad_transition');
  if (r.rating_stars !== null) fail(409, 'already_rated');
  if (!Number.isInteger(stars) || stars < 1 || stars > 5 || tags.some(t => !['calm', 'careful', 'on_time'].includes(t))) fail(422, 'validation_error');
  r.rating_stars = stars; r.rating_tags = [...new Set(tags)];
  const d = driver(store, r.driver_id!); d.rating = Math.round((d.rating * 9 + stars) * 10) / 100;
  save(store); return view(store, r);
}
export function registerDriver(draft: DriverDraft): Driver {
  if (Object.values(draft).some(v => !v.trim())) fail(422, 'validation_error');
  const d: Driver = { ...draft, id: id(), rating: 4.8, verified: false, trained: false, kit_checked_at: null, online: false, worked_with: [], is_demo: false, kit_ok: false };
  const store = read(); store.drivers.push(d); save(store); return clone(d);
}
export function getDriver(driverId: string): Driver { return clone(driver(read(), driverId)); }
export function patchDriver(driverId: string, patch: Partial<DriverDraft> & { verified?: boolean; trained?: boolean }): Driver {
  const store = read(), d = driver(store, driverId);
  for (const [key, value] of Object.entries(patch)) {
    if (['verified', 'trained'].includes(key) ? typeof value !== 'boolean' : typeof value !== 'string' || !value.trim()) fail(422, 'validation_error');
  }
  Object.assign(d, patch); save(store); return clone(d);
}
export function kitCheck(driverId: string, items: KitItem[]): Driver {
  if (KIT_REQUIRED.some(k => !items.includes(k)) || items.some(k => !KIT_ALL.includes(k))) fail(422, 'kit_incomplete');
  const store = read(), d = driver(store, driverId); d.kit_checked_at = now(); d.kit_ok = true; save(store); return clone(d);
}
export function setOnline(driverId: string, online: boolean): Driver {
  const store = read(), d = driver(store, driverId);
  const missing = [...(!d.verified ? ['verified'] : []), ...(!d.trained ? ['trained'] : []), ...(!d.kit_ok ? ['kit'] : [])];
  if (online && missing.length) fail(409, 'not_ready', { detail: 'not_ready', missing });
  d.online = online; save(store); return clone(d);
}
export function getFeed(driverId: string): FeedItem[] {
  const store = read(); if (!ready(driver(store, driverId))) fail(403, 'driver_not_ready');
  return store.rides.filter(r => r.status === 'searching').sort((a, b) => Number(a.mode !== 'express') - Number(b.mode !== 'express') || (a.scheduled_at ?? a.created_at).localeCompare(b.scheduled_at ?? b.created_at))
    .map(r => { const v = view(store, r, 'driver', driverId); return { ...v, my_offer: v.offers.find(o => o.status === 'pending') ?? null, regular_label_days: [...r.repeat_days] }; });
}
export function sendOffer(rideId: string, driverId: string, price: number): OfferView {
  const store = read(), r = ride(store, rideId), o = makeOffer(store, r, driverId, price); save(store); return offerView(store, r, o);
}
export function setRideStatus(rideId: string, driverId: string, status: RideStatus, pin?: string): RideView {
  const store = read(), r = ride(store, rideId);
  if (r.driver_id !== driverId) fail(403, 'not_your_ride');
  // Driver status endpoint only advances along RIDE_FLOW; cancellation is a parent action.
  if (status === 'cancelled' || !canTransition(r.status, status)) fail(409, 'bad_transition');
  if (status === 'child_in_car' && pin !== r.pin) fail(403, 'wrong_pin');
  r.status = status; r.status_changed_at = now(); save(store); return view(store, r, 'driver', driverId);
}

/** Driver perspective, including completed and cancelled assigned rides (D-33). */
export function listDriverRides(driverId: string): RideView[] {
  const store = read();
  return store.rides.filter(r => r.driver_id === driverId && r.status !== 'searching')
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 50)
    .map(r => view(store, r, 'driver', driverId));
}
