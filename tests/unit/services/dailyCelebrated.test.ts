/**
 * The `daily-celebrated` local copy (src/services/dailyCelebrated.ts) and the
 * waiting lock its claims run under (src/services/syncLock.ts).
 *
 * Runs against fake-indexeddb through the real `openMyLoveDB`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  DAILY_CELEBRATED_KIND,
  NO_CELEBRATION,
  claimCelebration,
  claimMilestone,
  readCelebrated,
} from '../../../src/services/dailyCelebrated';
import { openMyLoveDB } from '../../../src/services/dbSchema';
import * as localCopy from '../../../src/services/localCopy';
import {
  deleteAccountCopies,
  readLocalCopy,
  writeLocalCopy,
} from '../../../src/services/localCopy';

const A = 'USER-A';
const B = 'USER-B';
const P = 'PARTNER-P';
const Q = 'PARTNER-Q';
const current = () => true;
const streak = (held: number, milestones = 0) => ({ held, milestones });

async function clearStores(): Promise<void> {
  const db = await openMyLoveDB();
  try {
    await db.clear('local-copies');
  } finally {
    db.close();
  }
}

beforeEach(async () => {
  await clearStores();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await clearStores();
});

describe('readCelebrated', () => {
  it('is null when nothing is saved', async () => {
    await expect(readCelebrated(A)).resolves.toBeNull();
  });

  it('reads the saved value', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 4, milestones: 1 });

    await expect(readCelebrated(A)).resolves.toEqual({ held: 4, milestones: 1 });
  });

  it.each([
    ['a string', 'garbage'],
    ['an array', [4, 1]],
    ['a missing field', { held: 4 }],
    ['a negative count', { held: -1, milestones: 0 }],
    ['a fraction', { held: 1.5, milestones: 0 }],
    ['a string count', { held: '4', milestones: 0 }],
  ])('is null when the saved value is %s', async (_label, value) => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, value);

    await expect(readCelebrated(A)).resolves.toBeNull();
  });

  it('is null when the read fails', async () => {
    vi.spyOn(localCopy, 'readLocalCopy').mockResolvedValue(null);

    await expect(readCelebrated(A)).resolves.toBeNull();
  });

  it("keeps one account's value from another", async () => {
    await writeLocalCopy(B, DAILY_CELEBRATED_KIND, { held: 9, milestones: 2 });

    await expect(readCelebrated(A)).resolves.toBeNull();
  });
});

describe('claimCelebration', () => {
  it('first read: seeds held and milestones from the streak and does not play', async () => {
    await expect(claimCelebration(A, P, streak(4, 1), current)).resolves.toEqual(NO_CELEBRATION);

    expect(await readLocalCopy(A, DAILY_CELEBRATED_KIND)).toEqual({
      held: 4,
      milestones: 1,
      partner_id: P,
    });
  });

  it('equal: no write, no play', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 4, milestones: 0 });
    const write = vi.spyOn(localCopy, 'writeLocalCopy');

    await expect(claimCelebration(A, P, streak(4, 0), current)).resolves.toEqual({
      play: false,
      previous: { held: 4, milestones: 0 },
      milestone: false,
    });

    expect(write).not.toHaveBeenCalled();
    expect(await readCelebrated(A)).toEqual({ held: 4, milestones: 0 });
  });

  it('up, no new milestone: stores the new held, keeps the stored milestones and plays from the stored value', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 25, milestones: 1 });

    await expect(claimCelebration(A, P, streak(26, 1), current)).resolves.toEqual({
      play: true,
      previous: { held: 25, milestones: 1 },
      milestone: false,
    });

    expect(await readCelebrated(A)).toEqual({ held: 26, milestones: 1 });
  });

  it('first milestone: stores held, leaves the milestone unshown and answers milestone', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 24, milestones: 0 });

    await expect(claimCelebration(A, P, streak(25, 1), current)).resolves.toEqual({
      play: true,
      previous: { held: 24, milestones: 0 },
      milestone: true,
    });

    expect(await readCelebrated(A)).toEqual({ held: 25, milestones: 0 });
  });

  it('caught up past one milestone: one milestone answer with the streak held', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 24, milestones: 0 });

    await expect(claimCelebration(A, P, streak(27, 1), current)).resolves.toMatchObject({
      play: true,
      milestone: true,
    });

    expect(await readCelebrated(A)).toEqual({ held: 27, milestones: 0 });
  });

  it('two milestones at once: one answer, the stored count left', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 40, milestones: 1 });

    await expect(claimCelebration(A, P, streak(75, 3), current)).resolves.toEqual({
      play: true,
      previous: { held: 40, milestones: 1 },
      milestone: true,
    });

    expect(await readCelebrated(A)).toEqual({ held: 75, milestones: 1 });
  });

  it('stored milestones ahead of the streak: they stay, and no milestone', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 30, milestones: 2 });

    await expect(claimCelebration(A, P, streak(31, 1), current)).resolves.toEqual({
      play: true,
      previous: { held: 30, milestones: 2 },
      milestone: false,
    });

    expect(await readCelebrated(A)).toEqual({ held: 31, milestones: 2 });
  });

  it('the +1 already claimed, its milestone not shown: no play, no write, the milestone owed', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 25, milestones: 0 });
    const write = vi.spyOn(localCopy, 'writeLocalCopy');

    await expect(claimCelebration(A, P, streak(25, 1), current)).resolves.toEqual({
      play: false,
      previous: { held: 25, milestones: 0 },
      milestone: true,
    });

    expect(write).not.toHaveBeenCalled();
    expect(await readCelebrated(A)).toEqual({ held: 25, milestones: 0 });
  });

  it('lower, a milestone count above the stored one included: no write, no play, no milestone', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 6, milestones: 0 });
    const write = vi.spyOn(localCopy, 'writeLocalCopy');

    await expect(claimCelebration(A, P, streak(5, 1), current)).resolves.toEqual({
      play: false,
      previous: { held: 6, milestones: 0 },
      milestone: false,
    });

    expect(write).not.toHaveBeenCalled();
    expect(await readCelebrated(A)).toEqual({ held: 6, milestones: 0 });
  });

  it('two claims at once: exactly one plays', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 4, milestones: 0 });

    const claims = await Promise.all([
      claimCelebration(A, P, streak(5), current),
      claimCelebration(A, P, streak(5), current),
      claimCelebration(A, P, streak(5), current),
    ]);

    expect(claims.filter((claim) => claim.play)).toHaveLength(1);
    expect(await readCelebrated(A)).toEqual({ held: 5, milestones: 0 });
  });

  it('malformed stored value: treated as absent, seeds and does not play', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 'x' });

    await expect(claimCelebration(A, P, streak(7, 2), current)).resolves.toEqual(NO_CELEBRATION);

    expect(await readCelebrated(A)).toEqual({ held: 7, milestones: 2 });
  });

  it('read fails: answers NO_CELEBRATION and writes nothing, the stored value stays', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 3, milestones: 1 });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const writeSpy = vi.spyOn(localCopy, 'writeLocalCopy');
    const failure = new Error('read failed');
    vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementationOnce(() => {
      throw failure;
    });

    await expect(claimCelebration(A, P, streak(4, 1), current)).resolves.toEqual(NO_CELEBRATION);

    expect(errorSpy).toHaveBeenCalledWith(
      '[localCopy] Failed to read daily-celebrated copy:',
      failure
    );
    expect(writeSpy).not.toHaveBeenCalled();
    expect(await readCelebrated(A)).toEqual({ held: 3, milestones: 1 });

    await expect(claimCelebration(A, P, streak(4, 1), current)).resolves.toEqual({
      play: true,
      previous: { held: 3, milestones: 1 },
      milestone: false,
    });
    expect(await readCelebrated(A)).toEqual({ held: 4, milestones: 1 });
  });

  it('session changed: writes nothing and does not play', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 4, milestones: 0 });

    await expect(claimCelebration(A, P, streak(5), () => false)).resolves.toEqual(NO_CELEBRATION);

    expect(await readCelebrated(A)).toEqual({ held: 4, milestones: 0 });
  });

  it('does not recreate the kind that sign-out deleted', async () => {
    await expect(claimCelebration(A, P, streak(5), () => false)).resolves.toEqual(NO_CELEBRATION);

    expect(await readLocalCopy(A, DAILY_CELEBRATED_KIND)).toBeNull();
  });

  it('throws when the write fails, and the lock is free for the next claim', async () => {
    const failure = new Error('disk full');
    vi.spyOn(localCopy, 'writeLocalCopy').mockRejectedValueOnce(failure);

    await expect(claimCelebration(A, P, streak(5), current)).rejects.toBe(failure);

    await expect(claimCelebration(A, P, streak(5), current)).resolves.toEqual(NO_CELEBRATION);
    expect(await readCelebrated(A)).toEqual({ held: 5, milestones: 0 });
  });

  it("is deleted with the account's other copies on sign-out", async () => {
    await claimCelebration(A, P, streak(4), current);
    await claimCelebration(B, P, streak(2), current);

    await deleteAccountCopies(A);

    expect(await readCelebrated(A)).toBeNull();
    expect(await readCelebrated(B)).toEqual({ held: 2, milestones: 0 });
  });
});

describe('claimCelebration: the partner tag', () => {
  it('every write is tagged with the partner the claim was made for', async () => {
    await expect(claimCelebration(A, P, streak(24), current)).resolves.toEqual(NO_CELEBRATION);
    expect(await readLocalCopy(A, DAILY_CELEBRATED_KIND)).toEqual({
      held: 24,
      milestones: 0,
      partner_id: P,
    });

    await expect(claimCelebration(A, P, streak(25, 1), current)).resolves.toMatchObject({
      play: true,
      milestone: true,
    });
    expect(await readLocalCopy(A, DAILY_CELEBRATED_KIND)).toEqual({
      held: 25,
      milestones: 0,
      partner_id: P,
    });
  });

  it('a value tagged with another partner is re-seeded from the streak, with no play', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 40, milestones: 1, partner_id: P });

    // The new pair's held total starts at 0 and is below the old pair's 40.
    await expect(claimCelebration(A, Q, streak(2), current)).resolves.toEqual(NO_CELEBRATION);
    expect(await readLocalCopy(A, DAILY_CELEBRATED_KIND)).toEqual({
      held: 2,
      milestones: 0,
      partner_id: Q,
    });

    await expect(claimCelebration(A, Q, streak(3), current)).resolves.toEqual({
      play: true,
      previous: { held: 2, milestones: 0 },
      milestone: false,
    });
  });

  it('a value tagged with another partner never answers a milestone owed', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 25, milestones: 0, partner_id: P });

    await expect(claimCelebration(A, Q, streak(25, 1), current)).resolves.toEqual(NO_CELEBRATION);
    expect(await readLocalCopy(A, DAILY_CELEBRATED_KIND)).toEqual({
      held: 25,
      milestones: 1,
      partner_id: Q,
    });
  });

  it("an untagged value counts as the current pair's and is tagged by the next write", async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 3, milestones: 0 });
    const write = vi.spyOn(localCopy, 'writeLocalCopy');

    await expect(claimCelebration(A, P, streak(3), current)).resolves.toMatchObject({ play: false });
    expect(write).not.toHaveBeenCalled();

    await expect(claimCelebration(A, P, streak(4), current)).resolves.toEqual({
      play: true,
      previous: { held: 3, milestones: 0 },
      milestone: false,
    });
    expect(await readLocalCopy(A, DAILY_CELEBRATED_KIND)).toEqual({
      held: 4,
      milestones: 0,
      partner_id: P,
    });
  });

  it('no known partner: nothing is claimed and nothing is written', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 3, milestones: 0, partner_id: P });
    const write = vi.spyOn(localCopy, 'writeLocalCopy');

    await expect(claimCelebration(A, null, streak(9, 1), current)).resolves.toEqual(NO_CELEBRATION);

    expect(write).not.toHaveBeenCalled();
    expect(await readLocalCopy(A, DAILY_CELEBRATED_KIND)).toEqual({
      held: 3,
      milestones: 0,
      partner_id: P,
    });
  });

  it('no known partner and nothing stored: the kind is not created', async () => {
    await expect(claimCelebration(A, null, streak(9), current)).resolves.toEqual(NO_CELEBRATION);

    expect(await readLocalCopy(A, DAILY_CELEBRATED_KIND)).toBeNull();
  });

  it('a value with a tag that is not a string is malformed: treated as absent and re-seeded', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 40, milestones: 1, partner_id: 7 });

    await expect(claimCelebration(A, P, streak(2), current)).resolves.toEqual(NO_CELEBRATION);

    expect(await readCelebrated(A)).toEqual({ held: 2, milestones: 0 });
  });
});

describe('claimMilestone', () => {
  it('a count above the stored one: stores it, keeps the held and answers true', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 25, milestones: 0 });

    await expect(claimMilestone(A, P, streak(25, 1), current)).resolves.toBe(true);

    expect(await readCelebrated(A)).toEqual({ held: 25, milestones: 1 });
  });

  it('keeps a stored held that moved on since the +1 was claimed', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 26, milestones: 0 });

    await expect(claimMilestone(A, P, streak(25, 1), current)).resolves.toBe(true);

    expect(await readCelebrated(A)).toEqual({ held: 26, milestones: 1 });
  });

  it.each([
    ['equal', 1],
    ['ahead', 2],
  ])('stored milestones %s: answers false and writes nothing', async (_label, milestones) => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 25, milestones });
    const write = vi.spyOn(localCopy, 'writeLocalCopy');

    await expect(claimMilestone(A, P, streak(25, 1), current)).resolves.toBe(false);

    expect(write).not.toHaveBeenCalled();
    expect(await readCelebrated(A)).toEqual({ held: 25, milestones });
  });

  it('two claims at once: exactly one shows', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 25, milestones: 0 });

    const claims = await Promise.all([
      claimMilestone(A, P, streak(25, 1), current),
      claimMilestone(A, P, streak(25, 1), current),
      claimMilestone(A, P, streak(25, 1), current),
    ]);

    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(await readCelebrated(A)).toEqual({ held: 25, milestones: 1 });
  });

  it('read fails: answers false and writes nothing, the stored value stays', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 3, milestones: 1 });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const writeSpy = vi.spyOn(localCopy, 'writeLocalCopy');
    const failure = new Error('read failed');
    vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementationOnce(() => {
      throw failure;
    });

    await expect(claimMilestone(A, P, { milestones: 2 }, current)).resolves.toBe(false);

    expect(errorSpy).toHaveBeenCalledWith(
      '[localCopy] Failed to read daily-celebrated copy:',
      failure
    );
    expect(writeSpy).not.toHaveBeenCalled();
    expect(await readCelebrated(A)).toEqual({ held: 3, milestones: 1 });

    await expect(claimMilestone(A, P, { milestones: 2 }, current)).resolves.toBe(true);
    expect(await readCelebrated(A)).toEqual({ held: 3, milestones: 2 });
  });

  it('no longer current: answers false and the milestone stays owed', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 25, milestones: 0 });

    await expect(claimMilestone(A, P, streak(25, 1), () => false)).resolves.toBe(false);

    expect(await readCelebrated(A)).toEqual({ held: 25, milestones: 0 });
  });

  it('nothing stored: answers false and does not recreate the kind that sign-out deleted', async () => {
    await expect(claimMilestone(A, P, streak(25, 1), current)).resolves.toBe(false);

    expect(await readLocalCopy(A, DAILY_CELEBRATED_KIND)).toBeNull();
  });

  it('throws when the write fails, the milestone stays owed and the lock is free', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 25, milestones: 0 });
    const failure = new Error('disk full');
    vi.spyOn(localCopy, 'writeLocalCopy').mockRejectedValueOnce(failure);

    await expect(claimMilestone(A, P, streak(25, 1), current)).rejects.toBe(failure);

    await expect(claimMilestone(A, P, streak(25, 1), current)).resolves.toBe(true);
  });
});

describe('claimMilestone: the partner tag', () => {
  it('stores the count tagged with the partner', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 25, milestones: 0, partner_id: P });

    await expect(claimMilestone(A, P, streak(25, 1), current)).resolves.toBe(true);

    expect(await readLocalCopy(A, DAILY_CELEBRATED_KIND)).toEqual({
      held: 25,
      milestones: 1,
      partner_id: P,
    });
  });

  it("an untagged value counts as the current pair's and is tagged by the write", async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 25, milestones: 0 });

    await expect(claimMilestone(A, P, streak(25, 1), current)).resolves.toBe(true);

    expect(await readLocalCopy(A, DAILY_CELEBRATED_KIND)).toEqual({
      held: 25,
      milestones: 1,
      partner_id: P,
    });
  });

  it('a value tagged with another partner: answers false and writes nothing', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 25, milestones: 0, partner_id: P });
    const write = vi.spyOn(localCopy, 'writeLocalCopy');

    await expect(claimMilestone(A, Q, streak(25, 1), current)).resolves.toBe(false);

    expect(write).not.toHaveBeenCalled();
  });

  it('no known partner: answers false and writes nothing', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 25, milestones: 0, partner_id: P });
    const write = vi.spyOn(localCopy, 'writeLocalCopy');

    await expect(claimMilestone(A, null, streak(25, 1), current)).resolves.toBe(false);

    expect(write).not.toHaveBeenCalled();
  });
});
