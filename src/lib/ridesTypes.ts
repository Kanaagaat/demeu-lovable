/** Rides contract types — mirror PLAN.md §7. Owned by the tech lead: change only together with PLAN.md. */
export type RideMode = 'express' | 'scheduled';
export type RideStatus = 'searching' | 'accepted' | 'driver_on_way' | 'arrived' | 'child_in_car' | 'in_ride' | 'completed' | 'cancelled';
export type Category = 'asd' | 'cp' | 'down' | 'zpr' | 'hearing' | 'vision' | 'epilepsy' | 'wheelchair' | 'other';
export type Need = 'quiet' | 'child_seat' | 'wheelchair_space' | 'door_lock';
export type Hint = 'quiet_ride' | 'may_run_lock_doors' | 'boarding_help' | 'folding_wheelchair' | 'seizure_first_aid' | 'communicate_hearing' | 'communicate_vision' | 'help_to_door';
export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn';
export type RatingTag = 'calm' | 'careful' | 'on_time';
export type KitItem = 'first_aid_kit' | 'diapers' | 'water' | 'wet_wipes' | 'bags' | 'spare_clothes' | 'noise_headphones' | 'child_seat';

/** Status order of an active ride after acceptance (timeline steps, left to right). */
export const RIDE_FLOW: RideStatus[] = ['accepted', 'driver_on_way', 'arrived', 'child_in_car', 'in_ride', 'completed'];
export const CATEGORIES: Category[] = ['asd', 'cp', 'down', 'zpr', 'hearing', 'vision', 'epilepsy', 'wheelchair', 'other'];
export const NEEDS: Need[] = ['quiet', 'child_seat', 'wheelchair_space', 'door_lock'];
/** First five items are required before going online; the rest are recommended. */
export const KIT_REQUIRED: KitItem[] = ['first_aid_kit', 'diapers', 'water', 'wet_wipes', 'bags'];
export const KIT_ALL: KitItem[] = [...KIT_REQUIRED, 'spare_clothes', 'noise_headphones', 'child_seat'];
export const PRICE_MIN = 500;
export const PRICE_MAX = 50000;
export const PRICE_STEP = 100;
/** Driver may offer up to +50% of the parent's price, in +200 ₸ UI steps. */
export const OFFER_MAX_FACTOR = 1.5;
export const OFFER_UI_STEP = 200;

export interface DriverPublic {
  id: string; name: string; initials: string; car: string; plate: string; rating: number;
  trained: boolean; verified: boolean; kit_ok: boolean; worked_with: Category[];
  phone?: string | null; is_demo: boolean;
}
export interface Driver {
  id: string; name: string; phone: string; car: string; plate: string; rating: number;
  verified: boolean; trained: boolean; kit_checked_at: string | null; online: boolean;
  worked_with: Category[]; is_demo: boolean; kit_ok: boolean;
}
export interface OfferView {
  id: string; ride_id: string; driver_id: string; price: number; status: OfferStatus;
  created_at: string; eta_minutes: number; driver: DriverPublic;
}
export interface RideView {
  id: string; parent_ref?: string; child_ref?: string | null; mode: RideMode;
  from_district: string; from_address: string; to_address: string;
  scheduled_at: string | null; repeat_days: number[]; needs_escort: boolean;
  categories: Category[]; category_other: string; show_category: boolean;
  needs: Need[]; comment: string; hints: Hint[];
  parent_price: number; initial_price: number; final_price: number | null;
  status: RideStatus; driver_id: string | null; driver: DriverPublic | null;
  pin?: string | null; rating_stars: number | null; rating_tags: RatingTag[];
  created_at: string; status_changed_at: string; price_changed_at: string;
  offers: OfferView[];
}
export interface FeedItem extends RideView { my_offer: OfferView | null; regular_label_days: number[] }
export interface RideDraft {
  parent_ref: string; child_ref?: string | null; mode: RideMode;
  from_district: string; from_address?: string; to_address: string;
  scheduled_at?: string | null; repeat_days?: number[]; needs_escort?: boolean;
  categories?: Category[]; category_other?: string; show_category?: boolean;
  needs?: Need[]; comment?: string; parent_price: number;
}
export interface Estimate { minutes: number; low: number; high: number; suggested: number }
export interface DriverDraft { name: string; phone: string; car: string; plate: string }
/** Error raised by the rides client for 4xx answers: `code` is the API `detail` (e.g. "wrong_pin"). */
export class RidesError extends Error {
  constructor(public status: number, public code: string, public extra?: Record<string, unknown>) { super(code); }
}
