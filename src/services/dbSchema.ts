import type { DBSchema } from 'idb';
import type { MoodEntry, Message, Photo } from '../types';

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
 * Shared IndexedDB Schema Definition
 * Defines the structure of all object stores in the my-love-db database
 *
 * Used by:
 * - moodService.ts
 * - photoStorageService.ts
 * - customMessageService.ts
 * - BaseIndexedDBService.ts (type constraints)
 *
 * DB Versions:
 * - v1: Basic photos and messages stores
 * - v2: Enhanced Photo schema with compression metadata
 * - v3: Added moods store with by-date unique index
 * - v4: Added sw-auth store for Background Sync
 */
export interface MyLoveDBSchema extends DBSchema {
  messages: {
    key: number;
    value: Message;
    indexes: {
      'by-category': string;
      'by-date': Date;
    };
  };
  photos: {
    key: number;
    value: Photo;
    indexes: {
      'by-date': Date;
    };
  };
  moods: {
    key: number;
    value: MoodEntry;
    indexes: {
      'by-date': string;
    };
  };
  'sw-auth': {
    key: 'current';
    value: StoredAuthToken;
  };
}

/**
 * Database configuration constants
 */
export const DB_NAME = 'my-love-db';
export const DB_VERSION = 4; // v4: Added sw-auth store for Background Sync

/**
 * Store name literal types for type-safe store access
 */
export type MyLoveStoreName = keyof MyLoveDBSchema;
