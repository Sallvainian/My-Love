/**
 * Couple Settings Service — settings one linked couple shares
 * (`public.couple_settings`): today the relationship start date.
 *
 * One row per couple, keyed on the ORDERED pair (`user_a < user_b`), so both
 * partners address the same row. RLS admits the pair only (the caller on one
 * side, `get_my_partner_id()` on the other), which is why a row is always
 * addressed by both ids and never by one.
 *
 * Supabase is the source of truth; `settingsSlice.coupleSettings` and its local
 * copy (kind `couple-settings`) are filled only from these reads and confirmed
 * writes. Last write wins. Reads and writes are online-only and THROW — see
 * `accountDataError.ts` for the error convention (offline is
 * `AccountDataError('offline')`).
 *
 * `relationship_start` is a `timestamptz`: a date AND time, so Home's "Together
 * for" counter keeps its hours, minutes and seconds. It crosses this boundary
 * as an ISO string.
 *
 * @module services/coupleSettingsService
 */

import type { Database } from '../api/supabaseClient';
import { supabase } from '../api/supabaseClient';
import { logger } from '../utils/logger';
import { AccountDataError, requestTimeout, requireOnline, toAccountDataError } from './accountDataError';

export type SupabaseCoupleSettingsRecord = Database['public']['Tables']['couple_settings']['Row'];

/** A couple's settings in the app's shape. */
export interface ServerCoupleSettings {
  /** ISO timestamp, or `null` when neither partner has set it (or no row yet). */
  relationshipStart: string | null;
}

const WHAT = 'Couple settings';

/** The couple's row key: the two ids in key order, as the table's CHECK requires. */
export function couplePair(userId: string, partnerId: string): { user_a: string; user_b: string } {
  return userId < partnerId
    ? { user_a: userId, user_b: partnerId }
    : { user_a: partnerId, user_b: userId };
}

/** A timestamp the server returned, normalised; an unreadable one is `null`. */
function toIsoOrNull(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export const coupleSettingsService = {
  /**
   * The couple's settings. No row yet is an answer, not a failure: it reads as
   * `relationshipStart: null` ("not set yet").
   */
  async fetchCoupleSettings(userId: string, partnerId: string): Promise<ServerCoupleSettings> {
    requireOnline(WHAT, 'load');
    const pair = couplePair(userId, partnerId);
    try {
      const { data, error } = await supabase
        .from('couple_settings')
        .select('*')
        .eq('user_a', pair.user_a)
        .eq('user_b', pair.user_b)
        .abortSignal(requestTimeout())
        .maybeSingle();
      if (error) throw error;
      return { relationshipStart: toIsoOrNull(data?.relationship_start ?? null) };
    } catch (error) {
      throw toAccountDataError('CoupleSettingsService.fetchCoupleSettings', error);
    }
  },

  /**
   * Set the couple's start date (last write wins). An upsert on the pair, so
   * whichever partner writes first creates the row. Absolute, so repeating it
   * after a timeout that fired once the server had committed is harmless.
   */
  async saveStartDate(
    userId: string,
    partnerId: string,
    relationshipStart: string
  ): Promise<ServerCoupleSettings> {
    requireOnline(WHAT);
    const value = toIsoOrNull(relationshipStart);
    if (!value) {
      throw new AccountDataError('invalid-response', `Not a valid date and time: ${relationshipStart}`);
    }
    try {
      const { data, error } = await supabase
        .from('couple_settings')
        .upsert(
          {
            ...couplePair(userId, partnerId),
            relationship_start: value,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_a,user_b' }
        )
        .select()
        .abortSignal(requestTimeout())
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new AccountDataError('invalid-response', 'The start date was not saved');
      logger.debug('[CoupleSettingsService] Saved the relationship start date');
      return { relationshipStart: toIsoOrNull(data.relationship_start) };
    } catch (error) {
      throw toAccountDataError('CoupleSettingsService.saveStartDate', error);
    }
  },
};
