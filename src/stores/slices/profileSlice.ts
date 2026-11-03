/**
 * Profile Slice
 *
 * The account's own profile: its display name and birthday (`public.users`).
 * `ownProfile` is the in-memory state, NOT persisted with `settings`: its saved
 * copy is the local copy of kind `profile`, filled only from server reads and
 * confirmed writes, so Home's own birthday card works offline.
 * `loadOwnProfile` is the kind's refresher; `setDisplayName` and `setBirthday`
 * need a connection and write server first. Each returns the stored row, which
 * replaces state and copy, so Settings' Profile rows and header, the top page's
 * Profile row and Home all read the one `ownProfile` with no re-read after a
 * save. (The signup gate, `DisplayNameSetup`, still writes the first name
 * itself.)
 *
 * `ownProfileLoadFailed` is true when the last `loadOwnProfile` could not get a
 * server answer (offline, or a failed read), and false after a successful read
 * or a confirmed write. A failed read leaves `ownProfile` as it was (the saved
 * copy or an earlier answer), which is the account's last confirmed profile, so
 * the pages may show and prefill it.
 */

import { requireOnline } from '../../services/accountDataError';
import { serializeAccountDataWrite } from '../../services/accountDataQueue';
import { toDateOnlyOrNull } from '../../services/eventsService';
import { readLocalCopy, registerLocalCopy, writeLocalCopy } from '../../services/localCopy';
import { type OwnProfile, profileService } from '../../services/profileService';
import type { AppStateCreator } from '../types';

export interface ProfileSlice {
  /**
   * The account's own display name and birthday, from `public.users` via its
   * local copy. `null` until the saved copy or the server has answered.
   */
  ownProfile: OwnProfile | null;
  /**
   * The last `loadOwnProfile` could not get a server answer (offline, or a
   * failed read); `ownProfile` and its copy were left as they were. False after
   * a successful read or a confirmed `setDisplayName` / `setBirthday`.
   */
  ownProfileLoadFailed: boolean;

  /**
   * The profile local-copy refresher: show the saved copy, then — when online —
   * replace state and copy with the server's row. Never throws.
   */
  loadOwnProfile: () => Promise<void>;
  /**
   * Set the account's own display name (trimmed, 3-30 characters, not the email
   * or `Unknown`). Server first, then state and copy. Throws:
   * `AccountDataError('offline')` without a connection,
   * `AccountDataError('invalid-response')` for a refused name.
   */
  setDisplayName: (name: string) => Promise<void>;
  /**
   * Set the account's own birthday (`YYYY-MM-DD`). Server first, then state
   * and copy. Throws: `AccountDataError('offline')` without a connection.
   */
  setBirthday: (birthday: string) => Promise<void>;
}

/** Local-copy kind for the account's own profile (`OwnProfile`). */
export const PROFILE_COPY_KIND = 'profile';

/**
 * The auth lifetime whose profile already came from the server or from a
 * confirmed write. The saved copy is applied only before that, so a copy read
 * that lands late can never replace a newer answer in the same session.
 */
let ownProfileFreshFor: { userId: string; authSessionVersion: number } | null = null;

function isOwnProfileFresh(userId: string, authSessionVersion: number): boolean {
  return (
    ownProfileFreshFor?.userId === userId &&
    ownProfileFreshFor.authSessionVersion === authSessionVersion
  );
}

/** A saved profile copy; a missing field reads as not set. */
function parseSavedOwnProfile(value: unknown): OwnProfile | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  return {
    displayName: typeof v.displayName === 'string' && v.displayName.trim() ? v.displayName : null,
    birthday: typeof v.birthday === 'string' ? toDateOnlyOrNull(v.birthday) : null,
  };
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine;
}

/** The saved own-profile copy for `userId`, or `null` (absent, failed or malformed). */
export async function readSavedOwnProfile(userId: string): Promise<OwnProfile | null> {
  return parseSavedOwnProfile(await readLocalCopy<unknown>(userId, PROFILE_COPY_KIND));
}

export const createProfileSlice: AppStateCreator<ProfileSlice> = (set, get, _api) => {
  registerLocalCopy(PROFILE_COPY_KIND, () => get().loadOwnProfile());

  /**
   * After a confirmed server answer for `userId` in `authSessionVersion` (the
   * caller has just re-checked both and set the state): mark the session fresh
   * and save the answer as the copy. A failed save is logged.
   */
  const saveOwnProfileCopy = async (userId: string, authSessionVersion: number, value: OwnProfile) => {
    ownProfileFreshFor = { userId, authSessionVersion };
    try {
      await writeLocalCopy(userId, PROFILE_COPY_KIND, value);
    } catch (error) {
      console.error('[Settings] Failed to save the profile copy:', error);
    }
  };

  return {
    ownProfile: null,
    ownProfileLoadFailed: false,

    loadOwnProfile: async () => {
      const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
      if (!requestedBy) return;
      const isCurrent = () =>
        get().userId === requestedBy && get().authSessionVersion === requestedInSession;

      // 1. The saved copy, at once — online or offline. Skipped once this
      // session has a server answer or a confirmed write, which is newer.
      if (!isOwnProfileFresh(requestedBy, requestedInSession)) {
        const saved = parseSavedOwnProfile(
          await readLocalCopy<unknown>(requestedBy, PROFILE_COPY_KIND)
        );
        if (!isCurrent()) return;
        if (saved && !isOwnProfileFresh(requestedBy, requestedInSession)) {
          set({ ownProfile: saved });
        }
      }

      // 2. Offline there is nothing to ask; the copy (or nothing) stays shown,
      // and the name row learns it has no server answer.
      if (!isOnline()) {
        set({ ownProfileLoadFailed: true });
        return;
      }

      // 3. The server's row replaces state and copy — only on success. In the
      // account-data queue, so it cannot read before a birthday write and land
      // after it.
      try {
        await serializeAccountDataWrite(async () => {
          const next = await profileService.fetchOwnProfile();
          if (!isCurrent()) return;
          set({ ownProfile: next, ownProfileLoadFailed: false });
          await saveOwnProfileCopy(requestedBy, requestedInSession, next);
        });
      } catch (error) {
        // State and copy stay as they were, so Home keeps its card.
        console.error('[Settings] Failed to load the profile from the server:', error);
        if (isCurrent()) set({ ownProfileLoadFailed: true });
      }
    },

    setDisplayName: async (name) => {
      const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
      if (!requestedBy) throw new Error('You must be signed in to set your name');
      const isCurrent = () =>
        get().userId === requestedBy && get().authSessionVersion === requestedInSession;

      // Refused before any request, so an offline edit changes nothing.
      requireOnline('Name changes');

      await serializeAccountDataWrite(async () => {
        if (!isCurrent()) return;
        const next = await profileService.saveDisplayName(name);
        if (!isCurrent()) return;
        set({ ownProfile: next, ownProfileLoadFailed: false });
        await saveOwnProfileCopy(requestedBy, requestedInSession, next);
      });
    },

    setBirthday: async (birthday) => {
      const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
      if (!requestedBy) throw new Error('You must be signed in to set your birthday');
      const isCurrent = () =>
        get().userId === requestedBy && get().authSessionVersion === requestedInSession;

      // Refused before any request, so an offline edit changes nothing.
      requireOnline('Profile changes');

      await serializeAccountDataWrite(async () => {
        if (!isCurrent()) return;
        const next = await profileService.saveBirthday(birthday);
        if (!isCurrent()) return;
        set({ ownProfile: next, ownProfileLoadFailed: false });
        await saveOwnProfileCopy(requestedBy, requestedInSession, next);
      });
    },
  };
};
