import type { IDBPDatabase } from 'idb';
import { openDB } from 'idb';
import type { Message, Photo } from '../types';
import { logger } from '../utils/logger';
import { type MyLoveDBSchema, DB_NAME, DB_VERSION, upgradeDb } from './dbSchema';

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
    } finally {
      this.initPromise = null;
    }
  }

  private async _doInit(): Promise<void> {
    try {
      logger.debug('[StorageService] Initializing IndexedDB...');
      // Delegates to the shared upgradeDb, exactly as moodService,
      // customMessageService and scriptureReadingService do.
      //
      // This used to be a hand-written callback that created only `messages`
      // and `photos`, on the assumption that whichever service owned a store
      // would create it. That assumption does not hold: IndexedDB runs the
      // upgrade callback of only the ONE open() that performs the
      // version-change transaction, and every other concurrent open() for the
      // same version just connects. On a fresh profile this open() is reached
      // first — initializeApp() calls it from the effect at App.tsx:275,
      // before the mood-sync effects — so its callback was the one that ran,
      // and `moods`, `sw-auth` and the four scripture stores were never
      // created at all.
      this.db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion, transaction) {
          upgradeDb(db, oldVersion, newVersion, transaction);
        },
      });
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
   * Custom rows with no owner are legacy and belong to nobody: `undefined`
   * never equals a user id and never equals `null`, so they are excluded for
   * every caller, signed out included.
   *
   * This is the single expression of the rule — the batch reads reach it
   * through {@link visibleTo} and every by-id read and write consults it
   * directly, so the row-at-a-time paths cannot drift away from the batch ones.
   */
  private isVisibleTo(message: Message, userId: string | null): boolean {
    return !message.isCustom || message.userId === userId;
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
      return messages;
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
      return messages;
    } catch (error) {
      console.error('[StorageService] Failed to get messages by category:', error);
      console.error('[StorageService] Category:', category);
      return []; // Graceful fallback: return empty array
    }
  }

  /**
   * Edit one message, if this caller may see it.
   *
   * `userId` is REQUIRED and nullable for the same reason getAllMessages's is:
   * the signed-out case is real (the shared daily rows are everyone's to
   * favorite), but it has to be stated at the call site. A row this caller may
   * not see takes the same warn-and-no-op branch as an id that is not in the
   * store — nothing is written and nothing is disclosed.
   */
  async updateMessage(id: number, updates: Partial<Message>, userId: string | null): Promise<void> {
    try {
      await this.init();
      const message = await this.getMessage(id, userId);
      if (message) {
        // Pinned to the row that was actually checked. The store is keyed on
        // `id`, so an `id` inside `updates` is a second, unchecked address for
        // this write: a caller who may see row X could otherwise aim the put at
        // row Y and overwrite it without Y ever passing the guard above.
        // (Whether `updates` may carry `userId`/`isCustom` is a separate
        // question — ownership reassignment — and is deliberately untouched.)
        await this.db!.put('messages', { ...message, ...updates, id: message.id });
        logger.debug('[StorageService] Message updated successfully, id:', id);
      } else {
        console.warn('[StorageService] Cannot update - message not found, id:', id);
      }
    } catch (error) {
      console.error('[StorageService] Failed to update message:', error);
      console.error('[StorageService] Message id:', id, 'updates:', updates);
      throw error; // Re-throw to allow caller to handle
    }
  }

  /**
   * Delete one message, if this caller may see it.
   *
   * `userId` is REQUIRED and nullable for the same reason getAllMessages's is:
   * the signed-out case is real, but it has to be stated at the call site.
   *
   * This reads the row first purely to answer that question — a blind delete
   * has no way to tell whose row it is about to remove. The read is a raw
   * `get` rather than `this.getMessage` on purpose: getMessage degrades a
   * failed read to `undefined`, which here would turn a broken store into a
   * silent no-op delete, so a failure re-throws instead.
   *
   * That leaves a deliberate asymmetry inside this service: `updateMessage`
   * and `toggleFavorite` do read through `getMessage`, so a failed read leaves
   * them resolving as a silent no-op. That is their behaviour from before
   * ownership scoping and it is kept unchanged. `deleteMessage` had no read at
   * all to preserve, so its new one takes the stricter contract.
   */
  async deleteMessage(id: number, userId: string | null): Promise<void> {
    try {
      await this.init();
      const message = await this.db!.get('messages', id);
      if (!message || !this.isVisibleTo(message, userId)) {
        console.warn('[StorageService] Cannot delete - message not found, id:', id);
        return;
      }
      await this.db!.delete('messages', id);
      logger.debug('[StorageService] Message deleted successfully, id:', id);
    } catch (error) {
      console.error('[StorageService] Failed to delete message:', error);
      console.error('[StorageService] Message id:', id);
      throw error; // Re-throw to allow caller to handle
    }
  }

  /**
   * Flip one message's favorite flag, if this caller may see it.
   *
   * `userId` is REQUIRED and nullable for the same reason getAllMessages's is,
   * and the nullable half is load-bearing here: Home favorites the daily
   * message through this method, and the daily rows are shared — reachable by
   * every caller, signed out included. The rule is visibility, not ownership,
   * for exactly that reason.
   */
  async toggleFavorite(messageId: number, userId: string | null): Promise<void> {
    try {
      await this.init();
      const message = await this.getMessage(messageId, userId);
      if (message) {
        await this.updateMessage(messageId, { isFavorite: !message.isFavorite }, userId);
        logger.debug(
          '[StorageService] Favorite toggled successfully, id:',
          messageId,
          'new value:',
          !message.isFavorite
        );
      } else {
        console.warn('[StorageService] Cannot toggle favorite - message not found, id:', messageId);
      }
    } catch (error) {
      console.error('[StorageService] Failed to toggle favorite:', error);
      console.error('[StorageService] Message id:', messageId);
      throw error; // Re-throw to allow caller to handle
    }
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
   * calling it to wipe the device left moods, the background-sync auth token
   * and the scripture cache in place. It has no callers today; a sign-out
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
