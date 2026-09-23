import type { IDBPDatabase } from 'idb';
import type { Message } from '../types';
import { logger } from '../utils/logger';
import { AccountDataError, NOT_SYNCED_MESSAGE } from './accountDataError';
import { serializeAccountDataWrite } from './accountDataQueue';
import { customMessagesApi } from './customMessagesApi';
import { type MyLoveDBSchema, openMyLoveDB } from './dbSchema';
import { projectMessageFavorites } from './messageFavorites';
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
   * One message by id, if this caller may see it.
   *
   * `userId` is REQUIRED and nullable for the same reason getAllMessages's is:
   * the signed-out case is real (the shared daily rows still have to load), but
   * it has to be stated at the call site rather than reached by leaving an
   * argument off.
   *
   * A row this caller may not see is reported exactly as a row that is not
   * there — same `undefined`, same warning. Message ids are small sequential
   * integers, so a distinguishable "exists but hidden" answer would hand one
   * account a way to enumerate the other's private rows.
   */
  async getMessage(id: number, userId: string | null): Promise<Message | undefined> {
    try {
      await this.init();
      const message = await this.db!.get('messages', id);
      if (message && this.isVisibleTo(message, userId)) {
        logger.debug('[StorageService] Message retrieved successfully, id:', id);
        return (await projectMessageFavorites(this.db!, [message], userId))[0];
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
   * Narrow a batch of rows to the ones `userId` may see. The rule itself is
   * {@link isVisibleTo}.
   */
  private visibleTo(messages: Message[], userId: string | null): Message[] {
    return messages.filter((message) => this.isVisibleTo(message, userId));
  }

  /**
   * May `userId` see this row? The shared daily messages are everyone's, plus
   * that caller's own custom messages.
   *
   * Custom rows with no nonempty owner are legacy and belong to nobody.
   * Signed-out readers see only shared rows, even if a legacy owner is null.
   *
   * This is the single expression of the rule — the batch reads reach it
   * through {@link visibleTo}. By-id reads and favorite writes use it too;
   * generic edits and deletions additionally require ownership.
   */
  private isVisibleTo(message: Message, userId: string | null): boolean {
    return !message.isCustom || (!!userId && message.userId === userId);
  }

  /**
   * Every message the caller may see, shared and own alike.
   *
   * The `messages` store holds every account that has signed in on this device,
   * and this read feeds the daily rotation and the Home screen — so unscoped it
   * put one partner's private custom messages into the other's rotation pool.
   *
   * `userId` is REQUIRED and nullable rather than optional: the signed-out case
   * is real (the daily messages still have to load), but it has to be stated at
   * the call site rather than reached by leaving an argument off.
   */
  async getAllMessages(userId: string | null): Promise<Message[]> {
    try {
      await this.init();
      const messages = this.visibleTo(await this.db!.getAll('messages'), userId);
      logger.debug('[StorageService] Retrieved all messages, count:', messages.length);
      return await projectMessageFavorites(this.db!, messages, userId);
    } catch (error) {
      console.error('[StorageService] Failed to get all messages:', error);
      return []; // Graceful fallback: return empty array
    }
  }

  async getMessagesByCategory(category: string, userId: string | null): Promise<Message[]> {
    try {
      await this.init();
      const messages = this.visibleTo(
        await this.db!.getAllFromIndex('messages', 'by-category', category),
        userId
      );
      logger.debug(
        '[StorageService] Retrieved messages by category:',
        category,
        'count:',
        messages.length
      );
      return await projectMessageFavorites(this.db!, messages, userId);
    } catch (error) {
      console.error('[StorageService] Failed to get messages by category:', error);
      console.error('[StorageService] Category:', category);
      return []; // Graceful fallback: return empty array
    }
  }

  /** Owner-only edits. Protected fields are rejected, not silently stripped. */
  async updateMessage(id: number, updates: Partial<Message>, userId: string | null): Promise<void> {
    if (!userId) throw new Error('Message writes require a signed-in user');
    const editable = new Set(['text', 'category', 'active', 'tags']);
    if (Object.keys(updates).some((key) => !editable.has(key))) {
      throw new Error('Cannot update protected message fields');
    }
    await this.init();
    const tx = this.db!.transaction('messages', 'readwrite');
    // A failed request also rejects tx.done; observe both failure channels.
    void tx.done.catch(() => {});
    const message = await tx.store.get(id);
    if (!message || !message.isCustom || message.userId !== userId) {
      await tx.done;
      throw new Error('Message not found for this user');
    }
    await tx.store.put({ ...message, ...updates, updatedAt: new Date() });
    await tx.done;
  }

  async deleteMessage(id: number, userId: string | null): Promise<void> {
    if (!userId) throw new Error('Message writes require a signed-in user');
    await this.init();
    const tx = this.db!.transaction(['messages', 'message-favorites'], 'readwrite');
    // A failed request also rejects tx.done; observe both failure channels.
    void tx.done.catch(() => {});
    const message = await tx.objectStore('messages').get(id);
    if (!message || !message.isCustom || message.userId !== userId) {
      await tx.done;
      throw new Error('Message not found for this user');
    }
    await tx.objectStore('messages').delete(id);
    await tx.objectStore('message-favorites').delete([id, userId]);
    await tx.done;
  }

  /**
   * Toggle one account's favorite, server first; return the committed value.
   *
   * Supabase is the source of truth: a custom message's favorite is its row's
   * `is_favorite`, a bundled message's is a `message_favorites` row keyed by a
   * hash of its text. The `message-favorites` store is the read mirror, written
   * only after the server accepted the change, so an offline toggle throws and
   * changes nothing.
   *
   * The read, the request and the mirror write cannot share one IndexedDB
   * transaction — it would commit at the network await — so toggles go
   * through the account-data queue instead (`accountDataQueue.ts`). Two taps
   * still resolve to on, then off, rather than both reading "off" and both
   * writing "on", and a mirror refresh cannot erase a toggle mid-flight.
   */
  async toggleFavorite(messageId: number, userId: string | null): Promise<boolean> {
    if (!userId) throw new Error('Favorites require a signed-in user');
    return serializeAccountDataWrite(() => this.toggleFavoriteNow(messageId, userId));
  }

  private async toggleFavoriteNow(messageId: number, userId: string): Promise<boolean> {
    await this.init();
    const key: [number, string] = [messageId, userId];
    // Both reads in one explicit transaction whose `done` is observed: the
    // idb shortcut reads open their own and leave an abort unobserved.
    const read = this.db!.transaction(['messages', 'message-favorites'], 'readonly');
    void read.done.catch(() => {});
    const message = await read.objectStore('messages').get(messageId);
    if (!message || !this.isVisibleTo(message, userId)) {
      throw new Error('Message not found for this user');
    }
    const isFavorite = !(await read.objectStore('message-favorites').get(key));

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

    const tx = this.db!.transaction('message-favorites', 'readwrite');
    // A failed request also rejects tx.done; observe both failure channels.
    void tx.done.catch(() => {});
    if (isFavorite) await tx.store.put({ messageId, userId });
    else await tx.store.delete(key);
    await tx.done;
    return isFavorite;
  }

  /**
   * Replace `userId`'s favorites of BUNDLED messages with the server's keys.
   *
   * Bundled ids are device-local, so each bundled row's text is hashed to find
   * the key the server knows it by. Favorites of custom rows are left alone —
   * `customMessageService.replaceMirrorForUser` owns those. Hashing happens
   * before the transaction opens, because an IndexedDB transaction commits at
   * the first await that is not one of its own requests.
   */
  async replaceBundledFavoritesForUser(userId: string, messageKeys: string[]): Promise<void> {
    await this.init();
    const wanted = new Set(messageKeys);
    const read = this.db!.transaction('messages', 'readonly');
    void read.done.catch(() => {});
    const bundled = (await read.store.getAll()).filter((message) => !message.isCustom);
    const favorite = new Map<number, boolean>(
      await Promise.all(
        bundled.map(
          async (message) =>
            [message.id, wanted.has(await bundledMessageKey(message.text))] as [number, boolean]
        )
      )
    );

    const tx = this.db!.transaction('message-favorites', 'readwrite');
    void tx.done.catch(() => {});
    const current = await tx.store.index('by-user').getAll(userId);
    for (const entry of current) {
      if (favorite.get(entry.messageId) === false) {
        await tx.store.delete([entry.messageId, userId]);
      }
    }
    for (const [messageId, isFavorite] of favorite) {
      if (isFavorite) await tx.store.put({ messageId, userId });
    }
    await tx.done;
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
