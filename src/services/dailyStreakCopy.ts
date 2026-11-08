/**
 * The `daily-streak` local copy: the account's last `ok` couple streak
 * (architecture AD-13).
 *
 * The value is a `CoupleStreak` exactly as `get_couple_streak` answered it; the
 * client never computes it. It also records the partner it was read with
 * (`partner_id`, as the `daily-days` copy does), and `readSavedStreak` shows it
 * only for that partner: a copy saved before the tag has no `partner_id` and reads
 * as partner `null`, so it is hidden once a partner is known. Only a successful
 * server answer reaches this module: `ok` replaces the copy, and `unlinked`
 * deletes it (a missing copy already reads as "nothing to show"). A failed read never gets here, so it leaves the
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

/**
 * The saved streak read with `partnerId`, or `null` when there is none, it was
 * read with another partner (an untagged copy counts as partner `null`), the
 * read failed or the value is malformed.
 */
export async function readSavedStreak(
  userId: string,
  partnerId: string | null
): Promise<CoupleStreak | null> {
  const saved = await readLocalCopy<unknown>(userId, DAILY_STREAK_COPY_KIND);
  const parsed = CoupleStreakSchema.safeParse(saved);
  if (!parsed.success) return null;
  const tag = (saved as { partner_id?: unknown }).partner_id;
  return (typeof tag === 'string' ? tag : null) === partnerId ? parsed.data : null;
}

/**
 * Save a successful server answer: `ok` writes its streak tagged with the
 * partner it was read with, `unlinked` deletes the copy. Throws when the storage
 * fails.
 */
export async function saveStreakAnswer(
  userId: string,
  answer: CoupleStreakAnswer,
  partnerId: string | null
): Promise<void> {
  if (answer.status === 'ok') {
    await writeLocalCopy(userId, DAILY_STREAK_COPY_KIND, {
      ...answer.streak,
      partner_id: partnerId,
    });
  } else {
    await deleteLocalCopy(userId, DAILY_STREAK_COPY_KIND);
  }
}
