/**
 * notesSlice — the `love-notes` local copy (unified data storage, story 8)
 *
 * `fetchNotes` shows the account's saved thread at once — before the partner
 * lookup — then replaces state and copy with the server's page. A failed read
 * changes nothing and, while a saved thread is on screen, raises no banner; an
 * empty answer saves `[]`. Every confirmed change (incoming note, confirmed
 * send or resend, confirmed removal, older page) rewrites the copy, which holds
 * confirmed server rows only. A result raised for one account or session is
 * never shown or saved under another.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { create, type StateCreator } from 'zustand';
import type { LoveNote } from '../../../src/types/models';

const USER_A = 'USER-A-ID';
const PARTNER = 'PARTNER-ID';
const USER_B = 'USER-B-ID';

type Row = Required<Pick<LoveNote, 'id' | 'from_user_id' | 'to_user_id' | 'content' | 'created_at'>> & {
  image_url: string | null;
  /** The view is `select *`: rows carry the key the sender composed with. */
  idempotency_key?: string;
};

/** What the fake server answers, and how. */
const server = {
  rows: [] as Row[],
  lookup: { status: 'linked', partnerId: PARTNER } as
    | { status: 'linked'; partnerId: string }
    | { status: 'unlinked' }
    | { status: 'error'; reason: string },
  /** Hold the next page read until released (account-switch cases). */
  hold: null as Promise<void> | null,
  readError: null as { message: string } | null,
  insertError: null as { message: string; code?: string; details?: string; hint?: string } | null,
  removalError: null as { message: string } | null,
  /** Commit the next insert, then hold its reply until released. */
  insertHold: null as Promise<void> | null,
  seq: 0,
};

function readBuilder() {
  let before: string | null = null;
  let take = 50;
  const api = {
    select: () => api,
    or: () => api,
    order: () => api,
    lt: (_col: string, value: string) => {
      before = value;
      return api;
    },
    limit: (n: number) => {
      take = n;
      return api;
    },
    then(onFulfilled: (r: { data: Row[] | null; error: unknown }) => unknown, onRejected?: (e: unknown) => unknown) {
      const run = async () => {
        if (server.hold) await server.hold;
        if (server.readError) return { data: null, error: server.readError };
        const newestFirst = server.rows
          .filter((row) => before === null || row.created_at < before)
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
          .slice(0, take);
        return { data: newestFirst, error: null };
      };
      return run().then(onFulfilled, onRejected);
    },
  };
  return api;
}

function fakeFrom(table: string) {
  if (table === 'love_notes_visible') return readBuilder();
  if (table === 'love_note_removals') {
    return {
      upsert: async () => ({ data: null, error: server.removalError }),
    };
  }
  if (table === 'love_notes') {
    let payload: (Omit<Row, 'id' | 'created_at'> & { idempotency_key: string }) | null = null;
    const api = {
      upsert: (values: Omit<Row, 'id' | 'created_at'> & { idempotency_key: string }) => {
        payload = values;
        return api;
      },
      select: () => api,
      eq: () => api,
      maybeSingle: async () => {
        if (!payload) return { data: null, error: null };
        if (server.insertError) return { data: null, error: server.insertError };
        server.seq += 1;
        const row: Row = {
          id: `server-${server.seq}`,
          from_user_id: payload.from_user_id,
          to_user_id: payload.to_user_id,
          content: payload.content,
          image_url: payload.image_url,
          idempotency_key: payload.idempotency_key,
          created_at: `2026-09-24T12:00:0${server.seq}.000000+00:00`,
        };
        server.rows.push(row);
        if (server.insertHold) await server.insertHold;
        return { data: { ...row }, error: null };
      },
    };
    return api;
  }
  throw new Error(`unmodelled table ${table}`);
}

const getPartnerId = vi.fn();
const lookupPartnerId = vi.fn();

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: { from: (table: string) => fakeFrom(table) },
  getPartnerId: () => getPartnerId(),
  lookupPartnerId: () => lookupPartnerId(),
}));

vi.mock('../../../src/api/ephemeralBroadcast', () => ({
  sendEphemeralBroadcast: vi.fn(async () => undefined),
}));

vi.mock('../../../src/services/loveNoteImageService', () => ({
  uploadCompressedBlob: vi.fn(async () => ({ storagePath: `${USER_A}/uploaded.jpg`, compressedSize: 3 })),
  deleteLoveNoteImage: vi.fn(async () => undefined),
}));

vi.mock('../../../src/services/imageCompressionService', () => ({
  imageCompressionService: {
    validateImageFile: vi.fn(() => ({ valid: true })),
    compressImage: vi.fn(async (file: Blob) => ({ blob: file, originalSize: 3, compressedSize: 3 })),
  },
}));

const savedCopies = new Map<string, unknown>();
const readLocalCopy = vi.fn();
const writeLocalCopy = vi.fn();
const registerLocalCopy = vi.fn();

vi.mock('../../../src/services/localCopy', () => ({
  readLocalCopy: (userId: string, kind: string) => readLocalCopy(userId, kind),
  writeLocalCopy: (userId: string, kind: string, value: unknown) =>
    writeLocalCopy(userId, kind, value),
  registerLocalCopy: (kind: string, refresh: () => Promise<void>) =>
    registerLocalCopy(kind, refresh),
}));

import 'fake-indexeddb/auto';
import { openMyLoveDB } from '../../../src/services/dbSchema';
import {
  createNotesSlice,
  LOVE_NOTES_COPY_KIND,
  NoteRefusedOfflineError,
  type NotesSlice,
} from '../../../src/stores/slices/notesSlice';

type TestStore = NotesSlice & { userId: string | null; authSessionVersion: number };

function createTestStore() {
  const store = create<TestStore>()(createNotesSlice as unknown as StateCreator<TestStore>);
  store.setState({ userId: USER_A, authSessionVersion: 1 });
  return store;
}

function row(id: string, overrides: Partial<Row> = {}): Row {
  return {
    id,
    from_user_id: PARTNER,
    to_user_id: USER_A,
    content: `note ${id}`,
    image_url: null,
    created_at: `2026-09-20T10:00:${id.padStart(2, '0').slice(-2)}.000000+00:00`,
    ...overrides,
  };
}

const key = (userId: string) => `${userId}|${LOVE_NOTES_COPY_KIND}`;
const savedIds = (userId = USER_A) =>
  (savedCopies.get(key(userId)) as { id: string }[] | undefined)?.map((n) => n.id);
const stateIds = (store: ReturnType<typeof createTestStore>) =>
  store.getState().notes.map((n) => n.id);

function deferred<T = void>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function goOffline() {
  lookupPartnerId.mockResolvedValue({ status: 'error', reason: 'TypeError: Failed to fetch' });
  getPartnerId.mockResolvedValue(null);
}

/**
 * Scroll back through the whole of a six-row thread two rows at a page:
 * leaves notes 1-6 on screen and notesHasMore false.
 */
async function loadSixByPages(store: ReturnType<typeof createTestStore>) {
  server.rows = ['1', '2', '3', '4', '5', '6'].map((id) => row(id));
  await store.getState().fetchNotes(2);
  await store.getState().fetchOlderNotes(2);
  await store.getState().fetchOlderNotes(2);
  await store.getState().fetchOlderNotes(2);
  expect(stateIds(store)).toEqual(['1', '2', '3', '4', '5', '6']);
  expect(store.getState().notesHasMore).toBe(false);
}

/** A server rejection: marks a queued text note failed. */
const REJECTED = { code: '23514', message: 'check violation', details: '', hint: '' };

describe('notesSlice love-notes local copy', () => {
  beforeEach(async () => {
    const db = await openMyLoveDB();
    await db.clear('note-queue');
    db.close();
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    savedCopies.clear();
    server.rows = [];
    server.hold = null;
    server.readError = null;
    server.insertError = null;
    server.removalError = null;
    server.insertHold = null;
    server.seq = 0;
    readLocalCopy.mockImplementation(async (userId: string, kind: string) =>
      savedCopies.has(`${userId}|${kind}`) ? savedCopies.get(`${userId}|${kind}`) : null
    );
    writeLocalCopy.mockImplementation(async (userId: string, kind: string, value: unknown) => {
      savedCopies.set(`${userId}|${kind}`, value);
    });
    lookupPartnerId.mockResolvedValue({ status: 'linked', partnerId: PARTNER });
    getPartnerId.mockResolvedValue(PARTNER);
  });

  describe('fetchNotes', () => {
    it('online start: the copy shows first, then the server list replaces it and is saved', async () => {
      savedCopies.set(key(USER_A), [row('1')]);
      server.rows = [row('1'), row('2')];
      const gate = deferred();
      server.hold = gate.promise;
      const store = createTestStore();

      const inFlight = store.getState().fetchNotes();
      await flush();
      // The copy is on screen before the server has answered.
      expect(stateIds(store)).toEqual(['1']);

      gate.resolve();
      await inFlight;
      expect(stateIds(store)).toEqual(['1', '2']);
      expect(savedIds()).toEqual(['1', '2']);
      expect(store.getState().notesError).toBeNull();
      expect(store.getState().notesIsLoading).toBe(false);
    });

    it('shows the copy before the partner lookup answers', async () => {
      savedCopies.set(key(USER_A), [row('1')]);
      const lookup = deferred<{ status: 'linked'; partnerId: string }>();
      lookupPartnerId.mockReturnValue(lookup.promise);
      const store = createTestStore();

      const inFlight = store.getState().fetchNotes();
      await flush();
      expect(stateIds(store)).toEqual(['1']);

      lookup.resolve({ status: 'linked', partnerId: PARTNER });
      await inFlight;
    });

    it('offline with a copy: the saved notes are listed with no error banner', async () => {
      savedCopies.set(key(USER_A), [row('1'), row('2', { image_url: `${PARTNER}/pic.jpg` })]);
      goOffline();
      const store = createTestStore();

      await store.getState().fetchNotes();

      expect(stateIds(store)).toEqual(['1', '2']);
      expect(store.getState().notes[1].image_url).toBe(`${PARTNER}/pic.jpg`);
      expect(store.getState().notesError).toBeNull();
      expect(store.getState().notesIsLoading).toBe(false);
      // A failed read changes nothing, the copy included.
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });

    it('offline with no copy: empty with an error, as today', async () => {
      goOffline();
      const store = createTestStore();

      await store.getState().fetchNotes();

      expect(store.getState().notes).toEqual([]);
      expect(store.getState().notesError).toBeTruthy();
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });

    it('a failed page read keeps the copy and the state', async () => {
      savedCopies.set(key(USER_A), [row('1')]);
      server.readError = { message: 'network error' };
      const store = createTestStore();

      await store.getState().fetchNotes();

      expect(stateIds(store)).toEqual(['1']);
      expect(savedIds()).toEqual(['1']);
      expect(store.getState().notesError).toBeNull();
    });

    it('an unlinked account keeps today\'s "Partner not configured" error and the copy', async () => {
      savedCopies.set(key(USER_A), [row('1')]);
      lookupPartnerId.mockResolvedValue({ status: 'unlinked' });
      const store = createTestStore();

      await store.getState().fetchNotes();

      expect(store.getState().notesError).toBe('Partner not configured');
      expect(savedIds()).toEqual(['1']);
    });

    it('an empty server answer saves []', async () => {
      savedCopies.set(key(USER_A), [row('1')]);
      const store = createTestStore();

      await store.getState().fetchNotes();

      expect(store.getState().notes).toEqual([]);
      expect(savedCopies.get(key(USER_A))).toEqual([]);
    });

    it('ignores a malformed copy whole, logs it, and still reads the server', async () => {
      savedCopies.set(key(USER_A), [row('1'), { id: 2, content: null }]);
      server.rows = [row('3')];
      const gate = deferred();
      server.hold = gate.promise;
      const store = createTestStore();

      const inFlight = store.getState().fetchNotes();
      await flush();
      expect(store.getState().notes).toEqual([]);
      expect(console.error).toHaveBeenCalledWith('[NotesSlice] Ignoring a malformed love-notes copy');

      gate.resolve();
      await inFlight;
      expect(stateIds(store)).toEqual(['3']);
      expect(savedIds()).toEqual(['3']);
    });

    it('reads written_at back from the copy, and a copy saved before it existed still applies', async () => {
      savedCopies.set(key(USER_A), [
        { ...row('1'), written_at: '2026-09-20T09:00:00.000Z' },
        { ...row('2'), written_at: null },
        row('3'),
      ]);
      goOffline();
      const store = createTestStore();

      await store.getState().fetchNotes();

      expect(stateIds(store)).toEqual(['1', '2', '3']);
      expect(store.getState().notes[0].written_at).toBe('2026-09-20T09:00:00.000Z');
      expect(store.getState().notes[1].written_at).toBeUndefined();
      expect(store.getState().notes[2].written_at).toBeUndefined();
    });

    it('treats a copy entry with a non-string written_at as malformed', async () => {
      savedCopies.set(key(USER_A), [{ ...row('1'), written_at: 5 }]);
      goOffline();
      const store = createTestStore();

      await store.getState().fetchNotes();

      expect(store.getState().notes).toEqual([]);
      expect(console.error).toHaveBeenCalledWith('[NotesSlice] Ignoring a malformed love-notes copy');
    });

    it('applies notesPendingRemoval to the copy', async () => {
      savedCopies.set(key(USER_A), [row('1'), row('2')]);
      goOffline();
      const store = createTestStore();
      store.setState({ notesPendingRemoval: ['1'] });

      await store.getState().fetchNotes();

      expect(stateIds(store)).toEqual(['2']);
    });

    it('never lays the copy over a thread already on screen, nor after a server answer', async () => {
      server.rows = [row('2')];
      const store = createTestStore();
      await store.getState().fetchNotes();
      expect(stateIds(store)).toEqual(['2']);

      // A later copy (say another tab) is not read again this session.
      savedCopies.set(key(USER_A), [row('9')]);
      readLocalCopy.mockClear();
      goOffline();
      await store.getState().fetchNotes();
      expect(readLocalCopy).not.toHaveBeenCalled();
      expect(stateIds(store)).toEqual(['2']);
    });

    it('a refresh keeps notes still sending or failed, which have no server row yet', async () => {
      server.rows = [row('1')];
      const store = createTestStore();
      const failed: LoveNote = {
        ...row('temp-x'),
        id: 'temp-x',
        tempId: 'temp-x',
        from_user_id: USER_A,
        to_user_id: PARTNER,
        error: true,
        sending: false,
      };
      store.setState({ notes: [failed] });

      await store.getState().fetchNotes();

      expect(stateIds(store)).toEqual(['1', 'temp-x']);
      expect(savedIds()).toEqual(['1']);
    });

    it('a refresh that already returns a failed note\'s committed row shows it once', async () => {
      // The insert committed but its reply was lost, so the note shows failed.
      server.rows = [row('1'), row('2', { idempotency_key: 'temp-x', from_user_id: USER_A, to_user_id: PARTNER })];
      const store = createTestStore();
      const failed: LoveNote = {
        ...row('temp-x'),
        id: 'temp-x',
        tempId: 'temp-x',
        from_user_id: USER_A,
        to_user_id: PARTNER,
        error: true,
        sending: false,
      };
      store.setState({ notes: [failed] });

      await store.getState().fetchNotes();

      expect(stateIds(store)).toEqual(['1', '2']);
      expect(savedIds()).toEqual(['1', '2']);
    });

    it('a refresh revokes the previews of notes it replaces, never of notes it keeps', async () => {
      const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      server.rows = [row('2', { idempotency_key: 'temp-done' })];
      const store = createTestStore();
      const kept: LoveNote = {
        ...row('temp-kept'),
        id: 'temp-kept',
        tempId: 'temp-kept',
        error: true,
        imagePreviewUrl: 'blob:kept-preview',
      };
      const replaced: LoveNote = {
        ...row('temp-done'),
        id: 'temp-done',
        tempId: 'temp-done',
        sending: true,
        imagePreviewUrl: 'blob:replaced-preview',
      };
      store.setState({ notes: [replaced, kept] });

      await store.getState().fetchNotes();

      expect(stateIds(store)).toEqual(['2', 'temp-kept']);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:replaced-preview');
      expect(revokeObjectURL).not.toHaveBeenCalledWith('blob:kept-preview');
      revokeObjectURL.mockRestore();
    });

    it('applying the copy sets notesHasMore from its length', async () => {
      savedCopies.set(key(USER_A), [row('1'), row('2')]);
      goOffline();
      const store = createTestStore();

      await store.getState().fetchNotes();

      expect(store.getState().notesHasMore).toBe(false);
    });

    it('registers itself as the love-notes refresher, which re-reads the server (reconnect)', async () => {
      const store = createTestStore();
      const call = registerLocalCopy.mock.calls.find(([kind]) => kind === LOVE_NOTES_COPY_KIND);
      expect(call).toBeDefined();
      const refresh = call![1] as () => Promise<void>;

      await store.getState().fetchNotes();
      expect(store.getState().notes).toEqual([]);

      // The partner wrote while this device was offline; the connection returns.
      server.rows = [row('7')];
      await refresh();

      expect(stateIds(store)).toEqual(['7']);
      expect(savedIds()).toEqual(['7']);
    });

    it('a refresh over a scrolled-back thread keeps the older pages', async () => {
      const store = createTestStore();
      await loadSixByPages(store);

      // The partner wrote while this device was offline; the connection returns.
      server.rows.push(row('7'));
      await store.getState().fetchNotes(2, { keepOlder: true });

      expect(stateIds(store)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
      expect(savedIds()).toEqual(['1', '2', '3', '4', '5', '6', '7']);
      expect(store.getState().notesHasMore).toBe(false);
    });

    it('a refresh after more than a page arrived replaces the thread', async () => {
      const store = createTestStore();
      await loadSixByPages(store);

      server.rows.push(row('7'), row('8'));
      await store.getState().fetchNotes(2, { keepOlder: true });

      expect(stateIds(store)).toEqual(['7', '8']);
      expect(savedIds()).toEqual(['7', '8']);
      expect(store.getState().notesHasMore).toBe(true);
    });

    it('a short refresh page is the whole thread', async () => {
      const store = createTestStore();
      await loadSixByPages(store);

      // Notes 1-3 were removed from this account's history on another device.
      server.rows = ['4', '5', '6', '7'].map((id) => row(id));
      await store.getState().fetchNotes(5, { keepOlder: true });

      expect(stateIds(store)).toEqual(['4', '5', '6', '7']);
      expect(savedIds()).toEqual(['4', '5', '6', '7']);
      expect(store.getState().notesHasMore).toBe(false);
    });

    it('a refresh keeps a failed note last and the older pages first', async () => {
      server.rows = ['3', '4', '5', '6'].map((id) => row(id));
      const store = createTestStore();
      await store.getState().fetchNotes(2);
      await store.getState().fetchOlderNotes(2);
      const failed: LoveNote = {
        ...row('temp-x'),
        id: 'temp-x',
        tempId: 'temp-x',
        from_user_id: USER_A,
        to_user_id: PARTNER,
        error: true,
        sending: false,
      };
      store.setState({ notes: [...store.getState().notes, failed] });

      server.rows.push(row('7'));
      await store.getState().fetchNotes(2, { keepOlder: true });

      expect(stateIds(store)).toEqual(['3', '4', '5', '6', '7', 'temp-x']);
      expect(savedIds()).toEqual(['3', '4', '5', '6', '7']);
    });

    it('the registered refresher keeps scrolled-back pages (reconnect)', async () => {
      // More than one default page, so the refresher's own limit is exercised.
      const minute = (n: number) => String(Math.floor(n / 60)).padStart(2, '0');
      const second = (n: number) => String(n % 60).padStart(2, '0');
      const nthRow = (n: number) =>
        row(`n${n}`, { created_at: `2026-09-20T10:${minute(n)}:${second(n)}.000000+00:00` });
      server.rows = Array.from({ length: 60 }, (_, i) => nthRow(i + 1));
      const store = createTestStore();
      const refresh = registerLocalCopy.mock.calls.find(
        ([kind]) => kind === LOVE_NOTES_COPY_KIND
      )![1] as () => Promise<void>;
      await store.getState().fetchNotes();
      await store.getState().fetchOlderNotes();
      expect(store.getState().notes).toHaveLength(60);
      expect(store.getState().notesHasMore).toBe(false);

      server.rows.push(nthRow(61));
      await refresh();

      const expected = Array.from({ length: 61 }, (_, i) => `n${i + 1}`);
      expect(stateIds(store)).toEqual(expected);
      expect(savedIds()).toEqual(expected);
      expect(store.getState().notesHasMore).toBe(false);
    });

    it("a merge over a thread shown from the copy does not keep the copy's hasMore guess", async () => {
      const minute = (n: number) => String(Math.floor(n / 60)).padStart(2, '0');
      const second = (n: number) => String(n % 60).padStart(2, '0');
      const nthRow = (n: number) =>
        row(`n${n}`, { created_at: `2026-09-20T10:${minute(n)}:${second(n)}.000000+00:00` });
      server.rows = Array.from({ length: 100 }, (_, i) => nthRow(i + 1));
      // One note was removed from a 50-note page, so the copy saved 49 rows.
      savedCopies.set(key(USER_A), Array.from({ length: 49 }, (_, i) => nthRow(i + 52)));
      goOffline();
      const store = createTestStore();
      const refresh = registerLocalCopy.mock.calls.find(
        ([kind]) => kind === LOVE_NOTES_COPY_KIND
      )![1] as () => Promise<void>;
      await store.getState().fetchNotes();
      // The copy's guess: 49 is under a page, so it reads as the whole thread.
      expect(store.getState().notesHasMore).toBe(false);

      // The partner sends three notes; the connection returns.
      server.rows.push(nthRow(101), nthRow(102), nthRow(103));
      lookupPartnerId.mockResolvedValue({ status: 'linked', partnerId: PARTNER });
      await refresh();

      expect(stateIds(store)[0]).toBe('n52');
      expect(store.getState().notes).toHaveLength(52);
      // The oldest kept row's history is unknown: the list may still ask.
      expect(store.getState().notesHasMore).toBe(true);
      await store.getState().fetchOlderNotes();
      expect(stateIds(store)[0]).toBe('n2');
    });

    it('a mount fetch without keepOlder still replaces the thread', async () => {
      const store = createTestStore();
      await loadSixByPages(store);

      server.rows.push(row('7'));
      await store.getState().fetchNotes(2);

      expect(stateIds(store)).toEqual(['6', '7']);
      expect(savedIds()).toEqual(['6', '7']);
      expect(store.getState().notesHasMore).toBe(true);
    });

    it('the refresher does nothing while signed out', async () => {
      const store = createTestStore();
      store.setState({ userId: null });
      const refresh = registerLocalCopy.mock.calls.find(
        ([kind]) => kind === LOVE_NOTES_COPY_KIND
      )![1] as () => Promise<void>;

      await refresh();

      expect(lookupPartnerId).not.toHaveBeenCalled();
      expect(readLocalCopy).not.toHaveBeenCalled();
    });
  });

  describe('account switch', () => {
    it("drops A's server read that resolves after B signs in: nothing shown or saved", async () => {
      server.rows = [row('1', { content: 'A-PRIVATE' })];
      const gate = deferred();
      server.hold = gate.promise;
      const store = createTestStore();

      const inFlight = store.getState().fetchNotes();
      await flush();
      store.setState({ userId: USER_B, authSessionVersion: 2, notes: [] });
      gate.resolve();
      await inFlight;

      expect(store.getState().notes).toEqual([]);
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });

    it("drops A's copy read that resolves after B signs in", async () => {
      const copyRead = deferred<unknown>();
      readLocalCopy.mockReturnValue(copyRead.promise);
      goOffline();
      const store = createTestStore();

      const inFlight = store.getState().fetchNotes();
      store.setState({ userId: USER_B, authSessionVersion: 2, notes: [] });
      copyRead.resolve([row('1', { content: 'A-PRIVATE' })]);
      await inFlight;

      expect(JSON.stringify(store.getState())).not.toContain('A-PRIVATE');
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });

    it('a same-account re-sign-in (new session version) drops the old read too', async () => {
      server.rows = [row('1')];
      const gate = deferred();
      server.hold = gate.promise;
      const store = createTestStore();

      const inFlight = store.getState().fetchNotes();
      await flush();
      store.setState({ authSessionVersion: 2, notes: [] });
      gate.resolve();
      await inFlight;

      expect(store.getState().notes).toEqual([]);
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });
  });

  describe('confirmed changes rewrite the copy', () => {
    it('an incoming Realtime note is added, then the copy is rewritten', async () => {
      server.rows = [row('1')];
      const store = createTestStore();
      await store.getState().fetchNotes();

      store.getState().addNote(row('2') as LoveNote);
      await flush();

      expect(stateIds(store)).toEqual(['1', '2']);
      expect(savedIds()).toEqual(['1', '2']);
    });

    it('a duplicate Realtime note writes nothing', async () => {
      server.rows = [row('1')];
      const store = createTestStore();
      await store.getState().fetchNotes();
      writeLocalCopy.mockClear();

      store.getState().addNote(row('1') as LoveNote);
      await flush();

      expect(writeLocalCopy).not.toHaveBeenCalled();
    });

    it('a failed copy write on an incoming note is logged and the note still shows', async () => {
      const store = createTestStore();
      writeLocalCopy.mockRejectedValue(new Error('QuotaExceededError'));

      store.getState().addNote(row('2') as LoveNote);
      await flush();

      expect(stateIds(store)).toEqual(['2']);
      expect(console.error).toHaveBeenCalledWith(
        '[NotesSlice] Failed to save the love-notes copy:',
        expect.any(Error)
      );
    });

    it('a confirmed send puts the server row in state and in the copy', async () => {
      server.rows = [row('1')];
      const store = createTestStore();
      await store.getState().fetchNotes();

      await store.getState().sendNote('hello');
      await store.getState().drainQueuedNotes();
      await flush();

      expect(stateIds(store)).toEqual(['1', 'server-1']);
      expect(savedIds()).toEqual(['1', 'server-1']);
      const saved = (savedCopies.get(key(USER_A)) as Record<string, unknown>[])[1];
      // Plain confirmed data only: no client-side fields.
      expect(Object.keys(saved).sort()).toEqual(
        ['content', 'created_at', 'from_user_id', 'id', 'image_url', 'to_user_id', 'written_at'].sort()
      );
    });

    it('a confirmed image send saves the storage path, never the blob or preview', async () => {
      const store = createTestStore();
      const createObjectURL = vi.fn(() => 'blob:preview');
      const revokeObjectURL = vi.fn();
      vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));

      await store.getState().sendNote('pic', new File(['x'], 'p.jpg', { type: 'image/jpeg' }));
      await flush();

      const saved = savedCopies.get(key(USER_A)) as Record<string, unknown>[];
      expect(saved).toHaveLength(1);
      expect(saved[0].image_url).toBe(`${USER_A}/uploaded.jpg`);
      expect(JSON.stringify(saved)).not.toContain('blob:');
      vi.unstubAllGlobals();
    });

    it('a failed send is not saved; the copy holds confirmed rows only', async () => {
      server.rows = [row('1')];
      const store = createTestStore();
      await store.getState().fetchNotes();
      server.insertError = REJECTED;

      await store.getState().sendNote('will fail');
      await store.getState().drainQueuedNotes();
      await flush();

      expect(store.getState().notes.at(-1)?.error).toBe(true);
      expect(savedIds()).toEqual(['1']);
    });

    it('a confirmed resend saves the row in the copy', async () => {
      const store = createTestStore();
      server.insertError = REJECTED;
      await store.getState().sendNote('retry me');
      await store.getState().drainQueuedNotes();
      const tempId = store.getState().notes[0].tempId!;
      expect(savedIds()).toBeUndefined();

      server.insertError = null;
      await store.getState().retryFailedMessage(tempId);

      expect(stateIds(store)).toEqual(['server-1']);
      expect(savedIds()).toEqual(['server-1']);
    });

    it('offline with no partner loaded, a send is refused before the lookup and the copy is unchanged', async () => {
      savedCopies.set(key(USER_A), [row('1')]);
      goOffline();
      const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      try {
        const store = createTestStore();
        await store.getState().fetchNotes();
        writeLocalCopy.mockClear();
        lookupPartnerId.mockClear();

        // Thrown, so the composer keeps the text; the banner owns the message.
        await expect(store.getState().sendNote('offline note')).rejects.toBeInstanceOf(
          NoteRefusedOfflineError
        );
        await flush();

        // The recipient cannot be fixed offline without a loaded partner: refused
        // before the lookup goes out, with the offline wording.
        expect(lookupPartnerId).not.toHaveBeenCalled();
        expect(store.getState().notesError).toBe(
          'You are offline. Love notes need a connection to send.'
        );
        expect(stateIds(store)).toEqual(['1']);
        expect(writeLocalCopy).not.toHaveBeenCalled();
        expect(savedIds()).toEqual(['1']);
      } finally {
        onLine.mockRestore();
      }
    });

    it('online with no partner loaded, a failed lookup refuses the send with its reason and the copy is unchanged', async () => {
      savedCopies.set(key(USER_A), [row('1')]);
      // navigator.onLine stays true: the lookup itself fails, so the saved
      // thread shows and the send reaches the lookup.
      goOffline();
      const store = createTestStore();
      await store.getState().fetchNotes();
      writeLocalCopy.mockClear();
      lookupPartnerId.mockClear();

      await store.getState().sendNote('lookup fails');
      await flush();

      // A failed read is never "unlinked": refused with its reason.
      expect(lookupPartnerId).toHaveBeenCalled();
      expect(store.getState().notesError).toBe('TypeError: Failed to fetch');
      expect(stateIds(store)).toEqual(['1']);
      expect(writeLocalCopy).not.toHaveBeenCalled();
      expect(savedIds()).toEqual(['1']);
    });

    it('a confirmed send whose row a refresh already listed is not doubled', async () => {
      const store = createTestStore();
      const reply = deferred();
      server.insertHold = reply.promise;

      const sending = store.getState().sendNote('raced');
      await vi.waitFor(() => expect(server.rows).toHaveLength(1));
      // The row has committed but its reply is still in flight when a refresh
      // (reconnect) lists it: the refresh recognises it by its idempotency key.
      await store.getState().fetchNotes();
      expect(stateIds(store)).toEqual(['server-1']);

      reply.resolve();
      await sending;
      await flush();

      expect(stateIds(store)).toEqual(['server-1']);
      expect(savedIds()).toEqual(['server-1']);
    });

    it('a confirmed removal takes the note out of state and the copy', async () => {
      server.rows = [row('1'), row('2')];
      const store = createTestStore();
      await store.getState().fetchNotes();

      await store.getState().removeNote('1');

      expect(stateIds(store)).toEqual(['2']);
      expect(savedIds()).toEqual(['2']);
    });

    it('a failed removal leaves the copy unchanged', async () => {
      server.rows = [row('1'), row('2')];
      const store = createTestStore();
      await store.getState().fetchNotes();
      writeLocalCopy.mockClear();
      server.removalError = { message: 'removal rejected' };

      await expect(store.getState().removeNote('1')).rejects.toBeTruthy();

      expect(stateIds(store)).toEqual(['1', '2']);
      expect(writeLocalCopy).not.toHaveBeenCalled();
      expect(savedIds()).toEqual(['1', '2']);
    });

    it('an older page saves the whole confirmed list', async () => {
      server.rows = [row('1'), row('2'), row('3')];
      const store = createTestStore();
      await store.getState().fetchNotes(2);
      expect(savedIds()).toEqual(['2', '3']);

      await store.getState().fetchOlderNotes(2);

      expect(stateIds(store)).toEqual(['1', '2', '3']);
      expect(savedIds()).toEqual(['1', '2', '3']);
    });

    it('an in-flight older page is dropped when a replacing refresh lands', async () => {
      server.rows = ['1', '2', '3', '4', '5', '6'].map((id) => row(id));
      const store = createTestStore();
      await store.getState().fetchNotes(2);
      const gate = deferred();
      server.hold = gate.promise;
      const older = store.getState().fetchOlderNotes(2);
      await flush();

      // More than a page arrives: the refresh replaces the thread, so the page
      // below note 5 no longer joins onto anything on screen.
      server.hold = null;
      server.rows.push(row('7'), row('8'));
      await store.getState().fetchNotes(2, { keepOlder: true });
      gate.resolve();
      await older;

      expect(stateIds(store)).toEqual(['7', '8']);
      expect(savedIds()).toEqual(['7', '8']);
      expect(store.getState().notesIsLoading).toBe(false);
    });

    it('an in-flight older page lands continuously when a merging refresh lands', async () => {
      server.rows = ['1', '2', '3', '4', '5', '6'].map((id) => row(id));
      const store = createTestStore();
      await store.getState().fetchNotes(2);
      await store.getState().fetchOlderNotes(2);
      const gate = deferred();
      server.hold = gate.promise;
      const older = store.getState().fetchOlderNotes(2);
      await flush();

      server.hold = null;
      server.rows.push(row('7'));
      await store.getState().fetchNotes(2, { keepOlder: true });
      gate.resolve();
      await older;

      expect(stateIds(store)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
      expect(savedIds()).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    });

    it('a second older-page request with the same cursor is dropped, not doubled', async () => {
      server.rows = ['1', '2', '3', '4', '5', '6'].map((id) => row(id));
      const store = createTestStore();
      await store.getState().fetchNotes(2);
      const first = deferred();
      server.hold = first.promise;
      const olderA = store.getState().fetchOlderNotes(2);
      await flush();

      // A refresh lands mid-flight and clears the loading flag, so the list
      // asks again with the same cursor.
      server.hold = null;
      await store.getState().fetchNotes(2, { keepOlder: true });
      const second = deferred();
      server.hold = second.promise;
      const olderB = store.getState().fetchOlderNotes(2);
      await flush();

      first.resolve();
      await olderA;
      second.resolve();
      await olderB;

      expect(stateIds(store)).toEqual(['3', '4', '5', '6']);
      expect(savedIds()).toEqual(['3', '4', '5', '6']);
      expect(store.getState().notesIsLoading).toBe(false);
    });

    it('a dropped older page leaves the loading flag to a page requested after it', async () => {
      server.rows = ['1', '2', '3', '4', '5', '6'].map((id) => row(id));
      const store = createTestStore();
      await store.getState().fetchNotes(2);
      const first = deferred();
      server.hold = first.promise;
      const olderA = store.getState().fetchOlderNotes(2);
      await flush();

      server.hold = null;
      server.rows.push(row('7'), row('8'));
      await store.getState().fetchNotes(2, { keepOlder: true });
      const second = deferred();
      server.hold = second.promise;
      const olderB = store.getState().fetchOlderNotes(2);
      await flush();

      // The first page no longer joins onto the thread and is dropped, but the
      // second page is still in flight and keeps its spinner.
      first.resolve();
      await olderA;
      expect(stateIds(store)).toEqual(['7', '8']);
      expect(store.getState().notesIsLoading).toBe(true);

      second.resolve();
      await olderB;
      expect(stateIds(store)).toEqual(['5', '6', '7', '8']);
      expect(store.getState().notesIsLoading).toBe(false);
    });

    it('offline, an older page on a thread shown from the copy raises no banner and changes nothing', async () => {
      savedCopies.set(key(USER_A), [row('1'), row('2')]);
      goOffline();
      const store = createTestStore();
      await store.getState().fetchNotes();
      // The infinite loader asks for more whatever the copy's length.
      store.setState({ notesHasMore: true });
      writeLocalCopy.mockClear();

      await store.getState().fetchOlderNotes();

      expect(stateIds(store)).toEqual(['1', '2']);
      expect(store.getState().notesError).toBeNull();
      expect(store.getState().notesIsLoading).toBe(false);
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });

    it('an older page for an unlinked account still shows "Partner not configured"', async () => {
      server.rows = [row('1')];
      const store = createTestStore();
      await store.getState().fetchNotes();
      store.setState({ notesHasMore: true });
      lookupPartnerId.mockResolvedValue({ status: 'unlinked' });

      await store.getState().fetchOlderNotes();

      expect(store.getState().notesError).toBe('Partner not configured');
    });

    it('removing the oldest note keeps an in-flight older page', async () => {
      server.rows = ['1', '2', '3', '4', '5', '6'].map((id) => row(id));
      const store = createTestStore();
      await store.getState().fetchNotes(2);
      const gate = deferred();
      server.hold = gate.promise;
      const older = store.getState().fetchOlderNotes(2);
      await flush();

      // The page below note 5 still joins onto note 6 once 5 is gone.
      await store.getState().removeNote('5');
      expect(stateIds(store)).toEqual(['6']);
      gate.resolve();
      await older;

      expect(stateIds(store)).toEqual(['3', '4', '6']);
      expect(savedIds()).toEqual(['3', '4', '6']);
      expect(store.getState().notesIsLoading).toBe(false);
    });

    it("an older page resolving after an account switch saves nothing for A", async () => {
      server.rows = [row('1'), row('2'), row('3')];
      const store = createTestStore();
      await store.getState().fetchNotes(2);
      writeLocalCopy.mockClear();
      const gate = deferred();
      server.hold = gate.promise;

      const inFlight = store.getState().fetchOlderNotes(2);
      await flush();
      store.setState({ userId: USER_B, authSessionVersion: 2, notes: [] });
      gate.resolve();
      await inFlight;

      expect(store.getState().notes).toEqual([]);
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });
  });
});
