/**
 * The `daily-streak` local copy (src/services/dailyStreakCopy.ts).
 *
 * Runs against fake-indexeddb through the real `openMyLoveDB`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  DAILY_STREAK_COPY_KIND,
  readSavedStreak,
  saveStreakAnswer,
} from '../../../src/services/dailyStreakCopy';
import { openMyLoveDB } from '../../../src/services/dbSchema';
import * as localCopy from '../../../src/services/localCopy';
import { readLocalCopy, writeLocalCopy } from '../../../src/services/localCopy';
import { coupleStreak } from '../stores/dailyQuestionFixture';

const A = 'USER-A';
const B = 'USER-B';

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

describe('readSavedStreak', () => {
  it('answers null when nothing is saved', async () => {
    expect(await readSavedStreak(A)).toBeNull();
  });

  it('answers the saved streak', async () => {
    const streak = coupleStreak({ held: 4 });
    await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, streak);

    expect(await readSavedStreak(A)).toEqual(streak);
  });

  it("never answers another account's streak", async () => {
    await writeLocalCopy(B, DAILY_STREAK_COPY_KIND, coupleStreak({ held: 9 }));

    expect(await readSavedStreak(A)).toBeNull();
  });

  it.each([
    ['a string', 'streak'],
    ['an object missing fields', { held: 3 }],
    ['an answer wrapper instead of the streak', { status: 'ok', streak: coupleStreak() }],
    ['a week of the wrong length', { ...coupleStreak(), week: [] }],
  ])('answers null for a malformed value: %s', async (_name, value) => {
    await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, value);

    expect(await readSavedStreak(A)).toBeNull();
  });

  it('answers null when the read fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, coupleStreak());
    vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementation(() => {
      throw new Error('READ-FAILED');
    });

    expect(await readSavedStreak(A)).toBeNull();
  });
});

describe('saveStreakAnswer', () => {
  it('writes the streak of an ok answer, replacing the previous one', async () => {
    await saveStreakAnswer(A, { status: 'ok', streak: coupleStreak({ held: 2 }) });
    await saveStreakAnswer(A, { status: 'ok', streak: coupleStreak({ held: 3 }) });

    expect(await readLocalCopy(A, DAILY_STREAK_COPY_KIND)).toEqual(coupleStreak({ held: 3 }));
  });

  it('deletes the copy for an unlinked answer, keeping other kinds and accounts', async () => {
    await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, coupleStreak());
    await writeLocalCopy(A, 'daily-days', {});
    await writeLocalCopy(B, DAILY_STREAK_COPY_KIND, coupleStreak({ held: 7 }));

    await saveStreakAnswer(A, { status: 'unlinked' });

    expect(await readSavedStreak(A)).toBeNull();
    expect(await readLocalCopy(A, 'daily-days')).toEqual({});
    expect(await readSavedStreak(B)).toEqual(coupleStreak({ held: 7 }));
  });

  it('throws when the storage fails', async () => {
    vi.spyOn(localCopy, 'writeLocalCopy').mockRejectedValue(new Error('WRITE-FAILED'));

    await expect(
      saveStreakAnswer(A, { status: 'ok', streak: coupleStreak() })
    ).rejects.toThrow('WRITE-FAILED');
  });
});
