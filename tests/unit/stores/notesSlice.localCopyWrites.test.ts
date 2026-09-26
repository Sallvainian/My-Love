/**
 * notesSlice — the `love-notes` local copy (unified data storage, story 8):
 * confirmed changes
 *
 * Every confirmed change (incoming note, confirmed send or resend, confirmed
 * removal, older page) rewrites the copy, which holds confirmed server rows
 * only. A result raised for one account or session is never shown or saved
 * under another. `fetchNotes` and the account switch are in
 * `notesSlice.localCopy.test.ts`.
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
import { NoteRefusedOfflineError } from '../../../src/stores/slices/notesSlice';
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

  describe('confirmed changes rewrite the copy', () => {
    it('an incoming Realtime note is added, then the copy is rewritten', async () => {
      server.rows = [row('1')];
      const store = createTestStore();
      await store.getState().fetchNotes();

      store.getState().addNote(row('2') as LoveNote);

      expect(stateIds(store)).toEqual(['1', '2']);
      await vi.waitFor(() => expect(savedIds()).toEqual(['1', '2']));
    });

    it('a duplicate Realtime note writes nothing', async () => {
      server.rows = [row('1')];
      const store = createTestStore();
      await store.getState().fetchNotes();
      writeLocalCopy.mockClear();

      // addNote starts the copy write synchronously when it adds a note, so a
      // write that was going to happen has already been requested.
      store.getState().addNote(row('1') as LoveNote);

      expect(writeLocalCopy).not.toHaveBeenCalled();

      // Positive control for that premise: a new note's write is requested
      // before addNote returns.
      store.getState().addNote(row('2') as LoveNote);
      expect(writeLocalCopy).toHaveBeenCalledTimes(1);
    });

    it('a failed copy write on an incoming note is logged and the note still shows', async () => {
      const store = createTestStore();
      writeLocalCopy.mockRejectedValue(new Error('QuotaExceededError'));

      store.getState().addNote(row('2') as LoveNote);

      expect(stateIds(store)).toEqual(['2']);
      await vi.waitFor(() =>
        expect(console.error).toHaveBeenCalledWith(
          '[NotesSlice] Failed to save the love-notes copy:',
          expect.any(Error)
        )
      );
    });

    it('a confirmed send puts the server row in state and in the copy', async () => {
      server.rows = [row('1')];
      const store = createTestStore();
      await store.getState().fetchNotes();

      await store.getState().sendNote('hello');
      await store.getState().drainQueuedNotes();

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

      // The lookup is awaited inside sendNote, so its refusal has landed.
      await store.getState().sendNote('lookup fails');

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
      // sendNote only started the drain; the in-flight drain's own promise is
      // what confirms the send.
      await store.getState().drainQueuedNotes();

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
      await readsHeld(1);

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
      await readsHeld(1);

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
      await readsHeld(1);

      // A refresh lands mid-flight and clears the loading flag, so the list
      // asks again with the same cursor.
      server.hold = null;
      await store.getState().fetchNotes(2, { keepOlder: true });
      const second = deferred();
      server.hold = second.promise;
      const olderB = store.getState().fetchOlderNotes(2);
      await readsHeld(2);

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
      await readsHeld(1);

      server.hold = null;
      server.rows.push(row('7'), row('8'));
      await store.getState().fetchNotes(2, { keepOlder: true });
      const second = deferred();
      server.hold = second.promise;
      const olderB = store.getState().fetchOlderNotes(2);
      await readsHeld(2);

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
      await readsHeld(1);

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
      await readsHeld(1);
      store.setState({ userId: USER_B, authSessionVersion: 2, notes: [] });
      gate.resolve();
      await inFlight;

      expect(store.getState().notes).toEqual([]);
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });
  });
});
