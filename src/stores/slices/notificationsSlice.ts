/**
 * Notifications Slice
 *
 * Push switches (story 3.7): `pushPreferences` holds the account's
 * `public.push_preferences` row (a missing row reads as all on). It is NOT
 * persisted: Settings' push section calls `loadPushPreferences` when it opens,
 * and `setPushPreference` writes one column server first, then updates state.
 * `signedOutState()` clears both fields. Story 4.3 added the date reminders'
 * switch to the row (`dateReminders`) and keeps the whole row as the local copy
 * of kind `push-preferences`, filled only from a successful read or a
 * confirmed write (a failed read never writes or clears it), so the shell can
 * plan the reminders offline. `loadPushPreferences` shows that copy at once,
 * online or offline, while nothing is loaded, so the switches stay usable
 * offline and after a failed read. The kind's refresher runs
 * `loadPushPreferences` only in a shell with the local-notifications plugin,
 * so the web and an older shell never read the table on their own.
 */

import { requireOnline } from '../../services/accountDataError';
import { serializeAccountDataWrite } from '../../services/accountDataQueue';
import { hasNativeReminders } from '../../services/dateReminders';
import { readLocalCopy, registerLocalCopy, writeLocalCopy } from '../../services/localCopy';
import {
  type PushPreferenceKey,
  type PushPreferences,
  pushPreferencesService,
} from '../../services/pushPreferencesService';
import type { AppStateCreator } from '../types';

export interface NotificationsSlice {
  /**
   * The account's push switches, from `public.push_preferences` via its local
   * copy. `null` until the saved copy or the server has answered; a failed read
   * leaves what is shown as it was.
   */
  pushPreferences: PushPreferences | null;
  /**
   * The last `loadPushPreferences` failed and nothing is shown (no saved copy,
   * no earlier answer); the section disables its rows.
   */
  pushPreferencesLoadFailed: boolean;

  /**
   * Load the account's push switches: the saved copy first (online or offline,
   * only while nothing is loaded), then the server's row when online. Never
   * throws. A failed read keeps what is shown and sets
   * `pushPreferencesLoadFailed` only when nothing is.
   */
  loadPushPreferences: () => Promise<void>;
  /**
   * Set one push switch. Server first, then state. Throws:
   * `AccountDataError('offline')` without a connection, and the save's error.
   */
  setPushPreference: (key: PushPreferenceKey, enabled: boolean) => Promise<void>;
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine;
}

/** Local-copy kind for the account's push switches (the whole `PushPreferences` row). */
export const PUSH_PREFERENCES_COPY_KIND = 'push-preferences';

const PUSH_PREFERENCE_KEYS: readonly (keyof PushPreferences)[] = [
  'loveNotes',
  'moods',
  'photos',
  'pokesAndKisses',
  'dates',
  'partnerRequests',
  'dateReminders',
];

/** A saved push-preferences copy: an object whose seven switches are all booleans, otherwise `null`. */
function parseSavedPushPreferences(value: unknown): PushPreferences | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (!PUSH_PREFERENCE_KEYS.every((key) => typeof record[key] === 'boolean')) return null;
  return Object.fromEntries(
    PUSH_PREFERENCE_KEYS.map((key) => [key, record[key]])
  ) as unknown as PushPreferences;
}

/** The saved push-preferences copy for `userId`, or `null` (absent, failed or malformed). */
export async function readSavedPushPreferences(userId: string): Promise<PushPreferences | null> {
  return parseSavedPushPreferences(await readLocalCopy<unknown>(userId, PUSH_PREFERENCES_COPY_KIND));
}

export const createNotificationsSlice: AppStateCreator<NotificationsSlice> = (set, get, _api) => {
  // Only a shell with the local-notifications plugin needs the date reminders'
  // switch; the web and an older shell make no push_preferences read here.
  registerLocalCopy(PUSH_PREFERENCES_COPY_KIND, () =>
    hasNativeReminders() ? get().loadPushPreferences() : Promise.resolve()
  );

  /** After a confirmed server answer for `userId`: save the row as the copy. A failed save is logged. */
  const savePushPreferencesCopy = async (userId: string, value: PushPreferences) => {
    try {
      await writeLocalCopy(userId, PUSH_PREFERENCES_COPY_KIND, value);
    } catch (error) {
      console.error('[Settings] Failed to save the push settings copy:', error);
    }
  };

  return {
    pushPreferences: null,
    pushPreferencesLoadFailed: false,

    loadPushPreferences: async () => {
      const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
      if (!requestedBy) return;
      const isCurrent = () =>
        get().userId === requestedBy && get().authSessionVersion === requestedInSession;

      // 1. The saved copy, at once — online or offline. Only while the state is
      // not loaded: a server answer or a confirmed write is newer.
      if (get().pushPreferences === null) {
        const saved = await readSavedPushPreferences(requestedBy);
        if (!isCurrent()) return;
        if (saved && get().pushPreferences === null) {
          set({ pushPreferences: saved, pushPreferencesLoadFailed: false });
        }
      }

      // 2. Offline there is nothing to ask, and nothing worth reporting; the
      // copy (or nothing) stays shown.
      if (!isOnline()) return;

      // 3. The server's row replaces state and copy — only on success.
      try {
        await serializeAccountDataWrite(async () => {
          const next = await pushPreferencesService.fetchPushPreferences(requestedBy);
          if (!isCurrent()) return;
          set({ pushPreferences: next, pushPreferencesLoadFailed: false });
          await savePushPreferencesCopy(requestedBy, next);
        });
      } catch (error) {
        console.error('[Settings] Failed to load the push settings:', error);
        // Whatever is shown (the saved copy or an earlier answer) stays; only
        // an empty section is flagged, and it disables its rows.
        if (isCurrent() && get().pushPreferences === null) {
          set({ pushPreferencesLoadFailed: true });
        }
      }
    },

    setPushPreference: async (key, enabled) => {
      const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
      if (!requestedBy) throw new Error('You must be signed in to change your push settings');
      const isCurrent = () =>
        get().userId === requestedBy && get().authSessionVersion === requestedInSession;

      // Refused before any request, so an offline edit changes nothing.
      requireOnline('Push settings');

      await serializeAccountDataWrite(async () => {
        if (!isCurrent()) return;
        const next = await pushPreferencesService.savePushPreference(requestedBy, key, enabled);
        if (!isCurrent()) return;
        set({ pushPreferences: next, pushPreferencesLoadFailed: false });
        await savePushPreferencesCopy(requestedBy, next);
      });
    },
  };
};
