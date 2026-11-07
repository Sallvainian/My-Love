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
  claimCelebration,
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
    await expect(claimCelebration(A, streak(4, 1), current)).resolves.toEqual({ play: false });

    expect(await readLocalCopy(A, DAILY_CELEBRATED_KIND)).toEqual({ held: 4, milestones: 1 });
  });

  it('equal: no write, no play', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 4, milestones: 0 });
    const write = vi.spyOn(localCopy, 'writeLocalCopy');

    await expect(claimCelebration(A, streak(4, 3), current)).resolves.toEqual({ play: false });

    expect(write).not.toHaveBeenCalled();
    expect(await readCelebrated(A)).toEqual({ held: 4, milestones: 0 });
  });

  it('up: stores the new held, keeps the stored milestones and plays from the stored value', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 4, milestones: 1 });

    await expect(claimCelebration(A, streak(5, 3), current)).resolves.toEqual({
      play: true,
      previous: { held: 4, milestones: 1 },
    });

    expect(await readCelebrated(A)).toEqual({ held: 5, milestones: 1 });
  });

  it('lower: no write, no play', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 6, milestones: 0 });
    const write = vi.spyOn(localCopy, 'writeLocalCopy');

    await expect(claimCelebration(A, streak(5), current)).resolves.toEqual({ play: false });

    expect(write).not.toHaveBeenCalled();
    expect(await readCelebrated(A)).toEqual({ held: 6, milestones: 0 });
  });

  it('two claims at once: exactly one plays', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 4, milestones: 0 });

    const claims = await Promise.all([
      claimCelebration(A, streak(5), current),
      claimCelebration(A, streak(5), current),
      claimCelebration(A, streak(5), current),
    ]);

    expect(claims.filter((claim) => claim.play)).toHaveLength(1);
    expect(await readCelebrated(A)).toEqual({ held: 5, milestones: 0 });
  });

  it('malformed stored value: treated as absent, seeds and does not play', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 'x' });

    await expect(claimCelebration(A, streak(7, 2), current)).resolves.toEqual({ play: false });

    expect(await readCelebrated(A)).toEqual({ held: 7, milestones: 2 });
  });

  it('session changed: writes nothing and does not play', async () => {
    await writeLocalCopy(A, DAILY_CELEBRATED_KIND, { held: 4, milestones: 0 });

    await expect(claimCelebration(A, streak(5), () => false)).resolves.toEqual({ play: false });

    expect(await readCelebrated(A)).toEqual({ held: 4, milestones: 0 });
  });

  it('does not recreate the kind that sign-out deleted', async () => {
    await expect(claimCelebration(A, streak(5), () => false)).resolves.toEqual({ play: false });

    expect(await readLocalCopy(A, DAILY_CELEBRATED_KIND)).toBeNull();
  });

  it('throws when the write fails, and the lock is free for the next claim', async () => {
    const failure = new Error('disk full');
    vi.spyOn(localCopy, 'writeLocalCopy').mockRejectedValueOnce(failure);

    await expect(claimCelebration(A, streak(5), current)).rejects.toBe(failure);

    await expect(claimCelebration(A, streak(5), current)).resolves.toEqual({ play: false });
    expect(await readCelebrated(A)).toEqual({ held: 5, milestones: 0 });
  });

  it("is deleted with the account's other copies on sign-out", async () => {
    await claimCelebration(A, streak(4), current);
    await claimCelebration(B, streak(2), current);

    await deleteAccountCopies(A);

    expect(await readCelebrated(A)).toBeNull();
    expect(await readCelebrated(B)).toEqual({ held: 2, milestones: 0 });
  });
});
