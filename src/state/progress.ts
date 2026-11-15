/** Session calendar and the parent's own progress notes. Stored on the device only (demeu.progress.*), cleared by «reset data». */
import { useCallback, useState } from 'react';
import type { SavedBooking } from '../lib/types';

export interface Session { id: string; title: string; date: string; time: string; repeat: boolean }
export type Mark = 'done' | 'missed';
export interface LevelEntry { date: string; goal: string; level: number }
export interface Win { id: string; date: string; text: string }
export interface Occurrence { key: string; title: string; time: string; date: string; kind: 'session' | 'booking'; sessionId?: string; format?: string }

export const LEVELS = [1, 2, 3, 4, 5] as const;
export const TITLE_MAX = 60;
export const WIN_MAX = 140;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const pad = (n: number) => String(n).padStart(2, '0');
/** Local calendar day of the device, YYYY-MM-DD. */
export function ymd(date: Date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
export function parseYmd(value: string) { const [y, m, d] = value.split('-').map(Number); return new Date(y, m - 1, d, 12); }
export const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

function read<T>(key: string, valid: (value: unknown) => value is T): T[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(`demeu.progress.${key}`) ?? '[]');
    return Array.isArray(value) ? value.filter(valid) : [];
  } catch { return []; }
}
function readMarks(): Record<string, Mark> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('demeu.progress.marks') ?? '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, mark]) => mark === 'done' || mark === 'missed')) as Record<string, Mark>;
  } catch { return {}; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(`demeu.progress.${key}`, JSON.stringify(value)); } catch { /* In-memory state still works. */ }
}
const isSession = (v: unknown): v is Session => !!v && typeof v === 'object' && typeof (v as Session).id === 'string' && typeof (v as Session).title === 'string'
  && DATE.test((v as Session).date) && TIME.test((v as Session).time) && typeof (v as Session).repeat === 'boolean';
const isLevel = (v: unknown): v is LevelEntry => !!v && typeof v === 'object' && DATE.test((v as LevelEntry).date) && typeof (v as LevelEntry).goal === 'string'
  && Number.isInteger((v as LevelEntry).level) && (v as LevelEntry).level >= 1 && (v as LevelEntry).level <= 5;
const isWin = (v: unknown): v is Win => !!v && typeof v === 'object' && typeof (v as Win).id === 'string' && DATE.test((v as Win).date) && typeof (v as Win).text === 'string';

/** Everything planned on a given day: own sessions (one-off or weekly from their start date) and bookings with specialists. */
export function occurrencesOn(day: string, sessions: Session[], bookings: SavedBooking[]): Occurrence[] {
  const weekday = parseYmd(day).getDay();
  const own = sessions.filter(s => s.date === day || (s.repeat && s.date <= day && parseYmd(s.date).getDay() === weekday))
    .map(s => ({ key: `s:${s.id}|${day}`, title: s.title, time: s.time, date: day, kind: 'session' as const, sessionId: s.id }));
  const booked = bookings.filter(b => ymd(new Date(b.slot)) === day)
    .map(b => { const at = new Date(b.slot); return { key: `b:${b.id}|${day}`, title: '', time: `${pad(at.getHours())}:${pad(at.getMinutes())}`, date: day, kind: 'booking' as const, format: b.format }; });
  return [...own, ...booked].sort((a, b) => a.time.localeCompare(b.time));
}

/** Attendance for the month of `month` (any day inside it), counting only days up to today. */
export function monthStats(month: Date, today: string, sessions: Session[], bookings: SavedBooking[], marks: Record<string, Mark>) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  let planned = 0, done = 0, missed = 0;
  for (let d = first; d.getMonth() === first.getMonth(); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12)) {
    const day = ymd(d);
    if (day > today) break;
    for (const item of occurrencesOn(day, sessions, bookings)) {
      planned++;
      if (marks[item.key] === 'done') done++;
      if (marks[item.key] === 'missed') missed++;
    }
  }
  return { planned, done, missed };
}

/** Month grid starting on Monday; `null` cells pad the first week. */
export function monthGrid(month: Date): (string | null)[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  return [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => ymd(new Date(month.getFullYear(), month.getMonth(), i + 1, 12)))];
}

export function useProgress() {
  const [sessions, setSessions] = useState(() => read('sessions', isSession));
  const [marks, setMarks] = useState(readMarks);
  const [levels, setLevels] = useState(() => read('levels', isLevel));
  const [wins, setWins] = useState(() => read('wins', isWin));
  const addSession = useCallback((session: Omit<Session, 'id'>) => setSessions(list => { const next = [...list, { ...session, title: session.title.trim().slice(0, TITLE_MAX), id: newId() }]; write('sessions', next); return next; }), []);
  const removeSession = useCallback((id: string) => setSessions(list => { const next = list.filter(s => s.id !== id); write('sessions', next); return next; }), []);
  const mark = useCallback((key: string, value: Mark | null) => setMarks(current => {
    const next = { ...current };
    if (value && current[key] !== value) next[key] = value; else delete next[key];
    write('marks', next);
    return next;
  }), []);
  /** One note per goal per day: a second tap the same day replaces it. */
  const setLevel = useCallback((goal: string, level: number, date: string) => setLevels(list => {
    const next = [...list.filter(e => !(e.goal === goal && e.date === date)), { goal, level, date }].sort((a, b) => a.date.localeCompare(b.date));
    write('levels', next);
    return next;
  }), []);
  const addWin = useCallback((text: string, date: string) => setWins(list => {
    const value = text.trim().replace(/\s+/g, ' ').slice(0, WIN_MAX);
    if (!value) return list;
    const next = [{ id: newId(), date, text: value }, ...list];
    write('wins', next);
    return next;
  }), []);
  const removeWin = useCallback((id: string) => setWins(list => { const next = list.filter(w => w.id !== id); write('wins', next); return next; }), []);
  return { sessions, marks, levels, wins, addSession, removeSession, mark, setLevel, addWin, removeWin };
}
