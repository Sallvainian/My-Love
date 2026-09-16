import type { DBSchema, IDBPDatabase, IDBPTransaction, StoreNames } from 'idb';
import { openDB, unwrap } from 'idb';
import type { Message, MoodEntry, Photo } from '../types';
import { logger } from '../utils/logger';

/**
 * Auth token stored for Background Sync SW access
 */
export interface StoredAuthToken {
  id: 'current';
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
}

/**
 * Semantic type alias for mood entries in IndexedDB
 * MoodEntry already has synced/supabaseId fields for persistence
 */
export type StoredMoodEntry = MoodEntry;

/**
 * Shared IndexedDB Schema Definition
 * Defines the structure of all object stores in the my-love-db database
 *
 * Used by:
 * - moodService.ts
 * - customMessageService.ts
 * - BaseIndexedDBService.ts (type constraints)
 *
 * DB Versions:
 * - v1: Basic photos and messages stores
 * - v2: Enhanced Photo schema with compression metadata
 * - v3: Added moods store with by-date unique index
 * - v4: Added sw-auth store for Background Sync
 * - v5: Added scripture stores (sessions, reflections, bookmarks, messages)
 * - v10: Dropped the four scripture stores
 */
export interface MyLoveDBSchema extends DBSchema {
  'message-favorites': {
    key: [number, string];
    value: { messageId: number; userId: string };
    indexes: { 'by-user': string };
  };
  messages: {
    key: number;
    value: Message;
    indexes: {
      'by-category': string;
      'by-date': Date;
      /**
       * Owner of a custom row. Seeded daily rows and legacy custom rows carry
       * no `userId`, so IndexedDB leaves them out of this index entirely —
       * which is why ownership filtering is done in the service rather than by
       * reading this index alone.
       */
      'by-user': string;
    };
  };
  photos: {
    key: number;
    value: Photo;
    indexes: {
      'by-date': Date;
    };
  };
  moods: {
    key: number;
    value: MoodEntry;
    indexes: {
      /**
       * Compound and unique on [userId, date].
       *
       * Was unique on `date` alone, which made the store physically unable to
       * hold two accounts' entries for the same day: on a shared device the
       * second user's mood collided with the first user's row. Uniqueness is
       * still wanted -- one mood per day per person -- so it moves to the pair
       * rather than being dropped.
       */
      'by-user-date': [string, string];
    };
  };
  'sw-auth': {
    key: 'current';
    value: StoredAuthToken;
  };
}

/**
 * Database configuration constants
 */
export const DB_NAME = 'my-love-db';
// v6 added no stores. It existed to re-fire upgradeDb on profiles that reached
// v5 through storage.ts's old callback and are missing moods, sw-auth and the
// scripture stores; upgradeDb's existence checks then created what was absent.
// A healthy database took a no-op upgrade.
//
// v7 replaces the moods `by-date` unique index with `by-user-date`, unique on
// [userId, date], so two accounts on one device can each hold today's mood.
//
// v8 adds `by-user` to the messages store. Custom messages carry an owner now,
// for the same reason moods do: the store holds every account that has signed
// in on this device, and an unscoped read handed one partner the other's
// private custom messages to list, edit, delete, export and rotate through.
// v9 stores favorites by account and message, preserving only attributable legacy flags.
//
// v10 drops the four scripture stores (`scripture-sessions`,
// `scripture-reflections`, `scripture-bookmarks`, `scripture-messages`) that
// v5 created. The drop is existence-gated so a profile that never had them
// (or already lost them) is a no-op, and survivor rows are left intact.
export const DB_VERSION = 10;

/**
 * Store name constants for consistent access across services
 */
export const STORE_NAMES = {
  MESSAGES: 'messages',
  MESSAGE_FAVORITES: 'message-favorites',
  PHOTOS: 'photos',
  MOODS: 'moods',
  SW_AUTH: 'sw-auth',
} as const;

/**
 * Centralized IndexedDB upgrade function
 * Handles all store creation and migrations for v1-v10
 *
 * Called by all services to ensure consistent database schema.
 * This fixes the tech debt where each service had duplicate upgrade logic.
 *
 * @param db - The IDBPDatabase instance being upgraded
 * @param oldVersion - Previous database version (0 if new)
 * @param _newVersion - Target database version (unused but required by callback signature)
 */
export function upgradeDb(
  db: IDBPDatabase<MyLoveDBSchema>,
  oldVersion: number,
  _newVersion: number | null,
  tx?: IDBPTransaction<MyLoveDBSchema, ArrayLike<StoreNames<MyLoveDBSchema>>, 'versionchange'>
): void {
  logger.debug(`[dbSchema] Upgrading database from v${oldVersion} to v${DB_VERSION}`);

  // Every branch below keys off whether the store EXISTS, not off oldVersion
  // alone. A version guard assumes the store was created at the version that
  // introduced it, which was not true for any profile that upgraded through
  // storage.ts's own (now deleted) callback: it created only messages and
  // photos, so those databases reached v5 missing moods, sw-auth and (at the
  // time) the four scripture stores, and no `oldVersion < N` branch could ever
  // fire again to create them. Existence checks make this function repair such
  // a database instead of skipping past it. The v6 bump is what makes those
  // profiles re-enter the upgrade at all — the checks alone would never run.
  // (v7 has since superseded it; see DB_VERSION.) The v10 scripture drop uses
  // the same rule: delete the store if it EXISTS, never because oldVersion < 10.

  // v1: messages store
  if (!db.objectStoreNames.contains('messages')) {
    const messageStore = db.createObjectStore('messages', {
      keyPath: 'id',
      autoIncrement: true,
    });
    messageStore.createIndex('by-category', 'category');
    messageStore.createIndex('by-date', 'createdAt');
    messageStore.createIndex('by-user', 'userId');
    logger.debug('[dbSchema] Created messages store with indexes (v1, by-user at v8)');
  } else if (tx) {
    // v8: add `by-user` to an existing store. Same mechanics as the moods
    // branch below — adding an index to a store that already exists needs the
    // versionchange transaction, so a caller that cannot supply one leaves the
    // store alone rather than half-migrating. Every opener threads `tx`.
    //
    // Gated on the index being absent, not on `oldVersion < 8`: a profile that
    // reached its current version through storage.ts's old hand-written
    // callback can be at any version with any subset of the schema, and a
    // version guard would skip past it forever.
    const messageStore = tx.objectStore('messages');

    if (!messageStore.indexNames.contains('by-user')) {
      // Not unique: one account owns many custom rows, and the seeded daily
      // rows carry no `userId` at all so IndexedDB simply omits them here.
      messageStore.createIndex('by-user', 'userId');
      logger.debug('[dbSchema] Created messages by-user index (v8)');
    }
  }

  // v9: favorites belong to an account, never to a shared message row.
  // Creating the store is also the one-time migration marker. Keep legacy
  // rows intact; only a custom row with an explicit owner can be attributed.
  if (!db.objectStoreNames.contains('message-favorites')) {
    const favorites = db.createObjectStore('message-favorites', {
      keyPath: ['messageId', 'userId'],
    });
    favorites.createIndex('by-user', 'userId');
    if (tx) {
      const request = unwrap(tx.objectStore('messages')).openCursor();
      request.addEventListener('success', () => {
        const cursor = request.result;
        if (!cursor) return;
        const row = cursor.value as Message;
        if (
          row.isCustom === true &&
          typeof row.userId === 'string' &&
          row.userId &&
          row.isFavorite === true
        ) {
          unwrap(favorites).put({ messageId: row.id, userId: row.userId });
        }
        cursor.continue();
      });
    }
  } else if (tx) {
    const favorites = tx.objectStore('message-favorites');
    if (!favorites.indexNames.contains('by-user')) favorites.createIndex('by-user', 'userId');
  }

  // v2: photos store
  //
  // This upgrade is DESTRUCTIVE for a v1 database: the v1 store is dropped and
  // recreated, losing any cached rows. The data-preserving path used to live in
  // photoStorageService.ts (it needed async transaction access, which an
  // upgrade callback cannot do), and that file no longer exists.
  //
  // Left destructive deliberately. Photos are Supabase-first — IndexedDB is a
  // read cache, so a dropped store refills on the next fetch. A v1 database
  // also predates the current schema by a wide margin. Restoring preservation
  // would mean reintroducing an async migration step for a cache that costs
  // nothing to rebuild.
  // The drop stays gated on oldVersion: it exists to discard the INCOMPATIBLE
  // v1 schema, so it must fire for a genuine v1 database and never for a v2+
  // one that already holds good rows.
  if (oldVersion < 2 && db.objectStoreNames.contains('photos')) {
    db.deleteObjectStore('photos');
    logger.debug('[dbSchema] Deleted old photos store from v1');
  }

  if (!db.objectStoreNames.contains('photos')) {
    const photosStore = db.createObjectStore('photos', {
      keyPath: 'id',
      autoIncrement: true,
    });
    photosStore.createIndex('by-date', 'uploadDate', { unique: false });
    logger.debug('[dbSchema] Created photos store with by-date index (v2)');
  }

  // v3: moods store
  if (!db.objectStoreNames.contains('moods')) {
    const moodsStore = db.createObjectStore('moods', {
      keyPath: 'id',
      autoIncrement: true,
    });
    moodsStore.createIndex('by-user-date', ['userId', 'date'], { unique: true });
    logger.debug('[dbSchema] Created moods store with by-user-date unique index (v7)');
  } else if (tx) {
    // v7: swap the old date-only unique index for the compound one. Altering an
    // index on an existing store needs the versionchange transaction, which is
    // why `tx` is threaded in; callers that cannot supply it leave the index
    // alone rather than half-migrating.
    const moodsStore = tx.objectStore('moods');

    // 'by-date' is deliberately absent from MyLoveDBSchema now, so the typed
    // wrapper cannot name it. The index still exists on disk for every profile
    // created before v7, so it is dropped through the unwrapped IDB handle.
    const legacyStore = unwrap(moodsStore);

    if (legacyStore.indexNames.contains('by-date')) {
      legacyStore.deleteIndex('by-date');
      logger.debug('[dbSchema] Dropped moods by-date index (v7)');
    }

    if (!moodsStore.indexNames.contains('by-user-date')) {
      // Safe to build as unique over existing rows: the index it replaces was
      // unique on `date` alone, which is strictly stricter than [userId, date],
      // so no surviving pair can already collide.
      moodsStore.createIndex('by-user-date', ['userId', 'date'], { unique: true });
      logger.debug('[dbSchema] Created moods by-user-date unique index (v7)');
    }
  }

  // v4: sw-auth store for Background Sync
  if (!db.objectStoreNames.contains('sw-auth')) {
    db.createObjectStore('sw-auth', { keyPath: 'id' });
    logger.debug('[dbSchema] Created sw-auth store for Background Sync (v4)');
  }

  // v10: drop the four scripture stores if they still exist. Names are gone
  // from MyLoveDBSchema, so the typed wrapper cannot mention them — same
  // unwrap path as the v7 `by-date` index drop. Gated on existence, not on
  // `oldVersion < 10`, because a profile that never had them (storage.ts's old
  // callback; a later partial drop) must not throw.
  const nativeDb = unwrap(db);
  for (const storeName of [
    'scripture-sessions',
    'scripture-reflections',
    'scripture-bookmarks',
    'scripture-messages',
  ] as const) {
    if (nativeDb.objectStoreNames.contains(storeName)) {
      nativeDb.deleteObjectStore(storeName);
      logger.debug(`[dbSchema] Dropped ${storeName} store (v10)`);
    }
  }
}

const UPGRADE_BLOCKED_RELOAD_MESSAGE =
  'A database update is waiting. You must reload this page to finish the update.';

type PendingOpen = {
  settled: boolean;
  resolve: (db: IDBPDatabase<MyLoveDBSchema>) => void;
  reject: (error: unknown) => void;
};

const pendingOpens: PendingOpen[] = [];
let blockedPromptShown = false;

function removePending(pending: PendingOpen): void {
  const idx = pendingOpens.indexOf(pending);
  if (idx !== -1) pendingOpens.splice(idx, 1);
  if (pendingOpens.length === 0) blockedPromptShown = false;
}

function rejectAllPending(error: unknown): void {
  const waiting = pendingOpens.splice(0);
  blockedPromptShown = false;
  for (const pending of waiting) {
    if (pending.settled) continue;
    pending.settled = true;
    pending.reject(error);
  }
}

function onUpgradeBlocked(): void {
  if (blockedPromptShown) return;
  blockedPromptShown = true;
  const accepted = window.confirm(UPGRADE_BLOCKED_RELOAD_MESSAGE);
  if (accepted) {
    location.reload();
    return;
  }
  rejectAllPending(new Error('IndexedDB upgrade blocked: reload dismissed'));
}

/**
 * Open `my-love-db` at `DB_VERSION` with the shared upgrade, a `blocked`
 * handler, and a `blocking` handler. App-side services must use this rather
 * than calling `openDB` themselves so a service worker still holding v9 cannot
 * stall the v10 upgrade with no UI.
 *
 * Concurrent opens share one confirm: accept reloads once, dismiss rejects
 * every waiting open. The worker has no `window`; it must keep the upgrade-only
 * `openDB` path. New SW code also cannot fix an already-installed v9 worker;
 * the app-side prompt is what unblocks.
 *
 * `blocking` closes this live handle when a newer version wants the database.
 * Holders that do not close still hit `blocked: onUpgradeBlocked`.
 */
export function openMyLoveDB(): Promise<IDBPDatabase<MyLoveDBSchema>> {
  return new Promise((resolve, reject) => {
    const pending: PendingOpen = { settled: false, resolve, reject };
    pendingOpens.push(pending);

    let liveDb: IDBPDatabase<MyLoveDBSchema> | undefined;
    const opening = openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        upgradeDb(db, oldVersion, newVersion, transaction);
      },
      blocked: onUpgradeBlocked,
      blocking() {
        liveDb?.close();
      },
    });

    void opening.then(
      (db) => {
        liveDb = db;
        removePending(pending);
        if (pending.settled) {
          db.close();
          return;
        }
        pending.settled = true;
        resolve(db);
      },
      (error: unknown) => {
        removePending(pending);
        if (pending.settled) return;
        pending.settled = true;
        reject(error);
      }
    );
  });
}
