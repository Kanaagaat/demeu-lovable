import { useSyncExternalStore } from 'react';
import { useAppState } from './AppState';
import { useSpecialists } from '../lib/hooks';
import { usePersonalPlan } from '../lib/personalHooks';
import type { SavedBooking, SpecialistCard } from '../lib/types';
import { getBookingMeta, isBoolean, usePlanValue } from './plan';

export interface PlanNotification {
  id: string; icon: string; tint: string; title: string; detail?: string; detailKey?: string;
  values?: Record<string, string>; when?: string; go: string; defaultRead?: boolean; demo?: boolean;
}
const key = 'demeu.plan.notifications.read';
const listeners = new Set<() => void>();
let memory: string | null = null;
function snapshot() { try { return localStorage.getItem(key); } catch { return memory; } }
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => { listeners.delete(listener); window.removeEventListener('storage', listener); };
}
function parse(raw: string | null): string[] {
  try { const data: unknown = JSON.parse(raw ?? '[]'); return Array.isArray(data) ? data.filter((id): id is string => typeof id === 'string') : []; } catch { return []; }
}
function write(ids: string[]) {
  memory = JSON.stringify([...new Set(ids)]);
  try { localStorage.setItem(key, memory); } catch { /* Retain read status in memory. */ }
  listeners.forEach(listener => listener());
}
function localDay(date: Date) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(date); }
export function deriveNotifications(bookings: SavedBooking[], specialists: SpecialistCard[], nextStep: { id: string; title: string } | undefined, hasCard: boolean, reminders = { day: true, hours: true }, now = new Date()): PlanNotification[] {
  const tomorrow = localDay(new Date(now.getTime() + 86400000));
  const items: PlanNotification[] = bookings.flatMap<PlanNotification>(booking => {
    if (getBookingMeta(booking.id)?.direct) return [];
    const specialist = specialists.find(item => item.id === booking.specialist_id);
    const date = new Date(booking.slot), diff = date.getTime() - now.getTime();
    if (diff <= 0) return [{ id: `feedback:${booking.id}`, icon: 'rating', tint: '#FFF1D9', title: 'timeToRate', values: { name: specialist?.short ?? '' }, detailKey: 'rateText', go: `/feedback/${booking.specialist_id}` }];
    const isTomorrow = localDay(date) === tomorrow;
    const soon = diff <= 2 * 3600000;
    if ((isTomorrow && reminders.day) || (soon && reminders.hours)) return [{ id: `lesson:${booking.id}:${soon ? 'soon' : 'day'}`, icon: 'calendar', tint: '#ECE6FF', title: soon ? 'soonLesson' : 'tomorrowLesson', values: { time: new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Almaty', hour: '2-digit', minute: '2-digit' }).format(date) }, detail: specialist ? `${specialist.role} ${specialist.short} · ${booking.format === 'Кабинет' ? specialist.address : booking.format}` : booking.format, go: '/my' }];
    return [];
  });
  if (nextStep) items.push({ id: `step:${nextStep.id}`, icon: 'todo-list', tint: '#E4EFE5', title: 'newStep', detail: nextStep.title, go: '/plan' });
  // NOTIFS0 scenarios are explicitly marked as a demo, never saved as bookings.
  if (!bookings.length && hasCard) items.push(
    { id: 'demo:lesson', icon: 'calendar', tint: '#ECE6FF', title: 'demoLesson', detailKey: 'demoLessonText', when: 'demo10m', go: '/my', demo: true },
    { id: 'demo:feedback', icon: 'rating', tint: '#FFF1D9', title: 'demoRate', detailKey: 'demoRateText', when: 'demo2h', go: '/feedback/1', demo: true },
    { id: 'demo:access', icon: 'shield', tint: '#ECE6FF', title: 'demoAccess', detailKey: 'demoAccessText', when: 'demoNov', go: '/profile/privacy', defaultRead: true, demo: true },
  );
  return items;
}
export function useNotifications() {
  const { bookings, card, planDone } = useAppState();
  const plan = usePersonalPlan(card);
  const child = useSpecialists({ kind: 'child' });
  const parent = useSpecialists({ kind: 'parent' });
  const [day] = usePlanValue('remDay', true, isBoolean);
  const [hours] = usePlanValue('rem2h', true, isBoolean);
  const read = parse(useSyncExternalStore(subscribe, snapshot, () => null));
  const items = deriveNotifications(bookings, [...(child.data?.items ?? []), ...(parent.data?.items ?? [])], plan?.steps.find(step => !planDone.includes(step.id)), !!card, { day, hours });
  const notifications = items.map(item => ({ ...item, unread: !item.defaultRead && !read.includes(item.id) }));
  return {
    notifications,
    loading: (bookings.length > 0 && (child.loading || parent.loading)),
    markRead: (id: string) => write([...parse(snapshot()), id]),
    readAll: () => write([...parse(snapshot()), ...items.map(item => item.id)]),
  };
}
export function useUnreadCount(): number { return useNotifications().notifications.filter(item => item.unread).length; }
