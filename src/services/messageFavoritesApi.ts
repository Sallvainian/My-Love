/**
 * Message Favorites API — the signed-in user's favorites among the BUNDLED
 * daily messages (`public.message_favorites`)
 *
 * Bundled message ids are device-local IndexedDB autoincrement values, so they
 * cannot name a message across devices. Every bundled text is unique
 * (365/365 in `src/data/defaultMessages.ts`), so the server key is a hash of
 * the text instead: `b:<sha-256 hex>`. A custom message's favorite is the
 * `is_favorite` column on its own row (`customMessagesApi.ts`).
 *
 * The account's `message-data` local copy keeps the favorited bundled rows by
 * their local ids; `storageService` maps between the two.
 *
 * Private to the author (owner-only RLS). Error convention: `accountDataError.ts`.
 *
 * @module services/messageFavoritesApi
 */

import { supabase } from '../api/supabaseClient';
import { requestTimeout, requireOnline, toAccountDataError } from './accountDataError';

const WHAT = 'Favorites';

/** Stable SHA-256 hex digest of a string's UTF-8 bytes; the bundled favorite key. */
export async function hashText(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** The server key for a bundled message: a hash of its exact text. */
export async function bundledMessageKey(text: string): Promise<string> {
  return `b:${await hashText(text)}`;
}

export const messageFavoritesApi = {
  async fetchFavoriteKeys(userId: string): Promise<string[]> {
    requireOnline(WHAT, 'load');
    try {
      const { data, error } = await supabase
        .from('message_favorites')
        .select('message_key')
        .eq('user_id', userId)
        .abortSignal(requestTimeout());
      if (error) throw error;
      return (data ?? []).map((row) => row.message_key);
    } catch (error) {
      throw toAccountDataError('MessageFavoritesApi.fetchFavoriteKeys', error);
    }
  },

  /** Idempotent: favoriting twice leaves one row (ON CONFLICT DO NOTHING). */
  async addFavorite(userId: string, messageKey: string): Promise<void> {
    requireOnline(WHAT);
    try {
      const { error } = await supabase
        .from('message_favorites')
        .upsert(
          { user_id: userId, message_key: messageKey },
          { onConflict: 'user_id,message_key', ignoreDuplicates: true }
        )
        .abortSignal(requestTimeout());
      if (error) throw error;
    } catch (error) {
      throw toAccountDataError('MessageFavoritesApi.addFavorite', error);
    }
  },

  /** Idempotent: removing a favorite that is not there is success. */
  async removeFavorite(userId: string, messageKey: string): Promise<void> {
    requireOnline(WHAT);
    try {
      const { error } = await supabase
        .from('message_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('message_key', messageKey)
        .abortSignal(requestTimeout());
      if (error) throw error;
    } catch (error) {
      throw toAccountDataError('MessageFavoritesApi.removeFavorite', error);
    }
  },
};
