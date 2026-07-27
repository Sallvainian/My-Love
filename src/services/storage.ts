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

  async getMessage(id: number): Promise<Message | undefined> {
    try {
      await this.init();
      const message = await this.db!.get('messages', id);
      if (message) {
        logger.debug('[StorageService] Message retrieved successfully, id:', id);
      } else {
        console.warn('[StorageService] Message not found, id:', id);
      }
      return message;
    } catch (error) {
      console.error('[StorageService] Failed to get message:', error);
      console.error('[StorageService] Message id:', id);
      return undefined; // Graceful fallback: return undefined
    }
  }

  async getAllMessages(): Promise<Message[]> {
    try {
      await this.init();
      const messages = await this.db!.getAll('messages');
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
      const messages = await this.db!.getAllFromIndex('messages', 'by-category', category);
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

  async updateMessage(id: number, updates: Partial<Message>): Promise<void> {
    try {
      await this.init();
      const message = await this.getMessage(id);
      if (message) {
        await this.db!.put('messages', { ...message, ...updates });
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

  async deleteMessage(id: number): Promise<void> {
    try {
      await this.init();
      await this.db!.delete('messages', id);
      logger.debug('[StorageService] Message deleted successfully, id:', id);
    } catch (error) {
      console.error('[StorageService] Failed to delete message:', error);
      console.error('[StorageService] Message id:', id);
      throw error; // Re-throw to allow caller to handle
    }
  }

  async toggleFavorite(messageId: number): Promise<void> {
    try {
      await this.init();
      const message = await this.getMessage(messageId);
      if (message) {
        await this.updateMessage(messageId, { isFavorite: !message.isFavorite });
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
        [...this.db!.objectStoreNames].map((storeName) => this.db!.clear(storeName))
      );
      logger.debug('[StorageService] All data cleared successfully');
    } catch (error) {
      console.error('[StorageService] Failed to clear all data:', error);
      throw error; // Re-throw to allow caller to handle
    }
  }

  // Export data for backup
  async exportData(): Promise<{ photos: Photo[]; messages: Message[] }> {
    try {
      await this.init();
      logger.debug('[StorageService] Exporting all data from IndexedDB...');
      const [photos, messages] = await Promise.all([this.getAllPhotos(), this.getAllMessages()]);
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
