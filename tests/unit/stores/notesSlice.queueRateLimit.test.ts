/**
 * notesSlice — love-note text saved offline and sent later (story 9, CAP-3):
 * notes queued offline do not count toward the send rate limit.
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
import { getPartnerId } from '../../../src/api/supabaseClient';
import { enqueueNote, listQueuedNotes } from '../../../src/services/noteQueue';
import {
  IMAGE_NOTE_NEEDS_CONNECTION,
  NoteRefusedOfflineError,
} from '../../../src/stores/slices/notesSlice';
import {
  A,
  clearStores,
  contents,
  createTestStore,
  fakeFrom,
  PARTNER,
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

/** A's note to PARTNER shown failed under its `tempId`, no longer sending. */
function failedNote(
  tempId: string,
  content: string,
  overrides: Partial<LoveNote> = {}
): LoveNote {
  return {
    id: tempId,
    tempId,
    from_user_id: A,
    to_user_id: PARTNER,
    content,
    created_at: '2026-09-24T09:00:00.000Z',
    sending: false,
    error: true,
    ...overrides,
  };
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
      await enqueueNote(queued(tempId, 'refused', { createdAt, failed: true }));
      store.setState({
        notes: [failedNote(tempId, 'refused', { created_at: createdAt, queued: true })],
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
        notes: [failedNote('temp-pic', 'pic')],
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
});
