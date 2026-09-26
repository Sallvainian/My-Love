/**
 * notesSlice — love-note text saved offline and sent later (story 9, CAP-3):
 * two tabs draining one queue under the Web Locks lock.
 *
 * Every text note goes into the per-account `note-queue` before it is sent and
 * shows at once as queued; `drainQueuedNotes` sends the queue in order under
 * one key per note. Runs against fake-indexeddb through the real queue and
 * local-copy services; only Supabase and the broadcast are faked, by
 * `notesSliceQueueFixture.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { enqueueNote, listQueuedNotes, removeQueuedNote } from '../../../src/services/noteQueue';
import {
  A,
  clearStores,
  copyIds,
  createTestStore,
  deferred,
  fakeFrom,
  queued,
  queuedIds,
  sendEphemeralBroadcast,
  server,
  serverRow,
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

/**
 * A same-origin Web Locks stand-in shared by every "tab" in a test:
 * `ifAvailable` answers null while the lock is held, and a plain request waits
 * for the holder to let go.
 */
function stubWebLocks() {
  const held = new Map<string, Promise<void>>();
  const fakeNavigator = Object.create(navigator) as Navigator;
  Object.defineProperty(fakeNavigator, 'onLine', { value: true });
  Object.defineProperty(fakeNavigator, 'locks', {
    value: {
      request: async (
        name: string,
        optionsOrFn: { ifAvailable?: boolean } | ((lock: object | null) => Promise<unknown>),
        maybeFn?: (lock: object | null) => Promise<unknown>
      ) => {
        const options = typeof optionsOrFn === 'function' ? {} : optionsOrFn;
        const fn = typeof optionsOrFn === 'function' ? optionsOrFn : maybeFn!;
        if (options.ifAvailable && held.has(name)) return fn(null);
        while (held.has(name)) await held.get(name);
        const release = deferred();
        held.set(name, release.promise);
        try {
          return await fn({ name });
        } finally {
          held.delete(name);
          release.resolve();
        }
      },
    },
  });
  vi.stubGlobal('navigator', fakeNavigator);
}

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

  it('two tabs draining at once: the lock lets one run, and each note is inserted once', async () => {
    stubWebLocks();
    const tab1 = createTestStore();
    await tab1.getState().sendNote('one');
    await tab1.getState().drainQueuedNotes();
    server.rows = [];
    server.upserts = 0;
    sendEphemeralBroadcast.mockClear();
    // Two queued rows, then both tabs drain together.
    await enqueueNote(queued('temp-x', 'x'));
    await enqueueNote(queued('temp-y', 'y', { createdAt: '2026-09-24T09:00:01.000Z' }));
    const tab2 = createTestStore();

    await Promise.all([tab1.getState().drainQueuedNotes(), tab2.getState().drainQueuedNotes()]);

    expect(server.rows.map((r) => r.content)).toEqual(['x', 'y']);
    expect(server.upserts).toBe(2);
    expect(await queuedIds()).toEqual([]);

    // Tab 1 holds the lock mid-insert; tab 2 sends online and loses the lock:
    // its note waits rather than showing "Sending..." that nothing does.
    const reply = deferred();
    server.outcomes = [{ hold: reply.promise }];
    await enqueueNote(queued('temp-z', 'z', { createdAt: '2026-09-24T09:00:02.000Z' }));
    const tab1Run = tab1.getState().drainQueuedNotes();
    await vi.waitFor(() => expect(server.upserts).toBe(3));

    await tab2.getState().sendNote('from tab2');
    // Tab 2's drain now waits for tab 1 to let go.
    const tab2Run = tab2.getState().drainQueuedNotes();

    await vi.waitFor(() =>
      expect(tab2.getState().notes.find((n) => n.content === 'from tab2')).toMatchObject({
        queued: true,
        sending: false,
      })
    );

    // Tab 1's run re-reads the shared queue and sends it, once.
    reply.resolve();
    await tab1Run;
    await tab2Run;
    expect(server.rows.map((r) => r.content)).toEqual(['x', 'y', 'z', 'from tab2']);
    expect(await queuedIds()).toEqual([]);
  });

  it('another tab sends this tab\'s waiting note: this tab confirms it once that drain ends', async () => {
    stubWebLocks();
    const tab1 = createTestStore();
    const tab2 = createTestStore();
    // Tab 1 holds the lock mid-insert of its own note.
    const reply = deferred();
    server.outcomes = [{ hold: reply.promise }];
    await tab1.getState().sendNote('from tab1');
    await vi.waitFor(() => expect(server.upserts).toBe(1));

    // Tab 2's drain loses the lock, so its note waits.
    await tab2.getState().sendNote('from tab2');
    await vi.waitFor(() =>
      expect(tab2.getState().notes[0]).toMatchObject({ content: 'from tab2', queued: true, sending: false })
    );

    // Tab 1 re-reads the shared queue, sends tab 2's note and deletes its row.
    reply.resolve();
    await tab1.getState().drainQueuedNotes();
    expect(server.rows.map((r) => r.content)).toEqual(['from tab1', 'from tab2']);
    expect(await queuedIds()).toEqual([]);
    expect(server.upserts).toBe(2);

    // No further trigger: tab 2 learns of it when tab 1's drain lets go.
    await vi.waitFor(() =>
      expect(tab2.getState().notes).toEqual([
        expect.objectContaining({ id: 'server-2', content: 'from tab2', sending: false, error: false }),
      ])
    );
    expect(tab2.getState().notes[0].queued).toBeUndefined();
    await tab2.getState().drainQueuedNotes();
    // Confirmed from the stored row, not sent a second time or broadcast by tab 2.
    expect(server.upserts).toBe(2);
    expect(sendEphemeralBroadcast).toHaveBeenCalledTimes(2);
    await vi.waitFor(async () => expect(await copyIds()).toContain('server-2'));
  });

  it('another tab sends this tab\'s waiting note and the server rejects it: this tab shows it failed, with Retry', async () => {
    stubWebLocks();
    const tab1 = createTestStore();
    const tab2 = createTestStore();
    // Tab 1 holds the lock mid-insert of its own note; tab 2's note is refused.
    const reply = deferred();
    server.outcomes = [{ hold: reply.promise }, { reject: '23514' }];
    await tab1.getState().sendNote('from tab1');
    await vi.waitFor(() => expect(server.upserts).toBe(1));

    // Tab 2's drain loses the lock, so its note waits.
    await tab2.getState().sendNote('from tab2');
    await vi.waitFor(() =>
      expect(tab2.getState().notes[0]).toMatchObject({ content: 'from tab2', queued: true, sending: false })
    );
    const key = tab2.getState().notes[0].tempId!;

    // Tab 1 re-reads the shared queue, sends tab 2's note, and it is rejected.
    reply.resolve();
    await tab1.getState().drainQueuedNotes();
    expect(server.rows.map((r) => r.content)).toEqual(['from tab1']);
    expect(await listQueuedNotes(A)).toEqual([expect.objectContaining({ id: key, failed: true })]);

    // No further trigger: tab 2 shows it failed once tab 1's drain lets go,
    // exactly as its own drain marks a rejection, and raises no banner.
    await vi.waitFor(() =>
      expect(tab2.getState().notes[0]).toMatchObject({
        tempId: key,
        queued: true,
        sending: false,
        error: true,
      })
    );
    expect(tab2.getState().notesError).toBeNull();
    await tab2.getState().drainQueuedNotes();
    expect(server.upserts).toBe(2);

    // Retry from tab 2 resends it under the same key.
    await tab2.getState().retryFailedMessage(key);
    expect(server.rows.map((r) => [r.content, r.idempotency_key])).toEqual([
      ['from tab1', expect.any(String)],
      ['from tab2', key],
    ]);
    expect(tab2.getState().notes[0]).toMatchObject({ id: 'server-2', error: false });
    expect(await queuedIds()).toEqual([]);
  });

  it('a note composed while this tab waits for another tab\'s drain shows waiting, not sending', async () => {
    stubWebLocks();
    const tab1 = createTestStore();
    const tab2 = createTestStore();
    // Tab 1 holds the lock mid-insert of its own note.
    const reply = deferred();
    server.outcomes = [{ hold: reply.promise }];
    await tab1.getState().sendNote('from tab1');
    await vi.waitFor(() => expect(server.upserts).toBe(1));

    // Tab 2's drain loses the lock and waits for tab 1 to let go.
    await tab2.getState().sendNote('first');
    await vi.waitFor(() =>
      expect(tab2.getState().notes[0]).toMatchObject({ content: 'first', queued: true, sending: false })
    );

    // A note composed during that wait joins it: nothing sends from tab 2 yet.
    await tab2.getState().sendNote('second');
    await vi.waitFor(() =>
      expect(tab2.getState().notes.find((n) => n.content === 'second')).toMatchObject({
        queued: true,
        sending: false,
      })
    );
    // Still only tab 1's insert has reached the server.
    expect(server.upserts).toBe(1);

    reply.resolve();
    await tab1.getState().drainQueuedNotes();
    await tab2.getState().drainQueuedNotes();
    expect(server.rows.map((r) => r.content)).toEqual(['from tab1', 'first', 'second']);
    expect(await queuedIds()).toEqual([]);
  });

  it('a later drain confirms a waiting note whose row another context already sent', async () => {
    const store = createTestStore();
    setOnline(false);
    await store.getState().sendNote('sent elsewhere');
    const key = store.getState().notes[0].tempId!;

    // Another tab of the same account sends it and deletes the row.
    server.rows.push(
      serverRow({
        id: 'server-9',
        content: 'sent elsewhere',
        idempotency_key: key,
        created_at: '2026-09-24T12:00:09.000000+00:00',
      })
    );
    await removeQueuedNote(key);

    setOnline(true);
    await store.getState().drainQueuedNotes();

    expect(store.getState().notes).toEqual([
      expect.objectContaining({ id: 'server-9', content: 'sent elsewhere', sending: false, error: false }),
    ]);
    expect(store.getState().notes[0].queued).toBeUndefined();
    expect(server.upserts).toBe(0);
  });

  it('a waiting note whose row is gone but was never stored stays waiting, not sent', async () => {
    const store = createTestStore();
    setOnline(false);
    await store.getState().sendNote('removed elsewhere');
    const key = store.getState().notes[0].tempId!;
    await removeQueuedNote(key);

    setOnline(true);
    await store.getState().drainQueuedNotes();

    expect(store.getState().notes).toEqual([
      expect.objectContaining({ id: key, content: 'removed elsewhere', queued: true, sending: false }),
    ]);
    expect(server.rows).toEqual([]);
  });
});
