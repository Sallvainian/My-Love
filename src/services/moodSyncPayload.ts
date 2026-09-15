/**
 * The single definition of what a mood sync transmits.
 *
 * Both writers — `moodSyncService` on the main thread and `sw.ts` in the
 * service worker — project a local record through here to build their request
 * body, and both fingerprint the same projection to decide afterwards whether
 * the record still matches what they sent.
 *
 * Deriving the fingerprint from the payload rather than listing fields twice is
 * load-bearing: a field added to `moodSyncFields` joins the change-detection
 * comparison automatically. Listing them separately would let the two drift,
 * and a field that is sent but not compared is silently lost on a concurrent
 * edit — the exact defect this module exists to close.
 *
 * Type-only imports keep this safe to pull into the service worker bundle.
 *
 * @module services/moodSyncPayload
 */

import type { MoodEntry, MoodType } from '../types';
import { normalizeMoodValues } from '../types/moods';

/**
 * Result of recording a sync against a local mood record
 * - `cleared`: the record still matched what was sent; dirty flag cleared
 * - `deferred`: it was edited mid-flight; left dirty for the next pass
 * - `missing`: the record was deleted before the sync could be recorded
 */
export type MarkSyncedOutcome = 'cleared' | 'deferred' | 'missing';

/** The parts of a mood record that are derived from user-editable content */
interface MoodSyncFields {
  mood_type: MoodType;
  mood_types: MoodType[];
  note: string | null;
  created_at: string;
}

/** The full request body, including the owner the writer authenticated as */
export interface MoodSyncPayload extends MoodSyncFields {
  user_id: string;
}

/** The subset of a record the sync reads — accepts both MoodEntry and StoredMoodEntry */
type SyncableMood = Pick<MoodEntry, 'mood' | 'moods' | 'note' | 'timestamp'>;

/**
 * Records that round-tripped through IndexedDB come back with a real `Date`,
 * but a record rehydrated from persisted JSON carries a string. Normalise so a
 * fingerprint taken before a write matches one taken after a reload.
 */
function toCreatedAt(timestamp: MoodEntry['timestamp']): string {
  return timestamp instanceof Date ? timestamp.toISOString() : new Date(timestamp).toISOString();
}

function moodSyncFields(mood: SyncableMood): MoodSyncFields {
  const normalized = normalizeMoodValues(mood.mood, mood.moods);
  if (!normalized) throw new Error('Mood contains no recognized values');
  if (mood.note != null && (typeof mood.note !== 'string' || mood.note.length > 200)) {
    throw new Error('Mood note is invalid');
  }
  if (!(mood.timestamp instanceof Date) && typeof mood.timestamp !== 'string') {
    throw new Error('Mood timestamp is invalid');
  }

  return {
    mood_type: normalized.mood,
    mood_types: normalized.moods,
    note: mood.note || null,
    created_at: toCreatedAt(mood.timestamp),
  };
}

/**
 * Build the Supabase request body for a local mood record.
 *
 * `userId` is a parameter rather than being read off the record because the
 * service worker authenticates from its stored auth token, not from the row.
 */
export function moodSyncPayload(mood: SyncableMood, userId: string): MoodSyncPayload {
  return { user_id: userId, ...moodSyncFields(mood) };
}

/**
 * A stable string identifying the transmitted content of a record.
 *
 * Excludes `user_id`: it is not record-derived and cannot change for a given
 * row, so including it would make the service worker's fingerprint disagree
 * with the main thread's for the same unchanged record.
 */
export function moodSyncFingerprint(mood: SyncableMood): string {
  return JSON.stringify(moodSyncFields(mood));
}

/** Newly corrupted rows still receive their server ID, but must remain dirty. */
export function matchesMoodSyncFingerprint(mood: SyncableMood, sentFingerprint: string): boolean {
  try {
    return moodSyncFingerprint(mood) === sentFingerprint;
  } catch {
    return false;
  }
}
