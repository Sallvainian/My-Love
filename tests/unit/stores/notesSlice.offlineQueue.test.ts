/**
 * notesSlice — love-note text saved offline and sent later (story 9, CAP-3)
 *
 * Every text note goes into the per-account `note-queue` before it is sent and
 * shows at once as queued; `drainQueuedNotes` sends the queue in order under
 * one key per note. Runs against fake-indexeddb through the real queue and
 * local-copy services; only Supabase and the broadcast are faked. The fake
 * models the `(from_user_id, idempotency_key)` unique constraint and ON
 * CONFLICT DO NOTHING, so "how many rows exist" is an observable outcome.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { create, type StateCreator } from 'zustand';
import type { LoveNote } from '../../../src/types/models';

const A = 'USER-A-ID';
const PARTNER = 'PARTNER-ID';
const B = 'USER-B-ID';
const FRIENDLY_CHECK = 'Some values are not allowed - check length and format limits';

interface Row {
  id: string;
  from_user_id: string;
  to_user_id: string;
  content: string;
  image_url: string | null;
  idempotency_key: string;
  created_at: string;
  written_at?: string | null;
}

type Outcome =
  | 'ok'
  /** Commit the row, then lose the reply. */
  | 'lose'
  /** Never reach the server: nothing is committed. */
  | 'network'
  | { reject: string; hold?: Promise<void> }
  /** Commit, then hold the reply until released. */
  | { hold: Promise<void> };

const server = {
  rows: [] as Row[],
  seq: 0,
  /** One outcome per upsert, in order; 'ok' once exhausted. */
  outcomes: [] as Outcome[],
  upserts: 0,
  lookup: { status: 'linked', partnerId: PARTNER } as
    | { status: 'linked'; partnerId: string }
    | { status: 'unlinked' }
    | { status: 'error'; reason: string; offline?: true },
  readError: null as { message: string } | null,
  /** Every table a request went to, in order. */
  requests: [] as string[],
  reset() {
    this.requests = [];
    this.rows = [];
    this.seq = 0;
    this.outcomes = [];
    this.upserts = 0;
    this.lookup = { status: 'linked', partnerId: PARTNER };
    this.readError = null;
  },
};

function readBuilder() {
  const api = {
    select: () => api,
    or: () => api,
    order: () => api,
    lt: () => api,
    limit: () => api,
    then(onFulfilled: (r: { data: Row[] | null; error: unknown }) => unknown, onRejected?: (e: unknown) => unknown) {
      const answer = server.readError
        ? { data: null, error: server.readError }
        : { data: [...server.rows].reverse(), error: null };
      return Promise.resolve(answer).then(onFulfilled, onRejected);
    },
  };
  return api;
}

function notesBuilder() {
  const filters: Array<[string, unknown]> = [];
  let payload: Omit<Row, 'id' | 'created_at'> | null = null;
  const find = () =>
    server.rows.find((r) => filters.every(([col, v]) => (r as unknown as Record<string, unknown>)[col] === v));
  const api = {
    upsert(values: Omit<Row, 'id' | 'created_at'>, options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
      if (options?.onConflict !== 'from_user_id,idempotency_key' || !options.ignoreDuplicates) {
        throw new Error('unexpected upsert options');
      }
      payload = values;
      return api;
    },
    select: () => api,
    eq(col: string, value: unknown) {
      filters.push([col, value]);
      return api;
    },
    async maybeSingle() {
      if (!payload) return { data: find() ?? null, error: null };
      server.upserts += 1;
      const outcome = server.outcomes.shift() ?? 'ok';
      if (outcome === 'network') {
        return { data: null, error: { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' } };
      }
      if (typeof outcome === 'object' && 'reject' in outcome) {
        if (outcome.hold) await outcome.hold;
        return { data: null, error: { code: outcome.reject, message: 'rejected', details: 'raw', hint: '' } };
      }
      const p = payload;
      const clash = server.rows.find(
        (r) => r.from_user_id === p.from_user_id && r.idempotency_key === p.idempotency_key
      );
      let inserted: Row | null = null;
      if (!clash) {
        server.seq += 1;
        inserted = {
          ...p,
          id: `server-${server.seq}`,
          created_at: `2026-09-24T12:00:${String(server.seq).padStart(2, '0')}.000000+00:00`,
        };
        server.rows.push(inserted);
      }
      if (outcome === 'lose') return { data: null, error: { message: 'network error' } };
      if (typeof outcome === 'object' && 'hold' in outcome) await outcome.hold;
      return { data: inserted ? { ...inserted } : null, error: null };
    },
    async single() {
      const match = find();
      if (!match) return { data: null, error: { code: 'PGRST116', message: 'No rows found', details: '', hint: '' } };
      return { data: { ...match }, error: null };
    },
  };
  return api;
}

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      server.requests.push(table);
      if (table === 'love_notes_visible') return readBuilder();
      if (table === 'love_notes') return notesBuilder();
      throw new Error(`unmodelled table ${table}`);
    },
  },
  getPartnerId: vi.fn(async () => (server.lookup.status === 'linked' ? server.lookup.partnerId : null)),
  lookupPartnerId: vi.fn(async () => server.lookup),
}));

const sendEphemeralBroadcast = vi.fn();
vi.mock('../../../src/api/ephemeralBroadcast', () => ({
  sendEphemeralBroadcast: (topic: string, event: string, payload: unknown) =>
    sendEphemeralBroadcast(topic, event, payload),
}));

const uploadCompressedBlob = vi.fn();
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

import { getPartnerId, lookupPartnerId } from '../../../src/api/supabaseClient';
import { openMyLoveDB } from '../../../src/services/dbSchema';
import { readLocalCopy, writeLocalCopy } from '../../../src/services/localCopy';
import { enqueueNote, listQueuedNotes, removeQueuedNote } from '../../../src/services/noteQueue';
import {
  createNotesSlice,
  IMAGE_NOTE_NEEDS_CONNECTION,
  LOVE_NOTES_COPY_KIND,
  NoteRefusedOfflineError,
  type NotesSlice,
} from '../../../src/stores/slices/notesSlice';

type TestStore = NotesSlice & {
  userId: string | null;
  authSessionVersion: number;
  partner: { id: string } | null;
};

/** Every store a test made; signed out after it, which cancels any retry timer. */
const liveStores: Array<{ setState: (partial: Partial<TestStore>) => void; getState: () => TestStore }> = [];

function createTestStore(options: { partnerLoaded?: boolean; userId?: string } = {}) {
  const store = create<TestStore>()(createNotesSlice as unknown as StateCreator<TestStore>);
  store.setState({
    userId: options.userId ?? A,
    authSessionVersion: 1,
    partner: options.partnerLoaded === false ? null : { id: PARTNER },
  });
  liveStores.push(store);
  return store;
}
type Store = ReturnType<typeof createTestStore>;

let online = true;
function setOnline(value: boolean) {
  online = value;
}

/** The ids in the account's saved love-notes copy. */
const copyIds = async (userId = A) =>
  (await readLocalCopy<{ id: string }[]>(userId, LOVE_NOTES_COPY_KIND))?.map((n) => n.id);

/** Wait for every copy write started so far, so a read-back sees them all. */
const copyWritesSettled = () => Promise.allSettled(copyWrites);

function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

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

const contents = (store: Store) => store.getState().notes.map((n) => n.content);
const queuedIds = async (userId = A) => (await listQueuedNotes(userId)).map((row) => row.id);

async function clearStores() {
  const db = await openMyLoveDB();
  try {
    await db.clear('note-queue');
    await db.clear('local-copies');
  } finally {
    db.close();
  }
}

/** Send three notes while offline; each is queued and none is sent. */
async function sendThreeOffline(store: Store) {
  setOnline(false);
  await store.getState().sendNote('one');
  await store.getState().sendNote('two');
  await store.getState().sendNote('three');
  await store.getState().drainQueuedNotes();
}

describe('notesSlice offline send queue', () => {
  beforeEach(async () => {
    await clearStores();
    copyWrites.length = 0;
    server.reset();
    vi.clearAllMocks();
    setOnline(true);
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    sendEphemeralBroadcast.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // A transient failure leaves a retry timer; it must not drain the next
    // test's queue.
    for (const store of liveStores.splice(0)) {
      store.setState({ userId: null, authSessionVersion: store.getState().authSessionVersion + 1 });
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('offline: three notes show at once, in order, waiting to send, and nothing is sent', async () => {
    const store = createTestStore();

    await sendThreeOffline(store);

    expect(contents(store)).toEqual(['one', 'two', 'three']);
    for (const note of store.getState().notes) {
      expect(note).toMatchObject({ queued: true, sending: false, to_user_id: PARTNER });
      expect(note.error).toBeFalsy();
    }
    expect(server.upserts).toBe(0);
    expect(await queuedIds()).toEqual(store.getState().notes.map((n) => n.tempId));
  });

  it('reconnect: the queue is sent in order, each once, into state and copy, and each is broadcast', async () => {
    const store = createTestStore();
    await sendThreeOffline(store);
    const keys = store.getState().notes.map((n) => n.tempId);

    setOnline(true);
    await store.getState().drainQueuedNotes();

    expect(server.rows.map((r) => [r.content, r.idempotency_key])).toEqual([
      ['one', keys[0]],
      ['two', keys[1]],
      ['three', keys[2]],
    ]);
    expect(server.upserts).toBe(3);
    expect(store.getState().notes.map((n) => n.id)).toEqual(['server-1', 'server-2', 'server-3']);
    expect(store.getState().notes.every((n) => !n.queued && !n.sending && !n.error)).toBe(true);
    // The drain saves the copy without awaiting it.
    await vi.waitFor(async () => expect(await copyIds()).toEqual(['server-1', 'server-2', 'server-3']));
    expect(await queuedIds()).toEqual([]);
    expect(sendEphemeralBroadcast.mock.calls.map(([topic, , payload]) => [
      topic,
      (payload as { message: Row }).message.content,
    ])).toEqual([
      [`love-notes:${PARTNER}`, 'one'],
      [`love-notes:${PARTNER}`, 'two'],
      [`love-notes:${PARTNER}`, 'three'],
    ]);
  });

  it('a queued note is sent with its composition time as written_at, and keeps it in state and copy', async () => {
    const store = createTestStore();
    setOnline(false);
    await store.getState().sendNote('written offline');
    const composedAt = (await listQueuedNotes(A))[0].createdAt;
    expect(store.getState().notes[0].created_at).toBe(composedAt);

    setOnline(true);
    await store.getState().drainQueuedNotes();

    expect(server.rows).toEqual([expect.objectContaining({ content: 'written offline', written_at: composedAt })]);
    // created_at stays the server's delivery time.
    expect(store.getState().notes[0]).toMatchObject({
      id: 'server-1',
      created_at: server.rows[0].created_at,
      written_at: composedAt,
    });
    // The drain saves the copy without awaiting it.
    await vi.waitFor(async () => {
      const copy = await readLocalCopy<Array<{ id: string; written_at?: string | null }>>(A, LOVE_NOTES_COPY_KIND);
      expect(copy).toEqual([expect.objectContaining({ id: 'server-1', written_at: composedAt })]);
    });

    // A reload reads it back from the copy.
    const reloaded = createTestStore();
    server.lookup = { status: 'error', reason: 'TypeError: Failed to fetch' };
    await reloaded.getState().fetchNotes();
    expect(reloaded.getState().notes[0]).toMatchObject({ id: 'server-1', written_at: composedAt });
  });

  it('reconnect: a network failure stops the run and leaves the rest pending', async () => {
    const store = createTestStore();
    await sendThreeOffline(store);
    setOnline(true);
    server.outcomes = ['ok', 'network'];

    await store.getState().drainQueuedNotes();

    expect(server.rows.map((r) => r.content)).toEqual(['one']);
    // The third was never tried: order is kept.
    expect(server.upserts).toBe(2);
    const [, second, third] = store.getState().notes;
    expect(second).toMatchObject({ content: 'two', queued: true, sending: false });
    expect(second.error).toBeFalsy();
    expect(third).toMatchObject({ content: 'three', queued: true });
    expect(await queuedIds()).toEqual([second.tempId, third.tempId]);

    // The next trigger sends them.
    await store.getState().drainQueuedNotes();
    expect(server.rows.map((r) => r.content)).toEqual(['one', 'two', 'three']);
  });

  it('reload while queued: the notes show pending after the saved thread, even with no server answer', async () => {
    await writeLocalCopy(A, LOVE_NOTES_COPY_KIND, [
      {
        id: 'saved-1',
        from_user_id: PARTNER,
        to_user_id: A,
        content: 'saved',
        created_at: '2026-09-20T10:00:00.000000+00:00',
        image_url: null,
      },
    ]);
    const before = createTestStore();
    await sendThreeOffline(before);

    // A reload: a new store, offline, the server unreachable.
    const store = createTestStore();
    server.lookup = { status: 'error', reason: 'TypeError: Failed to fetch' };
    await store.getState().fetchNotes();

    expect(contents(store)).toEqual(['saved', 'one', 'two', 'three']);
    expect(store.getState().notes.slice(1).every((n) => n.queued && !n.sending && !n.error)).toBe(true);
    expect(store.getState().notesError).toBeNull();
    // Queued notes never go in the copy: every write either store started has
    // landed, and the copy still holds only the saved row.
    await copyWritesSettled();
    expect(await copyIds()).toEqual(['saved-1']);
  });

  it('fetchNotes skips a queued row already on screen or already in the server page', async () => {
    const store = createTestStore();
    setOnline(false);
    await store.getState().sendNote('on screen');
    // A row committed elsewhere (another tab) whose queue row is still here.
    await enqueueNote({
      id: 'temp-committed',
      userId: A,
      toUserId: PARTNER,
      content: 'committed',
      createdAt: '2026-09-24T09:00:00.000Z',
      failed: false,
    });
    server.rows.push({
      id: 'server-99',
      from_user_id: A,
      to_user_id: PARTNER,
      content: 'committed',
      image_url: null,
      idempotency_key: 'temp-committed',
      created_at: '2026-09-24T09:00:00.000000+00:00',
    });

    // Back online for the read: a known-offline load sends no request.
    setOnline(true);
    await store.getState().fetchNotes();

    expect(contents(store)).toEqual(['committed', 'on screen']);
    expect(store.getState().notes[0].id).toBe('server-99');
  });

  it('two overlapping drains after a reload insert each note once', async () => {
    const before = createTestStore();
    await sendThreeOffline(before);

    const store = createTestStore();
    await store.getState().fetchNotes();
    setOnline(true);
    await Promise.all([store.getState().drainQueuedNotes(), store.getState().drainQueuedNotes()]);

    expect(server.rows.map((r) => r.content)).toEqual(['one', 'two', 'three']);
    expect(server.upserts).toBe(3);
    expect(sendEphemeralBroadcast).toHaveBeenCalledTimes(3);
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
    await enqueueNote({ id: 'temp-x', userId: A, toUserId: PARTNER, content: 'x', createdAt: '2026-09-24T09:00:00.000Z', failed: false });
    await enqueueNote({ id: 'temp-y', userId: A, toUserId: PARTNER, content: 'y', createdAt: '2026-09-24T09:00:01.000Z', failed: false });
    const tab2 = createTestStore();

    await Promise.all([tab1.getState().drainQueuedNotes(), tab2.getState().drainQueuedNotes()]);

    expect(server.rows.map((r) => r.content)).toEqual(['x', 'y']);
    expect(server.upserts).toBe(2);
    expect(await queuedIds()).toEqual([]);

    // Tab 1 holds the lock mid-insert; tab 2 sends online and loses the lock:
    // its note waits rather than showing "Sending..." that nothing does.
    const reply = deferred();
    server.outcomes = [{ hold: reply.promise }];
    await enqueueNote({ id: 'temp-z', userId: A, toUserId: PARTNER, content: 'z', createdAt: '2026-09-24T09:00:02.000Z', failed: false });
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
    server.rows.push({
      id: 'server-9',
      from_user_id: A,
      to_user_id: PARTNER,
      content: 'sent elsewhere',
      image_url: null,
      idempotency_key: key,
      created_at: '2026-09-24T12:00:09.000000+00:00',
    });
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

  it('online: when the head note fails transiently, a later note on screen ends waiting, not sending', async () => {
    const store = createTestStore();
    server.outcomes = ['network', 'network', 'network'];

    await store.getState().sendNote('head');
    await store.getState().sendNote('later');
    await store.getState().drainQueuedNotes();

    expect(server.rows).toEqual([]);
    const [head, later] = store.getState().notes;
    expect(head).toMatchObject({ content: 'head', queued: true, sending: false });
    expect(later).toMatchObject({ content: 'later', queued: true, sending: false });
    expect(later.error).toBeFalsy();
  });

  it('lost response: the resend under the same key resolves to the stored row, no duplicate', async () => {
    const store = createTestStore();
    await sendThreeOffline(store);
    setOnline(true);
    server.outcomes = ['lose'];

    // First pass: 'one' commits but its reply is lost, so the run stops.
    const run = store.getState().drainQueuedNotes();
    await run;
    expect(server.rows.map((r) => r.content)).toEqual(['one']);
    expect(store.getState().notes[0]).toMatchObject({ queued: true, sending: false });

    await store.getState().drainQueuedNotes();

    expect(server.rows.map((r) => r.content)).toEqual(['one', 'two', 'three']);
    expect(store.getState().notes.map((n) => n.id)).toEqual(['server-1', 'server-2', 'server-3']);
  });

  it('server rejection: the note is marked failed with the banner, later notes still send, and Retry resends under the same key', async () => {
    const store = createTestStore();
    await sendThreeOffline(store);
    const failedKey = store.getState().notes[0].tempId!;
    setOnline(true);
    server.outcomes = [{ reject: '23514' }];

    await store.getState().drainQueuedNotes();

    expect(server.rows.map((r) => r.content)).toEqual(['two', 'three']);
    expect(store.getState().notes[0]).toMatchObject({ tempId: failedKey, error: true, sending: false, queued: true });
    expect(store.getState().notesError).toBe(FRIENDLY_CHECK);
    expect(await listQueuedNotes(A)).toEqual([expect.objectContaining({ id: failedKey, failed: true })]);

    // A later trigger does not resend a failed note.
    await store.getState().drainQueuedNotes();
    expect(server.upserts).toBe(3);

    await store.getState().retryFailedMessage(failedKey);

    expect(server.rows.map((r) => [r.content, r.idempotency_key])).toContainEqual(['one', failedKey]);
    expect(server.rows).toHaveLength(3);
    expect(store.getState().notesError).toBeNull();
    expect(store.getState().notes.every((n) => !n.error && !n.queued)).toBe(true);
    expect(await queuedIds()).toEqual([]);
  });

  it('a PGRST error is not a rejection: the note stays pending', async () => {
    const store = createTestStore();
    server.outcomes = [{ reject: 'PGRST301' }];
    setOnline(false);
    await store.getState().sendNote('expired token');
    setOnline(true);

    await store.getState().drainQueuedNotes();

    expect(store.getState().notes[0]).toMatchObject({ queued: true, sending: false });
    expect(store.getState().notes[0].error).toBeFalsy();
    expect(await listQueuedNotes(A)).toEqual([expect.objectContaining({ failed: false })]);
  });

  it.each([
    ['08006', 'connection failure'],
    ['40001', 'serialization failure'],
    ['53300', 'too many connections'],
    ['57014', 'statement timeout'],
    ['55P03', 'lock not available'],
  ])('a transient SQLSTATE %s (%s) is not a rejection: the note stays pending', async (code) => {
    const store = createTestStore();
    server.outcomes = [{ reject: code }];
    setOnline(false);
    await store.getState().sendNote('try again later');
    setOnline(true);

    await store.getState().drainQueuedNotes();

    expect(store.getState().notes[0]).toMatchObject({ queued: true, sending: false });
    expect(store.getState().notes[0].error).toBeFalsy();
    expect(store.getState().notesError).toBeNull();
    expect(await listQueuedNotes(A)).toEqual([expect.objectContaining({ failed: false })]);
  });

  it('retry of a rejected queued note whose row is gone queues it again under the same key', async () => {
    const store = createTestStore();
    server.outcomes = [{ reject: '23514' }];
    setOnline(false);
    await store.getState().sendNote('row removed');
    setOnline(true);
    await store.getState().drainQueuedNotes();
    const key = store.getState().notes[0].tempId!;
    expect(store.getState().notes[0]).toMatchObject({ error: true, queued: true });

    await removeQueuedNote(key);
    await store.getState().retryFailedMessage(key);

    expect(server.rows.filter((r) => r.idempotency_key === key)).toHaveLength(1);
    expect(server.rows).toHaveLength(1);
    expect(await queuedIds()).toEqual([]);
    expect(store.getState().notes).toEqual([
      expect.objectContaining({ id: 'server-1', content: 'row removed', sending: false, error: false }),
    ]);
    expect(store.getState().notes[0].queued).toBeUndefined();
  });

  it('removing a failed queued note deletes its row', async () => {
    const store = createTestStore();
    server.outcomes = [{ reject: '42501' }];
    await store.getState().sendNote('refused');
    await store.getState().drainQueuedNotes();
    const tempId = store.getState().notes[0].tempId!;

    store.getState().removeFailedMessage(tempId);
    await vi.waitFor(async () => expect(await queuedIds()).toEqual([]));
    expect(store.getState().notes).toEqual([]);
  });

  it('online: a note is queued and sent at once, showing as sending rather than waiting', async () => {
    const store = createTestStore();

    await store.getState().sendNote('hello');
    expect(store.getState().notes[0]).toMatchObject({ queued: true, sending: true });
    await store.getState().drainQueuedNotes();

    expect(server.rows.map((r) => r.content)).toEqual(['hello']);
    expect(store.getState().notes[0]).toMatchObject({ id: 'server-1', sending: false });
    expect(await queuedIds()).toEqual([]);
  });

  it('with no partner loaded, the recipient comes from a linked lookup; unlinked is refused', async () => {
    const store = createTestStore({ partnerLoaded: false });
    await store.getState().sendNote('looked up');
    await store.getState().drainQueuedNotes();
    expect(server.rows[0]).toMatchObject({ content: 'looked up', to_user_id: PARTNER });

    server.lookup = { status: 'unlinked' };
    await store.getState().sendNote('nobody');
    expect(store.getState().notesError).toBe('Partner not configured');
    expect(await queuedIds()).toEqual([]);
    expect(contents(store)).toEqual(['looked up']);
  });

  it('a failed enqueue throws from sendNote and shows nothing', async () => {
    const store = createTestStore();
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new Error('IDB-DOWN');
    });

    const refusal = store.getState().sendNote('kept in the composer');
    await expect(refusal).rejects.toThrow();
    // Not an offline refusal: the composer shows its own "Failed to send".
    await expect(refusal).rejects.not.toBeInstanceOf(NoteRefusedOfflineError);

    expect(store.getState().notes).toEqual([]);
    expect(server.upserts).toBe(0);
  });

  it('offline: an image note is refused before anything is shown or uploaded', async () => {
    const store = createTestStore();
    const createObjectURL = vi.spyOn(URL, 'createObjectURL');
    setOnline(false);

    const refusal = store
      .getState()
      .sendNote('pic', new File(['x'], 'p.jpg', { type: 'image/jpeg' }));
    await expect(refusal).rejects.toThrow(IMAGE_NOTE_NEEDS_CONNECTION);
    // The banner owns the message; the composer keeps the text and picture.
    await expect(refusal).rejects.toBeInstanceOf(NoteRefusedOfflineError);

    expect(IMAGE_NOTE_NEEDS_CONNECTION).toBe(
      'You are offline. Notes with a picture need a connection to send.'
    );
    expect(store.getState().notesError).toBe(IMAGE_NOTE_NEEDS_CONNECTION);
    expect(server.requests).toEqual([]);
    expect(store.getState().notes).toEqual([]);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(uploadCompressedBlob).not.toHaveBeenCalled();
    expect(await queuedIds()).toEqual([]);
  });

  describe('resend of a failed image note', () => {
    async function failedImageNote(store: Store): Promise<string> {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      uploadCompressedBlob.mockResolvedValue({ storagePath: `${A}/pic.jpg`, compressedSize: 3 });
      server.outcomes = [{ reject: '23514' }];
      await store.getState().sendNote('pic', new File(['x'], 'p.jpg', { type: 'image/jpeg' }));
      const note = store.getState().notes[0];
      expect(note).toMatchObject({ error: true });
      expect(note.queued).toBeUndefined();
      sendEphemeralBroadcast.mockClear();
      return note.tempId!;
    }

    it("a successful retry broadcasts to the partner's topic", async () => {
      const store = createTestStore();
      const tempId = await failedImageNote(store);

      await store.getState().retryFailedMessage(tempId);

      expect(store.getState().notes[0]).toMatchObject({ id: 'server-1', error: false });
      expect(sendEphemeralBroadcast).toHaveBeenCalledWith(`love-notes:${PARTNER}`, 'new_message', {
        message: expect.objectContaining({ id: 'server-1', image_url: `${A}/pic.jpg` }),
      });
    });

    it('offline: Retry is refused before the partner lookup, and the note stays failed', async () => {
      const store = createTestStore();
      const tempId = await failedImageNote(store);
      uploadCompressedBlob.mockClear();
      vi.mocked(getPartnerId).mockClear();
      server.requests = [];
      store.setState({ notesError: null });
      setOnline(false);

      // Resolves: the Retry button has no catch.
      await expect(store.getState().retryFailedMessage(tempId)).resolves.toBeUndefined();

      expect(store.getState().notesError).toBe(
        'You are offline. Notes with a picture need a connection to send.'
      );
      expect(store.getState().notes[0]).toMatchObject({ tempId, error: true, sending: false });
      expect(getPartnerId).not.toHaveBeenCalled();
      expect(uploadCompressedBlob).not.toHaveBeenCalled();
      expect(server.requests).toEqual([]);

      // Back online, Retry sends it as before.
      setOnline(true);
      await store.getState().retryFailedMessage(tempId);
      expect(store.getState().notes[0]).toMatchObject({ id: 'server-1', error: false });
    });

    it('a failed broadcast is logged and the resend still stands', async () => {
      const store = createTestStore();
      const tempId = await failedImageNote(store);
      sendEphemeralBroadcast.mockRejectedValue(new Error('BROADCAST-DOWN'));

      await expect(store.getState().retryFailedMessage(tempId)).resolves.toBeUndefined();

      expect(store.getState().notes[0]).toMatchObject({ id: 'server-1', error: false });
      expect(console.warn).toHaveBeenCalledWith(
        '[NotesSlice] Broadcast failed (non-fatal):',
        expect.any(Error)
      );
    });
  });

  describe('known offline: refused before any request', () => {
    const sentRow = (id: string, content: string): LoveNote => ({
      id,
      from_user_id: A,
      to_user_id: PARTNER,
      content,
      image_url: null,
      created_at: `2026-09-20T10:00:0${id.slice(-1)}.000000+00:00`,
    });

    it('with no partner loaded, a text send is refused before the lookup and nothing is queued', async () => {
      const store = createTestStore({ partnerLoaded: false });
      setOnline(false);

      // Thrown, so the composer keeps the typed text.
      await expect(store.getState().sendNote('keep me')).rejects.toBeInstanceOf(
        NoteRefusedOfflineError
      );

      expect(store.getState().notesError).toBe(
        'You are offline. Love notes need a connection to send.'
      );
      expect(lookupPartnerId).not.toHaveBeenCalled();
      expect(store.getState().notes).toEqual([]);
      expect(await queuedIds()).toEqual([]);
      expect(server.requests).toEqual([]);
    });

    it('with a partner loaded, a text note is still queued offline', async () => {
      const store = createTestStore();
      setOnline(false);

      await store.getState().sendNote('queued as before');

      expect(store.getState().notesError).toBeNull();
      expect(contents(store)).toEqual(['queued as before']);
      expect(await queuedIds()).toHaveLength(1);
    });

    it('a thread load sends no lookup or query; the saved thread shows with no banner', async () => {
      await writeLocalCopy(A, LOVE_NOTES_COPY_KIND, [sentRow('n1', 'saved')]);
      const store = createTestStore();
      setOnline(false);

      await store.getState().fetchNotes();

      expect(lookupPartnerId).not.toHaveBeenCalled();
      expect(server.requests).toEqual([]);
      expect(contents(store)).toEqual(['saved']);
      expect(store.getState().notesError).toBeNull();
      expect(store.getState().notesIsLoading).toBe(false);
    });

    it('a thread load with nothing saved shows the offline reason', async () => {
      const store = createTestStore();
      setOnline(false);

      await store.getState().fetchNotes();

      expect(lookupPartnerId).not.toHaveBeenCalled();
      expect(server.requests).toEqual([]);
      expect(store.getState().notesError).toBe(
        'You are offline. Love notes need a connection to load.'
      );
    });

    it('an older page sends no lookup or query and changes nothing, then loads once online', async () => {
      const store = createTestStore();
      store.setState({ notes: [sentRow('n2', 'on screen')], notesHasMore: true });
      setOnline(false);

      await store.getState().fetchOlderNotes();

      expect(lookupPartnerId).not.toHaveBeenCalled();
      expect(server.requests).toEqual([]);
      expect(contents(store)).toEqual(['on screen']);
      expect(store.getState().notesHasMore).toBe(true);
      expect(store.getState().notesIsLoading).toBe(false);
      expect(store.getState().notesError).toBeNull();

      setOnline(true);
      await store.getState().fetchOlderNotes();
      expect(lookupPartnerId).toHaveBeenCalledTimes(1);
      expect(server.requests).toEqual(['love_notes_visible']);
    });

    it('a removal is refused before the note leaves the list or any request goes out', async () => {
      const store = createTestStore();
      store.setState({ notes: [sentRow('n3', 'stays')] });
      setOnline(false);

      await expect(store.getState().removeNote('n3')).rejects.toThrow(
        'You are offline. Love notes need a connection to remove.'
      );

      expect(contents(store)).toEqual(['stays']);
      expect(store.getState().notesPendingRemoval).toEqual([]);
      expect(server.requests).toEqual([]);
    });

    it('a thread load over a saved copy keeps a banner already showing', async () => {
      await writeLocalCopy(A, LOVE_NOTES_COPY_KIND, [sentRow('n4', 'saved')]);
      const store = createTestStore();
      store.setState({ notesError: IMAGE_NOTE_NEEDS_CONNECTION });
      setOnline(false);

      await store.getState().fetchNotes();

      expect(contents(store)).toEqual(['saved']);
      expect(store.getState().notesError).toBe(IMAGE_NOTE_NEEDS_CONNECTION);
      expect(store.getState().notesIsLoading).toBe(false);
    });

    it('a thread load over a saved copy clears a stale load banner', async () => {
      await writeLocalCopy(A, LOVE_NOTES_COPY_KIND, [sentRow('n5', 'saved')]);
      const store = createTestStore();
      store.setState({ notesError: 'You are offline. Love notes need a connection to load.' });
      setOnline(false);

      await store.getState().fetchNotes();

      expect(contents(store)).toEqual(['saved']);
      expect(store.getState().notesError).toBeNull();
      expect(store.getState().notesIsLoading).toBe(false);
    });

    it('a thread load over a saved copy clears a banner an earlier failed load raised', async () => {
      const store = createTestStore();
      server.lookup = { status: 'error', reason: 'upstream request timeout' };
      await store.getState().fetchNotes();
      expect(store.getState().notesError).toBe('upstream request timeout');

      await writeLocalCopy(A, LOVE_NOTES_COPY_KIND, [sentRow('n6', 'saved')]);
      setOnline(false);
      await store.getState().fetchNotes();

      expect(contents(store)).toEqual(['saved']);
      expect(store.getState().notesError).toBeNull();
    });
  });

  it('a partner lookup that finds the device offline shows the load sentence, not its reason', async () => {
    const store = createTestStore();
    server.lookup = { status: 'error', reason: 'offline', offline: true };

    await store.getState().fetchNotes();

    expect(store.getState().notesError).toBe(
      'You are offline. Love notes need a connection to load.'
    );
  });

  describe('rate limit: notes queued offline do not count', () => {
    // Pinned: the window keeps sends with `now - timestamp < 60 000`, so each
    // seeded timestamp sits an exact distance from `Date.now()`. Only `Date`
    // is faked; IndexedDB keeps its real setImmediate.
    const NOW = new Date('2026-09-15T16:00:00.000Z');

    /** Ten sends `ageMs` ago; the default, just inside the minute, is the limit. */
    const atLimit = (ageMs = 59_999) =>
      Array.from({ length: 10 }, () => NOW.getTime() - ageMs);
    const RATE_LIMIT = 'Rate limit exceeded: Maximum 10 messages per minute';

    beforeEach(() => {
      vi.setSystemTime(NOW);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    /** A queued text note shown failed, with its row marked failed. */
    async function failedQueuedNote(store: Store, tempId = 'temp-failed'): Promise<string> {
      const createdAt = '2026-09-24T09:00:00.000Z';
      await enqueueNote({
        id: tempId,
        userId: A,
        toUserId: PARTNER,
        content: 'refused',
        createdAt,
        failed: true,
      });
      store.setState({
        notes: [
          {
            id: tempId,
            tempId,
            from_user_id: A,
            to_user_id: PARTNER,
            content: 'refused',
            created_at: createdAt,
            sending: false,
            error: true,
            queued: true,
          },
        ],
      });
      return tempId;
    }

    it('offline at the limit, an image note gets the offline refusal, not the rate-limit error', async () => {
      const store = createTestStore();
      store.setState({ sentMessageTimestamps: atLimit() });
      setOnline(false);

      const refusal = store
        .getState()
        .sendNote('pic', new File(['x'], 'p.jpg', { type: 'image/jpeg' }));
      await expect(refusal).rejects.toBeInstanceOf(NoteRefusedOfflineError);

      expect(store.getState().notesError).toBe(IMAGE_NOTE_NEEDS_CONNECTION);
      expect(store.getState().notes).toEqual([]);
      expect(server.requests).toEqual([]);
    });

    it('offline at the limit with no partner loaded, a text note gets the offline refusal', async () => {
      const store = createTestStore({ partnerLoaded: false });
      store.setState({ sentMessageTimestamps: atLimit() });
      setOnline(false);

      await expect(store.getState().sendNote('keep me')).rejects.toBeInstanceOf(
        NoteRefusedOfflineError
      );

      expect(store.getState().notesError).toBe(
        'You are offline. Love notes need a connection to send.'
      );
      expect(await queuedIds()).toEqual([]);
    });

    it('eleven text notes written offline are all queued, and none is counted', async () => {
      const store = createTestStore();
      setOnline(false);

      for (let i = 1; i <= 11; i++) {
        await store.getState().sendNote(`offline ${i}`);
      }

      expect(contents(store)).toHaveLength(11);
      expect(await queuedIds()).toHaveLength(11);
      expect(store.getState().sentMessageTimestamps).toEqual([]);
      expect(store.getState().notesError).toBeNull();
    });

    it('online, a text note is counted, and at the limit it is refused as before', async () => {
      const store = createTestStore();

      await store.getState().sendNote('counted');
      await store.getState().drainQueuedNotes();
      expect(store.getState().sentMessageTimestamps).toHaveLength(1);

      store.setState({ sentMessageTimestamps: atLimit() });
      await expect(store.getState().sendNote('one too many')).rejects.toThrow(RATE_LIMIT);
      expect(contents(store)).toEqual(['counted']);
      expect(await queuedIds()).toEqual([]);
    });

    it('online, ten sends exactly a minute old have left the window', async () => {
      const store = createTestStore();
      store.setState({ sentMessageTimestamps: atLimit(60_000) });

      await store.getState().sendNote('outside the window');
      await store.getState().drainQueuedNotes();

      expect(contents(store)).toEqual(['outside the window']);
      expect(store.getState().notesError).toBeNull();
      expect(store.getState().sentMessageTimestamps).toEqual([NOW.getTime()]);
    });

    it('online at the limit, Retry resolves and shows the rate-limit error', async () => {
      const store = createTestStore();
      const tempId = await failedQueuedNote(store);
      store.setState({ sentMessageTimestamps: atLimit() });

      // Resolves: the Retry button has no catch.
      await expect(store.getState().retryFailedMessage(tempId)).resolves.toBeUndefined();

      expect(store.getState().notesError).toBe(RATE_LIMIT);
      expect(store.getState().notes[0]).toMatchObject({ tempId, error: true });
      expect(server.upserts).toBe(0);
    });

    it('Retry of a note no longer in the thread resolves and shows the error', async () => {
      const store = createTestStore();

      await expect(store.getState().retryFailedMessage('temp-gone')).resolves.toBeUndefined();

      expect(store.getState().notesError).toBe('Message not found');
    });

    it('offline at the limit, Retry of a queued note queues it again and is not counted', async () => {
      const store = createTestStore();
      const tempId = await failedQueuedNote(store);
      const seeded = atLimit();
      store.setState({ sentMessageTimestamps: seeded });
      setOnline(false);

      await expect(store.getState().retryFailedMessage(tempId)).resolves.toBeUndefined();

      expect(store.getState().notesError).toBeNull();
      expect(store.getState().notes[0]).toMatchObject({ tempId, error: false, sending: false });
      expect(await listQueuedNotes(A)).toEqual([
        expect.objectContaining({ id: tempId, failed: false }),
      ]);
      expect(store.getState().sentMessageTimestamps).toEqual(seeded);
    });

    it('a Retry failure after the session changed writes no banner', async () => {
      const store = createTestStore();
      store.setState({
        notes: [
          {
            id: 'temp-pic',
            tempId: 'temp-pic',
            from_user_id: A,
            to_user_id: PARTNER,
            content: 'pic',
            created_at: '2026-09-24T09:00:00.000Z',
            sending: false,
            error: true,
          },
        ],
        notesError: null,
      });
      vi.mocked(getPartnerId).mockImplementationOnce(async () => {
        store.setState({ authSessionVersion: 2 });
        return null;
      });

      await expect(store.getState().retryFailedMessage('temp-pic')).resolves.toBeUndefined();

      expect(store.getState().notesError).toBeNull();
    });
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

    it('a session change during the insert: the row is deleted, no state write, and the same account still broadcasts', async () => {
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

      expect(store.getState().notes).toBe(fresh);
      expect(await queuedIds()).toEqual([]);
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
      await writeLocalCopy(A, LOVE_NOTES_COPY_KIND, [
        {
          id: 'saved-1',
          from_user_id: PARTNER,
          to_user_id: A,
          content: 'saved',
          created_at: '2026-09-20T10:00:00.000000+00:00',
          image_url: null,
        },
      ]);
      await enqueueNote({ id: 'temp-q', userId: A, toUserId: PARTNER, content: 'queued', createdAt: '2026-09-24T09:00:00.000Z', failed: false });
      const store = createTestStore();

      await store.getState().drainQueuedNotes();
      // A copy write the drain started would be recorded by now; let it land.
      await copyWritesSettled();

      expect(server.rows.map((r) => r.content)).toEqual(['queued']);
      expect(await copyIds()).toEqual(['saved-1']);
    });
  });
});
