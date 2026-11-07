/**
 * The `daily-celebrated` local copy: the held total this device last
 * celebrated, and the milestones it last showed (architecture AD-13).
 *
 * A device-state kind: it is written only by `claimCelebration` (the +1 on
 * Daily) and has no server source, so it registers no refresher
 * (`registerLocalCopy`) and the `localCopy.ts` FILL SOURCES rule exempts it.
 * Each device celebrates once per new held total, and shows the milestone
 * screen once per new milestone: `milestones` is the highest count shown, so a
 * claim that plays compares the streak's count with it. Sign-out removes it
 * with the account's other kinds (`deleteAccountCopies`).
 *
 * @module services/dailyCelebrated
 */

import { z } from 'zod/v4';
import type { CoupleStreak } from '../api/dailyQuestionApi';
import { readLocalCopy, writeLocalCopy } from './localCopy';
import { DAILY_CELEBRATED_LOCK, withWaitingLock } from './syncLock';

export const DAILY_CELEBRATED_KIND = 'daily-celebrated';

const CountSchema = z.number().int().nonnegative();

const CelebratedSchema = z.object({ held: CountSchema, milestones: CountSchema });

export type Celebrated = z.infer<typeof CelebratedSchema>;

/**
 * What a claim decided: `previous` is the stored value a play rolls up from,
 * and `milestone` says the streak's milestone count is above the stored one, so
 * the milestone screen follows the +1.
 */
export type CelebrationClaim =
  | { play: false }
  | { play: true; previous: Celebrated; milestone: boolean };

/** The stored value, or `null` when nothing is stored, the read failed or the value is malformed. */
export async function readCelebrated(userId: string): Promise<Celebrated | null> {
  const saved = await readLocalCopy<unknown>(userId, DAILY_CELEBRATED_KIND);
  const parsed = CelebratedSchema.safeParse(saved);
  return parsed.success ? parsed.data : null;
}

/**
 * Decide whether `streak` is a new held total for this device, under
 * `DAILY_CELEBRATED_LOCK` (waiting, across tabs), so two claims at once yield
 * one play. Nothing stored: seed from the streak, no play. A held above the
 * stored one: store it with the higher of the two milestone counts and play,
 * answering `milestone` when the streak's count is the higher. Otherwise no play
 * and no write (a milestone never shows without the +1). Writes only while
 * `isCurrent()` holds (a sign-out in between must not recreate the outgoing
 * account's kind), and then answers no play. Throws when the write fails.
 */
export async function claimCelebration(
  userId: string,
  streak: Pick<CoupleStreak, 'held' | 'milestones'>,
  isCurrent: () => boolean
): Promise<CelebrationClaim> {
  return withWaitingLock(DAILY_CELEBRATED_LOCK, async () => {
    const stored = await readCelebrated(userId);
    if (!isCurrent()) return { play: false };
    if (stored === null) {
      await writeLocalCopy(userId, DAILY_CELEBRATED_KIND, {
        held: streak.held,
        milestones: streak.milestones,
      });
      return { play: false };
    }
    if (streak.held > stored.held) {
      await writeLocalCopy(userId, DAILY_CELEBRATED_KIND, {
        held: streak.held,
        milestones: Math.max(stored.milestones, streak.milestones),
      });
      return { play: true, previous: stored, milestone: streak.milestones > stored.milestones };
    }
    return { play: false };
  });
}
