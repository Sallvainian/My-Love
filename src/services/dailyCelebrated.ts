/**
 * The `daily-celebrated` local copy: the held total this device last
 * celebrated, and the milestones it last showed (architecture AD-13).
 *
 * A device-state kind: it is written only by `claimCelebration` (the +1 on
 * Daily) and `claimMilestone` (the milestone screen there) and has no server
 * source, so it registers no refresher (`registerLocalCopy`) and the
 * `localCopy.ts` FILL SOURCES rule exempts it. Each device celebrates once per
 * new held total, and shows the milestone screen once per new milestone: `held`
 * is stored when the +1 is claimed, and `milestones`, the highest count shown,
 * only when the milestone screen itself is about to show. A +1 cut short
 * (a reload, leaving Daily) therefore leaves the milestone owed: the held total
 * is stored and the milestone count is not, and the next open of Daily shows
 * the milestone screen by itself. Sign-out removes it with the account's other
 * kinds (`deleteAccountCopies`).
 *
 * @module services/dailyCelebrated
 */

import { z } from 'zod/v4';
import type { CoupleStreak } from '../api/dailyQuestionApi';
import { readLocalCopy, readLocalCopyStatus, writeLocalCopy } from './localCopy';
import { DAILY_CELEBRATED_LOCK, withWaitingLock } from './syncLock';

export const DAILY_CELEBRATED_KIND = 'daily-celebrated';

const CountSchema = z.number().int().nonnegative();

const CelebratedSchema = z.object({ held: CountSchema, milestones: CountSchema });

export type Celebrated = z.infer<typeof CelebratedSchema>;

/**
 * What a claim decided. `previous` is the value stored before it (a play rolls
 * up from it), or `null` when there was none or nothing was claimed. `milestone`
 * says the streak's milestone count is above the highest one shown: with a play,
 * the milestone screen follows the +1; without one, the +1 for this held total
 * was already claimed and its milestone screen is still owed.
 */
export type CelebrationClaim =
  | { play: false; previous: Celebrated | null; milestone: boolean }
  | { play: true; previous: Celebrated; milestone: boolean };

/** The answer when nothing was claimed (no session, or a failure). */
export const NO_CELEBRATION: CelebrationClaim = { play: false, previous: null, milestone: false };

/** The stored value, or `null` when nothing is stored, the read failed or the value is malformed. */
export async function readCelebrated(userId: string): Promise<Celebrated | null> {
  return parseCelebrated(await readLocalCopy<unknown>(userId, DAILY_CELEBRATED_KIND));
}

function parseCelebrated(saved: unknown): Celebrated | null {
  const parsed = CelebratedSchema.safeParse(saved);
  return parsed.success ? parsed.data : null;
}

/**
 * Decide whether `streak` is a new held total for this device, under
 * `DAILY_CELEBRATED_LOCK` (waiting, across tabs), so two claims at once yield
 * one play. Nothing stored: seed from the streak, no play and no milestone. A
 * held above the stored one: store it, leave the stored milestones (the screen
 * has not shown yet) and play, answering `milestone` when the streak's count is
 * the higher. Otherwise no play and no write; `milestone` is then true only for
 * the stored held itself with a higher milestone count, a milestone whose +1 was
 * cut short (a lower held is an older answer). Writes only while `isCurrent()`
 * holds (a sign-out in between must not recreate the outgoing account's kind),
 * and answers `NO_CELEBRATION` when it does not, and when the saved value cannot
 * be read (nothing is written). Throws when the write fails.
 */
export async function claimCelebration(
  userId: string,
  streak: Pick<CoupleStreak, 'held' | 'milestones'>,
  isCurrent: () => boolean
): Promise<CelebrationClaim> {
  return withWaitingLock(DAILY_CELEBRATED_LOCK, async () => {
    const read = await readLocalCopyStatus<unknown>(userId, DAILY_CELEBRATED_KIND);
    if (read.status === 'failed') return NO_CELEBRATION;
    const stored = parseCelebrated(read.status === 'found' ? read.value : null);
    if (!isCurrent()) return NO_CELEBRATION;
    if (stored === null) {
      await writeLocalCopy(userId, DAILY_CELEBRATED_KIND, {
        held: streak.held,
        milestones: streak.milestones,
      });
      return NO_CELEBRATION;
    }
    const milestone = streak.milestones > stored.milestones;
    if (streak.held > stored.held) {
      await writeLocalCopy(userId, DAILY_CELEBRATED_KIND, {
        held: streak.held,
        milestones: stored.milestones,
      });
      return { play: true, previous: stored, milestone };
    }
    return {
      play: false,
      previous: stored,
      milestone: milestone && streak.held === stored.held,
    };
  });
}

/**
 * Claim the milestone screen for `streak`, under the same lock, just before it
 * shows: `true`, with the streak's count stored as the highest shown, when that
 * count is above the stored one; `false`, with nothing written, when it has been
 * shown already (another tab), nothing is stored, the saved value cannot be read,
 * or `isCurrent()` no longer holds (a sign-out, or the view that would show it is
 * gone). So a milestone that showed never shows again, even on a reload at once,
 * and one that cannot show stays owed. Throws when the write fails.
 */
export async function claimMilestone(
  userId: string,
  streak: Pick<CoupleStreak, 'milestones'>,
  isCurrent: () => boolean
): Promise<boolean> {
  return withWaitingLock(DAILY_CELEBRATED_LOCK, async () => {
    const read = await readLocalCopyStatus<unknown>(userId, DAILY_CELEBRATED_KIND);
    if (read.status === 'failed') return false;
    const stored = parseCelebrated(read.status === 'found' ? read.value : null);
    if (!isCurrent()) return false;
    if (stored === null || streak.milestones <= stored.milestones) return false;
    await writeLocalCopy(userId, DAILY_CELEBRATED_KIND, {
      held: stored.held,
      milestones: streak.milestones,
    });
    return true;
  });
}
