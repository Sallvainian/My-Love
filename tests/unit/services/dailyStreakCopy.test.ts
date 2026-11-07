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
const PARTNER_X = 'PARTNER-X';
const PARTNER_Y = 'PARTNER-Y';

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
    expect(await readSavedStreak(A, null)).toBeNull();
  });

  it('answers the saved streak', async () => {
    const streak = coupleStreak({ held: 4 });
    await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, streak);

    expect(await readSavedStreak(A, null)).toEqual(streak);
  });

  it("never answers another account's streak", async () => {
    await writeLocalCopy(B, DAILY_STREAK_COPY_KIND, coupleStreak({ held: 9 }));

    expect(await readSavedStreak(A, null)).toBeNull();
  });

  it.each([
    ['a string', 'streak'],
    ['an object missing fields', { held: 3 }],
    ['an answer wrapper instead of the streak', { status: 'ok', streak: coupleStreak() }],
    ['a week of the wrong length', { ...coupleStreak(), week: [] }],
  ])('answers null for a malformed value: %s', async (_name, value) => {
    await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, value);

    expect(await readSavedStreak(A, null)).toBeNull();
  });

  it('answers the streak tagged with the partner it is read for', async () => {
    const streak = coupleStreak({ held: 4 });
    await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, { ...streak, partner_id: PARTNER_X });

    expect(await readSavedStreak(A, PARTNER_X)).toEqual(streak);
  });

  it('answers null for a streak tagged with another partner', async () => {
    await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, {
      ...coupleStreak({ held: 4 }),
      partner_id: PARTNER_X,
    });

    expect(await readSavedStreak(A, PARTNER_Y)).toBeNull();
    expect(await readSavedStreak(A, null)).toBeNull();
  });

  it('reads an untagged streak as partner null: hidden for a known partner, shown for none', async () => {
    const streak = coupleStreak({ held: 4 });
    await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, streak);

    expect(await readSavedStreak(A, PARTNER_X)).toBeNull();
    expect(await readSavedStreak(A, null)).toEqual(streak);
  });

  it('never leaks the partner tag to the caller', async () => {
    await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, {
      ...coupleStreak({ held: 4 }),
      partner_id: PARTNER_X,
    });

    expect(await readSavedStreak(A, PARTNER_X)).not.toHaveProperty('partner_id');
  });

  it('answers null when the read fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, coupleStreak());
    vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementation(() => {
      throw new Error('READ-FAILED');
    });

    expect(await readSavedStreak(A, null)).toBeNull();
  });
});

describe('saveStreakAnswer', () => {
  it('writes the streak of an ok answer, replacing the previous one', async () => {
    await saveStreakAnswer(A, { status: 'ok', streak: coupleStreak({ held: 2 }) }, null);
    await saveStreakAnswer(A, { status: 'ok', streak: coupleStreak({ held: 3 }) }, null);

    expect(await readLocalCopy(A, DAILY_STREAK_COPY_KIND)).toEqual({
      ...coupleStreak({ held: 3 }),
      partner_id: null,
    });
  });

  it('tags an ok answer with the partner it was read with', async () => {
    await saveStreakAnswer(A, { status: 'ok', streak: coupleStreak({ held: 5 }) }, PARTNER_X);

    expect(await readLocalCopy(A, DAILY_STREAK_COPY_KIND)).toEqual({
      ...coupleStreak({ held: 5 }),
      partner_id: PARTNER_X,
    });
  });

  it('deletes the copy for an unlinked answer, keeping other kinds and accounts', async () => {
    await writeLocalCopy(A, DAILY_STREAK_COPY_KIND, coupleStreak());
    await writeLocalCopy(A, 'daily-days', {});
    await writeLocalCopy(B, DAILY_STREAK_COPY_KIND, coupleStreak({ held: 7 }));

    await saveStreakAnswer(A, { status: 'unlinked' }, null);

    expect(await readSavedStreak(A, null)).toBeNull();
    expect(await readLocalCopy(A, 'daily-days')).toEqual({});
    expect(await readSavedStreak(B, null)).toEqual(coupleStreak({ held: 7 }));
  });

  it('throws when the storage fails', async () => {
    vi.spyOn(localCopy, 'writeLocalCopy').mockRejectedValue(new Error('WRITE-FAILED'));

    await expect(
      saveStreakAnswer(A, { status: 'ok', streak: coupleStreak() }, null)
    ).rejects.toThrow('WRITE-FAILED');
  });
});
