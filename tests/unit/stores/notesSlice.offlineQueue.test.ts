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
    | { status: 'error'; reason: string },
  readError: null as { message: string } | null,
  reset() {
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

vi.mock('../../../src/services/imageCompressionService', () => ({
  imageCompressionService: {
    validateImageFile: vi.fn(() => ({ valid: true })),
    compressImage: vi.fn(async (file: Blob) => ({ blob: file, originalSize: 3, compressedSize: 3 })),
  },
}));

import { openMyLoveDB } from '../../../src/services/dbSchema';
import { readLocalCopy, writeLocalCopy } from '../../../src/services/localCopy';
import { enqueueNote, listQueuedNotes } from '../../../src/services/noteQueue';
import {
  createNotesSlice,
  IMAGE_NOTE_NEEDS_CONNECTION,
  LOVE_NOTES_COPY_KIND,
  type NotesSlice,
} from '../../../src/stores/slices/notesSlice';

type TestStore = NotesSlice & {
  userId: string | null;
  authSessionVersion: number;
  partner: { id: string } | null;
};

function createTestStore(options: { partnerLoaded?: boolean; userId?: string } = {}) {
  const store = create<TestStore>()(createNotesSlice as unknown as StateCreator<TestStore>);
  store.setState({
    userId: options.userId ?? A,
    authSessionVersion: 1,
    partner: options.partnerLoaded === false ? null : { id: PARTNER },
  });
  return store;
}
type Store = ReturnType<typeof createTestStore>;

let online = true;
function setOnline(value: boolean) {
  online = value;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
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
    server.reset();
    vi.clearAllMocks();
    setOnline(true);
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    sendEphemeralBroadcast.mockResolvedValue(undefined);
  });

  afterEach(() => {
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
    await flush();
    const copy = (await readLocalCopy<{ id: string }[]>(A, LOVE_NOTES_COPY_KIND))?.map((n) => n.id);
    expect(copy).toEqual(['server-1', 'server-2', 'server-3']);
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
    // Queued notes never go in the copy.
    await flush();
    expect((await readLocalCopy<{ id: string }[]>(A, LOVE_NOTES_COPY_KIND))?.map((n) => n.id)).toEqual([
      'saved-1',
    ]);
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
    // A same-origin Web Locks stand-in: `ifAvailable` answers null while held.
    const held = new Set<string>();
    const fakeNavigator = Object.create(navigator) as Navigator;
    Object.defineProperty(fakeNavigator, 'onLine', { value: true });
    Object.defineProperty(fakeNavigator, 'locks', {
      value: {
        request: async (
          name: string,
          _options: { ifAvailable: boolean },
          fn: (lock: object | null) => Promise<unknown>
        ) => {
          if (held.has(name)) return fn(null);
          held.add(name);
          try {
            return await fn({ name });
          } finally {
            held.delete(name);
          }
        },
      },
    });
    vi.stubGlobal('navigator', fakeNavigator);
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

    await expect(store.getState().sendNote('kept in the composer')).rejects.toThrow();

    expect(store.getState().notes).toEqual([]);
    expect(server.upserts).toBe(0);
  });

  it('offline: an image note is refused before anything is shown or uploaded', async () => {
    const store = createTestStore();
    const createObjectURL = vi.spyOn(URL, 'createObjectURL');
    setOnline(false);

    await expect(
      store.getState().sendNote('pic', new File(['x'], 'p.jpg', { type: 'image/jpeg' }))
    ).rejects.toThrow(IMAGE_NOTE_NEEDS_CONNECTION);

    expect(store.getState().notesError).toBe(IMAGE_NOTE_NEEDS_CONNECTION);
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
      await flush();

      expect(server.rows.map((r) => r.content)).toEqual(['queued']);
      expect((await readLocalCopy<{ id: string }[]>(A, LOVE_NOTES_COPY_KIND))?.map((n) => n.id)).toEqual([
        'saved-1',
      ]);
    });
  });
});
