import type { SavedBooking, SharedCard } from '../../lib/types';
// Future-compatible local metadata: never infer consent from the current child card.
export function sharedBookingCard(booking: SavedBooking): SharedCard | null {
  const candidate = (booking as SavedBooking & { shared?: unknown }).shared;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
  const value = candidate as Record<string, unknown>; const output: SharedCard = {};
  if (typeof value.name === 'string') output.name = value.name;
  if (typeof value.age === 'number' && Number.isFinite(value.age)) output.age = value.age;
  for (const key of ['district', 'comm', 'react', 'disability'] as const) if (typeof value[key] === 'string') Object.assign(output, { [key]: value[key] });
  for (const key of ['features', 'goals'] as const) if (Array.isArray(value[key]) && value[key].every(item => typeof item === 'string')) Object.assign(output, { [key]: value[key] });
  return output;
}
