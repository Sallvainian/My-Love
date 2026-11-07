/**
 * The `daily-write-declined` local copy (src/services/dailyWriteDeclined.ts)
 * and the waiting lock its adds run under (src/services/syncLock.ts).
 *
 * Runs against fake-indexeddb through the real `openMyLoveDB`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  DAILY_WRITE_DECLINED_KIND,
  MAX_DECLINED_WRITE_DAYS,
  addDeclinedWriteDay,
  readDeclinedWriteDays,
} from '../../../src/services/dailyWriteDeclined';
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

describe('readDeclinedWriteDays', () => {
  it('is [] when nothing is saved', async () => {
    await expect(readDeclinedWriteDays(A)).resolves.toEqual([]);
  });

  it('reads the saved ids', async () => {
    await writeLocalCopy(A, DAILY_WRITE_DECLINED_KIND, ['d1', 'd2']);

    await expect(readDeclinedWriteDays(A)).resolves.toEqual(['d1', 'd2']);
  });

  it('is [] when the saved value is not an array', async () => {
    await writeLocalCopy(A, DAILY_WRITE_DECLINED_KIND, { d1: true });

    await expect(readDeclinedWriteDays(A)).resolves.toEqual([]);
  });

  it('drops entries that are not strings', async () => {
    await writeLocalCopy(A, DAILY_WRITE_DECLINED_KIND, ['d1', 7, null, 'd2']);

    await expect(readDeclinedWriteDays(A)).resolves.toEqual(['d1', 'd2']);
  });

  it('is [] when the read fails', async () => {
    vi.spyOn(localCopy, 'readLocalCopy').mockResolvedValue(null);

    await expect(readDeclinedWriteDays(A)).resolves.toEqual([]);
  });

  it("keeps one account's ids from another", async () => {
    await writeLocalCopy(B, DAILY_WRITE_DECLINED_KIND, ['b-day']);

    await expect(readDeclinedWriteDays(A)).resolves.toEqual([]);
  });
});

describe('addDeclinedWriteDay', () => {
  it('saves the id and returns the list', async () => {
    await expect(addDeclinedWriteDay(A, 'd1', current)).resolves.toEqual(['d1']);

    expect(await readLocalCopy<string[]>(A, DAILY_WRITE_DECLINED_KIND)).toEqual(['d1']);
  });

  it('dedupes: adding the same id again keeps one', async () => {
    await addDeclinedWriteDay(A, 'd1', current);
    await addDeclinedWriteDay(A, 'd2', current);
    await addDeclinedWriteDay(A, 'd1', current);

    expect(await readDeclinedWriteDays(A)).toEqual(['d2', 'd1']);
  });

  it('keeps the newest 31 ids', async () => {
    for (let i = 0; i < MAX_DECLINED_WRITE_DAYS + 3; i++) {
      await addDeclinedWriteDay(A, `d${i}`, current);
    }

    const saved = await readDeclinedWriteDays(A);
    expect(saved).toHaveLength(31);
    expect(saved[0]).toBe('d3');
    expect(saved.at(-1)).toBe(`d${MAX_DECLINED_WRITE_DAYS + 2}`);
  });

  it('starts over from [] when the saved value is unreadable', async () => {
    await writeLocalCopy(A, DAILY_WRITE_DECLINED_KIND, 'garbage');

    await expect(addDeclinedWriteDay(A, 'd1', current)).resolves.toEqual(['d1']);
  });

  it('keeps every id of concurrent adds', async () => {
    await Promise.all(
      ['d1', 'd2', 'd3', 'd4'].map((id) => addDeclinedWriteDay(A, id, current))
    );

    expect([...(await readDeclinedWriteDays(A))].sort()).toEqual(['d1', 'd2', 'd3', 'd4']);
  });

  it('writes nothing once the session is not current, and returns the list it read', async () => {
    await writeLocalCopy(A, DAILY_WRITE_DECLINED_KIND, ['d1']);

    await expect(addDeclinedWriteDay(A, 'd2', () => false)).resolves.toEqual(['d1']);

    expect(await readDeclinedWriteDays(A)).toEqual(['d1']);
  });

  it('does not recreate the kind that sign-out deleted', async () => {
    await expect(addDeclinedWriteDay(A, 'd1', () => false)).resolves.toEqual([]);

    expect(await readLocalCopy(A, DAILY_WRITE_DECLINED_KIND)).toBeNull();
  });

  it('throws when the write fails', async () => {
    const failure = new Error('disk full');
    vi.spyOn(localCopy, 'writeLocalCopy').mockRejectedValue(failure);

    await expect(addDeclinedWriteDay(A, 'd1', current)).rejects.toBe(failure);
  });

  it('does not wedge the lock after a failed write', async () => {
    const write = vi.spyOn(localCopy, 'writeLocalCopy').mockRejectedValueOnce(new Error('nope'));
    await expect(addDeclinedWriteDay(A, 'd1', current)).rejects.toThrow('nope');
    write.mockRestore();

    await expect(addDeclinedWriteDay(A, 'd2', current)).resolves.toEqual(['d2']);
  });

  it("is deleted with the account's other copies on sign-out", async () => {
    await addDeclinedWriteDay(A, 'd1', current);
    await addDeclinedWriteDay(B, 'b1', current);

    await deleteAccountCopies(A);

    expect(await readDeclinedWriteDays(A)).toEqual([]);
    expect(await readDeclinedWriteDays(B)).toEqual(['b1']);
  });
});
