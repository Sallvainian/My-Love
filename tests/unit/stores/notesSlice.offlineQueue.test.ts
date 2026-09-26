/**
 * notesSlice — love-note text saved offline and sent later (story 9, CAP-3)
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
import { getPartnerId, lookupPartnerId } from '../../../src/api/supabaseClient';
import { readLocalCopy, writeLocalCopy } from '../../../src/services/localCopy';
import { enqueueNote, listQueuedNotes, removeQueuedNote } from '../../../src/services/noteQueue';
import {
  IMAGE_NOTE_NEEDS_CONNECTION,
  LOVE_NOTES_COPY_KIND,
  NoteRefusedOfflineError,
  type NotesSlice,
} from '../../../src/stores/slices/notesSlice';
import {
  A,
  clearStores,
  contents,
  copyIds,
  createTestStore,
  expectQueueDeliveredOnceInOrder,
  fakeFrom,
  PARTNER,
  queued,
  queuedIds,
  SAVED_COPY_ROW,
  sendEphemeralBroadcast,
  sendThreeOffline,
  server,
  serverRow,
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

const FRIENDLY_CHECK = 'Some values are not allowed - check length and format limits';
/**
 * Postgres SQLSTATE insufficient_privilege: an RLS refusal, a rejection rather
 * than a transient failure (src/api/errorHandlers.ts `handleSupabaseError`
 * errorMessages['42501'], function-local).
 */
const INSUFFICIENT_PRIVILEGE = '42501';

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

    await expectQueueDeliveredOnceInOrder(store, keys);
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
    await writeLocalCopy(A, LOVE_NOTES_COPY_KIND, [SAVED_COPY_ROW]);
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
    await enqueueNote(queued('temp-committed', 'committed'));
    server.rows.push(
      serverRow({
        id: 'server-99',
        content: 'committed',
        idempotency_key: 'temp-committed',
        created_at: '2026-09-24T09:00:00.000000+00:00',
      })
    );

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

  /** Queues three notes offline, reconnects, and has the server reject the first with CHECK. */
  async function rejectFirstOfThree() {
    const store = createTestStore();
    await sendThreeOffline(store);
    const failedKey = store.getState().notes[0].tempId!;
    setOnline(true);
    server.outcomes = [{ reject: '23514' }];

    await store.getState().drainQueuedNotes();
    return { store, failedKey };
  }

  it('server rejection: the note and its queue row are marked failed, with the banner', async () => {
    const { store, failedKey } = await rejectFirstOfThree();

    expect(store.getState().notes[0]).toMatchObject({ tempId: failedKey, error: true, sending: false, queued: true });
    expect(store.getState().notesError).toBe(FRIENDLY_CHECK);
    expect(await listQueuedNotes(A)).toEqual([expect.objectContaining({ id: failedKey, failed: true })]);
  });

  it('server rejection: the notes after the rejected one still send', async () => {
    await rejectFirstOfThree();

    expect(server.rows.map((r) => r.content)).toEqual(['two', 'three']);
  });

  it('server rejection: a later trigger does not resend the failed note', async () => {
    const { store } = await rejectFirstOfThree();

    await store.getState().drainQueuedNotes();
    expect(server.upserts).toBe(3);
  });

  it('server rejection: Retry resends under the same key and clears the failure', async () => {
    const { store, failedKey } = await rejectFirstOfThree();

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
    server.outcomes = [{ reject: INSUFFICIENT_PRIVILEGE }];
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
});
