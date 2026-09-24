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
  insertError: null as { message: string } | null,
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

import {
  createNotesSlice,
  LOVE_NOTES_COPY_KIND,
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

describe('notesSlice love-notes local copy', () => {
  beforeEach(() => {
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
      await flush();

      expect(stateIds(store)).toEqual(['1', 'server-1']);
      expect(savedIds()).toEqual(['1', 'server-1']);
      const saved = (savedCopies.get(key(USER_A)) as Record<string, unknown>[])[1];
      // Plain confirmed data only: no client-side fields.
      expect(Object.keys(saved).sort()).toEqual(
        ['content', 'created_at', 'from_user_id', 'id', 'image_url', 'to_user_id'].sort()
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
      server.insertError = { message: 'insert failed' };

      await store.getState().sendNote('will fail');
      await flush();

      expect(store.getState().notes.at(-1)?.error).toBe(true);
      expect(savedIds()).toEqual(['1']);
    });

    it('a confirmed resend saves the row in the copy', async () => {
      const store = createTestStore();
      server.insertError = { message: 'insert failed' };
      await store.getState().sendNote('retry me');
      const tempId = store.getState().notes[0].tempId!;
      expect(savedIds()).toBeUndefined();

      server.insertError = null;
      await store.getState().retryFailedMessage(tempId);

      expect(stateIds(store)).toEqual(['server-1']);
      expect(savedIds()).toEqual(['server-1']);
    });

    it('offline, a send is refused as today and the copy is unchanged', async () => {
      savedCopies.set(key(USER_A), [row('1')]);
      goOffline();
      const store = createTestStore();
      await store.getState().fetchNotes();
      writeLocalCopy.mockClear();

      await store.getState().sendNote('offline note');
      await flush();

      expect(store.getState().notesError).toBe('Partner not configured');
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
