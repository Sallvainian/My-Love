import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { Photo, Message } from '../types';

// IndexedDB schema definition
interface MyLoveDB extends DBSchema {
  photos: {
    key: number;
    value: Photo;
    indexes: { 'by-date': Date };
  };
  messages: {
    key: number;
    value: Message;
    indexes: { 'by-category': string; 'by-date': Date };
  };
}

const DB_NAME = 'my-love-db';
const DB_VERSION = 1;

class StorageService {
  private db: IDBPDatabase<MyLoveDB> | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    this.db = await openDB<MyLoveDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create photos store
        if (!db.objectStoreNames.contains('photos')) {
          const photoStore = db.createObjectStore('photos', {
            keyPath: 'id',
            autoIncrement: true,
          });
          photoStore.createIndex('by-date', 'uploadDate');
        }

        // Create messages store
        if (!db.objectStoreNames.contains('messages')) {
          const messageStore = db.createObjectStore('messages', {
            keyPath: 'id',
            autoIncrement: true,
          });
          messageStore.createIndex('by-category', 'category');
          messageStore.createIndex('by-date', 'createdAt');
        }
      },
    });
  }

  // Photo operations
  async addPhoto(photo: Omit<Photo, 'id'>): Promise<number> {
    await this.init();
    return this.db!.add('photos', photo as Photo);
  }

  async getPhoto(id: number): Promise<Photo | undefined> {
    await this.init();
    return this.db!.get('photos', id);
  }

  async getAllPhotos(): Promise<Photo[]> {
    await this.init();
    return this.db!.getAll('photos');
  }

  async deletePhoto(id: number): Promise<void> {
    await this.init();
    await this.db!.delete('photos', id);
  }

  async updatePhoto(id: number, updates: Partial<Photo>): Promise<void> {
    await this.init();
    const photo = await this.getPhoto(id);
    if (photo) {
      await this.db!.put('photos', { ...photo, ...updates });
    }
  }

  // Message operations
  async addMessage(message: Omit<Message, 'id'>): Promise<number> {
    await this.init();
    return this.db!.add('messages', message as Message);
  }

  async getMessage(id: number): Promise<Message | undefined> {
    await this.init();
    return this.db!.get('messages', id);
  }

  async getAllMessages(): Promise<Message[]> {
    await this.init();
    return this.db!.getAll('messages');
  }

  async getMessagesByCategory(category: string): Promise<Message[]> {
    await this.init();
    return this.db!.getAllFromIndex('messages', 'by-category', category);
  }

  async updateMessage(id: number, updates: Partial<Message>): Promise<void> {
    await this.init();
    const message = await this.getMessage(id);
    if (message) {
      await this.db!.put('messages', { ...message, ...updates });
    }
  }

  async deleteMessage(id: number): Promise<void> {
    await this.init();
    await this.db!.delete('messages', id);
  }

  async toggleFavorite(messageId: number): Promise<void> {
    await this.init();
    const message = await this.getMessage(messageId);
    if (message) {
      await this.updateMessage(messageId, { isFavorite: !message.isFavorite });
    }
  }

  // Bulk operations
  async addMessages(messages: Omit<Message, 'id'>[]): Promise<void> {
    await this.init();
    const tx = this.db!.transaction('messages', 'readwrite');
    await Promise.all([
      ...messages.map(msg => tx.store.add(msg as Message)),
      tx.done,
    ]);
  }

  // Clear all data (for reset)
  async clearAllData(): Promise<void> {
    await this.init();
    await this.db!.clear('photos');
    await this.db!.clear('messages');
  }

  // Export data for backup
  async exportData(): Promise<{ photos: Photo[]; messages: Message[] }> {
    await this.init();
    const [photos, messages] = await Promise.all([
      this.getAllPhotos(),
      this.getAllMessages(),
    ]);
    return { photos, messages };
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
