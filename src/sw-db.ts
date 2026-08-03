/**
 * Service Worker Database Helpers
 *
 * IndexedDB operations for use in the service worker context.
 * Uses idb library for promise-based API (VitePWA bundles via Rollup).
 *
 * Standard PWA Background Sync Pattern:
 * - Reads pending moods from the existing 'my-love-db' database
 * - Reads auth token from a dedicated 'sw-auth' store
 * - Used by sw.ts to sync data when app is closed
 */

import { openDB } from 'idb';
import type { MyLoveDBSchema, StoredAuthToken, StoredMoodEntry } from './services/dbSchema';
import { DB_NAME, DB_VERSION, STORE_NAMES, upgradeDb } from './services/dbSchema';
import type { MarkSyncedOutcome } from './services/moodSyncPayload';
import { moodSyncFingerprint } from './services/moodSyncPayload';

// Re-export types for consumers (sw.ts imports StoredMoodEntry)
export type { StoredMoodEntry } from './services/dbSchema';

/**
 * Open the database with migration support
 * SW must be self-sufficient for Background Sync (app may be closed)
 */
async function openDatabase() {
  return openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // Delegates to the shared upgradeDb rather than carrying its own copy.
      //
      // This was a third hand-written implementation of the schema, alongside
      // storage.ts's. It created messages, photos, moods and sw-auth and had no
      // branch for the scripture stores, so if the worker's open() happened to
      // be the one performing the version-change transaction, those stores were
      // never created. It also built the moods index as unique on `date` alone,
      // which is the cross-account collision v7 exists to remove -- a stale copy
      // here would silently reintroduce it.
      upgradeDb(db, oldVersion, newVersion, transaction);
    },
  });
}

/**
 * Get pending (unsynced) mood entries belonging to one user
 *
 * The moods store holds every account that has signed in on this device, so an
 * unfiltered read returns the previous user's rows too. The worker then stamps
 * whatever it is handed with the stored token's owner
 * (`moodSyncPayload(mood, authToken.userId)` in sw.ts), which uploads one
 * person's private mood notes into the other's account.
 *
 * Mirrors moodService.getUnsyncedMoods, comparison included: a row whose
 * `userId` does not match is skipped, and a row carrying no `userId` at all
 * therefore belongs to nobody and is never claimed. No such row should exist --
 * `moodService.create` has required a `userId` since the file was written -- so
 * that is a guard against a malformed record, not a migration path.
 *
 * @param userId - Owner to scope to. Omitted returns every user's rows and must
 *                 only be used where no account context exists.
 */
export async function getPendingMoods(userId?: string): Promise<StoredMoodEntry[]> {
  const db = await openDatabase();
  try {
    const allMoods = await db.getAll(STORE_NAMES.MOODS);
    return allMoods.filter(
      (mood) => !mood.synced && (userId === undefined || mood.userId === userId)
    );
  } catch (error) {
    throw new Error(
      `Failed to get pending moods: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    db.close();
  }
}

/**
 * Record the outcome of a background sync against a mood record
 *
 * Mirrors moodService.markAsSynced exactly — same comparison, same single
 * readwrite transaction. The worker must not clear the dirty flag on a record
 * an open tab edited while this PATCH was in flight, or that edit is stranded
 * locally and flagged clean, and `getPendingMoods()` never returns it again.
 *
 * The read and the write share one transaction so nothing can commit between
 * them; a `get`/`await`/`put` pair is the same defect in a narrower window.
 *
 * @returns `cleared`, `deferred` (edited mid-flight), or `missing` (deleted)
 */
export async function markMoodSynced(
  localId: number,
  supabaseId: string,
  sentFingerprint: string
): Promise<MarkSyncedOutcome> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE_NAMES.MOODS, 'readwrite');
    const current = await tx.store.get(localId);

    if (!current) {
      await tx.done;
      return 'missing';
    }

    const unchanged = moodSyncFingerprint(current) === sentFingerprint;

    // supabaseId is recorded either way: the server row exists, so the next
    // pass must PATCH it rather than insert a second one.
    await tx.store.put({ ...current, supabaseId, synced: unchanged });
    await tx.done;

    return unchanged ? 'cleared' : 'deferred';
  } catch (error) {
    throw new Error(
      `Failed to mark mood ${localId} as synced: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    db.close();
  }
}

/**
 * Store auth token in IndexedDB for SW access
 * Called from authService when user logs in
 */
export async function storeAuthToken(token: Omit<StoredAuthToken, 'id'>): Promise<void> {
  const db = await openDatabase();
  try {
    await db.put(STORE_NAMES.SW_AUTH, { id: 'current', ...token });
  } catch (error) {
    throw new Error(
      `Failed to store auth token: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    db.close();
  }
}

/**
 * Get stored auth token from IndexedDB
 * Called from SW to authenticate API requests
 */
export async function getAuthToken(): Promise<StoredAuthToken | null> {
  const db = await openDatabase();
  try {
    const token = await db.get(STORE_NAMES.SW_AUTH, 'current');
    return token ?? null;
  } catch (error) {
    throw new Error(
      `Failed to get auth token: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    db.close();
  }
}

/**
 * Clear auth token from IndexedDB
 * Called from authService when user logs out
 */
export async function clearAuthToken(): Promise<void> {
  const db = await openDatabase();
  try {
    await db.delete(STORE_NAMES.SW_AUTH, 'current');
  } catch (error) {
    throw new Error(
      `Failed to clear auth token: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    db.close();
  }
}
