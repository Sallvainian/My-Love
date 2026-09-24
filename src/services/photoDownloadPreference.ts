/**
 * Whether the background photo fill may download over mobile data — a DEVICE
 * preference, not account data.
 *
 * The data plan belongs to the phone, so the choice is kept per device and
 * survives sign-out and a change of account. It lives in its own localStorage
 * key rather than in the persisted store: the store's `settings` blob is
 * schema-validated as a whole (a failed parse drops all of it), and the
 * background fill (`photoImageCache.ts`) reads it outside React without
 * importing the store. Default OFF.
 *
 * Every storage access is guarded: when localStorage is unavailable or refuses
 * the write, the choice still holds in memory for this page load.
 */

export const PHOTOS_OVER_MOBILE_DATA_KEY = 'my-love-photos-over-mobile-data';

let allowed: boolean | null = null;
const listeners = new Set<() => void>();

function readStored(): boolean {
  try {
    return localStorage.getItem(PHOTOS_OVER_MOBILE_DATA_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Whether the background fill may download over mobile data on this device. */
export function getPhotosOverMobileData(): boolean {
  if (allowed === null) allowed = readStored();
  return allowed;
}

/** Set the device's choice, save it, and tell every subscriber. */
export function setPhotosOverMobileData(value: boolean): void {
  allowed = value;
  try {
    localStorage.setItem(PHOTOS_OVER_MOBILE_DATA_KEY, value ? 'true' : 'false');
  } catch (error) {
    console.warn('[photoDownloadPreference] Could not save the mobile-data choice:', error);
  }
  for (const listener of Array.from(listeners)) listener();
}

/** Called after every change; returns the unsubscribe. */
export function subscribePhotosOverMobileData(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The Network Information API fields this app reads; absent on Safari and Firefox. */
export interface ConnectionInfo extends EventTarget {
  type?: string;
}

/** `navigator.connection`, or null where the browser does not expose it. */
export function getConnection(): ConnectionInfo | null {
  if (typeof navigator === 'undefined') return null;
  return (navigator as Navigator & { connection?: ConnectionInfo }).connection ?? null;
}

/**
 * Whether this browser tells the app enough to keep the fill off mobile data:
 * it reports the connection type (Chrome on Android does). Where it is false
 * the fill runs on any connection, and Settings says so.
 */
export function canTellMobileData(): boolean {
  const type = getConnection()?.type;
  return !!type && type !== 'unknown';
}

/**
 * Whether the connection is one the background fill must not use without the
 * user's permission: mobile data (`type === 'cellular'`). A browser that does
 * not report the type is treated as unmetered, so the fill runs as before.
 */
export function onMeteredConnection(): boolean {
  return getConnection()?.type === 'cellular';
}
