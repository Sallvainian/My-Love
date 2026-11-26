/**
 * The two partner-id lookups the Daily slices share (`dailyDaySlice`,
 * `dailyStreakSlice`, `dailyHistorySlice`). Plain functions over the store's
 * `get`, so each slice's own store instance is the one they read.
 */

import { lookupPartnerId } from '../api/supabaseClient';
import { readSavedPartner } from './slices/partnerSlice';
import type { AppState } from './types';

/** The partner the saved days are shown for: the store's, else the saved partner copy's; `null` when none. */
export const shownPartnerId = async (
  get: () => AppState,
  userId: string
): Promise<string | null> => {
  if (get().partnerKnown) return get().partner?.id ?? null;
  const saved = await readSavedPartner(userId);
  return saved?.status === 'linked' ? saved.partner.id : null;
};

/**
 * The partner a merge tags its entries with: the linked id from the store or
 * the saved partner copy when one is known, else `lookupPartnerId()`, where
 * anything but a `linked` answer (or a throw) gives `null`.
 */
export const mergePartnerId = async (
  get: () => AppState,
  userId: string
): Promise<string | null> => {
  const known = get().partner?.id;
  if (known) return known;
  const saved = await readSavedPartner(userId);
  if (saved?.status === 'linked') return saved.partner.id;
  try {
    const lookup = await lookupPartnerId();
    return lookup?.status === 'linked' ? lookup.partnerId : null;
  } catch {
    return null;
  }
};
