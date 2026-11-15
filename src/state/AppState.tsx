import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { isChildCard } from '../lib/engine';
import { KB } from '../lib/personalPlan';
import type { ChildCard, SavedBooking, SharedCard } from '../lib/types';

export type ShareDefaults = Record<keyof SharedCard, boolean>;
export const DEFAULT_SHARE: ShareDefaults = { name: false, age: true, district: false, features: true, comm: true, react: true, goals: true, disability: false };
interface State {
  card: ChildCard | null;
  compare: number[];
  bookings: SavedBooking[];
  planDone: string[];
  onboarded: boolean;
  shareDefaults: ShareDefaults;
}
interface Actions {
  setCard: (card: ChildCard | null) => void;
  toggleCompare: (id: number) => 'added' | 'removed' | 'limit';
  addBooking: (booking: SavedBooking) => void;
  togglePlanDone: (code: string) => void;
  setOnboarded: (onboarded: boolean) => void;
  setShareDefaults: (defaults: ShareDefaults) => void;
  resetAll: () => void;
}
const AppState = createContext<(State & Actions) | null>(null);
/** Step ids of the family plan (plan_kb.json) and the legacy template codes: anything else in storage is ignored. */
const stepIds = new Set<string>(['pmpk', 'disability', 'speech', 'defect', 'psych', 'neuro', 'rehab', 'benefits', 'aba', ...KB.steps.map(step => step.id)]);
const validStepId = (code: unknown): code is string => typeof code === 'string' && stepIds.has(code);
const empty = (): State => ({ card: null, compare: [], bookings: [], planDone: [], onboarded: false, shareDefaults: { ...DEFAULT_SHARE } });
function read(key: keyof State): unknown {
  try { return JSON.parse(localStorage.getItem(`demeu.${key}`) ?? 'null'); } catch { return null; }
}
function isBooking(v: unknown): v is SavedBooking {
  if (!v || typeof v !== 'object') return false;
  const b = v as SavedBooking;
  return typeof b.id === 'string' && Number.isInteger(b.specialist_id) && typeof b.slot === 'string' && Number.isFinite(Date.parse(b.slot)) && ['Кабинет', 'На дом', 'Онлайн'].includes(b.format) && typeof b.created_at === 'string' && Number.isFinite(Date.parse(b.created_at));
}
function initial(): State {
  const state = empty();
  const card = read('card'), compare = read('compare'), bookings = read('bookings'), done = read('planDone'), defaults = read('shareDefaults');
  if (isChildCard(card)) state.card = card;
  if (Array.isArray(compare)) state.compare = [...new Set(compare.filter((id): id is number => typeof id === 'number' && Number.isInteger(id)))].slice(0, 3);
  if (Array.isArray(bookings)) state.bookings = bookings.filter(isBooking);
  if (Array.isArray(done)) state.planDone = [...new Set(done.filter(validStepId))];
  state.onboarded = read('onboarded') === true;
  if (defaults && typeof defaults === 'object') {
    for (const key of Object.keys(DEFAULT_SHARE) as (keyof ShareDefaults)[]) {
      const v = (defaults as ShareDefaults)[key];
      if (typeof v === 'boolean') state.shareDefaults[key] = v;
    }
  }
  return state;
}

export function AppStateProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState(initial);
  const current = useRef(state);
  // The ref makes sequential actions in a single React batch see each other's changes.
  const update = useCallback(<K extends keyof State,>(key: K, value: State[K]) => {
    current.current = { ...current.current, [key]: value };
    setState(current.current);
    try { localStorage.setItem(`demeu.${key}`, JSON.stringify(value)); } catch { /* Memory state remains usable. */ }
  }, []);
  const setCard = useCallback((card: ChildCard | null) => update('card', card), [update]);
  const toggleCompare = useCallback((id: number): 'added' | 'removed' | 'limit' => {
    const ids = current.current.compare;
    if (ids.includes(id)) { update('compare', ids.filter(v => v !== id)); return 'removed'; }
    if (ids.length >= 3) return 'limit';
    update('compare', [...ids, id]);
    return 'added';
  }, [update]);
  const addBooking = useCallback((booking: SavedBooking) => update('bookings', [...current.current.bookings.filter(b => b.id !== booking.id), booking]), [update]);
  const togglePlanDone = useCallback((code: string) => {
    const done = current.current.planDone;
    update('planDone', done.includes(code) ? done.filter(c => c !== code) : [...done, code]);
  }, [update]);
  const setOnboarded = useCallback((value: boolean) => update('onboarded', value), [update]);
  const setShareDefaults = useCallback((value: ShareDefaults) => update('shareDefaults', value), [update]);
  const resetAll = useCallback(() => {
    // Clears shared state and every screen-group namespace (demeu.plan.*, demeu.support.*, …); keeps the language.
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith('demeu.') && key !== 'demeu.lang');
      for (const key of keys) localStorage.removeItem(key);
    } catch { /* Reset in memory even if storage is unavailable. */ }
    current.current = empty();
    setState(current.current);
  }, []);
  const value = useMemo(() => ({ ...state, setCard, toggleCompare, addBooking, togglePlanDone, setOnboarded, setShareDefaults, resetAll }), [state, setCard, toggleCompare, addBooking, togglePlanDone, setOnboarded, setShareDefaults, resetAll]);
  return <AppState.Provider value={value}>{children}</AppState.Provider>;
}
export function useAppState() {
  const context = useContext(AppState);
  if (!context) throw new Error('useAppState must be used within AppStateProvider');
  return context;
}
