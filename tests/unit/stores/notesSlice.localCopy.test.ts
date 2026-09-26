/**
 * notesSlice — the `love-notes` local copy (unified data storage, story 8)
 *
 * `fetchNotes` shows the account's saved thread at once — before the partner
 * lookup — then replaces state and copy with the server's page. A failed read
 * changes nothing and, while a saved thread is on screen, raises no banner; an
 * empty answer saves `[]`. A result raised for one account or session is
 * never shown or saved under another. Confirmed changes that rewrite the copy
 * are in `notesSlice.localCopyWrites.test.ts`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { LoveNote } from '../../../src/types/models';

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
vi.mock('../../../src/services/localCopy', () => ({
  readLocalCopy: (userId: string, kind: string) => readLocalCopy(userId, kind),
  writeLocalCopy: (userId: string, kind: string, value: unknown) =>
    writeLocalCopy(userId, kind, value),
  registerLocalCopy: (kind: string, refresh: () => Promise<void>) =>
    registerLocalCopy(kind, refresh),
}));

import 'fake-indexeddb/auto';
import { openMyLoveDB } from '../../../src/services/dbSchema';
import { LOVE_NOTES_COPY_KIND } from '../../../src/stores/slices/notesSlice';
import {
  USER_A,
  PARTNER,
  USER_B,
  server,
  fakeFrom,
  getPartnerId,
  lookupPartnerId,
  readLocalCopy,
  writeLocalCopy,
  registerLocalCopy,
  savedCopies,
  createTestStore,
  row,
  key,
  savedIds,
  stateIds,
  deferred,
  readsHeld,
  goOffline,
} from './notesSliceCopyFixture';

/** A note held on this device under its `tempId`, not yet confirmed by the server. */
function pendingNote(tempId: string, overrides: Partial<LoveNote> = {}): LoveNote {
  return { ...row(tempId), id: tempId, tempId, ...overrides };
}

/** USER_A's note the server rejected: shown failed, no longer sending. */
const failedOwnNote = (tempId: string) =>
  pendingNote(tempId, { from_user_id: USER_A, to_user_id: PARTNER, error: true, sending: false });

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
    server.heldReads = 0;
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
      // The copy is on screen before the server has answered.
      await vi.waitFor(() => expect(stateIds(store)).toEqual(['1']));

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
      await vi.waitFor(() => expect(stateIds(store)).toEqual(['1']));
      expect(lookupPartnerId).toHaveBeenCalledTimes(1);

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
      await vi.waitFor(() =>
        expect(console.error).toHaveBeenCalledWith('[NotesSlice] Ignoring a malformed love-notes copy')
      );
      expect(store.getState().notes).toEqual([]);

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
      const failed = failedOwnNote('temp-x');
      store.setState({ notes: [failed] });

      await store.getState().fetchNotes();

      expect(stateIds(store)).toEqual(['1', 'temp-x']);
      expect(savedIds()).toEqual(['1']);
    });

    it('a refresh that already returns a failed note\'s committed row shows it once', async () => {
      // The insert committed but its reply was lost, so the note shows failed.
      server.rows = [row('1'), row('2', { idempotency_key: 'temp-x', from_user_id: USER_A, to_user_id: PARTNER })];
      const store = createTestStore();
      const failed = failedOwnNote('temp-x');
      store.setState({ notes: [failed] });

      await store.getState().fetchNotes();

      expect(stateIds(store)).toEqual(['1', '2']);
      expect(savedIds()).toEqual(['1', '2']);
    });

    it('a refresh revokes the previews of notes it replaces, never of notes it keeps', async () => {
      const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      server.rows = [row('2', { idempotency_key: 'temp-done' })];
      const store = createTestStore();
      const kept = pendingNote('temp-kept', { error: true, imagePreviewUrl: 'blob:kept-preview' });
      const replaced = pendingNote('temp-done', {
        sending: true,
        imagePreviewUrl: 'blob:replaced-preview',
      });
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
      const failed = failedOwnNote('temp-x');
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
      await readsHeld(1);
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
      await readsHeld(1);
      store.setState({ authSessionVersion: 2, notes: [] });
      gate.resolve();
      await inFlight;

      expect(store.getState().notes).toEqual([]);
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });
  });
});
