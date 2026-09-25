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
 * - storage.ts
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
 * - v14: Added note-queue, per-account love-note text waiting to be sent
 * - v15: Moved the signed-in account's custom messages and favorites into its
 *   `message-data` local copy; dropped every custom row, the messages `by-user`
 *   index and the `message-favorites` store
 */
export interface MyLoveDBSchema extends DBSchema {
  /**
   * The bundled daily messages only, seeded from `src/data/defaultMessages.ts`
   * and shared by every account. Custom messages and favorites live in each
   * account's `message-data` local copy (v15).
   */
  messages: {
    key: number;
    value: Message;
    indexes: {
      'by-category': string;
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
  /**
   * The per-account love-note send queue (`src/services/noteQueue.ts`). One
   * row per composed text note, keyed by its `tempId`, until the server has
   * confirmed it.
   */
  'note-queue': {
    key: string;
    value: StoredQueuedNote;
    indexes: { 'by-user': string };
  };
}

/**
 * One love note composed by `userId` and not yet confirmed by the server.
 * Plain data only; `id` is the note's `tempId` and its `idempotency_key`.
 */
export interface StoredQueuedNote {
  id: string;
  userId: string;
  toUserId: string;
  content: string;
  /** ISO timestamp of composition; the queue is sent oldest first. */
  createdAt: string;
  /** True once the server rejected it; only a Retry sends it again. */
  failed: boolean;
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
 * Local-copy kind holding one account's custom messages and favorites. Defined
 * here rather than beside its consumers because the v15 upgrade writes it, and
 * this module is bundled into the service worker.
 */
export const MESSAGE_DATA_COPY_KIND = 'message-data';

/**
 * The value of one account's `message-data` local copy.
 *
 * - `custom`: the account's custom messages, each with its device-local `id`
 *   (the rotation history and favorites refer to it) and its `serverId`. A
 *   custom row's favorite is its own `isFavorite`, from the server's row.
 * - `bundledFavoriteIds`: the ids of the bundled rows (`messages` store) this
 *   account has favorited.
 * - `nextCustomId`: the id the next new custom row takes. It only grows, so an
 *   id a deleted row used is never handed out again.
 */
export interface StoredMessageData {
  custom: Message[];
  bundledFavoriteIds: number[];
  nextCustomId: number;
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
// v8 added `by-user` to the messages store and v9 the `message-favorites`
// store, so custom messages and favorites could be scoped per account on a
// shared device. Both are gone since v15 (below); neither branch runs now.
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
//
// v14 adds `note-queue`, keyed by the note's tempId with a `by-user` index:
// love-note text waiting to be sent (see src/services/noteQueue.ts). Same
// existence gate as v12.
//
// v15 moves custom messages and favorites onto the `message-data` local copy.
// The account in `sw-auth` 'current' gets its own custom rows (same ids) and
// favorites copied; then every custom row, the messages `by-user` index and the
// `message-favorites` store are deleted, so rows left by accounts that signed
// out long ago go too. Gated on those legacy structures existing (see
// migrateMessageDataToLocalCopy), never on oldVersion.
export const DB_VERSION = 15;

/**
 * Store name constants for consistent access across services
 */
export const STORE_NAMES = {
  MESSAGES: 'messages',
  MOODS: 'moods',
  SW_AUTH: 'sw-auth',
  LOCAL_COPIES: 'local-copies',
  IMAGE_CACHE: 'image-cache',
  NOTE_QUEUE: 'note-queue',
} as const;

/**
 * Centralized IndexedDB upgrade function
 * Handles all store creation and migrations for v1-v15
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

  // v1: messages store. It holds the bundled daily rows only; the v8 `by-user`
  // index is no longer created, and v15 below drops it where it exists.
  if (!db.objectStoreNames.contains('messages')) {
    const messageStore = db.createObjectStore('messages', {
      keyPath: 'id',
      autoIncrement: true,
    });
    messageStore.createIndex('by-category', 'category');
    messageStore.createIndex('by-date', 'createdAt');
    logger.debug('[dbSchema] Created messages store with indexes (v1)');
  }

  // v9 (`message-favorites`) is no longer created: favorites live in the
  // `message-data` local copy, and v15 below reads and drops the store where a
  // profile still has it.

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

  // v14: the per-account love-note send queue. Same existence gate as v12.
  if (!db.objectStoreNames.contains('note-queue')) {
    const queue = db.createObjectStore('note-queue', { keyPath: 'id' });
    queue.createIndex('by-user', 'userId');
    logger.debug('[dbSchema] Created note-queue store (v14)');
  } else if (tx) {
    const queue = tx.objectStore('note-queue');
    if (!queue.indexNames.contains('by-user')) queue.createIndex('by-user', 'userId');
  }

  // v15: custom messages and favorites move onto the `message-data` local
  // copy. Runs after v12 so `local-copies` exists for the copy it writes.
  if (tx) migrateMessageDataToLocalCopy(unwrap(db), unwrap(tx));

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

/**
 * v15: move the signed-in account's custom messages and favorites into its
 * `message-data` local copy, then delete every custom row, the messages
 * `by-user` index and the `message-favorites` store.
 *
 * Only the account in `sw-auth` 'current' is copied: `upgradeDb` also runs in
 * the service worker, where the localStorage account-owner marker cannot be
 * read. Custom rows keep their ids, so rotation history and favorites still
 * name them. Every other account's rows (left by sign-outs before #341) are
 * deleted, not copied; the server still holds them, and that account's next
 * sign-in refills its copy from there. With no token, nothing is copied.
 *
 * Favorites come from `message-favorites` when the profile has it. A profile
 * that never reached v9 has only the legacy `isFavorite` flag, which counts on
 * an owned custom row alone — the rule v9 applied: a bundled row's flag names
 * no account.
 *
 * Gated on the legacy structures, never on oldVersion: a copy is written only
 * when the `message-favorites` store or the `by-user` index existed or a
 * custom row was found, so a later version bump over a migrated profile scans
 * the bundled rows and writes nothing. A copy that already exists is kept.
 *
 * Raw request callbacks, as upgradeDb is synchronous and an idb promise would
 * not keep the versionchange transaction alive. A failed request aborts the
 * upgrade, so a profile is never left half-migrated.
 */
function migrateMessageDataToLocalCopy(db: IDBDatabase, tx: IDBTransaction): void {
  if (!db.objectStoreNames.contains('messages')) return;
  const messages = tx.objectStore('messages');
  const hadFavoritesStore = db.objectStoreNames.contains('message-favorites');
  const hadOwnerIndex = messages.indexNames.contains('by-user');
  if (hadOwnerIndex) {
    messages.deleteIndex('by-user');
    logger.debug('[dbSchema] Dropped messages by-user index (v15)');
  }

  const dropFavoritesStore = () => {
    if (db.objectStoreNames.contains('message-favorites')) {
      db.deleteObjectStore('message-favorites');
      logger.debug('[dbSchema] Dropped message-favorites store (v15)');
    }
  };

  // 3. Every custom row goes; the signed-in account's are collected first.
  const moveRows = (userId: string | null, favoriteIds: Set<number>) => {
    const custom: Message[] = [];
    const bundledFavoriteIds: number[] = [];
    let maxId = 0;
    let foundCustom = false;
    const scan = messages.openCursor();
    scan.addEventListener('success', () => {
      const cursor = scan.result;
      if (cursor) {
        const row = cursor.value as Message;
        if (typeof row.id === 'number') maxId = Math.max(maxId, row.id);
        if (row.isCustom) {
          foundCustom = true;
          if (userId && row.userId === userId) {
            const isFavorite = hadFavoritesStore
              ? favoriteIds.has(row.id)
              : row.isFavorite === true;
            custom.push({ ...row, isFavorite });
          }
          cursor.delete();
        } else if (favoriteIds.has(row.id)) {
          bundledFavoriteIds.push(row.id);
        }
        cursor.continue();
        return;
      }

      if (!userId || !(hadFavoritesStore || hadOwnerIndex || foundCustom)) return;
      const copies = tx.objectStore('local-copies');
      const existing = copies.get([userId, MESSAGE_DATA_COPY_KIND]);
      existing.addEventListener('success', () => {
        if (existing.result) return;
        const value: StoredMessageData = {
          custom: custom.sort((a, b) => a.id - b.id),
          bundledFavoriteIds,
          nextCustomId: maxId + 1,
        };
        const row: StoredLocalCopy = {
          userId,
          kind: MESSAGE_DATA_COPY_KIND,
          value,
          savedAt: Date.now(),
        };
        copies.put(row);
        logger.debug(`[dbSchema] Moved ${custom.length} custom messages to the local copy (v15)`);
      });
    });
  };

  // 2. The signed-in account's favorites, read before their store is dropped.
  const readFavorites = (userId: string | null) => {
    if (!userId || !hadFavoritesStore) {
      dropFavoritesStore();
      moveRows(userId, new Set());
      return;
    }
    const read = tx.objectStore('message-favorites').getAll();
    read.addEventListener('success', () => {
      const ids = new Set<number>();
      for (const entry of read.result as Array<{ messageId: number; userId: string }>) {
        if (entry.userId === userId) ids.add(entry.messageId);
      }
      dropFavoritesStore();
      moveRows(userId, ids);
    });
  };

  // 1. Whose rows to keep: the account in the Background Sync token slot.
  if (!db.objectStoreNames.contains('sw-auth')) {
    readFavorites(null);
    return;
  }
  const token = tx.objectStore('sw-auth').get('current');
  token.addEventListener('success', () => {
    const userId = (token.result as StoredAuthToken | undefined)?.userId;
    readFavorites(typeof userId === 'string' && userId ? userId : null);
  });
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
  overlay.className = 'fixed inset-0 z-80 flex items-center justify-center bg-black/80';

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
  // callback (mood/storage init, page-side storeAuthToken)
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
