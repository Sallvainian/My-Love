/**
 * The two partner-id lookups the Daily slices share (`dailyDaySlice`,
 * `dailyStreakSlice`, `dailyHistorySlice`). Plain functions over the store's
 * `get`, so each slice's own store instance is the one they read.
 */

import { lookupPartnerId } from '../api/supabaseClient';
import type { PartnerTag } from '../services/dailyPartnerTag';
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

/** For a write that needs no partner (an `unlinked` answer): nothing is tagged. */
export const NO_PARTNER_TAG: PartnerTag = { status: 'unlinked' };

/**
 * The partner a merge tags its entries with: `linked` from the store or the
 * saved partner copy when one is known, else `lookupPartnerId()`'s answer.
 * A lookup that failed or threw is `unknown`, never `unlinked`, so the merge
 * keeps the tag an entry already has.
 */
export const mergePartnerId = async (get: () => AppState, userId: string): Promise<PartnerTag> => {
  const known = get().partner?.id;
  if (known) return { status: 'linked', partnerId: known };
  const saved = await readSavedPartner(userId);
  if (saved?.status === 'linked') return { status: 'linked', partnerId: saved.partner.id };
  try {
    const lookup = await lookupPartnerId();
    if (lookup?.status === 'linked') return { status: 'linked', partnerId: lookup.partnerId };
    return lookup?.status === 'unlinked' ? { status: 'unlinked' } : { status: 'unknown' };
  } catch {
    return { status: 'unknown' };
  }
};
