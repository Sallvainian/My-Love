/**
 * The per-account love-note send queue (src/services/noteQueue.ts).
 *
 * Runs against fake-indexeddb through the real `openMyLoveDB`, so the store,
 * its `id` key and its by-user index are the ones dbSchema creates.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { openMyLoveDB } from '../../../src/services/dbSchema';
import {
  enqueueNote,
  listQueuedNotes,
  removeQueuedNote,
  setQueuedNoteFailed,
  type QueuedNote,
} from '../../../src/services/noteQueue';

const A = 'USER-A';
const B = 'USER-B';

function queued(id: string, overrides: Partial<QueuedNote> = {}): QueuedNote {
  return {
    id,
    userId: A,
    toUserId: B,
    content: `note ${id}`,
    createdAt: '2026-09-24T10:00:00.000Z',
    failed: false,
    ...overrides,
  };
}

async function clearQueue(): Promise<void> {
  const db = await openMyLoveDB();
  try {
    await db.clear('note-queue');
  } finally {
    db.close();
  }
}

describe('noteQueue', () => {
  beforeEach(async () => {
    await clearQueue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps an enqueued note as plain data under its account', async () => {
    await enqueueNote(queued('temp-1'));

    expect(await listQueuedNotes(A)).toEqual([queued('temp-1')]);
    expect(await listQueuedNotes(B)).toEqual([]);
  });

  it('lists oldest createdAt first, then by id', async () => {
    await enqueueNote(queued('temp-c', { createdAt: '2026-09-24T10:00:02.000Z' }));
    await enqueueNote(queued('temp-b', { createdAt: '2026-09-24T10:00:01.000Z' }));
    await enqueueNote(queued('temp-a', { createdAt: '2026-09-24T10:00:02.000Z' }));

    expect((await listQueuedNotes(A)).map((row) => row.id)).toEqual(['temp-b', 'temp-a', 'temp-c']);
  });

  it("lists only the given account's rows", async () => {
    await enqueueNote(queued('temp-a1'));
    await enqueueNote(queued('temp-b1', { userId: B, toUserId: A }));

    expect((await listQueuedNotes(A)).map((row) => row.id)).toEqual(['temp-a1']);
    expect((await listQueuedNotes(B)).map((row) => row.id)).toEqual(['temp-b1']);
  });

  it('sets and clears the failed mark, and reports a missing row', async () => {
    await enqueueNote(queued('temp-1'));

    await expect(setQueuedNoteFailed('temp-1', true)).resolves.toBe(true);
    expect((await listQueuedNotes(A))[0].failed).toBe(true);

    await expect(setQueuedNoteFailed('temp-1', false)).resolves.toBe(true);
    expect((await listQueuedNotes(A))[0].failed).toBe(false);

    await expect(setQueuedNoteFailed('temp-missing', true)).resolves.toBe(false);
    expect(await listQueuedNotes(A)).toHaveLength(1);
  });

  it('removes one row and treats an absent row as a no-op', async () => {
    await enqueueNote(queued('temp-1'));
    await enqueueNote(queued('temp-2'));

    await removeQueuedNote('temp-1');
    await removeQueuedNote('temp-absent');

    expect((await listQueuedNotes(A)).map((row) => row.id)).toEqual(['temp-2']);
  });

  it('answers [] when the read fails, and throws when a write fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('IDB-DOWN');
    const getAll = vi
      .spyOn(IDBIndex.prototype, 'getAll')
      .mockImplementation(() => {
        throw failure;
      });
    await expect(listQueuedNotes(A)).resolves.toEqual([]);
    getAll.mockRestore();

    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw failure;
    });
    await expect(enqueueNote(queued('temp-1'))).rejects.toThrow('IDB-DOWN');
  });
});
