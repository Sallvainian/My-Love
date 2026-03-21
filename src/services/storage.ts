import type { IDBPDatabase } from 'idb';
import { openDB } from 'idb';
import type { Message, Photo } from '../types';
import { logger } from '../utils/logger';
import { type MyLoveDBSchema, DB_NAME, DB_VERSION } from './dbSchema';

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
      this.db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion) {
          logger.debug(`[StorageService] Upgrading database from v${oldVersion} to v${newVersion}`);

          // Ensure messages store exists (should have been created in v1)
          if (!db.objectStoreNames.contains('messages')) {
            const messageStore = db.createObjectStore('messages', {
              keyPath: 'id',
              autoIncrement: true,
            });
            messageStore.createIndex('by-category', 'category');
            messageStore.createIndex('by-date', 'createdAt');
            logger.debug('[StorageService] Created messages store (fallback)');
          }

          // Migration: v1 → v2 (Story 4.1)
          // Recreate photos store with enhanced schema
          if (oldVersion < 2) {
            // Delete old photos store if it exists from v1
            if (db.objectStoreNames.contains('photos')) {
              db.deleteObjectStore('photos');
              logger.debug('[StorageService] Deleted old photos store from v1');
            }

            // Create new photos store with enhanced schema
            const photoStore = db.createObjectStore('photos', {
              keyPath: 'id',
              autoIncrement: true,
            });
            photoStore.createIndex('by-date', 'uploadDate', { unique: false });
            logger.debug('[StorageService] Created photos store with by-date index (v2)');
          }

          // Migration: v2 → v3 (Story 6.2)
          // Moods store is handled by MoodService
          if (oldVersion < 3 && oldVersion >= 2) {
            logger.debug(
              '[StorageService] Acknowledged v2→v3 upgrade (moods store handled by MoodService)'
            );
          }

          // Migration: v3 → v4 (Background Sync)
          // sw-auth store is handled by MoodService
          if (oldVersion < 4 && oldVersion >= 3) {
            logger.debug(
              '[StorageService] Acknowledged v3→v4 upgrade (sw-auth store handled by MoodService)'
            );
          }
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

  // Clear all data (for reset)
  async clearAllData(): Promise<void> {
    try {
      await this.init();
      logger.debug('[StorageService] Clearing all data from IndexedDB...');
      await this.db!.clear('photos');
      await this.db!.clear('messages');
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
