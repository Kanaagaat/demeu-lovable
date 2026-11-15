/** Favourites stay on this device; never sent to the rides API. */
const STORAGE_KEY = 'demeu.favDrivers';

export function getFavDrivers(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0))] : [];
  } catch { return []; }
}

/** Returns false when device storage is unavailable. */
export function setFavDriver(id: string, favourite: boolean): boolean {
  try {
    const ids = getFavDrivers().filter(value => value !== id);
    if (favourite) ids.push(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    return true;
  } catch { return false; }
}
