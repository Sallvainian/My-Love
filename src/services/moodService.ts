import { openDB } from 'idb';
import type { MoodEntry } from '../types';
import { BaseIndexedDBService } from './BaseIndexedDBService';
import { type MyLoveDBSchema, DB_NAME, DB_VERSION } from './dbSchema';
import { MoodEntrySchema } from '../validation/schemas';
import { createValidationError, isZodError } from '../validation/errorMessages';
import { ZodError } from 'zod';

/**
 * Mood Service - IndexedDB CRUD operations for mood tracking
 * Story 6.2: Mood Tracking UI & Local Storage
 *
 * Extends: BaseIndexedDBService<MoodEntry, MyLoveDBSchema>
 * - Inherits: init(), add(), get(), update(), delete(), clear()
 * - Implements: getStoreName(), _doInit()
 * - Service-specific methods: getMoodForDate(), getMoodsInRange()
 *
 * DB Migration: v2 → v3
 * - Version 2: photos and messages stores
 * - Version 3: Add moods store with by-date unique index
 */
class MoodService extends BaseIndexedDBService<MoodEntry, MyLoveDBSchema, 'moods'> {
  /**
   * Get the object store name for moods
   */
  protected getStoreName(): 'moods' {
    return 'moods';
  }

  /**
   * Initialize IndexedDB connection with DB version 3
   * Story 6.2: Create moods store with by-date unique index
   */
  protected async _doInit(): Promise<void> {
    try {
      if (import.meta.env.DEV) {
        console.log(`[MoodService] Initializing IndexedDB (version ${DB_VERSION})...`);
      }

      this.db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, {
        async upgrade(db, oldVersion, newVersion) {
          if (import.meta.env.DEV) {
            console.log(`[MoodService] Upgrading database from v${oldVersion} to v${newVersion}`);
          }

          // Ensure messages store exists (should have been created in v1)
          if (!db.objectStoreNames.contains('messages')) {
            const messageStore = db.createObjectStore('messages', {
              keyPath: 'id',
              autoIncrement: true,
            });
            messageStore.createIndex('by-category', 'category');
            messageStore.createIndex('by-date', 'createdAt');
            if (import.meta.env.DEV) {
              console.log('[MoodService] Created messages store (fallback)');
            }
          }

          // Ensure photos store exists (should have been created in v2)
          if (!db.objectStoreNames.contains('photos')) {
            const photoStore = db.createObjectStore('photos', {
              keyPath: 'id',
              autoIncrement: true,
            });
            photoStore.createIndex('by-date', 'uploadDate', { unique: false });
            if (import.meta.env.DEV) {
              console.log('[MoodService] Created photos store (fallback)');
            }
          }

          // Migration: v2 → v3 - Add moods store
          if (oldVersion < 3) {
            const moodsStore = db.createObjectStore('moods', {
              keyPath: 'id',
              autoIncrement: true,
            });
            // by-date index for fast date-based queries (unique: one mood per day)
            moodsStore.createIndex('by-date', 'date', { unique: true });
            if (import.meta.env.DEV) {
              console.log('[MoodService] Created moods store with by-date unique index (v3)');
            }
          }

          // Migration: v3 → v4 - Add sw-auth store for Background Sync
          if (oldVersion < 4) {
            if (!db.objectStoreNames.contains('sw-auth')) {
              db.createObjectStore('sw-auth', { keyPath: 'id' });
              if (import.meta.env.DEV) {
                console.log('[MoodService] Created sw-auth store for Background Sync (v4)');
              }
            }
          }
        },
      });

      if (import.meta.env.DEV) {
        console.log('[MoodService] IndexedDB initialized successfully (v4)');
      }
    } catch (error) {
      this.handleError('initialize', error as Error);
    }
  }

  /**
   * Create a new mood entry in IndexedDB
   * Story 6.2: Save with full metadata (userId, mood, note, date, timestamp, synced)
   * Story 5.5: Added runtime validation with Zod schema
   *
   * @param userId - Authenticated user's UUID from Supabase
   * @param moods - Array of mood types (at least one required)
   * @param note - Optional note (max 200 chars)
   * @returns MoodEntry with auto-generated id
   * @throws {ValidationError} if mood data is invalid
   */
  async create(userId: string, moods: MoodEntry['mood'][], note?: string): Promise<MoodEntry> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const primaryMood = moods[0]; // First mood is primary for backward compatibility
      const moodEntry: Omit<MoodEntry, 'id'> = {
        userId,
        mood: primaryMood,
        moods, // Store all selected moods
        note: note || '',
        date: today,
        timestamp: new Date(),
        synced: false,
        supabaseId: undefined,
      };

      // Validate mood entry data before saving to IndexedDB
      MoodEntrySchema.parse({
        date: moodEntry.date,
        mood: moodEntry.mood,
        moods: moodEntry.moods,
        note: moodEntry.note,
      });

      const created = await super.add(moodEntry);

      if (import.meta.env.DEV) {
        console.log(`[MoodService] Created mood entry for ${today}:`, created);
      }

      return created;
    } catch (error) {
      // Transform Zod validation errors into user-friendly messages
      if (isZodError(error)) {
        throw createValidationError(error as ZodError);
      }
      throw error;
    }
  }

  /**
   * Update an existing mood entry
   * Story 6.2: AC-5 - Can only log one mood per day (edit if logging again same day)
   *
   * @param id - Mood entry ID
   * @param moods - Updated mood types array
   * @param note - Updated note
   * @returns Updated MoodEntry
   * @throws {ValidationError} if mood data is invalid
   */
  async updateMood(id: number, moods: MoodEntry['mood'][], note?: string): Promise<MoodEntry> {
    try {
      const existing = await this.get(id);
      if (!existing) {
        throw new Error(`Mood entry with id ${id} not found`);
      }

      const primaryMood = moods[0]; // First mood is primary for backward compatibility

      // Validate updated mood entry
      MoodEntrySchema.parse({
        date: existing.date,
        mood: primaryMood,
        moods,
        note: note || '',
      });

      // Update via base class (id, updates)
      await super.update(id, {
        mood: primaryMood,
        moods, // Store all selected moods
        note: note || '',
        timestamp: new Date(), // Update timestamp
        synced: false, // Mark as unsynced after update
      });

      const result = await this.get(id);

      if (!result) {
        throw new Error(`Failed to retrieve updated mood entry ${id}`);
      }

      if (import.meta.env.DEV) {
        console.log(`[MoodService] Updated mood entry ${id}:`, result);
      }

      return result;
    } catch (error) {
      if (isZodError(error)) {
        throw createValidationError(error as ZodError);
      }
      throw error;
    }
  }

  /**
   * Get mood entry for a specific date
   * Story 6.2: AC-5 - Check if mood already exists for today
   *
   * @param date - ISO date string (YYYY-MM-DD)
   * @returns MoodEntry or null if not found
   */
  async getMoodForDate(date: Date): Promise<MoodEntry | null> {
    try {
      await this.init();

      const dateString = date.toISOString().split('T')[0];
      const tx = this.db!.transaction('moods', 'readonly');
      const index = tx.store.index('by-date');
      const mood = await index.get(dateString);

      if (import.meta.env.DEV) {
        console.log(`[MoodService] getMoodForDate(${dateString}):`, mood || 'not found');
      }

      return mood || null;
    } catch (error) {
      console.error('[MoodService] Error getting mood for date:', error);
      return null; // Graceful degradation for read operations
    }
  }

  /**
   * Get moods in a date range
   * Story 6.2: Future use for mood history/calendar views
   *
   * @param start - Start date
   * @param end - End date
   * @returns Array of MoodEntry objects in the range
   */
  async getMoodsInRange(start: Date, end: Date): Promise<MoodEntry[]> {
    try {
      await this.init();

      const startString = start.toISOString().split('T')[0];
      const endString = end.toISOString().split('T')[0];

      const tx = this.db!.transaction('moods', 'readonly');
      const index = tx.store.index('by-date');
      const range = IDBKeyRange.bound(startString, endString);
      const moods = await index.getAll(range);

      if (import.meta.env.DEV) {
        console.log(`[MoodService] getMoodsInRange(${startString} to ${endString}):`, moods.length);
      }

      return moods;
    } catch (error) {
      console.error('[MoodService] Error getting moods in range:', error);
      return []; // Graceful degradation for read operations
    }
  }

  /**
   * Get all unsynced mood entries
   * Story 6.4: Will be used for background sync
   *
   * @returns Array of MoodEntry objects where synced = false
   */
  async getUnsyncedMoods(): Promise<MoodEntry[]> {
    try {
      await this.init();

      const allMoods = await this.getAll();
      const unsynced = allMoods.filter((mood) => !mood.synced);

      if (import.meta.env.DEV) {
        console.log(`[MoodService] Found ${unsynced.length} unsynced mood entries`);
      }

      return unsynced;
    } catch (error) {
      console.error('[MoodService] Error getting unsynced moods:', error);
      return []; // Graceful degradation for read operations
    }
  }

  /**
   * Mark a mood entry as synced
   * Story 6.4: Will be used after successful Supabase upload
   *
   * @param id - Mood entry ID
   * @param supabaseId - Supabase record ID
   */
  async markAsSynced(id: number, supabaseId: string): Promise<void> {
    try {
      const existing = await this.get(id);
      if (!existing) {
        throw new Error(`Mood entry with id ${id} not found`);
      }

      await super.update(id, {
        synced: true,
        supabaseId,
      });

      if (import.meta.env.DEV) {
        console.log(`[MoodService] Marked mood entry ${id} as synced (supabaseId: ${supabaseId})`);
      }
    } catch (error) {
      this.handleError('markAsSynced', error as Error);
    }
  }
}

// Export singleton instance
export const moodService = new MoodService();
