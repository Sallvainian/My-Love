/**
 * notesSlice — love-note text saved offline and sent later (story 9, CAP-3):
 * account switches and stale sessions never send or show another account's
 * queue.
 *
 * Every text note goes into the per-account `note-queue` before it is sent and
 * shows at once as queued; `drainQueuedNotes` sends the queue in order under
 * one key per note. Runs against fake-indexeddb through the real queue and
 * local-copy services; only Supabase and the broadcast are faked, by
 * `notesSliceQueueFixture.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import type { LoveNote } from '../../../src/types/models';
import { writeLocalCopy } from '../../../src/services/localCopy';
import { enqueueNote, listQueuedNotes } from '../../../src/services/noteQueue';
import { LOVE_NOTES_COPY_KIND } from '../../../src/stores/slices/notesSlice';
import {
  A,
  B,
  clearStores,
  contents,
  copyIds,
  createTestStore,
  deferred,
  fakeFrom,
  PARTNER,
  queued,
  queuedIds,
  SAVED_COPY_ROW,
  sendEphemeralBroadcast,
  sendThreeOffline,
  server,
  setOnline,
  signOutLiveStores,
  stubOnline,
  uploadCompressedBlob,
} from './notesSliceQueueFixture';

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    from: (table: string) => fakeFrom(table),
  },
  getPartnerId: vi.fn(async () => (server.lookup.status === 'linked' ? server.lookup.partnerId : null)),
  lookupPartnerId: vi.fn(async () => server.lookup),
}));

vi.mock('../../../src/api/ephemeralBroadcast', () => ({
  sendEphemeralBroadcast: (topic: string, event: string, payload: unknown) =>
    sendEphemeralBroadcast(topic, event, payload),
}));

vi.mock('../../../src/services/loveNoteImageService', () => ({
  uploadCompressedBlob: (blob: Blob, userId: string) => uploadCompressedBlob(blob, userId),
  deleteLoveNoteImage: vi.fn(async () => undefined),
}));

/**
 * Every love-notes copy write, as the promise its caller got. The slice starts
 * some of them without awaiting (`void saveNotesCopy`), but always calls
 * `writeLocalCopy` synchronously, so a check that the copy was NOT written
 * awaits every recorded write before reading it back.
 */
const copyWrites = vi.hoisted(() => [] as Promise<unknown>[]);
vi.mock('../../../src/services/localCopy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/services/localCopy')>();
  return {
    ...actual,
    writeLocalCopy: (...args: Parameters<typeof actual.writeLocalCopy>) => {
      const write = actual.writeLocalCopy(...args);
      copyWrites.push(write);
      return write;
    },
  };
});

vi.mock('../../../src/services/imageCompressionService', () => ({
  imageCompressionService: {
    validateImageFile: vi.fn(() => ({ valid: true })),
    compressImage: vi.fn(async (file: Blob) => ({ blob: file, originalSize: 3, compressedSize: 3 })),
  },
}));

/** Wait for every copy write started so far, so a read-back sees them all. */
const copyWritesSettled = () => Promise.allSettled(copyWrites);

describe('notesSlice offline send queue', () => {
  beforeEach(async () => {
    await clearStores();
    copyWrites.length = 0;
    server.reset();
    vi.clearAllMocks();
    setOnline(true);
    stubOnline();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    sendEphemeralBroadcast.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // A transient failure leaves a retry timer; it must not drain the next
    // test's queue.
    signOutLiveStores();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('accounts and stale sessions', () => {
    it("account switch: B never sees or sends A's rows; they send when A signs back in", async () => {
      const store = createTestStore();
      await sendThreeOffline(store);

      // A signs out and B signs in, online.
      store.setState({ userId: B, authSessionVersion: 2, notes: [] });
      setOnline(true);
      await store.getState().fetchNotes();
      await store.getState().drainQueuedNotes();

      expect(contents(store)).toEqual([]);
      expect(server.upserts).toBe(0);
      expect(await queuedIds(A)).toHaveLength(3);

      store.setState({ userId: A, authSessionVersion: 3, notes: [] });
      await store.getState().drainQueuedNotes();

      expect(server.rows.map((r) => [r.from_user_id, r.content])).toEqual([
        [A, 'one'],
        [A, 'two'],
        [A, 'three'],
      ]);
      expect(await queuedIds(A)).toEqual([]);
    });

    /**
     * Holds a note's insert at the server while the same account signs out and
     * back in, then lets the insert land. Returns the new session's notes list.
     */
    async function insertAcrossSameAccountRelogin() {
      const store = createTestStore();
      const reply = deferred();
      server.outcomes = [{ hold: reply.promise }];
      await store.getState().sendNote('in flight');
      await vi.waitFor(() => expect(server.rows).toHaveLength(1));

      // The same account signs out and back in.
      const fresh: LoveNote[] = [];
      store.setState({ authSessionVersion: 2, notes: fresh });
      reply.resolve();
      await store.getState().drainQueuedNotes();
      return { store, fresh };
    }

    it("a session change during the insert writes nothing into the new session's notes", async () => {
      const { store, fresh } = await insertAcrossSameAccountRelogin();

      expect(store.getState().notes).toBe(fresh);
    });

    it('a session change during the insert still removes the sent row from the queue', async () => {
      await insertAcrossSameAccountRelogin();

      expect(await queuedIds()).toEqual([]);
    });

    it('a session change during the insert still broadcasts for the same account', async () => {
      await insertAcrossSameAccountRelogin();

      expect(sendEphemeralBroadcast).toHaveBeenCalledWith(`love-notes:${PARTNER}`, 'new_message', {
        message: expect.objectContaining({ content: 'in flight' }),
      });
    });

    it('a different account during the insert: no state write and no broadcast', async () => {
      const store = createTestStore();
      const reply = deferred();
      server.outcomes = [{ hold: reply.promise }];
      await store.getState().sendNote('in flight');
      await vi.waitFor(() => expect(server.rows).toHaveLength(1));

      const fresh: LoveNote[] = [];
      store.setState({ userId: B, authSessionVersion: 2, notes: fresh });
      reply.resolve();
      await store.getState().drainQueuedNotes();

      expect(store.getState().notes).toBe(fresh);
      expect(await queuedIds()).toEqual([]);
      expect(sendEphemeralBroadcast).not.toHaveBeenCalled();
    });

    it('a stale rejection marks the row failed but writes no state or banner', async () => {
      const store = createTestStore();
      const reply = deferred();
      server.outcomes = [{ reject: '23514', hold: reply.promise }];
      await store.getState().sendNote('refused later');
      await vi.waitFor(() => expect(server.upserts).toBe(1));

      const fresh: LoveNote[] = [];
      store.setState({ authSessionVersion: 2, notes: fresh, notesError: null });
      reply.resolve();
      await store.getState().drainQueuedNotes();

      expect(store.getState().notes).toBe(fresh);
      expect(store.getState().notesError).toBeNull();
      expect(await listQueuedNotes(A)).toEqual([
        expect.objectContaining({ content: 'refused later', failed: true }),
      ]);
    });

    it('a stale session sends nothing more: the drain re-checks before each insert', async () => {
      const store = createTestStore();
      await sendThreeOffline(store);
      setOnline(true);
      const reply = deferred();
      server.outcomes = [{ hold: reply.promise }];

      const run = store.getState().drainQueuedNotes();
      await vi.waitFor(() => expect(server.upserts).toBe(1));
      store.setState({ authSessionVersion: 2 });
      reply.resolve();
      await run;

      // The first was committed and leaves the queue; the rest wait for their
      // owner's next session.
      expect(server.upserts).toBe(1);
      expect((await listQueuedNotes(A)).map((row) => row.content)).toEqual(['two', 'three']);
    });

    it('a drain before the thread is loaded does not write the copy', async () => {
      await writeLocalCopy(A, LOVE_NOTES_COPY_KIND, [SAVED_COPY_ROW]);
      await enqueueNote(queued('temp-q', 'queued'));
      const store = createTestStore();

      await store.getState().drainQueuedNotes();
      // A copy write the drain started would be recorded by now; let it land.
      await copyWritesSettled();

      expect(server.rows.map((r) => r.content)).toEqual(['queued']);
      expect(await copyIds()).toEqual(['saved-1']);
    });
  });
});
