/**
 * Service Worker Database Helpers
 *
 * Minimal IndexedDB operations for use in the service worker context.
 * Uses raw IndexedDB API (no dependencies) for maximum compatibility.
 *
 * Standard PWA Background Sync Pattern:
 * - Reads pending moods from the existing 'my-love-db' database
 * - Reads auth token from a dedicated 'sw-auth' store
 * - Used by sw.ts to sync data when app is closed
 */

// SYNC WARNING: These constants must match src/services/dbSchema.ts
// Service Worker cannot import from dbSchema.ts (no idb library in SW context)
// When changing DB_VERSION, update BOTH files!
const DB_NAME = 'my-love-db';
const DB_VERSION = 4; // Must match DB_VERSION in src/services/dbSchema.ts
const AUTH_STORE = 'sw-auth';
const MOODS_STORE = 'moods';

/**
 * Auth token stored in IndexedDB for SW access
 */
export interface StoredAuthToken {
  id: 'current'; // Single record
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
  userId: string;
}

/**
 * Mood entry as stored in IndexedDB (matches existing schema)
 */
export interface StoredMoodEntry {
  id?: number;
  userId: string;
  mood: string;
  moods?: string[];
  note?: string;
  date: string;
  timestamp: Date;
  synced: boolean;
  supabaseId?: string;
}

/**
 * Open the database with migration support
 * Creates sw-auth store if it doesn't exist
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`Failed to open database: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      console.log(`[SW-DB] Upgrading database from v${oldVersion} to v${DB_VERSION}`);

      // Ensure messages store exists (v1)
      if (!db.objectStoreNames.contains('messages')) {
        const messageStore = db.createObjectStore('messages', {
          keyPath: 'id',
          autoIncrement: true,
        });
        messageStore.createIndex('by-category', 'category');
        messageStore.createIndex('by-date', 'createdAt');
      }

      // Ensure photos store exists (v2)
      if (!db.objectStoreNames.contains('photos')) {
        const photoStore = db.createObjectStore('photos', {
          keyPath: 'id',
          autoIncrement: true,
        });
        photoStore.createIndex('by-date', 'uploadDate', { unique: false });
      }

      // Ensure moods store exists (v3)
      if (!db.objectStoreNames.contains('moods')) {
        const moodsStore = db.createObjectStore('moods', {
          keyPath: 'id',
          autoIncrement: true,
        });
        moodsStore.createIndex('by-date', 'date', { unique: true });
      }

      // Add sw-auth store (v4) - for Background Sync token access
      if (!db.objectStoreNames.contains(AUTH_STORE)) {
        db.createObjectStore(AUTH_STORE, { keyPath: 'id' });
        console.log('[SW-DB] Created sw-auth store for Background Sync');
      }
    };
  });
}

/**
 * Get pending (unsynced) mood entries
 */
export async function getPendingMoods(): Promise<StoredMoodEntry[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(MOODS_STORE, 'readonly');
      const store = tx.objectStore(MOODS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const allMoods = request.result as StoredMoodEntry[];
        const pending = allMoods.filter((mood) => !mood.synced);
        db.close();
        resolve(pending);
      };

      request.onerror = () => {
        db.close();
        reject(new Error(`Failed to get moods: ${request.error?.message}`));
      };
    } catch (error) {
      db.close();
      reject(error);
    }
  });
}

/**
 * Mark a mood as synced in IndexedDB
 */
export async function markMoodSynced(localId: number, supabaseId: string): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(MOODS_STORE, 'readwrite');
      const store = tx.objectStore(MOODS_STORE);
      const getRequest = store.get(localId);

      getRequest.onsuccess = () => {
        const mood = getRequest.result as StoredMoodEntry;
        if (!mood) {
          db.close();
          reject(new Error(`Mood ${localId} not found`));
          return;
        }

        mood.synced = true;
        mood.supabaseId = supabaseId;

        const putRequest = store.put(mood);

        putRequest.onsuccess = () => {
          db.close();
          resolve();
        };

        putRequest.onerror = () => {
          db.close();
          reject(new Error(`Failed to update mood: ${putRequest.error?.message}`));
        };
      };

      getRequest.onerror = () => {
        db.close();
        reject(new Error(`Failed to get mood: ${getRequest.error?.message}`));
      };
    } catch (error) {
      db.close();
      reject(error);
    }
  });
}

/**
 * Store auth token in IndexedDB for SW access
 * Called from authService when user logs in
 */
export async function storeAuthToken(token: Omit<StoredAuthToken, 'id'>): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(AUTH_STORE, 'readwrite');
      const store = tx.objectStore(AUTH_STORE);
      const request = store.put({ id: 'current', ...token });

      request.onsuccess = () => {
        db.close();
        resolve();
      };

      request.onerror = () => {
        db.close();
        reject(new Error(`Failed to store auth token: ${request.error?.message}`));
      };
    } catch (error) {
      db.close();
      reject(error);
    }
  });
}

/**
 * Get stored auth token from IndexedDB
 * Called from SW to authenticate API requests
 */
export async function getAuthToken(): Promise<StoredAuthToken | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(AUTH_STORE, 'readonly');
      const store = tx.objectStore(AUTH_STORE);
      const request = store.get('current');

      request.onsuccess = () => {
        db.close();
        resolve(request.result || null);
      };

      request.onerror = () => {
        db.close();
        reject(new Error(`Failed to get auth token: ${request.error?.message}`));
      };
    } catch (error) {
      db.close();
      reject(error);
    }
  });
}

/**
 * Clear auth token from IndexedDB
 * Called from authService when user logs out
 */
export async function clearAuthToken(): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(AUTH_STORE, 'readwrite');
      const store = tx.objectStore(AUTH_STORE);
      const request = store.delete('current');

      request.onsuccess = () => {
        db.close();
        resolve();
      };

      request.onerror = () => {
        db.close();
        reject(new Error(`Failed to clear auth token: ${request.error?.message}`));
      };
    } catch (error) {
      db.close();
      reject(error);
    }
  });
}
