/**
 * Push Preferences Service — the signed-in account's switch for each kind of
 * push (`public.push_preferences`, one row per account).
 *
 * Supabase is the source of truth, and nothing here is cached on the device:
 * Settings loads the switches when its push section opens
 * (`settingsSlice.pushPreferences`). A missing row means every switch is on,
 * as it does for the `send-push` sender that reads the receiver's row.
 * Reads and writes are online-only and THROW — see `accountDataError.ts` for
 * the error convention (offline is `AccountDataError('offline')`).
 *
 * A write is an upsert on `user_id` that sends only `user_id` and one column.
 * PostgREST's merge updates only the columns it is sent, so two switches
 * toggled in quick succession never overwrite each other.
 *
 * @module services/pushPreferencesService
 */

import { supabase } from '../api/supabaseClient';
import { logger } from '../utils/logger';
import { AccountDataError, requestTimeout, requireOnline, toAccountDataError } from './accountDataError';

/** The account's switches in the app's shape; `true` is on. */
export interface PushPreferences {
  loveNotes: boolean;
  moods: boolean;
  photos: boolean;
  pokesAndKisses: boolean;
  dates: boolean;
  partnerRequests: boolean;
}

export type PushPreferenceKey = keyof PushPreferences;

/** Every switch on: the state of an account with no row. */
export const ALL_PUSH_PREFERENCES_ON: PushPreferences = {
  loveNotes: true,
  moods: true,
  photos: true,
  pokesAndKisses: true,
  dates: true,
  partnerRequests: true,
};

/** The `push_preferences` column behind each switch. */
interface PreferencesRow {
  love_notes: boolean;
  moods: boolean;
  photos: boolean;
  pokes_and_kisses: boolean;
  dates: boolean;
  partner_requests: boolean;
}

type PreferenceColumn = Exclude<keyof PreferencesRow, never>;

const COLUMN: Record<PushPreferenceKey, PreferenceColumn> = {
  loveNotes: 'love_notes',
  moods: 'moods',
  photos: 'photos',
  pokesAndKisses: 'pokes_and_kisses',
  dates: 'dates',
  partnerRequests: 'partner_requests',
};

const COLUMNS = Object.values(COLUMN).join(', ');

const WHAT = 'Push settings';

function toPushPreferences(row: PreferencesRow): PushPreferences {
  return {
    loveNotes: row.love_notes,
    moods: row.moods,
    photos: row.photos,
    pokesAndKisses: row.pokes_and_kisses,
    dates: row.dates,
    partnerRequests: row.partner_requests,
  };
}

export const pushPreferencesService = {
  /** The account's switches; no row yet is an answer, and reads as all on. */
  async fetchPushPreferences(userId: string): Promise<PushPreferences> {
    requireOnline(WHAT, 'load');
    try {
      const { data, error } = await supabase
        .from('push_preferences')
        .select(COLUMNS)
        .eq('user_id', userId)
        .abortSignal(requestTimeout())
        .maybeSingle();
      if (error) throw error;
      return data ? toPushPreferences(data as unknown as PreferencesRow) : { ...ALL_PUSH_PREFERENCES_ON };
    } catch (error) {
      throw toAccountDataError('PushPreferencesService.fetchPushPreferences', error);
    }
  },

  /**
   * Set one switch. Sends only `user_id` and that column, so the account's
   * other switches are untouched. Returns the stored row, read back.
   */
  async savePushPreference(
    userId: string,
    key: PushPreferenceKey,
    enabled: boolean
  ): Promise<PushPreferences> {
    requireOnline(WHAT);
    try {
      // Only user_id and this column are sent, so no other switch is touched.
      const row: { user_id: string } & Partial<PreferencesRow> = { user_id: userId };
      row[COLUMN[key]] = enabled;
      const { data, error } = await supabase
        .from('push_preferences')
        .upsert(row, { onConflict: 'user_id' })
        .select(COLUMNS)
        .abortSignal(requestTimeout())
        .single();
      if (error) throw error;
      if (!data) throw new AccountDataError('invalid-response', 'Your push setting was not saved');
      logger.debug('[PushPreferencesService] Saved a push switch');
      return toPushPreferences(data as unknown as PreferencesRow);
    } catch (error) {
      throw toAccountDataError('PushPreferencesService.savePushPreference', error);
    }
  },
};
