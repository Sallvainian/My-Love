import type { IDBPDatabase } from 'idb';
import type { Message, Photo } from '../types';
import { logger } from '../utils/logger';
import { type MyLoveDBSchema, openMyLoveDB } from './dbSchema';
import { projectMessageFavorites } from './messageFavorites';

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

  // Photo operations
  async addPhoto(photo: Omit<Photo, 'id'>): Promise<number> {
    try {
      await this.init();
      logger.debug('[StorageService] Adding photo to IndexedDB');
      const id = await this.db!.add('photos', photo as Photo);
      logger.debug('[StorageService] Photo added successfully, id:', id);
      return id;
    } catch (error) {
      console.error('[StorageService] Failed to add photo:', error);
      console.error('[StorageService] Photo data:', photo);
      throw error; // Re-throw to allow caller to handle
    }
  }

  async getPhoto(id: number): Promise<Photo | undefined> {
    try {
      await this.init();
      const photo = await this.db!.get('photos', id);
      if (photo) {
        logger.debug('[StorageService] Photo retrieved successfully, id:', id);
      } else {
        console.warn('[StorageService] Photo not found, id:', id);
      }
      return photo;
    } catch (error) {
      console.error('[StorageService] Failed to get photo:', error);
      console.error('[StorageService] Photo id:', id);
      return undefined; // Graceful fallback: return undefined
    }
  }

  async getAllPhotos(): Promise<Photo[]> {
    try {
      await this.init();
      const photos = await this.db!.getAll('photos');
      logger.debug('[StorageService] Retrieved all photos, count:', photos.length);
      return photos;
    } catch (error) {
      console.error('[StorageService] Failed to get all photos:', error);
      return []; // Graceful fallback: return empty array
    }
  }

  async deletePhoto(id: number): Promise<void> {
    try {
      await this.init();
      await this.db!.delete('photos', id);
      logger.debug('[StorageService] Photo deleted successfully, id:', id);
    } catch (error) {
      console.error('[StorageService] Failed to delete photo:', error);
      console.error('[StorageService] Photo id:', id);
      throw error; // Re-throw to allow caller to handle
    }
  }

  async updatePhoto(id: number, updates: Partial<Photo>): Promise<void> {
    try {
      await this.init();
      const photo = await this.getPhoto(id);
      if (photo) {
        await this.db!.put('photos', { ...photo, ...updates });
        logger.debug('[StorageService] Photo updated successfully, id:', id);
      } else {
        console.warn('[StorageService] Cannot update - photo not found, id:', id);
      }
    } catch (error) {
      console.error('[StorageService] Failed to update photo:', error);
      console.error('[StorageService] Photo id:', id, 'updates:', updates);
      throw error; // Re-throw to allow caller to handle
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

  /** Read and toggle atomically; return the committed account-specific value. */
  async toggleFavorite(messageId: number, userId: string | null): Promise<boolean> {
    if (!userId) throw new Error('Favorites require a signed-in user');
    await this.init();
    const tx = this.db!.transaction(['messages', 'message-favorites'], 'readwrite');
    // A failed request also rejects tx.done; observe both failure channels.
    void tx.done.catch(() => {});
    const message = await tx.objectStore('messages').get(messageId);
    if (!message || !this.isVisibleTo(message, userId)) {
      await tx.done;
      throw new Error('Message not found for this user');
    }
    const favorites = tx.objectStore('message-favorites');
    const key: [number, string] = [messageId, userId];
    const isFavorite = !(await favorites.get(key));
    if (isFavorite) await favorites.put({ messageId, userId });
    else await favorites.delete(key);
    await tx.done;
    return isFavorite;
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

  /**
   * Clear every store (for reset)
   *
   * Named "all data" but only ever cleared photos and messages, so anything
   * calling it to wipe the device left moods and the background-sync auth
   * token in place. It has no callers today; a sign-out
   * cleanup reaching for it would have looked complete and still leaked.
   *
   * NOTE: this deletes unsynced moods along with everything else. It is a
   * destructive reset, not a sign-out hook — sign-out clears in-memory state
   * (authSlice.clearAuth) and leaves IndexedDB intact so a user's offline
   * entries survive until they sync.
   */
  async clearAllData(): Promise<void> {
    try {
      await this.init();
      logger.debug('[StorageService] Clearing all data from IndexedDB...');
      await Promise.all(
        // Array.from, not spread: DOMStringList is array-like but is not
        // specified as iterable, so the spread is not portable.
        Array.from(this.db!.objectStoreNames).map((storeName) => this.db!.clear(storeName))
      );
      logger.debug('[StorageService] All data cleared successfully');
    } catch (error) {
      console.error('[StorageService] Failed to clear all data:', error);
      throw error; // Re-throw to allow caller to handle
    }
  }

  // Export data for backup
  //
  // `userId` is threaded through for the same reason getAllMessages takes it:
  // an export is a read, and it must not hand the caller another account's
  // custom messages. No caller today, but the argument keeps it that way.
  async exportData(userId: string | null): Promise<{ photos: Photo[]; messages: Message[] }> {
    try {
      await this.init();
      logger.debug('[StorageService] Exporting all data from IndexedDB...');
      const [photos, messages] = await Promise.all([
        this.getAllPhotos(),
        this.getAllMessages(userId),
      ]);
      logger.debug(
        '[StorageService] Data exported successfully, photos:',
        photos.length,
        'messages:',
        messages.length
      );
      return { photos, messages };
    } catch (error) {
      console.error('[StorageService] Failed to export data:', error);
      return { photos: [], messages: [] }; // Graceful fallback: return empty data
    }
  }
}

// Singleton instance
export const storageService = new StorageService();
