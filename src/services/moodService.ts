import { ZodError } from 'zod/v4';
import type { MoodEntry } from '../types';
import { normalizeMoodEntry } from '../types/moods';
import { formatDateISO } from '../utils/dateUtils';
import { logger } from '../utils/logger';
import { createValidationError, isZodError } from '../validation/errorMessages';
import { MoodEntrySchema } from '../validation/schemas';
import { BaseIndexedDBService } from './BaseIndexedDBService';
import { type MyLoveDBSchema, DB_VERSION, openMyLoveDB } from './dbSchema';
import type { MarkSyncedOutcome } from './moodSyncPayload';
import { matchesMoodSyncFingerprint } from './moodSyncPayload';

export type { MarkSyncedOutcome };

/** What `mergeServerMoods` compares of a local row: its sync flag and content. */
export interface MoodMergeSnapshot {
  synced: boolean;
  mood: unknown;
  moods: string;
  note: string;
  time: number;
}

function toMergeSnapshot(row: MoodEntry): MoodMergeSnapshot {
  return {
    synced: !!row.synced,
    mood: row.mood,
    moods: JSON.stringify(row.moods ?? null),
    note: row.note || '',
    time: new Date(row.timestamp).getTime(),
  };
}

/** Content equality; the sync flag is checked by the caller. */
function sameMergeSnapshot(a: MoodMergeSnapshot, b: MoodMergeSnapshot): boolean {
  return a.mood === b.mood && a.moods === b.moods && a.note === b.note && a.time === b.time;
}

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

      this.db = await openMyLoveDB();

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
   * Atomically save by owner/date, including rows hidden by display validation.
   * Hidden rows retain notes unless the replacement supplies nonempty text.
   * Visible-row edits keep the existing clear-note semantics.
   */
  async saveForDate(
    userId: string,
    date: string,
    moods: MoodEntry['mood'][],
    note?: string,
    requireExisting = false
  ): Promise<MoodEntry> {
    if (!userId) throw new Error('User not authenticated');
    let validated;
    try {
      validated = MoodEntrySchema.parse({ date, mood: moods[0], moods, note: note || '' });
    } catch (error) {
      if (isZodError(error)) throw createValidationError(error as ZodError);
      throw error;
    }
    await this.init();
    const tx = this.getTypedDB().transaction('moods', 'readwrite');
    void tx.done.catch(() => {});
    const existing = await tx.store.index('by-user-date').get([userId, date]);
    if (!existing && requireExisting) {
      await tx.done;
      throw new Error(`Mood entry for ${date} not found`);
    }
    const savedNote =
      existing && !normalizeMoodEntry(existing) && !note?.trim() ? existing.note : validated.note;
    const saved: MoodEntry = {
      ...(existing ?? { userId, date, timestamp: new Date() }),
      mood: validated.mood,
      moods: validated.moods,
      note: savedNote,
      synced: false,
    };
    const id = await tx.store.put(saved);
    await tx.done;
    return { ...saved, id };
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

      return mood ? normalizeMoodEntry(mood) : null;
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

      return moods.flatMap((row) => {
        const normalized = normalizeMoodEntry(row);
        return normalized ? [normalized] : [];
      });
    } catch (error) {
      console.error('[MoodService] Error getting moods in range:', error);
      return []; // Graceful degradation for read operations
    }
  }

  /**
   * Get one user's unsynced mood entries
   *
   * `userId` is REQUIRED. The IndexedDB store holds every account that has
   * signed in on this device, so an unscoped read returns one partner's private
   * mood notes to the other — which is exactly what this method used to do when
   * the argument was omitted. Callers with no signed-in user must handle that
   * case themselves rather than delegating it here; `moodSlice.updateSyncStatus`
   * is the one that does.
   *
   * @returns Array of this user's MoodEntry objects where synced = false
   */
  async getUnsyncedMoods(userId: string): Promise<MoodEntry[]> {
    try {
      await this.init();

      const allMoods = await this.getAll();
      const unsynced = allMoods.filter((mood) => !mood.synced && mood.userId === userId);

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

      return mine.flatMap((row) => {
        const normalized = normalizeMoodEntry(row);
        return normalized ? [normalized] : [];
      });
    } catch (error) {
      console.error('[MoodService] Error getting moods for user:', error);
      return []; // Graceful degradation for read operations
    }
  }

  /**
   * The user's local rows per date, as `mergeServerMoods` compares them. Taken
   * before the first server request, so the merge can tell a row that changed
   * while the pages were being read (an edit that synced, a new mood) from one
   * the server may overwrite. Read convention: an empty map on failure, which
   * makes the merge skip every date that has a row.
   */
  async getMergeSnapshot(userId: string): Promise<Map<string, MoodMergeSnapshot>> {
    const snapshot = new Map<string, MoodMergeSnapshot>();
    try {
      await this.init();
      const range = IDBKeyRange.bound([userId, ''], [userId, '\uffff']);
      const rows = await this.getTypedDB().getAllFromIndex('moods', 'by-user-date', range);
      for (const row of rows) snapshot.set(row.date, toMergeSnapshot(row));
    } catch (error) {
      console.error('[MoodService] Error reading the merge snapshot:', error);
    }
    return snapshot;
  }

  /**
   * Merge the server's mood history for one user into the store.
   *
   * `entries` are server rows already mapped to `MoodEntry` (`synced: true`,
   * `supabaseId` set), at most one per date. `snapshot` is
   * `getMergeSnapshot(userId)` taken before the server was read. Per date:
   * - no local row, and none in the snapshot: inserted — unless a row with the
   *   same `supabaseId` exists under another date (the device changed
   *   timezone), which would show one mood on two days;
   * - a `synced: false` row: never touched — it is queued and still sends;
   * - a `synced: true` row: updated in place (same `id`) when it still equals
   *   its snapshot entry and the server entry is not older than it. A row that
   *   changed during the read (an edit that has since synced keeps its
   *   timestamp) is newer than the pages and is kept.
   * Nothing is ever deleted: local rows the server lacks are queued or were
   * synced from this device.
   *
   * One readwrite transaction that re-reads each date's row inside it, so a
   * row queued or marked by `markAsSynced` in between is seen as it is now.
   * IndexedDB serialises overlapping readwrite transactions, including the
   * service worker's.
   *
   * Entries for another user are ignored. Throws on failure (a write).
   *
   * @returns whether any row was inserted or changed
   */
  async mergeServerMoods(
    userId: string,
    entries: MoodEntry[],
    snapshot: Map<string, MoodMergeSnapshot>
  ): Promise<boolean> {
    if (!userId) throw new Error('User not authenticated');
    await this.init();
    const tx = this.getTypedDB().transaction('moods', 'readwrite');
    void tx.done.catch(() => {});
    const index = tx.store.index('by-user-date');
    const range = IDBKeyRange.bound([userId, ''], [userId, '\uffff']);
    const knownSupabaseIds = new Set(
      (await index.getAll(range)).flatMap((row) => (row.supabaseId ? [row.supabaseId] : []))
    );
    let changed = false;

    for (const entry of entries) {
      if (entry.userId !== userId) continue;
      const serverTime = entry.timestamp.getTime();
      if (Number.isNaN(serverTime)) continue;

      const before = snapshot.get(entry.date);
      const existing = await index.get([userId, entry.date]);
      if (!existing) {
        if (before) continue; // Removed or moved during the read: not ours to refill.
        if (entry.supabaseId && knownSupabaseIds.has(entry.supabaseId)) continue;
        const { id: _ignored, ...row } = entry;
        await tx.store.add({ ...row, userId, synced: true });
        changed = true;
        continue;
      }
      if (!existing.synced || !before?.synced) continue;
      if (!sameMergeSnapshot(toMergeSnapshot(existing), before)) continue;
      if (serverTime < new Date(existing.timestamp).getTime()) continue;

      const unchanged =
        existing.supabaseId === entry.supabaseId &&
        sameMergeSnapshot(toMergeSnapshot(existing), toMergeSnapshot(entry));
      if (unchanged) continue;

      await tx.store.put({
        ...existing,
        mood: entry.mood,
        moods: entry.moods,
        note: entry.note,
        timestamp: entry.timestamp,
        synced: true,
        supabaseId: entry.supabaseId,
      });
      changed = true;
    }

    await tx.done;
    logger.debug(`[MoodService] Merged ${entries.length} server moods (changed: ${changed})`);
    return changed;
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

      const unchanged = matchesMoodSyncFingerprint(current, sentFingerprint);

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
