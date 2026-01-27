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
import { DB_NAME, DB_VERSION, STORE_NAMES } from './services/dbSchema';
import type { MyLoveDBSchema, StoredAuthToken, StoredMoodEntry } from './services/dbSchema';

// Re-export types for consumers (sw.ts imports StoredMoodEntry)
export type { StoredAuthToken, StoredMoodEntry } from './services/dbSchema';

/**
 * Open the database with migration support
 * SW must be self-sufficient for Background Sync (app may be closed)
 */
async function openDatabase() {
  return openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion) {
      if (import.meta.env.DEV) {
        console.log(`[SW-DB] Upgrading database from v${oldVersion} to v${newVersion ?? 'unknown'}`);
      }

      // Migration: v0 → v1 - Add messages store
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(STORE_NAMES.MESSAGES)) {
          const messageStore = db.createObjectStore(STORE_NAMES.MESSAGES, {
            keyPath: 'id',
            autoIncrement: true,
          });
          messageStore.createIndex('by-category', 'category');
          messageStore.createIndex('by-date', 'createdAt');
        }
      }

      // Migration: v1 → v2 - Add photos store
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(STORE_NAMES.PHOTOS)) {
          const photoStore = db.createObjectStore(STORE_NAMES.PHOTOS, {
            keyPath: 'id',
            autoIncrement: true,
          });
          photoStore.createIndex('by-date', 'uploadDate', { unique: false });
        }
      }

      // Migration: v2 → v3 - Add moods store
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains(STORE_NAMES.MOODS)) {
          const moodsStore = db.createObjectStore(STORE_NAMES.MOODS, {
            keyPath: 'id',
            autoIncrement: true,
          });
          moodsStore.createIndex('by-date', 'date', { unique: true });
        }
      }

      // Migration: v3 → v4 - Add sw-auth store for Background Sync
      if (oldVersion < 4) {
        if (!db.objectStoreNames.contains(STORE_NAMES.SW_AUTH)) {
          db.createObjectStore(STORE_NAMES.SW_AUTH, { keyPath: 'id' });
          if (import.meta.env.DEV) {
            console.log('[SW-DB] Created sw-auth store for Background Sync');
          }
        }
      }
    },
  });
}

/**
 * Get pending (unsynced) mood entries
 */
export async function getPendingMoods(): Promise<StoredMoodEntry[]> {
  const db = await openDatabase();
  try {
    const allMoods = await db.getAll(STORE_NAMES.MOODS);
    return allMoods.filter((mood) => !mood.synced);
  } catch (error) {
    throw new Error(`Failed to get pending moods: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    db.close();
  }
}

/**
 * Mark a mood as synced in IndexedDB
 */
export async function markMoodSynced(localId: number, supabaseId: string): Promise<void> {
  const db = await openDatabase();
  try {
    const mood = await db.get(STORE_NAMES.MOODS, localId);
    if (!mood) {
      throw new Error(`Mood ${localId} not found`);
    }

    mood.synced = true;
    mood.supabaseId = supabaseId;
    await db.put(STORE_NAMES.MOODS, mood);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error; // Re-throw "not found" errors as-is
    }
    throw new Error(`Failed to mark mood ${localId} as synced: ${error instanceof Error ? error.message : String(error)}`);
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
    throw new Error(`Failed to store auth token: ${error instanceof Error ? error.message : String(error)}`);
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
    throw new Error(`Failed to get auth token: ${error instanceof Error ? error.message : String(error)}`);
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
    throw new Error(`Failed to clear auth token: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    db.close();
  }
}
