import type { DBSchema, IDBPDatabase } from 'idb';
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
 * Semantic type alias for mood entries in IndexedDB
 * MoodEntry already has synced/supabaseId fields for persistence
 */
export type StoredMoodEntry = MoodEntry;

// ============================================
// Scripture Reading IndexedDB Types (v5)
// ============================================

export type ScriptureSessionMode = 'solo' | 'together';
export type ScriptureSessionPhase = 'lobby' | 'countdown' | 'reading' | 'reflection' | 'report' | 'complete';
export type ScriptureSessionStatus = 'pending' | 'in_progress' | 'complete' | 'abandoned';

/**
 * Scripture session stored in IndexedDB for offline support
 */
export interface ScriptureSession {
  id: string; // UUID from Supabase
  mode: ScriptureSessionMode;
  userId: string; // Current user's ID
  partnerId?: string; // Partner's ID (together mode)
  currentPhase: ScriptureSessionPhase;
  currentStepIndex: number;
  status: ScriptureSessionStatus;
  version: number;
  snapshotJson?: Record<string, unknown>;
  startedAt: Date;
  completedAt?: Date;
  synced: boolean;
  supabaseId?: string;
}

/**
 * Scripture reflection stored in IndexedDB
 */
export interface ScriptureReflection {
  id: string; // UUID
  sessionId: string;
  stepIndex: number;
  userId: string;
  rating?: number; // 1-5
  notes?: string;
  isShared: boolean;
  createdAt: Date;
  synced: boolean;
}

/**
 * Scripture bookmark stored in IndexedDB
 */
export interface ScriptureBookmark {
  id: string; // UUID
  sessionId: string;
  stepIndex: number;
  userId: string;
  shareWithPartner: boolean;
  createdAt: Date;
  synced: boolean;
}

/**
 * Scripture message (Daily Prayer Report) stored in IndexedDB
 */
export interface ScriptureMessage {
  id: string; // UUID
  sessionId: string;
  senderId: string;
  message: string;
  createdAt: Date;
  synced: boolean;
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
 * - v5: Added scripture stores (sessions, reflections, bookmarks, messages)
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
  'scripture-sessions': {
    key: string;
    value: ScriptureSession;
    indexes: {
      'by-user': string;
    };
  };
  'scripture-reflections': {
    key: string;
    value: ScriptureReflection;
    indexes: {
      'by-session': string;
    };
  };
  'scripture-bookmarks': {
    key: string;
    value: ScriptureBookmark;
    indexes: {
      'by-session': string;
    };
  };
  'scripture-messages': {
    key: string;
    value: ScriptureMessage;
    indexes: {
      'by-session': string;
    };
  };
}

/**
 * Database configuration constants
 */
export const DB_NAME = 'my-love-db';
export const DB_VERSION = 5; // v5: Added scripture stores for offline support

/**
 * Store name constants for consistent access across services
 */
export const STORE_NAMES = {
  MESSAGES: 'messages',
  PHOTOS: 'photos',
  MOODS: 'moods',
  SW_AUTH: 'sw-auth',
  SCRIPTURE_SESSIONS: 'scripture-sessions',
  SCRIPTURE_REFLECTIONS: 'scripture-reflections',
  SCRIPTURE_BOOKMARKS: 'scripture-bookmarks',
  SCRIPTURE_MESSAGES: 'scripture-messages',
} as const;

/**
 * Store name literal types for type-safe store access
 */
export type MyLoveStoreName = keyof MyLoveDBSchema;

/**
 * Centralized IndexedDB upgrade function
 * Handles all store creation and migrations for v1-v5
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
  _newVersion: number | null
): void {
  if (import.meta.env.DEV) {
    console.log(`[dbSchema] Upgrading database from v${oldVersion} to v${DB_VERSION}`);
  }

  // v1: messages store
  if (oldVersion < 1) {
    const messageStore = db.createObjectStore('messages', {
      keyPath: 'id',
      autoIncrement: true,
    });
    messageStore.createIndex('by-category', 'category');
    messageStore.createIndex('by-date', 'createdAt');
    if (import.meta.env.DEV) {
      console.log('[dbSchema] Created messages store with indexes (v1)');
    }
  }

  // v2: photos store
  // Note: v1→v2 migration with data preservation is handled in photoStorageService
  // because it requires async transaction access. For fresh installs or v2+, we just create the store.
  if (oldVersion < 2) {
    // Delete old v1 store if it exists (had 'blob' instead of 'imageBlob')
    if (db.objectStoreNames.contains('photos')) {
      db.deleteObjectStore('photos');
      if (import.meta.env.DEV) {
        console.log('[dbSchema] Deleted old photos store from v1');
      }
    }

    // Create new v2 photos store with enhanced schema
    const photosStore = db.createObjectStore('photos', {
      keyPath: 'id',
      autoIncrement: true,
    });
    photosStore.createIndex('by-date', 'uploadDate', { unique: false });
    if (import.meta.env.DEV) {
      console.log('[dbSchema] Created photos store with by-date index (v2)');
    }
  }

  // v3: moods store
  if (oldVersion < 3) {
    const moodsStore = db.createObjectStore('moods', {
      keyPath: 'id',
      autoIncrement: true,
    });
    moodsStore.createIndex('by-date', 'date', { unique: true });
    if (import.meta.env.DEV) {
      console.log('[dbSchema] Created moods store with by-date unique index (v3)');
    }
  }

  // v4: sw-auth store for Background Sync
  if (oldVersion < 4) {
    db.createObjectStore('sw-auth', { keyPath: 'id' });
    if (import.meta.env.DEV) {
      console.log('[dbSchema] Created sw-auth store for Background Sync (v4)');
    }
  }

  // v5: scripture stores for offline support
  if (oldVersion < 5) {
    const sessionsStore = db.createObjectStore('scripture-sessions', { keyPath: 'id' });
    sessionsStore.createIndex('by-user', 'userId');
    if (import.meta.env.DEV) {
      console.log('[dbSchema] Created scripture-sessions store with by-user index (v5)');
    }

    const reflectionsStore = db.createObjectStore('scripture-reflections', { keyPath: 'id' });
    reflectionsStore.createIndex('by-session', 'sessionId');
    if (import.meta.env.DEV) {
      console.log('[dbSchema] Created scripture-reflections store with by-session index (v5)');
    }

    const bookmarksStore = db.createObjectStore('scripture-bookmarks', { keyPath: 'id' });
    bookmarksStore.createIndex('by-session', 'sessionId');
    if (import.meta.env.DEV) {
      console.log('[dbSchema] Created scripture-bookmarks store with by-session index (v5)');
    }

    const messagesStore = db.createObjectStore('scripture-messages', { keyPath: 'id' });
    messagesStore.createIndex('by-session', 'sessionId');
    if (import.meta.env.DEV) {
      console.log('[dbSchema] Created scripture-messages store with by-session index (v5)');
    }
  }
}
