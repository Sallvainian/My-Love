import type { DBSchema, IDBPDatabase, IDBPTransaction, StoreNames } from 'idb';
import { openDB, unwrap } from 'idb';
import type { Message, MoodEntry } from '../types';
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
 * - v11: Dropped the photos store (photos live in Supabase; nothing read it)
 * - v12: Added local-copies, the one per-account store for server-derived copies
 * - v13: Added image-cache, per-account image Blobs keyed by storage path
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
  /**
   * The shared per-account local copy (`src/services/localCopy.ts`). One row
   * per account and data kind; `value` is whatever that kind last received
   * from the server, a Realtime event or the user's own write.
   */
  'local-copies': {
    key: [string, string];
    value: StoredLocalCopy;
    indexes: { 'by-user': string };
  };
  /**
   * The per-account image cache (`src/services/imageCache.ts`). One Blob per
   * account and storage path, kept apart from `local-copies` because that
   * store holds plain data only.
   */
  'image-cache': {
    key: [string, string];
    value: StoredCachedImage;
    indexes: { 'by-user': string };
  };
}

/**
 * One cached image for one account, keyed by its storage path (never by a
 * signed URL, which changes on every signing and expires).
 */
export interface StoredCachedImage {
  userId: string;
  path: string;
  blob: Blob;
  /** Epoch ms of the write that cached this image. */
  savedAt: number;
}

/**
 * One saved copy of one data kind for one account.
 */
export interface StoredLocalCopy {
  userId: string;
  kind: string;
  value: unknown;
  /** Epoch ms of the write that saved this copy. */
  savedAt: number;
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
//
// v11 drops the `photos` store that v1/v2 created. Photos have been
// Supabase-only since the gallery moved there, and no code has read or written
// the store since. Same existence gate as v10.
//
// v12 adds `local-copies`, keyed [userId, kind] with a `by-user` index: the one
// store every data kind's saved copy lives in (see src/services/localCopy.ts).
// Created only if absent, so a profile that already has it is a no-op.
//
// v13 adds `image-cache`, keyed [userId, path] with a `by-user` index: image
// Blobs cached by storage path so an image shown online can be shown offline
// (see src/services/imageCache.ts). Same existence gate as v12.
export const DB_VERSION = 13;

/**
 * Store name constants for consistent access across services
 */
export const STORE_NAMES = {
  MESSAGES: 'messages',
  MESSAGE_FAVORITES: 'message-favorites',
  MOODS: 'moods',
  SW_AUTH: 'sw-auth',
  LOCAL_COPIES: 'local-copies',
  IMAGE_CACHE: 'image-cache',
} as const;

/**
 * Centralized IndexedDB upgrade function
 * Handles all store creation and migrations for v1-v13
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
  // (v7 has since superseded it; see DB_VERSION.) The v10 scripture drop and
  // the v11 photos drop use the same rule: delete the store if it EXISTS, never
  // because oldVersion < N.

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

  // v12: the shared per-account local-copy store. Existence-gated like every
  // other branch; a store that already exists gets its index checked instead.
  if (!db.objectStoreNames.contains('local-copies')) {
    const copies = db.createObjectStore('local-copies', { keyPath: ['userId', 'kind'] });
    copies.createIndex('by-user', 'userId');
    logger.debug('[dbSchema] Created local-copies store (v12)');
  } else if (tx) {
    const copies = tx.objectStore('local-copies');
    if (!copies.indexNames.contains('by-user')) copies.createIndex('by-user', 'userId');
  }

  // v13: the per-account image cache. Same existence gate as v12.
  if (!db.objectStoreNames.contains('image-cache')) {
    const images = db.createObjectStore('image-cache', { keyPath: ['userId', 'path'] });
    images.createIndex('by-user', 'userId');
    logger.debug('[dbSchema] Created image-cache store (v13)');
  } else if (tx) {
    const images = tx.objectStore('image-cache');
    if (!images.indexNames.contains('by-user')) images.createIndex('by-user', 'userId');
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

  // v11: drop the photos store if it still exists. Photos live in Supabase and
  // nothing has read or written this store since the gallery moved there.
  // Existence-gated like v10, so a profile that never had it is a no-op.
  if (nativeDb.objectStoreNames.contains('photos')) {
    nativeDb.deleteObjectStore('photos');
    logger.debug('[dbSchema] Dropped photos store (v11)');
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

const UPGRADE_BLOCKED_DIALOG_ID = 'idb-upgrade-blocked-dialog';
const UPGRADE_BLOCKED_TITLE_ID = 'idb-upgrade-blocked-title';

function removeUpgradeBlockedDialog(): void {
  document.getElementById(UPGRADE_BLOCKED_DIALOG_ID)?.remove();
}

function showUpgradeBlockedDialog(): void {
  if (document.getElementById(UPGRADE_BLOCKED_DIALOG_ID)) return;

  const overlay = document.createElement('div');
  overlay.id = UPGRADE_BLOCKED_DIALOG_ID;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', UPGRADE_BLOCKED_TITLE_ID);
  overlay.className = 'fixed inset-0 z-[80] flex items-center justify-center bg-black/80';

  const panel = document.createElement('div');
  panel.className = 'mx-4 w-full max-w-md rounded-lg bg-gray-800 shadow-xl';

  const header = document.createElement('div');
  header.className = 'border-b border-gray-700 px-6 py-4';
  const title = document.createElement('h2');
  title.id = UPGRADE_BLOCKED_TITLE_ID;
  title.className = 'text-xl font-semibold text-white';
  title.textContent = UPGRADE_BLOCKED_RELOAD_MESSAGE;
  header.append(title);

  const footer = document.createElement('div');
  footer.className = 'flex items-center justify-end gap-3 px-6 py-4';

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.textContent = 'Not now';
  dismiss.className =
    'rounded-lg px-4 py-2 text-gray-300 transition-colors hover:bg-gray-700';
  dismiss.addEventListener('click', () => {
    rejectAllPending(new Error('IndexedDB upgrade blocked: reload dismissed'));
    removeUpgradeBlockedDialog();
  });

  const accept = document.createElement('button');
  accept.type = 'button';
  accept.textContent = 'Reload';
  accept.className =
    'rounded-lg bg-pink-600 px-6 py-2 font-medium text-white transition-colors hover:bg-pink-700';
  accept.addEventListener(
    'click',
    () => {
      location.reload();
    },
    { once: true }
  );

  footer.append(dismiss, accept);
  panel.append(header, footer);
  overlay.append(panel);
  document.body.append(overlay);
}

function onUpgradeBlocked(): void {
  if (blockedPromptShown) return;
  blockedPromptShown = true;
  // DOM dialog, not a React modal: this runs from openMyLoveDB's blocked
  // callback (mood/storage/custom-message init, page-side storeAuthToken)
  // and must appear without a user gesture or a mounted React tree.
  showUpgradeBlockedDialog();
}

/**
 * Open `my-love-db` at `DB_VERSION` with the shared upgrade, a `blocked`
 * handler, and a `blocking` handler. App-side services must use this rather
 * than calling `openDB` themselves so a service worker still holding v9 cannot
 * stall the v10 upgrade with no UI.
 *
 * Concurrent opens share one in-app reload dialog: accept reloads once, dismiss
 * rejects every waiting open. The worker has no `window`; it must keep the
 * upgrade-only `openDB` path. New SW code also cannot fix an already-installed
 * v9 worker; the app-side prompt is what unblocks.
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
