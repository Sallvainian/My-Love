/**
 * The `daily-streak` local copy: the account's last `ok` couple streak
 * (architecture AD-13).
 *
 * The value is a `CoupleStreak` exactly as `get_couple_streak` answered it; the
 * client never computes it. Only a successful server answer reaches this module:
 * `ok` replaces the copy, and `unlinked` deletes it (a missing copy already
 * reads as "nothing to show"). A failed read never gets here, so it leaves the
 * copy as it was. Sign-out removes the kind with the account's other copies
 * (`deleteAccountCopies`).
 *
 * @module services/dailyStreakCopy
 */

import {
  type CoupleStreak,
  type CoupleStreakAnswer,
  CoupleStreakSchema,
} from '../api/validation/dailyQuestionSchemas';
import { deleteLocalCopy, readLocalCopy, writeLocalCopy } from './localCopy';

export const DAILY_STREAK_COPY_KIND = 'daily-streak';

/** The saved streak, or `null` when there is none, the read failed or the value is malformed. */
export async function readSavedStreak(userId: string): Promise<CoupleStreak | null> {
  const saved = await readLocalCopy<unknown>(userId, DAILY_STREAK_COPY_KIND);
  const parsed = CoupleStreakSchema.safeParse(saved);
  return parsed.success ? parsed.data : null;
}

/**
 * Save a successful server answer: `ok` writes its streak, `unlinked` deletes
 * the copy. Throws when the storage fails.
 */
export async function saveStreakAnswer(userId: string, answer: CoupleStreakAnswer): Promise<void> {
  if (answer.status === 'ok') {
    await writeLocalCopy(userId, DAILY_STREAK_COPY_KIND, answer.streak);
  } else {
    await deleteLocalCopy(userId, DAILY_STREAK_COPY_KIND);
  }
}
