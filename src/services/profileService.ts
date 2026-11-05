/**
 * Profile Service — the signed-in account's own profile row (`public.users`):
 * its display name and its birthday.
 *
 * Supabase is the source of truth; `profileSlice.ownProfile` and its local
 * copy (kind `profile`) are filled only from these reads and confirmed writes.
 * Reads and writes are online-only and THROW — see `accountDataError.ts` for
 * the error convention (offline is `AccountDataError('offline')`).
 *
 * The client may write only `display_name` and `birthday` here (plus
 * `updated_at`): the column grants on `public.users`
 * (20260912030000_profile_name_email_ownership.sql,
 * 20260924000000_birthdays_wedding_date.sql) open no other column. The signup
 * gate keeps its own name writer (`DisplayNameSetup`); `saveDisplayName` is the
 * one Settings uses. Both refuse a name through `displayNameRefusal`, the one
 * copy of the display-name rule.
 *
 * `birthday` is a plain `date` and crosses this boundary as `YYYY-MM-DD`; parse
 * it with `parseEventDate`, never `new Date(string)`.
 *
 * @module services/profileService
 */

import { isSeedFallbackName, SEED_FALLBACK_NAME, supabase } from '../api/supabaseClient';
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

const NAME_MIN = 3;
const NAME_MAX = 30;

/** Whether a display name is 3 to 30 characters once trimmed: what the Name page's Save waits for. */
export function isDisplayNameLength(name: string): boolean {
  const length = name.trim().length;
  return length >= NAME_MIN && length <= NAME_MAX;
}

/**
 * The display-name rule, the one copy every name writer uses (Settings through
 * `saveDisplayName`, and the signup gate, `DisplayNameSetup`): why `name`
 * cannot be saved for the account whose email is `email`, or `null` when it
 * can. Trimmed, 3 to 30 characters, not the account's email in any case, and
 * not `SEED_FALLBACK_NAME`: the read side (`isSeedFallbackName`) counts either
 * of those as no name chosen, so saving one would bring the gate back on every
 * read. A null `email` checks everything but the email.
 */
export function displayNameRefusal(name: string, email: string | null | undefined): string | null {
  const trimmed = name.trim();
  if (!isDisplayNameLength(trimmed)) {
    return `Display name must be between ${NAME_MIN} and ${NAME_MAX} characters`;
  }
  const account = email?.trim() ?? '';
  if (account !== '' && trimmed.toLowerCase() === account.toLowerCase()) {
    return 'Please choose a name that is different from your email address';
  }
  if (trimmed === SEED_FALLBACK_NAME) {
    return `"${SEED_FALLBACK_NAME}" is not a name — please choose another`;
  }
  return null;
}

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

  /**
   * Set the account's own display name. Trimmed, 3-30 characters, and not what
   * the read side calls a seed (the account's email, case-insensitively, or
   * `Unknown`): `toOwnProfile` recomputes that on every read, so saving one
   * would succeed and then read back as "no name chosen". Refused with
   * `AccountDataError('invalid-response')` before any request. Absolute, so
   * repeating it after a timeout is harmless. Returns the stored profile, read
   * back from the updated row.
   */
  async saveDisplayName(name: string): Promise<OwnProfile> {
    requireOnline('Name changes');
    const trimmed = name.trim();
    if (!isDisplayNameLength(trimmed)) {
      throw new AccountDataError('invalid-response', displayNameRefusal(trimmed, null) ?? '');
    }
    try {
      const user = await requireSessionUser();
      const refusal = displayNameRefusal(trimmed, user.email);
      if (refusal) throw new AccountDataError('invalid-response', refusal);
      // A plain update, not an upsert: the row exists from signup, and an upsert
      // would have to name `id`, which `authenticated` holds no UPDATE on.
      const { data, error } = await supabase
        .from('users')
        .update({ display_name: trimmed, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select('display_name, birthday')
        .abortSignal(requestTimeout())
        .maybeSingle();
      if (error) throw error;
      // Fail closed: RLS and a missing row both answer zero rows, not an error.
      if (!data) {
        throw new AccountDataError(
          'invalid-response',
          'Could not find your profile to save the name to'
        );
      }
      logger.debug('[ProfileService] Saved the display name');
      return toOwnProfile(data, user.email);
    } catch (error) {
      throw toAccountDataError('ProfileService.saveDisplayName', error);
    }
  },
};
