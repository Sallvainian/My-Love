/**
 * The `daily-days` local copy: the account's saved Daily days, a map keyed by
 * `day_id` (architecture AD-13).
 *
 * The map is written only by `mergeDailyDay`, which runs under the waiting lock
 * `DAILY_DAYS_LOCK` and never moves an entry's state back (`none` <
 * `me`/`partner` < `both`), so a slow read cannot undo a reveal. A failed
 * server read never reaches this module; an `unlinked` answer is saved as `{}`
 * because the server said there is no day. Sign-out removes the kind with the
 * account's other copies (`deleteAccountCopies`).
 *
 * @module services/dailyDaysCopy
 */

import {
  type DailyDayAnswer,
  type DailyDaySnapshot,
  DailyDaySnapshotSchema,
} from '../api/validation/dailyQuestionSchemas';
import { readLocalCopy, writeLocalCopy } from './localCopy';
import { DAILY_DAYS_LOCK, withWaitingLock } from './syncLock';

export const DAILY_DAYS_COPY_KIND = 'daily-days';

/** The most days the copy keeps; the oldest `day` goes first. */
export const MAX_SAVED_DAILY_DAYS = 31;

/** The saved value: snapshots keyed by `day_id`. */
export type DailyDaysCopy = Record<string, DailyDaySnapshot>;

const STATE_RANK: Record<DailyDaySnapshot['state'], number> = {
  none: 0,
  me: 1,
  partner: 1,
  both: 2,
};

/** How far a day has got: `none` 0 < `me` / `partner` 1 < `both` 2. */
export function dailyStateRank(state: DailyDaySnapshot['state']): number {
  return STATE_RANK[state];
}

/**
 * `entry`, with `write.done` true when `other` (the same day) has it: a question
 * once written stays written, so a read that started before the Send cannot
 * reopen the prompt.
 */
export function keepWriteDone(
  entry: DailyDaySnapshot,
  other: DailyDaySnapshot | undefined
): DailyDaySnapshot {
  if (!other?.write.done || entry.write.done) return entry;
  return { ...entry, write: { ...entry.write, done: true } };
}

/** The saved map with every entry that is not a valid snapshot dropped; `{}` for anything else. */
function parseSavedDays(value: unknown): DailyDaysCopy {
  const days: DailyDaysCopy = {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return days;
  for (const [dayId, entry] of Object.entries(value)) {
    const parsed = DailyDaySnapshotSchema.safeParse(entry);
    if (parsed.success) days[dayId] = parsed.data;
  }
  return days;
}

/**
 * The saved snapshot whose `day` is `day` (`YYYY-MM-DD`), or `null` when there
 * is none or the read failed. Two entries for one `day` give the higher-ranked.
 */
export async function readSavedDailyDay(
  userId: string,
  day: string
): Promise<DailyDaySnapshot | null> {
  const days = parseSavedDays(await readLocalCopy<unknown>(userId, DAILY_DAYS_COPY_KIND));
  let best: DailyDaySnapshot | null = null;
  for (const snapshot of Object.values(days)) {
    if (snapshot.day !== day) continue;
    if (!best || dailyStateRank(snapshot.state) > dailyStateRank(best.state)) best = snapshot;
  }
  return best;
}

/** The map pruned to its `MAX_SAVED_DAILY_DAYS` newest entries by `day`. */
function prune(days: DailyDaysCopy): DailyDaysCopy {
  const entries = Object.entries(days);
  if (entries.length <= MAX_SAVED_DAILY_DAYS) return days;
  entries.sort(([idA, a], [idB, b]) => (a.day === b.day ? idA.localeCompare(idB) : b.day.localeCompare(a.day)));
  return Object.fromEntries(entries.slice(0, MAX_SAVED_DAILY_DAYS));
}

/**
 * Merge a successful server answer into the copy and return the answer to show.
 *
 * - `ok`: replaces the entry for `snapshot.day_id` unless the stored one ranks
 *   higher, never moving `write.done` back to false, then keeps the newest 31
 *   days. Returns the merged entry.
 * - `unlinked`: writes `{}`. Returns `unlinked`.
 *
 * Runs under `DAILY_DAYS_LOCK`, waiting for any other merge. Writes only while
 * `isCurrent()` holds; a failed write is logged and never thrown.
 */
export async function mergeDailyDay(
  userId: string,
  answer: DailyDayAnswer,
  isCurrent: () => boolean
): Promise<DailyDayAnswer> {
  return withWaitingLock(DAILY_DAYS_LOCK, async () => {
    let merged: DailyDayAnswer = answer;
    let next: DailyDaysCopy = {};

    if (answer.status === 'ok') {
      const days = parseSavedDays(await readLocalCopy<unknown>(userId, DAILY_DAYS_COPY_KIND));
      const stored = days[answer.snapshot.day_id];
      const keepStored =
        stored !== undefined &&
        dailyStateRank(stored.state) > dailyStateRank(answer.snapshot.state);
      const entry = keepStored
        ? keepWriteDone(stored, answer.snapshot)
        : keepWriteDone(answer.snapshot, stored);
      merged = { status: 'ok', snapshot: entry };
      next = prune({ ...days, [answer.snapshot.day_id]: entry });
    }

    if (!isCurrent()) return merged;
    try {
      await writeLocalCopy(userId, DAILY_DAYS_COPY_KIND, next);
    } catch (error) {
      console.error('[DailyQuestion] Failed to save the daily days copy:', error);
    }
    return merged;
  });
}
