import { openDB } from 'idb';
import { ZodError } from 'zod/v4';
import type { MoodEntry } from '../types';
import { formatDateISO } from '../utils/dateUtils';
import { logger } from '../utils/logger';
import { createValidationError, isZodError } from '../validation/errorMessages';
import { MoodEntrySchema } from '../validation/schemas';
import { BaseIndexedDBService } from './BaseIndexedDBService';
import { type MyLoveDBSchema, DB_NAME, DB_VERSION, upgradeDb } from './dbSchema';
import type { MarkSyncedOutcome } from './moodSyncPayload';
import { moodSyncFingerprint } from './moodSyncPayload';

export type { MarkSyncedOutcome };

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
   * Initialize IndexedDB connection
   * Uses centralized upgradeDb function from dbSchema.ts
   */
  protected async _doInit(): Promise<void> {
    try {
      logger.debug(`[MoodService] Initializing IndexedDB (version ${DB_VERSION})...`);

      this.db = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion, transaction) {
          upgradeDb(db, oldVersion, newVersion, transaction);
        },
      });

      logger.debug(`[MoodService] IndexedDB initialized successfully (v${DB_VERSION})`);
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
      const today = formatDateISO(new Date());
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

      logger.debug(`[MoodService] Created mood entry for ${today}:`, created);

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
      // `timestamp` is deliberately NOT touched: it is the log time, it is what
      // gets sent as created_at, and (user_id, created_at) is the row's identity.
      // Moving it on edit would let an edit of a never-synced mood insert a second
      // row instead of resolving to the orphaned one.
      await super.update(id, {
        mood: primaryMood,
        moods, // Store all selected moods
        note: note || '',
        synced: false, // Mark as unsynced after update
      });

      const result = await this.get(id);

      if (!result) {
        throw new Error(`Failed to retrieve updated mood entry ${id}`);
      }

      logger.debug(`[MoodService] Updated mood entry ${id}:`, result);

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
  async getMoodForDate(date: Date, userId: string): Promise<MoodEntry | null> {
    try {
      await this.init();

      const dateString = formatDateISO(date);
      const tx = this.db!.transaction('moods', 'readonly');
      const index = tx.store.index('by-user-date');
      const mood = await index.get([userId, dateString]);

      logger.debug(`[MoodService] getMoodForDate(${dateString}):`, mood || 'not found');

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
  async getMoodsInRange(start: Date, end: Date, userId: string): Promise<MoodEntry[]> {
    try {
      await this.init();

      const startString = formatDateISO(start);
      const endString = formatDateISO(end);

      const tx = this.db!.transaction('moods', 'readonly');
      const index = tx.store.index('by-user-date');
      // Bounding both components keeps the scan inside this user's slice of the
      // index rather than filtering another account's rows out afterwards.
      const range = IDBKeyRange.bound([userId, startString], [userId, endString]);
      const moods = await index.getAll(range);

      logger.debug(`[MoodService] getMoodsInRange(${startString} to ${endString}):`, moods.length);

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
  async getUnsyncedMoods(userId?: string): Promise<MoodEntry[]> {
    try {
      await this.init();

      const allMoods = await this.getAll();
      const unsynced = allMoods.filter(
        (mood) => !mood.synced && (userId === undefined || mood.userId === userId)
      );

      logger.debug(`[MoodService] Found ${unsynced.length} unsynced mood entries`);

      return unsynced;
    } catch (error) {
      console.error('[MoodService] Error getting unsynced moods:', error);
      return []; // Graceful degradation for read operations
    }
  }

  /**
   * Get every mood entry belonging to one user
   *
   * The store holds every account that has signed in on this device, and the
   * inherited `getAll()` returns all of them. Callers that put results into UI
   * state must go through this instead, or one partner's private notes surface
   * in the other's session.
   *
   * @param userId - Authenticated user's UUID
   * @returns That user's mood entries, oldest-first by insertion
   */
  async getAllForUser(userId: string): Promise<MoodEntry[]> {
    try {
      await this.init();

      const allMoods = await this.getAll();
      const mine = allMoods.filter((mood) => mood.userId === userId);

      logger.debug(`[MoodService] Found ${mine.length} mood entries for the current user`);

      return mine;
    } catch (error) {
      console.error('[MoodService] Error getting moods for user:', error);
      return []; // Graceful degradation for read operations
    }
  }

  /**
   * Record the outcome of a sync against a mood entry
   * Story 6.4: Used after a successful Supabase upload
   *
   * Clears the dirty flag ONLY if the record still transmits what the caller
   * sent. A sync snapshots a record, spends up to ~7s in `syncMoodWithRetry`'s
   * 1s/2s/4s backoff, and returns to a record the user may have edited in the
   * meantime; clearing unconditionally would strand that edit locally, flagged
   * clean, invisible to `getUnsyncedMoods()` forever.
   *
   * `supabaseId` is recorded either way — the server row exists now, so the
   * follow-up sync must PATCH it rather than insert a second one.
   *
   * The read and the write share ONE readwrite transaction. `super.update()`
   * does `get` then `put` in two auto-commit transactions with an `await`
   * between them, which is the same defect in a one-microtask-wide window.
   * IndexedDB serialises overlapping readwrite transactions across
   * connections, so this also holds against the service worker and other tabs.
   *
   * @param id - Mood entry ID
   * @param supabaseId - Supabase record ID
   * @param sentFingerprint - `moodSyncFingerprint` of the record as transmitted
   * @returns `cleared` when the flag was cleared, `deferred` when a concurrent
   *          edit was detected, `missing` when the record no longer exists
   */
  async markAsSynced(
    id: number,
    supabaseId: string,
    sentFingerprint: string
  ): Promise<MarkSyncedOutcome> {
    try {
      await this.init();

      const tx = this.getTypedDB().transaction('moods', 'readwrite');
      const current = await tx.store.get(id);

      if (!current) {
        await tx.done;
        // Deleted while the write was in flight. The row is on the server and
        // nothing local references it; treat as done rather than failing the
        // batch into a retry that can never succeed.
        logger.debug(`[MoodService] Mood entry ${id} vanished before it could be marked`);
        return 'missing';
      }

      const unchanged = moodSyncFingerprint(current) === sentFingerprint;

      await tx.store.put({ ...current, supabaseId, synced: unchanged });
      await tx.done;

      if (!unchanged) {
        logger.debug(
          `[MoodService] Mood entry ${id} changed during sync - staying unsynced for the next pass`
        );
        return 'deferred';
      }

      logger.debug(`[MoodService] Marked mood entry ${id} as synced (supabaseId: ${supabaseId})`);
      return 'cleared';
    } catch (error) {
      this.handleError('markAsSynced', error as Error);
    }
  }
}

// Export singleton instance
export const moodService = new MoodService();
