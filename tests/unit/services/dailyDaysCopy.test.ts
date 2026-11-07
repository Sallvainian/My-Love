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
  dailyStateRank,
  mergeDailyDay,
  mergeDailyDays,
  readSavedDailyDay,
  readSavedDailyHistory,
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
const keyed = (...snapshots: ReturnType<typeof dailySnapshot>[]) => keyedFor(null, ...snapshots);
/** The stored map: each snapshot with the partner it was read with. */
const keyedFor = (partnerId: string | null, ...snapshots: ReturnType<typeof dailySnapshot>[]) =>
  Object.fromEntries(
    snapshots.map((snapshot) => [snapshot.day_id, { ...snapshot, partner_id: partnerId }])
  );
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
    const result = await mergeDailyDay(A, ok(dailySnapshot()), null, current);

    expect(result).toEqual(ok(dailySnapshot()));
    expect(await savedMap()).toEqual(keyed(dailySnapshot()));
  });

  it('a higher state replaces the stored entry of the same day_id', async () => {
    await mergeDailyDay(A, ok(dailySnapshot()), null, current);

    const result = await mergeDailyDay(A, ok(waitingSnapshot('this')), null, current);

    expect(result).toEqual(ok(waitingSnapshot('this')));
    expect(await savedMap()).toEqual(keyed(waitingSnapshot('this')));
  });

  it('an equal state replaces the stored entry (the newer answer wins a tie)', async () => {
    await mergeDailyDay(A, ok(dailySnapshot({ state: 'partner' })), null, current);
    const later = dailySnapshot({ state: 'me', my_choice: 'that', my_picked_at: '2026-11-05T16:00:00.000Z' });

    await mergeDailyDay(A, ok(later), null, current);

    expect(await savedMap()).toEqual(keyed(later));
  });

  it.each([
    ['both', revealSnapshot('this', 'that'), waitingSnapshot('this')],
    ['both', revealSnapshot('this', 'that'), dailySnapshot()],
    ['me', waitingSnapshot('this'), dailySnapshot()],
  ])('a lower read does not move a stored %s entry back', async (_s, stored, late) => {
    await mergeDailyDay(A, ok(stored), null, current);

    const result = await mergeDailyDay(A, ok(late), null, current);

    expect(result).toEqual(ok(stored));
    expect(await savedMap()).toEqual(keyed(stored));
  });

  it('a late read with write.done false does not reopen a written turn', async () => {
    const written = writerSnapshot('this', { write: { mine: true, done: true } });
    await mergeDailyDay(A, ok(written), null, current);

    const result = await mergeDailyDay(A, ok(writerSnapshot('this')), null, current);

    expect(result).toEqual(ok(written));
    expect(await savedMap()).toEqual(keyed(written));
  });

  it('a higher state with write.done false keeps write.done true', async () => {
    const written = writerSnapshot('this', { write: { mine: true, done: true } });
    await mergeDailyDay(A, ok(written), null, current);

    const result = await mergeDailyDay(A, ok(revealSnapshot('this', 'that')), null, current);

    expect(result).toEqual(
      ok({ ...revealSnapshot('this', 'that'), write: { mine: false, done: true } })
    );
  });

  it('keeps other days when one is merged', async () => {
    const yesterday = forDay('2026-11-04', { state: 'both' });
    await mergeDailyDay(A, ok(yesterday), null, current);

    await mergeDailyDay(A, ok(dailySnapshot()), null, current);

    expect(await savedMap()).toEqual(keyed(yesterday, dailySnapshot()));
  });

  it('an unlinked answer writes an empty map and returns unlinked', async () => {
    await mergeDailyDay(A, ok(dailySnapshot()), null, current);

    const result = await mergeDailyDay(A, { status: 'unlinked' }, null, current);

    expect(result).toEqual({ status: 'unlinked' });
    expect(await savedMap()).toEqual({});
  });

  it('keeps every day: 40 distinct days put through the merge are all saved (no cap)', async () => {
    const days = Array.from({ length: 40 }, (_, i) =>
      forDay(new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10))
    );
    expect(new Set(days.map((snapshot) => snapshot.day)).size).toBe(40);

    await mergeDailyDays(A, days, 'C', current);
    await mergeDailyDay(A, ok(forDay('2026-11-05')), 'C', current);

    const saved = (await savedMap())!;
    expect(Object.keys(saved)).toHaveLength(41);
    expect(saved[days[0].day_id]).toMatchObject({ partner_id: 'C' });
    expect(saved[days[39].day_id]).toMatchObject({ partner_id: 'C' });
    expect(saved['id-2026-11-05']).toMatchObject({ partner_id: 'C' });
  });

  it('an ok answer drops the date\'s other day_ids and leaves other dates alone', async () => {
    const old = forDay('2026-11-05', { day_id: 'd-old' });
    const other = forDay('2026-11-04');
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, keyed(old, other));

    await mergeDailyDay(A, ok(forDay('2026-11-05', { day_id: 'd-new' })), null, current);

    expect(await savedMap()).toEqual(keyed(other, forDay('2026-11-05', { day_id: 'd-new' })));
  });

  it('tags the entry with the given partner, and the newest tag wins even over a kept higher state', async () => {
    const both = revealSnapshot('this', 'that');
    await mergeDailyDay(A, ok(both), 'B', current);
    expect(await savedMap()).toEqual(keyedFor('B', both));

    const result = await mergeDailyDay(A, ok(dailySnapshot()), 'C', current);

    expect(result).toEqual(ok(both));
    expect(await savedMap()).toEqual(keyedFor('C', both));
  });

  it('never hands partner_id back in the merged answer', async () => {
    const result = await mergeDailyDay(A, ok(dailySnapshot()), 'C', current);

    expect(result).toEqual(ok(dailySnapshot()));
    expect(result.status === 'ok' && 'partner_id' in result.snapshot).toBe(false);
  });

  it('writes nothing when isCurrent is false, and still returns the merged answer', async () => {
    const result = await mergeDailyDay(A, ok(dailySnapshot()), null, () => false);

    expect(result).toEqual(ok(dailySnapshot()));
    expect(await savedMap()).toBeNull();
  });

  it('writes nothing for an unlinked answer when isCurrent is false', async () => {
    await mergeDailyDay(A, ok(dailySnapshot()), null, current);

    await mergeDailyDay(A, { status: 'unlinked' }, null, () => false);

    expect(await savedMap()).toEqual(keyed(dailySnapshot()));
  });

  it('writes under the given account only', async () => {
    await mergeDailyDay(A, ok(dailySnapshot()), null, current);

    expect(await readLocalCopy(B, DAILY_DAYS_COPY_KIND)).toBeNull();
  });

  it('serialises two concurrent merges, so the higher one wins whatever the order', async () => {
    await Promise.all([
      mergeDailyDay(A, ok(waitingSnapshot('this')), null, current),
      mergeDailyDay(A, ok(revealSnapshot('this', 'that')), null, current),
    ]);
    expect((await savedMap())![dailySnapshot().day_id]).toMatchObject({ state: 'both' });

    await clearStores();
    await Promise.all([
      mergeDailyDay(A, ok(revealSnapshot('this', 'that')), null, current),
      mergeDailyDay(A, ok(waitingSnapshot('this')), null, current),
    ]);
    expect((await savedMap())![dailySnapshot().day_id]).toMatchObject({ state: 'both' });
  });

  it('concurrent merges of different days both land', async () => {
    const one = forDay('2026-11-03');
    const two = forDay('2026-11-04');

    await Promise.all([mergeDailyDay(A, ok(one), null, current), mergeDailyDay(A, ok(two), null, current)]);

    expect(await savedMap()).toEqual(keyed(one, two));
  });

  it('logs a failed write with its message and never throws', async () => {
    const failure = new Error('disk full');
    vi.spyOn(localCopy, 'writeLocalCopy').mockRejectedValue(failure);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(mergeDailyDay(A, ok(dailySnapshot()), null, current)).resolves.toEqual(
      ok(dailySnapshot())
    );

    expect(errorSpy).toHaveBeenCalledWith(
      '[DailyQuestion] Failed to save the daily days copy:',
      failure
    );
  });

  it('drops a malformed stored entry when it rewrites the map', async () => {
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, { broken: { day_id: 'broken' } });

    await mergeDailyDay(A, ok(dailySnapshot()), null, current);

    expect(await savedMap()).toEqual(keyed(dailySnapshot()));
  });
});

describe('readSavedDailyDay', () => {
  it('is null when nothing is saved', async () => {
    expect(await readSavedDailyDay(A, '2026-11-05', null)).toBeNull();
  });

  it('returns the entry whose day matches, and null for another date', async () => {
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, keyed(dailySnapshot(), forDay('2026-11-04')));

    expect(await readSavedDailyDay(A, '2026-11-05', null)).toEqual(dailySnapshot());
    expect(await readSavedDailyDay(A, '2026-11-04', null)).toEqual(forDay('2026-11-04'));
    expect(await readSavedDailyDay(A, '2026-11-06', null)).toBeNull();
  });

  it('returns the higher-ranked of two entries that share a day', async () => {
    const low = dailySnapshot({ day_id: 'low' });
    const high = revealSnapshot('this', 'that');
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, keyed(low, high));

    expect(await readSavedDailyDay(A, '2026-11-05', null)).toEqual(high);
  });

  it('drops an entry that fails the snapshot schema', async () => {
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, {
      bad: { ...dailySnapshot({ day_id: 'bad' }), state: 'revealed' },
      worse: 'not an object',
    });

    expect(await readSavedDailyDay(A, '2026-11-05', null)).toBeNull();
  });

  it('is null for a saved value that is not a map', async () => {
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, [dailySnapshot()]);

    expect(await readSavedDailyDay(A, '2026-11-05', null)).toBeNull();
  });

  it("does not read another account's copy", async () => {
    await writeLocalCopy(B, DAILY_DAYS_COPY_KIND, keyed(dailySnapshot()));

    expect(await readSavedDailyDay(A, '2026-11-05', null)).toBeNull();
  });
});

describe('readSavedDailyDay partner filter', () => {
  it('hides a day saved with another partner and shows the current partner\'s', async () => {
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, keyedFor('B', dailySnapshot()));

    expect(await readSavedDailyDay(A, '2026-11-05', 'C')).toBeNull();
    expect(await readSavedDailyDay(A, '2026-11-05', 'B')).toEqual(dailySnapshot());
  });

  it('reads an entry without partner_id as untagged: shown for null/undefined and for a partner', async () => {
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, { [dailySnapshot().day_id]: dailySnapshot() });

    expect(await readSavedDailyDay(A, '2026-11-05', 'C')).toEqual(dailySnapshot());
    expect(await readSavedDailyDay(A, '2026-11-05', null)).toEqual(dailySnapshot());
    expect(await readSavedDailyDay(A, '2026-11-05', undefined)).toEqual(dailySnapshot());
  });

  it('a legacy entry is re-tagged by the next merge', async () => {
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, { [dailySnapshot().day_id]: dailySnapshot() });

    await mergeDailyDay(A, ok(dailySnapshot()), 'C', current);

    expect(await savedMap()).toEqual(keyedFor('C', dailySnapshot()));
  });
});

describe('mergeDailyDays', () => {
  it('saves a page in one write, every entry tagged with the partner', async () => {
    const page = [forDay('2026-11-05', { state: 'both' }), forDay('2026-11-04', { state: 'both' }), forDay('2026-11-03', { state: 'both' })];
    const writeSpy = vi.spyOn(localCopy, 'writeLocalCopy');

    await mergeDailyDays(A, page, 'C', current);

    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(await savedMap()).toEqual(keyedFor('C', ...page));
  });

  it('writes nothing for an empty page', async () => {
    const writeSpy = vi.spyOn(localCopy, 'writeLocalCopy');

    await mergeDailyDays(A, [], 'C', current);

    expect(writeSpy).not.toHaveBeenCalled();
    expect(await savedMap()).toBeNull();
  });

  it('applies the rank rule and the date drop to each snapshot', async () => {
    const stored = revealSnapshot('this', 'that');
    const old = forDay('2026-11-04', { day_id: 'd-old' });
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, keyed(stored, old));
    const fresh = forDay('2026-11-04', { day_id: 'd-new', state: 'both' });

    await mergeDailyDays(A, [dailySnapshot(), fresh], 'C', current);

    expect(await savedMap()).toEqual(keyedFor('C', stored, fresh));
  });

  it('writes nothing when isCurrent is false', async () => {
    await mergeDailyDays(A, [dailySnapshot()], 'C', () => false);

    expect(await savedMap()).toBeNull();
  });

  it('logs a failed write and never throws', async () => {
    const failure = new Error('disk full');
    vi.spyOn(localCopy, 'writeLocalCopy').mockRejectedValue(failure);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(mergeDailyDays(A, [dailySnapshot()], 'C', current)).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      '[DailyQuestion] Failed to save the daily days copy:',
      failure
    );
  });
});

describe('readSavedDailyHistory', () => {
  const done = (day: string, overrides: Partial<ReturnType<typeof dailySnapshot>> = {}) =>
    forDay(day, { state: 'both', my_choice: 'this', partner_choice: 'that', ...overrides });

  it('is [] when nothing is saved', async () => {
    expect(await readSavedDailyHistory(A, 'C')).toEqual([]);
  });

  it('gives the partner\'s both days newest first, ties by day_id, without partner_id', async () => {
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, {
      ...keyedFor('C', done('2026-11-03'), done('2026-11-05'), done('2026-11-04', { day_id: 'z' }), done('2026-11-04', { day_id: 'a' })),
      ...keyedFor('B', done('2026-11-01')),
      ...keyedFor('C', forDay('2026-11-02', { state: 'me', my_choice: 'this' })),
    });

    const history = await readSavedDailyHistory(A, 'C');

    expect(history.map((row) => row.day_id)).toEqual(['id-2026-11-05', 'a', 'z', 'id-2026-11-03']);
    expect(history.every((row) => !('partner_id' in row))).toBe(true);
  });

  it('skips a both day with a missing choice', async () => {
    await writeLocalCopy(A, DAILY_DAYS_COPY_KIND, keyedFor('C', done('2026-11-05', { partner_choice: null })));

    expect(await readSavedDailyHistory(A, 'C')).toEqual([]);
  });

  it('is [] when the read fails', async () => {
    vi.spyOn(localCopy, 'readLocalCopy').mockResolvedValue(null);

    expect(await readSavedDailyHistory(A, 'C')).toEqual([]);
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
