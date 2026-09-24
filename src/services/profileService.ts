/**
 * Profile Service — the signed-in account's own profile row (`public.users`):
 * its display name and its birthday.
 *
 * Supabase is the source of truth; `settingsSlice.ownProfile` and its local
 * copy (kind `profile`) are filled only from these reads and confirmed writes.
 * Reads and writes are online-only and THROW — see `accountDataError.ts` for
 * the error convention (offline is `AccountDataError('offline')`).
 *
 * The client may write only `birthday` here (plus `updated_at`): the column
 * grant on `public.users` (20260924000000_birthdays_wedding_date.sql) opens no
 * other column. The display name keeps its own writer (`DisplayNameSetup`).
 *
 * `birthday` is a plain `date` and crosses this boundary as `YYYY-MM-DD`; parse
 * it with `parseEventDate`, never `new Date(string)`.
 *
 * @module services/profileService
 */

import { isSeedFallbackName, supabase } from '../api/supabaseClient';
import { logger } from '../utils/logger';
import { AccountDataError, requestTimeout, requireOnline, toAccountDataError } from './accountDataError';
import { parseEventDate, toDateOnlyOrNull } from './eventsService';

/** The account's own profile in the app's shape. */
export interface OwnProfile {
  /** The chosen display name, or `null` while the profile still carries the seed. */
  displayName: string | null;
  /** `YYYY-MM-DD`, or `null` when not set. */
  birthday: string | null;
}

const WHAT = 'Profile changes';

/** A row in the app's shape, applying the seed rule to the name. */
function toOwnProfile(
  row: { display_name: string | null; birthday: string | null } | null,
  email: string | null
): OwnProfile {
  const name = row?.display_name ?? null;
  return {
    displayName: isSeedFallbackName(name, email) ? null : (name?.trim() ?? null),
    birthday: toDateOnlyOrNull(row?.birthday),
  };
}

/** The signed-in account's id from the local session, or an error to throw. */
async function requireSessionUser(): Promise<{ id: string; email: string | null }> {
  const { data, error } = await supabase.auth.getSession();
  const user = data.session?.user ?? null;
  if (!user) {
    throw new AccountDataError('transport', error?.message ?? 'You must be signed in');
  }
  return { id: user.id, email: user.email ?? null };
}

export const profileService = {
  /** The account's own display name and birthday. */
  async fetchOwnProfile(): Promise<OwnProfile> {
    requireOnline(WHAT, 'load');
    try {
      const user = await requireSessionUser();
      const { data, error } = await supabase
        .from('users')
        .select('display_name, birthday')
        .eq('id', user.id)
        .abortSignal(requestTimeout())
        .maybeSingle();
      if (error) throw error;
      return toOwnProfile(data, user.email);
    } catch (error) {
      throw toAccountDataError('ProfileService.fetchOwnProfile', error);
    }
  },

  /**
   * Set the account's own birthday (`YYYY-MM-DD`). Absolute, so repeating it
   * after a timeout that fired once the server had committed is harmless.
   * Returns the stored profile, read back from the updated row.
   */
  async saveBirthday(birthday: string): Promise<OwnProfile> {
    requireOnline(WHAT);
    if (!parseEventDate(birthday)) {
      throw new AccountDataError('invalid-response', `Not a valid date: ${birthday}`);
    }
    try {
      const user = await requireSessionUser();
      const { data, error } = await supabase
        .from('users')
        .update({ birthday, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select('display_name, birthday')
        .abortSignal(requestTimeout())
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new AccountDataError('invalid-response', 'Your birthday was not saved');
      logger.debug('[ProfileService] Saved the birthday');
      return toOwnProfile(data, user.email);
    } catch (error) {
      throw toAccountDataError('ProfileService.saveBirthday', error);
    }
  },
};
