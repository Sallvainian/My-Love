/**
 * The `daily-days` local copy (src/services/dailyDaysCopy.ts) and the waiting
 * lock it merges under (src/services/syncLock.ts).
 *
 * Runs against fake-indexeddb through the real `openMyLoveDB`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  DAILY_DAYS_COPY_KIND,
  MAX_SAVED_DAILY_DAYS,
  dailyStateRank,
  mergeDailyDay,
  readSavedDailyDay,
} from '../../../src/services/dailyDaysCopy';
import { openMyLoveDB } from '../../../src/services/dbSchema';
import * as localCopy from '../../../src/services/localCopy';
import { readLocalCopy, writeLocalCopy } from '../../../src/services/localCopy';
import { withWaitingLock } from '../../../src/services/syncLock';
import {
  dailySnapshot,
  revealSnapshot,
  waitingSnapshot,
  writerSnapshot,
} from '../stores/dailyQuestionFixture';

const A = 'USER-A';
const B = 'USER-B';
const current = () => true;

const ok = (snapshot: ReturnType<typeof dailySnapshot>) => ({ status: 'ok' as const, snapshot });
const keyed = (...snapshots: ReturnType<typeof dailySnapshot>[]) =>
  Object.fromEntries(snapshots.map((snapshot) => [snapshot.day_id, snapshot]));
const savedMap = () => readLocalCopy<Record<string, unknown>>(A, DAILY_DAYS_COPY_KIND);

/** A snapshot for `day` with an id of its own. */
const forDay = (day: string, overrides: Partial<ReturnType<typeof dailySnapshot>> = {}) =>
  dailySnapshot({ day_id: `id-${day}`, day, ...overrides });

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

describe('dailyStateRank', () => {
  it('ranks none below me and partner, and both above them', () => {
    expect(dailyStateRank('none')).toBe(0);
    expect(dailyStateRank('me')).toBe(1);
    expect(dailyStateRank('partner')).toBe(1);
    expect(dailyStateRank('both')).toBe(2);
  });
});

describe('mergeDailyDay', () => {
  it('saves an ok answer under its day_id and returns it', async () => {
    const result = await mergeDailyDay(A, ok(dailySnapshot()), current);

    expect(result).toEqual(ok(dailySnapshot()));
    expect(await savedMap()).toEqual(keyed(dailySnapshot()));
  });

  it('a higher state replaces the stored entry of the same day_id', async () => {
    await mergeDailyDay(A, ok(dailySnapshot()), current);

    const result = await mergeDailyDay(A, ok(waitingSnapshot('this')), current);

    expect(result).toEqual(ok(waitingSnapshot('this')));
    expect(await savedMap()).toEqual(keyed(waitingSnapshot('this')));
  });

  it('an equal state replaces the stored entry (the newer answer wins a tie)', async () => {
    await mergeDailyDay(A, ok(dailySnapshot({ state: 'partner' })), current);
    const later = dailySnapshot({ state: 'me', my_choice: 'that', my_picked_at: '2026-11-05T16:00:00.000Z' });

    await mergeDailyDay(A, ok(later), current);

    expect(await savedMap()).toEqual(keyed(later));
  });

  it.each([
    ['both', revealSnapshot('this', 'that'), waitingSnapshot('this')],
    ['both', revealSnapshot('this', 'that'), dailySnapshot()],
    ['me', waitingSnapshot('this'), dailySnapshot()],
  ])('a lower read does not move a stored %s entry back', async (_s, stored, late) => {
    await mergeDailyDay(A, ok(stored), current);

    const result = await mergeDailyDay(A, ok(late), current);

    expect(result).toEqual(ok(stored));
    expect(await savedMap()).toEqual(keyed(stored));
  });

  it('a late read with write.done false does not reopen a written turn', async () => {
    const written = writerSnapshot('this', { write: { mine: true, done: true } });
    await mergeDailyDay(A, ok(written), current);

    const result = await mergeDailyDay(A, ok(writerSnapshot('this')), current);

    expect(result).toEqual(ok(written));
    expect(await savedMap()).toEqual(keyed(written));
  });

  it('a higher state with write.done false keeps write.done true', async () => {
    const written = writerSnapshot('this', { write: { mine: true, done: true } });
    await mergeDailyDay(A, ok(written), current);

    const result = await mergeDailyDay(A, ok(revealSnapshot('this', 'that')), current);

    expect(result).toEqual(
      ok({ ...revealSnapshot('this', 'that'), write: { mine: false, done: true } })
    );
  });

  it('keeps other days when one is merged', async () => {
    const yesterday = forDay('2026-11-04', { state: 'both' });
    await mergeDailyDay(A, ok(yesterday), current);

    await mergeDailyDay(A, ok(dailySnapshot()), current);

    expect(await savedMap()).toEqual(keyed(yesterday, dailySnapshot()));
  });

  it('an unlinked answer writes an empty map and returns unlinked', async () => {
    await mergeDailyDay(A, ok(dailySnapshot()), current);

    const result = await mergeDailyDay(A, { status: 'unlinked' }, current);

    expect(result).toEqual({ status: 'unlinked' });
    expect(await savedMap()).toEqual({});
  });

  it('keeps the 31 newest days by day and drops the oldest of 32', async () => {
    const days = Array.from({ length: MAX_SAVED_DAILY_DAYS }, (_, i) =>
      forDay(`2026-10-${String(i + 1).padStart(2, '0')}`)
    );
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, keyed(...days));
    expect(Object.keys((await savedMap())!)).toHaveLength(31);

    await mergeDailyDay(A, ok(forDay('2026-11-05')), current);

    const saved = (await savedMap())!;
    expect(Object.keys(saved)).toHaveLength(31);
    expect(saved['id-2026-10-01']).toBeUndefined();
    expect(saved['id-2026-10-02']).toBeDefined();
    expect(saved['id-2026-11-05']).toBeDefined();
  });

  it('writes nothing when isCurrent is false, and still returns the merged answer', async () => {
    const result = await mergeDailyDay(A, ok(dailySnapshot()), () => false);

    expect(result).toEqual(ok(dailySnapshot()));
    expect(await savedMap()).toBeNull();
  });

  it('writes nothing for an unlinked answer when isCurrent is false', async () => {
    await mergeDailyDay(A, ok(dailySnapshot()), current);

    await mergeDailyDay(A, { status: 'unlinked' }, () => false);

    expect(await savedMap()).toEqual(keyed(dailySnapshot()));
  });

  it('writes under the given account only', async () => {
    await mergeDailyDay(A, ok(dailySnapshot()), current);

    expect(await readLocalCopy(B, DAILY_DAYS_COPY_KIND)).toBeNull();
  });

  it('serialises two concurrent merges, so the higher one wins whatever the order', async () => {
    await Promise.all([
      mergeDailyDay(A, ok(waitingSnapshot('this')), current),
      mergeDailyDay(A, ok(revealSnapshot('this', 'that')), current),
    ]);
    expect((await savedMap())![dailySnapshot().day_id]).toMatchObject({ state: 'both' });

    await clearStores();
    await Promise.all([
      mergeDailyDay(A, ok(revealSnapshot('this', 'that')), current),
      mergeDailyDay(A, ok(waitingSnapshot('this')), current),
    ]);
    expect((await savedMap())![dailySnapshot().day_id]).toMatchObject({ state: 'both' });
  });

  it('concurrent merges of different days both land', async () => {
    const one = forDay('2026-11-03');
    const two = forDay('2026-11-04');

    await Promise.all([mergeDailyDay(A, ok(one), current), mergeDailyDay(A, ok(two), current)]);

    expect(await savedMap()).toEqual(keyed(one, two));
  });

  it('logs a failed write with its message and never throws', async () => {
    const failure = new Error('disk full');
    vi.spyOn(localCopy, 'writeLocalCopy').mockRejectedValue(failure);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(mergeDailyDay(A, ok(dailySnapshot()), current)).resolves.toEqual(
      ok(dailySnapshot())
    );

    expect(errorSpy).toHaveBeenCalledWith(
      '[DailyQuestion] Failed to save the daily days copy:',
      failure
    );
  });

  it('drops a malformed stored entry when it rewrites the map', async () => {
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, { broken: { day_id: 'broken' } });

    await mergeDailyDay(A, ok(dailySnapshot()), current);

    expect(await savedMap()).toEqual(keyed(dailySnapshot()));
  });
});

describe('readSavedDailyDay', () => {
  it('is null when nothing is saved', async () => {
    expect(await readSavedDailyDay(A, '2026-11-05')).toBeNull();
  });

  it('returns the entry whose day matches, and null for another date', async () => {
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, keyed(dailySnapshot(), forDay('2026-11-04')));

    expect(await readSavedDailyDay(A, '2026-11-05')).toEqual(dailySnapshot());
    expect(await readSavedDailyDay(A, '2026-11-04')).toEqual(forDay('2026-11-04'));
    expect(await readSavedDailyDay(A, '2026-11-06')).toBeNull();
  });

  it('returns the higher-ranked of two entries that share a day', async () => {
    const low = dailySnapshot({ day_id: 'low' });
    const high = revealSnapshot('this', 'that');
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, keyed(low, high));

    expect(await readSavedDailyDay(A, '2026-11-05')).toEqual(high);
  });

  it('drops an entry that fails the snapshot schema', async () => {
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, {
      bad: { ...dailySnapshot({ day_id: 'bad' }), state: 'revealed' },
      worse: 'not an object',
    });

    expect(await readSavedDailyDay(A, '2026-11-05')).toBeNull();
  });

  it('is null for a saved value that is not a map', async () => {
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, [dailySnapshot()]);

    expect(await readSavedDailyDay(A, '2026-11-05')).toBeNull();
  });

  it("does not read another account's copy", async () => {
    await writeLocalCopy(B, DAILY_DAYS_COPY_KIND, keyed(dailySnapshot()));

    expect(await readSavedDailyDay(A, '2026-11-05')).toBeNull();
  });
});

describe('withWaitingLock', () => {
  it('runs a second caller only after the first has finished, and returns each result', async () => {
    const order: string[] = [];
    let releaseFirst: () => void = () => {};
    const first = withWaitingLock('test:waiting', async () => {
      order.push('first:start');
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      order.push('first:end');
      return 1;
    });
    const second = withWaitingLock('test:waiting', async () => {
      order.push('second');
      return 2;
    });

    await vi.waitFor(() => expect(order).toEqual(['first:start']));
    releaseFirst();

    expect(await Promise.all([first, second])).toEqual([1, 2]);
    expect(order).toEqual(['first:start', 'first:end', 'second']);
  });

  it('a throwing holder does not block the next caller', async () => {
    const failing = withWaitingLock('test:throws', async () => {
      throw new Error('boom');
    });
    const next = withWaitingLock('test:throws', async () => 'after');

    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBe('after');
  });

  it('different names do not wait on each other', async () => {
    let releaseFirst: () => void = () => {};
    const first = withWaitingLock('test:name-a', () => new Promise<void>((r) => (releaseFirst = r)));

    await expect(withWaitingLock('test:name-b', async () => 'b')).resolves.toBe('b');
    releaseFirst();
    await first;
  });
});
