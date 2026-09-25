import type { IDBPDatabase } from 'idb';
import type { Message } from '../types';
import { logger } from '../utils/logger';
import { AccountDataError, NOT_SYNCED_MESSAGE } from './accountDataError';
import { customMessagesApi } from './customMessagesApi';
import { type MyLoveDBSchema, type StoredMessageData, openMyLoveDB } from './dbSchema';
import { isFavoriteIn, withFavorite } from './messageFavorites';
import { bundledMessageKey, messageFavoritesApi } from './messageFavoritesApi';

class StorageService {
  private db: IDBPDatabase<MyLoveDBSchema> | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    // Return existing promise if initialization already in progress
    if (this.initPromise) {
      logger.debug('[StorageService] Init already in progress, waiting...');
      return this.initPromise;
    }

    // Return immediately if already initialized
    if (this.db) {
      logger.debug('[StorageService] Already initialized');
      return Promise.resolve();
    }

    // Store promise to prevent concurrent initialization
    this.initPromise = this._doInit();

    try {
      await this.initPromise;
      this.forgetHandleOnVersionChange();
    } finally {
      this.initPromise = null;
    }
  }

  /**
   * `openMyLoveDB`'s `blocking` closes this connection on a later bump.
   * Drop the wrapper so the next `init()` reopens instead of returning as ready.
   */
  private forgetHandleOnVersionChange(): void {
    const db = this.db;
    if (!db) return;
    db.addEventListener('versionchange', () => {
      if (this.db === db) this.db = null;
    });
  }

  private async _doInit(): Promise<void> {
    try {
      logger.debug('[StorageService] Initializing IndexedDB...');
      // Delegates to the shared upgradeDb, exactly as moodService and
      // customMessageService do.
      //
      // This used to be a hand-written callback that created only `messages`
      // and `photos`, on the assumption that whichever service owned a store
      // would create it. That assumption does not hold: IndexedDB runs the
      // upgrade callback of only the ONE open() that performs the
      // version-change transaction, and every other concurrent open() for the
      // same version just connects. On a fresh profile this open() is reached
      // first — initializeApp() calls it from the effect at App.tsx:275,
      // before the mood-sync effects — so its callback was the one that ran,
      // and `moods` and `sw-auth` were never created at all.
      this.db = await openMyLoveDB();
      logger.debug('[StorageService] IndexedDB initialized successfully');
    } catch (error) {
      console.error('[StorageService] Failed to initialize IndexedDB:', error);
      console.error('[StorageService] Error details:', {
        name: (error as Error).name,
        message: (error as Error).message,
      });

      // Fallback: App will continue with default state (handled in useAppStore)
      // Possible causes: permission denied, quota exceeded, corrupted database
      throw error; // Re-throw to allow caller to handle gracefully
    }
  }

  // Message operations
  async addMessage(message: Omit<Message, 'id'>): Promise<number> {
    try {
      await this.init();
      logger.debug('[StorageService] Adding message to IndexedDB');
      const id = await this.db!.add('messages', message as Message);
      logger.debug('[StorageService] Message added successfully, id:', id);
      return id;
    } catch (error) {
      console.error('[StorageService] Failed to add message:', error);
      console.error('[StorageService] Message data:', message);
      throw error; // Re-throw to allow caller to handle
    }
  }

  /**
   * One bundled message by id, or `undefined`. The store holds the bundled
   * daily rows only; custom messages live in each account's `message-data`
   * local copy (`customMessageService`).
   */
  async getMessage(id: number): Promise<Message | undefined> {
    try {
      await this.init();
      const message = await this.db!.get('messages', id);
      if (message && !message.isCustom) {
        logger.debug('[StorageService] Message retrieved successfully, id:', id);
        return message;
      }
      console.warn('[StorageService] Message not found, id:', id);
      return undefined;
    } catch (error) {
      console.error('[StorageService] Failed to get message:', error);
      console.error('[StorageService] Message id:', id);
      return undefined; // Graceful fallback: return undefined
    }
  }

  /**
   * Every bundled daily message, by ascending id. Their favorites are not
   * here: `projectMessageFavorites` applies an account's copy to them.
   */
  async getAllMessages(): Promise<Message[]> {
    try {
      await this.init();
      const messages = (await this.db!.getAll('messages')).filter((message) => !message.isCustom);
      logger.debug('[StorageService] Retrieved all messages, count:', messages.length);
      return messages;
    } catch (error) {
      console.error('[StorageService] Failed to get all messages:', error);
      return []; // Graceful fallback: return empty array
    }
  }

  async getMessagesByCategory(category: string): Promise<Message[]> {
    try {
      await this.init();
      const messages = (
        await this.db!.getAllFromIndex('messages', 'by-category', category)
      ).filter((message) => !message.isCustom);
      logger.debug(
        '[StorageService] Retrieved messages by category:',
        category,
        'count:',
        messages.length
      );
      return messages;
    } catch (error) {
      console.error('[StorageService] Failed to get messages by category:', error);
      console.error('[StorageService] Category:', category);
      return []; // Graceful fallback: return empty array
    }
  }

  /**
   * Toggle one account's favorite on the server, then return the committed
   * value and the copy with it applied. The caller saves that copy.
   *
   * Supabase is the source of truth: a custom message's favorite is its row's
   * `is_favorite`, a bundled message's is a `message_favorites` row keyed by a
   * hash of its text. The current value is read from `copy`, the account's
   * `message-data` local copy. An offline toggle throws before anything is
   * sent, and the caller then leaves the copy as it was.
   *
   * Not queued itself: the caller runs the read, this and the save as one task
   * in the account-data queue (`accountDataQueue.ts`), so two taps resolve to
   * on, then off, and a refresh cannot erase a toggle mid-flight.
   */
  async toggleFavorite(
    userId: string | null,
    message: Message,
    copy: StoredMessageData
  ): Promise<{ isFavorite: boolean; copy: StoredMessageData }> {
    if (!userId) throw new Error('Favorites require a signed-in user');
    const isFavorite = !isFavoriteIn(copy, message);

    if (message.isCustom) {
      if (!message.serverId) {
        throw new AccountDataError('not-synced', NOT_SYNCED_MESSAGE);
      }
      await customMessagesApi.updateCustomMessage(message.serverId, { isFavorite });
    } else {
      const messageKey = await bundledMessageKey(message.text);
      if (isFavorite) await messageFavoritesApi.addFavorite(userId, messageKey);
      else await messageFavoritesApi.removeFavorite(userId, messageKey);
    }

    return { isFavorite, copy: withFavorite(copy, message, isFavorite) };
  }

  /**
   * The ids of the bundled rows whose server key is in `messageKeys`. Bundled
   * ids are device-local, so each row's text is hashed to find the key the
   * server knows it by.
   */
  async bundledFavoriteIds(bundled: Message[], messageKeys: string[]): Promise<number[]> {
    const wanted = new Set(messageKeys);
    const matches = await Promise.all(
      bundled
        .filter((message) => !message.isCustom)
        .map(async (message) =>
          wanted.has(await bundledMessageKey(message.text)) ? message.id : null
        )
    );
    return matches.filter((id): id is number => id !== null);
  }

  // Bulk operations
  async addMessages(messages: Omit<Message, 'id'>[]): Promise<void> {
    try {
      await this.init();
      logger.debug('[StorageService] Adding bulk messages to IndexedDB, count:', messages.length);
      const tx = this.db!.transaction('messages', 'readwrite');
      await Promise.all([...messages.map((msg) => tx.store.add(msg as Message)), tx.done]);
      logger.debug('[StorageService] Bulk messages added successfully');
    } catch (error) {
      console.error('[StorageService] Failed to add bulk messages:', error);
      console.error('[StorageService] Message count:', messages.length);
      throw error; // Re-throw to allow caller to handle
    }
  }
}

// Singleton instance
export const storageService = new StorageService();
