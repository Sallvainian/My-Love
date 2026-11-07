/**
 * The per-account daily-question pick queue (src/services/pickQueue.ts).
 *
 * Runs against fake-indexeddb through the real `openMyLoveDB`, so the store,
 * its [user_id, day_id] key and its by-user index are the ones dbSchema creates.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { openMyLoveDB } from '../../../src/services/dbSchema';
import {
  enqueuePick,
  listQueuedPicks,
  markQueuedPickFailed,
  removeQueuedPick,
  type QueuedPick,
} from '../../../src/services/pickQueue';

const A = 'USER-A';
const B = 'USER-B';

function queued(dayId: string, overrides: Partial<QueuedPick> = {}): QueuedPick {
  return {
    user_id: A,
    day_id: dayId,
    choice: 'this',
    picked_at: '2026-11-05T23:50:00.000Z',
    time_zone: 'America/New_York',
    utc_offset_minutes: -300,
    failed: false,
    failure: null,
    ...overrides,
  };
}

async function clearQueue(): Promise<void> {
  const db = await openMyLoveDB();
  try {
    await db.clear('pick-queue');
  } finally {
    db.close();
  }
}

describe('pickQueue', () => {
  beforeEach(async () => {
    await clearQueue();
  });

  it('keeps an enqueued pick as plain data under its account', async () => {
    await enqueuePick(queued('DAY-1'));

    expect(await listQueuedPicks(A)).toEqual([queued('DAY-1')]);
    expect(await listQueuedPicks(B)).toEqual([]);
  });

  it('replaces the row of the same account and day', async () => {
    await enqueuePick(queued('DAY-1', { failed: true, failure: 'REFUSED' }));
    await enqueuePick(queued('DAY-1', { choice: 'that' }));

    expect(await listQueuedPicks(A)).toEqual([queued('DAY-1', { choice: 'that' })]);
  });

  it('lists oldest picked_at first, then by day_id', async () => {
    await enqueuePick(queued('DAY-c', { picked_at: '2026-11-05T10:00:02.000Z' }));
    await enqueuePick(queued('DAY-b', { picked_at: '2026-11-05T10:00:01.000Z' }));
    await enqueuePick(queued('DAY-a', { picked_at: '2026-11-05T10:00:02.000Z' }));

    expect((await listQueuedPicks(A)).map((row) => row.day_id)).toEqual(['DAY-b', 'DAY-a', 'DAY-c']);
  });

  it("lists only the given account's rows", async () => {
    await enqueuePick(queued('DAY-1'));
    await enqueuePick(queued('DAY-1', { user_id: B }));
    await enqueuePick(queued('DAY-2', { user_id: B }));

    expect((await listQueuedPicks(A)).map((row) => row.day_id)).toEqual(['DAY-1']);
    expect((await listQueuedPicks(B)).map((row) => row.day_id)).toEqual(['DAY-1', 'DAY-2']);
  });

  it('marks a row failed with its message, and reports a missing row', async () => {
    await enqueuePick(queued('DAY-1'));

    await expect(markQueuedPickFailed(A, 'DAY-1', 'REFUSED')).resolves.toBe(true);
    expect(await listQueuedPicks(A)).toEqual([queued('DAY-1', { failed: true, failure: 'REFUSED' })]);

    await expect(markQueuedPickFailed(A, 'DAY-missing', 'REFUSED')).resolves.toBe(false);
    await expect(markQueuedPickFailed(B, 'DAY-1', 'REFUSED')).resolves.toBe(false);
    expect(await listQueuedPicks(A)).toHaveLength(1);
  });

  it('removes one row and treats an absent row as a no-op', async () => {
    await enqueuePick(queued('DAY-1'));
    await enqueuePick(queued('DAY-2'));

    await removeQueuedPick(A, 'DAY-1');
    await removeQueuedPick(A, 'DAY-absent');
    await removeQueuedPick(B, 'DAY-2');

    expect((await listQueuedPicks(A)).map((row) => row.day_id)).toEqual(['DAY-2']);
  });

  it('answers [] with a logged error when the read fails, and throws when a write fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('IDB-DOWN');
    const getAll = vi.spyOn(IDBIndex.prototype, 'getAll').mockImplementation(() => {
      throw failure;
    });
    await expect(listQueuedPicks(A)).resolves.toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith('[pickQueue] Failed to read the pick queue:', failure);
    getAll.mockRestore();

    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw failure;
    });
    await expect(enqueuePick(queued('DAY-1'))).rejects.toThrow('IDB-DOWN');
  });
});
