/**
 * notesSlice — love-note text saved offline and sent later (story 9, CAP-3):
 * the timed retry after a transient failure while online.
 *
 * Every text note goes into the per-account `note-queue` before it is sent and
 * shows at once as queued; `drainQueuedNotes` sends the queue in order under
 * one key per note. Runs against fake-indexeddb through the real queue and
 * local-copy services; only Supabase and the broadcast are faked, by
 * `notesSliceQueueFixture.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  A,
  B,
  clearStores,
  createTestStore,
  deferred,
  fakeFrom,
  queued,
  queuedIds,
  sendEphemeralBroadcast,
  server,
  setOnline,
  signOutLiveStores,
  stubOnline,
  uploadCompressedBlob,
  type Store,
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

  describe('retry after a transient failure while online', () => {
    /** Yields to IndexedDB (setImmediate, not faked) until `cond` holds. */
    async function until(cond: () => boolean) {
      for (let i = 0; i < 1000 && !cond(); i++) {
        await new Promise((resolve) => setImmediate(resolve));
      }
      expect(cond()).toBe(true);
    }

    /** One note queued offline, then a single online pass that fails transiently. */
    async function failOnce(store: Store, failures: number) {
      server.outcomes = Array.from({ length: failures }, () => 'network' as const);
      setOnline(false);
      await store.getState().sendNote('retried');
      setOnline(true);
      await store.getState().drainQueuedNotes();
      expect(server.upserts).toBe(1);
      expect(vi.getTimerCount()).toBe(1);
    }

    /** The retry is due after exactly `delay` ms: not a millisecond before. */
    async function expectRetryAfter(delay: number, upserts: number) {
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(server.upserts).toBe(upserts - 1);
      await vi.advanceTimersByTimeAsync(1);
      await until(() => server.upserts === upserts);
    }

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    });

    it('a transient failure is retried after 5 s without any other trigger', async () => {
      const store = createTestStore();
      await failOnce(store, 1);

      await expectRetryAfter(5_000, 2);

      await until(() => store.getState().notes[0]?.id === 'server-1');
      expect(server.rows.map((r) => r.content)).toEqual(['retried']);
      expect(await queuedIds()).toEqual([]);
      // The completed pass leaves no timer behind.
      expect(vi.getTimerCount()).toBe(0);
    });

    it('backs off 5, 10, 20, 40, then every 60 s, and resets after a completed pass', async () => {
      const store = createTestStore();
      await failOnce(store, 7);

      // [delay before this attempt, upserts after it, timers left behind]: the
      // seventh failure schedules one more retry, and the eighth attempt lands.
      const schedule = [
        [5_000, 2, 1],
        [10_000, 3, 1],
        [20_000, 4, 1],
        [40_000, 5, 1],
        [60_000, 6, 1],
        [60_000, 7, 1],
        [60_000, 8, 0],
      ] as const;
      for (const [delay, upserts, timers] of schedule) {
        await expectRetryAfter(delay, upserts);
        await until(() => vi.getTimerCount() === timers);
      }
      await until(() => store.getState().notes[0]?.id === 'server-1');
      await until(() => vi.getTimerCount() === 0);

      // The next transient failure starts from 5 s again.
      server.upserts = 0;
      await failOnce(store, 1);
      await expectRetryAfter(5_000, 2);
    });

    it('keeps one timer at a time', async () => {
      const store = createTestStore();
      await failOnce(store, 3);

      server.outcomes = ['network'];
      await store.getState().drainQueuedNotes();
      expect(server.upserts).toBe(2);
      expect(vi.getTimerCount()).toBe(1);
    });

    it('does not schedule a retry when the device is known offline as the pass ends', async () => {
      const store = createTestStore();
      const reply = deferred();
      server.outcomes = [{ reject: '08006', hold: reply.promise }];
      setOnline(false);
      await store.getState().sendNote('dropped connection');
      setOnline(true);

      const run = store.getState().drainQueuedNotes();
      await until(() => server.upserts === 1);
      setOnline(false);
      reply.resolve();
      await run;

      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(120_000);
      expect(server.upserts).toBe(1);
    });

    it('a retry that finds the device offline stops and leaves the online event to drain', async () => {
      const store = createTestStore();
      await failOnce(store, 1);

      setOnline(false);
      await vi.advanceTimersByTimeAsync(5_000);
      await until(() => vi.getTimerCount() === 0);
      await vi.advanceTimersByTimeAsync(120_000);
      expect(server.upserts).toBe(1);
    });

    it('sign-out cancels the retry, so nothing is drained for anyone', async () => {
      const store = createTestStore();
      await failOnce(store, 1);

      store.setState({ userId: null, authSessionVersion: 2, notes: [] });

      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(120_000);
      expect(server.upserts).toBe(1);
      expect(await queuedIds()).toHaveLength(1);
    });

    it("an account switch cancels the retry: B's session never drains on A's timer", async () => {
      const store = createTestStore();
      await failOnce(store, 1);

      store.setState({ userId: B, authSessionVersion: 2, notes: [] });

      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(120_000);
      expect(server.upserts).toBe(1);
      expect(await queuedIds(A)).toHaveLength(1);
    });
  });
});
