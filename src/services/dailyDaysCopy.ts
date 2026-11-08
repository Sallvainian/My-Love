/**
 * The `daily-days` local copy: the account's saved Daily days, a map keyed by
 * `day_id` (architecture AD-13). It holds today's day and the couple's past
 * questions (the Partner page history pages merge in), with no cap.
 *
 * The map is written only by `mergeDailyDay` and `mergeDailyDays`, which share
 * one merge core under the waiting lock `DAILY_DAYS_LOCK`. The core never moves
 * an entry's state back (`none` < `me`/`partner` < `both`), so a slow read
 * cannot undo a reveal, and a server answer for a date drops that date's other
 * `day_id`s (a relink or `reset_bot_daily_days` gives the date a new day).
 * Each entry also records the partner it was read with (`partner_id`, the newest
 * tag wins; an entry saved before the tag reads as `null`), and the readers
 * give only the current partner's entries, so an old pairing's day stays saved
 * but hidden; `readSavedDailyDay` also gives an untagged entry, so the day saved
 * before the tag still shows offline. Callers never see `partner_id`. A failed server read never
 * reaches this module; an `unlinked` answer is saved as `{}` because the server
 * said there is no day. Sign-out removes the kind with the account's other
 * copies (`deleteAccountCopies`).
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

/** One saved entry: the snapshot and the partner it was read with (`null`: none known). */
type SavedDay = { snapshot: DailyDaySnapshot; partnerId: string | null };

/** The saved value as it is stored: snapshots keyed by `day_id`, each tagged with its `partner_id`. */
export type DailyDaysCopy = Record<string, DailyDaySnapshot & { partner_id: string | null }>;

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

/**
 * The saved entries with every one that is not a valid snapshot dropped; `{}`
 * for anything else. A missing or non-string `partner_id` (an entry saved
 * before the tag) reads as `null`.
 */
function parseSavedDays(value: unknown): Record<string, SavedDay> {
  const days: Record<string, SavedDay> = {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return days;
  for (const [dayId, entry] of Object.entries(value)) {
    const parsed = DailyDaySnapshotSchema.safeParse(entry);
    if (!parsed.success) continue;
    const tag = (entry as { partner_id?: unknown }).partner_id;
    days[dayId] = { snapshot: parsed.data, partnerId: typeof tag === 'string' ? tag : null };
  }
  return days;
}

/** The saved entries as they are stored, each snapshot followed by its `partner_id`. */
function toStored(days: Record<string, SavedDay>): DailyDaysCopy {
  return Object.fromEntries(
    Object.entries(days).map(([dayId, { snapshot, partnerId }]) => [
      dayId,
      { ...snapshot, partner_id: partnerId },
    ])
  );
}

/** The entries read with `partnerId`. */
function forPartner(days: Record<string, SavedDay>, partnerId: string | null): DailyDaySnapshot[] {
  return Object.values(days)
    .filter((entry) => entry.partnerId === partnerId)
    .map((entry) => entry.snapshot);
}

/**
 * The saved snapshot whose `day` is `day` (`YYYY-MM-DD`) and that was read with
 * `partnerId`, or `null` when there is none or the read failed. Two entries for
 * one `day` give the higher-ranked. An entry with no tag (saved before entries
 * recorded their partner) is shown too, so the day saved before the update
 * still shows offline; the server's next answer for that date re-tags it and
 * drops any other `day_id` for the date.
 */
export async function readSavedDailyDay(
  userId: string,
  day: string,
  partnerId: string | null | undefined
): Promise<DailyDaySnapshot | null> {
  const days = parseSavedDays(await readLocalCopy<unknown>(userId, DAILY_DAYS_COPY_KIND));
  let best: DailyDaySnapshot | null = null;
  const wanted = partnerId ?? null;
  const entries = Object.values(days)
    .filter((entry) => entry.partnerId === wanted || entry.partnerId === null)
    .map((entry) => entry.snapshot);
  for (const snapshot of entries) {
    if (snapshot.day !== day) continue;
    if (!best || dailyStateRank(snapshot.state) > dailyStateRank(best.state)) best = snapshot;
  }
  return best;
}

/**
 * The saved past questions read with `partnerId`: the days both partners
 * picked (`state` `both`, both choices set), newest `day` first, ties by
 * `day_id`. `[]` when there are none or the read failed.
 */
export async function readSavedDailyHistory(
  userId: string,
  partnerId: string | null | undefined
): Promise<DailyDaySnapshot[]> {
  const days = parseSavedDays(await readLocalCopy<unknown>(userId, DAILY_DAYS_COPY_KIND));
  return forPartner(days, partnerId ?? null)
    .filter(
      (snapshot) =>
        snapshot.state === 'both' && snapshot.my_choice !== null && snapshot.partner_choice !== null
    )
    .sort((a, b) =>
      a.day === b.day ? a.day_id.localeCompare(b.day_id) : b.day.localeCompare(a.day)
    );
}

/**
 * The one merge: `snapshots` (all from successful server answers) into the
 * saved entries, `partnerId` as their tag. Per snapshot the stored entry for
 * its `day_id` wins only when it ranks higher (never moving `write.done` back
 * to false), the tag is always the new one, and every other entry for the same
 * `day` under a different `day_id` is dropped. Returns the entries now saved
 * for those `day_id`s, in order.
 */
function mergeSnapshots(
  days: Record<string, SavedDay>,
  snapshots: DailyDaySnapshot[],
  partnerId: string | null
): DailyDaySnapshot[] {
  const merged: DailyDaySnapshot[] = [];
  for (const snapshot of snapshots) {
    const stored = days[snapshot.day_id]?.snapshot;
    const keepStored =
      stored !== undefined && dailyStateRank(stored.state) > dailyStateRank(snapshot.state);
    const entry = keepStored ? keepWriteDone(stored, snapshot) : keepWriteDone(snapshot, stored);
    for (const [dayId, other] of Object.entries(days)) {
      if (other.snapshot.day === snapshot.day && dayId !== snapshot.day_id) delete days[dayId];
    }
    days[snapshot.day_id] = { snapshot: entry, partnerId };
    merged.push(entry);
  }
  return merged;
}

/**
 * Merge a successful server answer into the copy, tagged with `partnerId`, and
 * return the answer to show.
 *
 * - `ok`: the merge rule above. Returns the merged entry.
 * - `unlinked`: writes `{}`. Returns `unlinked`.
 *
 * Runs under `DAILY_DAYS_LOCK`, waiting for any other merge. Writes only while
 * `isCurrent()` holds; a failed write is logged and never thrown.
 */
export async function mergeDailyDay(
  userId: string,
  answer: DailyDayAnswer,
  partnerId: string | null,
  isCurrent: () => boolean
): Promise<DailyDayAnswer> {
  return withWaitingLock(DAILY_DAYS_LOCK, async () => {
    let merged: DailyDayAnswer = answer;
    let next: DailyDaysCopy = {};

    if (answer.status === 'ok') {
      const days = parseSavedDays(await readLocalCopy<unknown>(userId, DAILY_DAYS_COPY_KIND));
      const [entry] = mergeSnapshots(days, [answer.snapshot], partnerId);
      merged = { status: 'ok', snapshot: entry ?? answer.snapshot };
      next = toStored(days);
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

/**
 * Merge a page of successfully read snapshots (past questions) into the copy by
 * the same rule as `mergeDailyDay`, in one read and one write. `[]` writes
 * nothing. Same lock and write rules; a failed write is logged and never thrown.
 */
export async function mergeDailyDays(
  userId: string,
  snapshots: DailyDaySnapshot[],
  partnerId: string | null,
  isCurrent: () => boolean
): Promise<void> {
  if (snapshots.length === 0) return;
  await withWaitingLock(DAILY_DAYS_LOCK, async () => {
    const days = parseSavedDays(await readLocalCopy<unknown>(userId, DAILY_DAYS_COPY_KIND));
    mergeSnapshots(days, snapshots, partnerId);
    if (!isCurrent()) return;
    try {
      await writeLocalCopy(userId, DAILY_DAYS_COPY_KIND, toStored(days));
    } catch (error) {
      console.error('[DailyQuestion] Failed to save the daily days copy:', error);
    }
  });
}
