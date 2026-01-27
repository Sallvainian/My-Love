import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import type { Photo, Message } from '../types';
import { type MyLoveDBSchema, DB_NAME, DB_VERSION } from './dbSchema';

class StorageService {
  private db: IDBPDatabase<MyLoveDBSchema> | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    // Return existing promise if initialization already in progress
    if (this.initPromise) {
      console.log('[StorageService] Init already in progress, waiting...');
      return this.initPromise;
    }

    // Return immediately if already initialized
    if (this.db) {
      console.log('[StorageService] Already initialized');
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
      console.log('[StorageService] Initializing IndexedDB...');
      this.db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion) {
          console.log(`[StorageService] Upgrading database from v${oldVersion} to v${newVersion}`);

          // Ensure messages store exists (should have been created in v1)
          if (!db.objectStoreNames.contains('messages')) {
            const messageStore = db.createObjectStore('messages', {
              keyPath: 'id',
              autoIncrement: true,
            });
            messageStore.createIndex('by-category', 'category');
            messageStore.createIndex('by-date', 'createdAt');
            console.log('[StorageService] Created messages store (fallback)');
          }

          // Migration: v1 → v2 (Story 4.1)
          // Recreate photos store with enhanced schema
          if (oldVersion < 2) {
            // Delete old photos store if it exists from v1
            if (db.objectStoreNames.contains('photos')) {
              db.deleteObjectStore('photos');
              console.log('[StorageService] Deleted old photos store from v1');
            }

            // Create new photos store with enhanced schema
            const photoStore = db.createObjectStore('photos', {
              keyPath: 'id',
              autoIncrement: true,
            });
            photoStore.createIndex('by-date', 'uploadDate', { unique: false });
            console.log('[StorageService] Created photos store with by-date index (v2)');
          }

          // Migration: v2 → v3 (Story 6.2)
          // Moods store is handled by MoodService
          if (oldVersion < 3 && oldVersion >= 2) {
            console.log(
              '[StorageService] Acknowledged v2→v3 upgrade (moods store handled by MoodService)'
            );
          }

          // Migration: v3 → v4 (Background Sync)
          // sw-auth store is handled by MoodService
          if (oldVersion < 4 && oldVersion >= 3) {
            console.log(
              '[StorageService] Acknowledged v3→v4 upgrade (sw-auth store handled by MoodService)'
            );
          }
        },
      });
      console.log('[StorageService] IndexedDB initialized successfully');
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
      console.log('[StorageService] Adding photo to IndexedDB');
      const id = await this.db!.add('photos', photo as Photo);
      console.log('[StorageService] Photo added successfully, id:', id);
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
        console.log('[StorageService] Photo retrieved successfully, id:', id);
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
      console.log('[StorageService] Retrieved all photos, count:', photos.length);
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
      console.log('[StorageService] Photo deleted successfully, id:', id);
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
        console.log('[StorageService] Photo updated successfully, id:', id);
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
      console.log('[StorageService] Adding message to IndexedDB');
      const id = await this.db!.add('messages', message as Message);
      console.log('[StorageService] Message added successfully, id:', id);
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
        console.log('[StorageService] Message retrieved successfully, id:', id);
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
      console.log('[StorageService] Retrieved all messages, count:', messages.length);
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
      console.log(
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
        console.log('[StorageService] Message updated successfully, id:', id);
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
      console.log('[StorageService] Message deleted successfully, id:', id);
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
        console.log(
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
      console.log('[StorageService] Adding bulk messages to IndexedDB, count:', messages.length);
      const tx = this.db!.transaction('messages', 'readwrite');
      await Promise.all([...messages.map((msg) => tx.store.add(msg as Message)), tx.done]);
      console.log('[StorageService] Bulk messages added successfully');
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
      console.log('[StorageService] Clearing all data from IndexedDB...');
      await this.db!.clear('photos');
      await this.db!.clear('messages');
      console.log('[StorageService] All data cleared successfully');
    } catch (error) {
      console.error('[StorageService] Failed to clear all data:', error);
      throw error; // Re-throw to allow caller to handle
    }
  }

  // Export data for backup
  async exportData(): Promise<{ photos: Photo[]; messages: Message[] }> {
    try {
      await this.init();
      console.log('[StorageService] Exporting all data from IndexedDB...');
      const [photos, messages] = await Promise.all([this.getAllPhotos(), this.getAllMessages()]);
      console.log(
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

// LocalStorage helpers for settings and small data
export const localStorageHelper = {
  get<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading ${key} from localStorage:`, error);
      return defaultValue;
    }
  },

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing ${key} to localStorage:`, error);
    }
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing ${key} from localStorage:`, error);
    }
  },

  clear(): void {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  },
};
