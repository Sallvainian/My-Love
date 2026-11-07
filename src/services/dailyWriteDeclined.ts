/**
 * The `daily-write-declined` local copy: the `day_id`s whose write prompt
 * ("Write tomorrow's question?") this account declined on THIS device
 * (architecture AD-4, AD-13).
 *
 * A device-state kind: it is written only by this device's "No thanks" and has
 * no server source, so it registers no refresher (`registerLocalCopy`) and the
 * `localCopy.ts` FILL SOURCES rule exempts it. Another device of the account
 * may ask once more. Sign-out removes it with the account's other kinds
 * (`deleteAccountCopies`).
 *
 * @module services/dailyWriteDeclined
 */

import { readLocalCopy, writeLocalCopy } from './localCopy';
import { DAILY_WRITE_DECLINED_LOCK, withWaitingLock } from './syncLock';

export const DAILY_WRITE_DECLINED_KIND = 'daily-write-declined';

/** The most ids the copy keeps; the oldest added go first. */
export const MAX_DECLINED_WRITE_DAYS = 31;

/**
 * The declined `day_id`s: `[]` when there is none, the read failed or the value
 * is not an array of strings.
 */
export async function readDeclinedWriteDays(userId: string): Promise<string[]> {
  const saved = await readLocalCopy<unknown>(userId, DAILY_WRITE_DECLINED_KIND);
  if (!Array.isArray(saved)) return [];
  return saved.filter((entry): entry is string => typeof entry === 'string');
}

/**
 * Add `dayId` to the account's declined days and return the saved list. Runs
 * under `DAILY_WRITE_DECLINED_LOCK`, waiting for any other add; dedupes and
 * keeps the newest `MAX_DECLINED_WRITE_DAYS`. Writes only while `isCurrent()`
 * holds (a sign-out in between must not recreate the outgoing account's kind
 * after `deleteAccountCopies`); otherwise it returns the list it read. Throws
 * when the write fails.
 */
export async function addDeclinedWriteDay(
  userId: string,
  dayId: string,
  isCurrent: () => boolean
): Promise<string[]> {
  return withWaitingLock(DAILY_WRITE_DECLINED_LOCK, async () => {
    const days = await readDeclinedWriteDays(userId);
    if (!isCurrent()) return days;
    const next = [...days.filter((id) => id !== dayId), dayId].slice(-MAX_DECLINED_WRITE_DAYS);
    await writeLocalCopy(userId, DAILY_WRITE_DECLINED_KIND, next);
    return next;
  });
}
