/**
 * notesSlice — a retried send must not post the note twice
 *
 * Vector: the INSERT commits in Postgres but the response never reaches the
 * browser (dropped connection, backgrounded tab, timeout). The client marks the
 * note failed and offers Retry; the retry used to insert a second identical row,
 * and the partner's chat showed the note twice forever.
 *
 * No test file imported notesSlice before this one — sendNote and
 * retryFailedMessage were only ever reached through MessageInput tests that
 * mock the store wholesale, so the real insert never executed.
 *
 * The fake models the `(from_user_id, idempotency_key)` unique constraint and
 * ON CONFLICT DO NOTHING, so "how many rows exist afterwards" is an observable
 * outcome rather than an assertion about call shapes.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { create, type StateCreator } from 'zustand';

interface FakeRow {
  id: string;
  from_user_id: string;
  to_user_id: string;
  content: string;
  image_url: string | null;
  idempotency_key: string;
  created_at: string;
}

const PARTNER_ID = '00000000-0000-4000-8000-0000000000b0';
const USER_ID = '00000000-0000-4000-8000-0000000000a0';

/** Rows the "server" holds, plus a switch to drop the next response */
const backend = {
  rows: [] as FakeRow[],
  seq: 0,
  /** Commit the next write, then fail the client's response path */
  loseNextResponse: false,
  /** Reject the next write outright — nothing is committed */
  failNextWrite: false,
  /** Fail the next plain read, as a dead network would */
  failNextLookup: false,
  reset() {
    this.rows = [];
    this.seq = 0;
    this.loseNextResponse = false;
    this.failNextWrite = false;
    this.failNextLookup = false;
  },
};

/** upsert(...).select().maybeSingle() and select().eq().eq().single() */
function fakeFrom(table: string) {
  if (table !== 'love_notes') throw new Error(`unmodelled table ${table}`);

  const filters: Array<{ column: string; value: unknown }> = [];
  let pending: FakeRow | null = null;
  let isInsert = false;
  let writeRejected = false;

  const api = {
    upsert(
      values: Omit<FakeRow, 'id' | 'created_at'>,
      options?: { ignoreDuplicates?: boolean; onConflict?: string }
    ) {
      isInsert = true;
      if (backend.failNextWrite) {
        backend.failNextWrite = false;
        writeRejected = true;
        return api;
      }
      // Dedup on the columns the CALLER asked for, not on a hardcoded key.
      // Postgres uses `on_conflict` verbatim, so a fake that ignores it passes
      // no matter which column the source names — and the conflict target is
      // the entire mechanism these tests exist to protect.
      if (!options?.onConflict) throw new Error('upsert without onConflict');
      const conflictColumns = options.onConflict.split(',').map((c) => c.trim());
      const clash = backend.rows.find((r) =>
        conflictColumns.every(
          (col) =>
            (r as unknown as Record<string, unknown>)[col] ===
            (values as unknown as Record<string, unknown>)[col]
        )
      );

      if (clash) {
        // ON CONFLICT DO NOTHING: no row written, no row returned.
        if (!options?.ignoreDuplicates) throw new Error('expected ignoreDuplicates');
        pending = null;
      } else {
        const row: FakeRow = {
          ...values,
          id: `row-${++backend.seq}`,
          created_at: new Date('2026-07-27T00:00:00.000Z').toISOString(),
        };
        backend.rows.push(row);
        pending = row;
      }
      return api;
    },
    select() {
      return api;
    },
    eq(column: string, value: unknown) {
      filters.push({ column, value });
      return api;
    },
    async maybeSingle() {
      if (writeRejected) {
        return { data: null, error: { message: 'insert rejected' } };
      }
      if (isInsert && backend.loseNextResponse) {
        backend.loseNextResponse = false;
        // Row is committed; only the response is lost.
        return { data: null, error: { message: 'network error' } };
      }
      if (isInsert) return { data: pending, error: null };

      if (backend.failNextLookup) {
        backend.failNextLookup = false;
        return { data: null, error: { message: 'network error' } };
      }

      // A plain read: apply the filters, and report "no such row" as an absence
      // rather than an error — that is what maybeSingle is for.
      const match = backend.rows.find((r) =>
        filters.every((f) => (r as unknown as Record<string, unknown>)[f.column] === f.value)
      );
      return { data: match ?? null, error: null };
    },
    async single() {
      const match = backend.rows.find((r) =>
        filters.every((f) => (r as unknown as Record<string, unknown>)[f.column] === f.value)
      );
      if (!match) return { data: null, error: { code: 'PGRST116', message: 'No rows found' } };
      return { data: match, error: null };
    },
  };

  return api;
}

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: { from: (table: string) => fakeFrom(table) },
  getPartnerId: vi.fn(async () => PARTNER_ID),
}));

vi.mock('../../../src/services/loveNoteImageService', () => ({
  uploadCompressedBlob: vi.fn(),
  deleteLoveNoteImage: vi.fn(async () => undefined),
}));

vi.mock('../../../src/services/imageCompressionService', () => ({
  imageCompressionService: {
    validateImageFile: vi.fn(() => ({ valid: true })),
    compressImage: vi.fn(async (file: Blob) => ({ blob: file, originalSize: 3, compressedSize: 3 })),
  },
}));

import { deleteLoveNoteImage, uploadCompressedBlob } from '../../../src/services/loveNoteImageService';
import { createNotesSlice, type NotesSlice } from '../../../src/stores/slices/notesSlice';

const mockedUploadCompressedBlob = vi.mocked(uploadCompressedBlob);
const mockedDeleteLoveNoteImage = vi.mocked(deleteLoveNoteImage);

type TestStore = NotesSlice & { userId: string | null };

function createTestStore() {
  const store = create<TestStore>()(createNotesSlice as unknown as StateCreator<TestStore>);
  store.setState({ userId: USER_ID });
  return store;
}

describe('notesSlice send idempotency', () => {
  beforeEach(() => {
    backend.reset();
    vi.clearAllMocks();
  });

  it('sends a note with the composed message tempId as its idempotency key', async () => {
    const store = createTestStore();
    await store.getState().sendNote('i love you');

    expect(backend.rows).toHaveLength(1);
    // The key has to be the tempId, because that is the value the retry path
    // still has in hand after a failure.
    const optimisticKey = backend.rows[0].idempotency_key;
    expect(optimisticKey).toMatch(/^temp-/);
  });

  it('a retry after a lost response resolves to the committed row', async () => {
    const store = createTestStore();

    // The row commits; the client sees a failure and offers Retry.
    backend.loseNextResponse = true;
    await store.getState().sendNote('i love you');

    expect(backend.rows).toHaveLength(1);
    const failed = store.getState().notes.find((n) => n.error);
    expect(failed).toBeDefined();

    await store.getState().retryFailedMessage(failed!.tempId as string);

    // The whole point: still one row, and the optimistic note is now resolved
    // against the row that was already there.
    expect(backend.rows).toHaveLength(1);
    const settled = store.getState().notes.find((n) => n.id === backend.rows[0].id);
    expect(settled).toBeDefined();
    expect(settled!.error).toBe(false);
    expect(settled!.sending).toBe(false);
  });

  it('two genuinely different sends both land', async () => {
    const store = createTestStore();
    await store.getState().sendNote('first');
    await store.getState().sendNote('second');

    expect(backend.rows).toHaveLength(2);
    expect(backend.rows[0].idempotency_key).not.toBe(backend.rows[1].idempotency_key);
  });

  it('the same text sent twice is two notes, not a suppressed duplicate', async () => {
    // Uniqueness is on the client key, never on content — saying "i love you"
    // twice must produce two notes.
    const store = createTestStore();
    await store.getState().sendNote('i love you');
    await store.getState().sendNote('i love you');

    expect(backend.rows).toHaveLength(2);
  });

  describe('image attached to a retried note', () => {
    // The upload Edge Function names the object server-side and takes no
    // idempotency key, so every retry produces a NEW storage path while the
    // note itself deduplicates on tempId. Whichever object the resolved row
    // does not point at is referenced by nothing.

    function imageFile(): File {
      return new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' });
    }

    /** Hand out a distinct storage path per upload, like the Edge Function */
    function uploadsDistinctPaths(): void {
      let n = 0;
      mockedUploadCompressedBlob.mockImplementation(async () => ({
        storagePath: `${USER_ID}/upload-${++n}.jpg`,
        compressedSize: 3,
      }));
    }

    it('deletes the object the resolved row does not reference', async () => {
      uploadsDistinctPaths();
      const store = createTestStore();

      backend.loseNextResponse = true;
      await store.getState().sendNote('look at this', imageFile());

      const failed = store.getState().notes.find((n) => n.error);
      expect(failed).toBeDefined();
      // The committed row points at the first upload.
      expect(backend.rows).toHaveLength(1);
      expect(backend.rows[0].image_url).toBe(`${USER_ID}/upload-1.jpg`);

      await store.getState().retryFailedMessage(failed!.tempId as string);

      // Still one note, and the second object — which nothing references — was
      // cleaned up rather than left to sit against the user's quota.
      expect(backend.rows).toHaveLength(1);
      expect(backend.rows[0].image_url).toBe(`${USER_ID}/upload-1.jpg`);
      expect(mockedDeleteLoveNoteImage).toHaveBeenCalledWith(`${USER_ID}/upload-2.jpg`);
      expect(mockedDeleteLoveNoteImage).toHaveBeenCalledTimes(1);
    });

    it('keeps the object when the retry is the attempt that lands', async () => {
      uploadsDistinctPaths();
      const store = createTestStore();

      // Nothing committed the first time, so the retry writes the row and its
      // own upload is the one the row points at.
      backend.failNextWrite = true;
      await store.getState().sendNote('look at this', imageFile());

      const failed = store.getState().notes.find((n) => n.error);
      expect(failed).toBeDefined();
      expect(backend.rows).toHaveLength(0);
      // The first attempt's own object was discarded on its failure path.
      expect(mockedDeleteLoveNoteImage).toHaveBeenCalledWith(`${USER_ID}/upload-1.jpg`);
      mockedDeleteLoveNoteImage.mockClear();

      await store.getState().retryFailedMessage(failed!.tempId as string);

      expect(backend.rows).toHaveLength(1);
      expect(backend.rows[0].image_url).toBe(`${USER_ID}/upload-2.jpg`);
      // Deleting this one would break the note that just landed.
      expect(mockedDeleteLoveNoteImage).not.toHaveBeenCalled();
    });

    it('keeps the image when the first attempt committed but its response was lost', async () => {
      uploadsDistinctPaths();
      const store = createTestStore();

      backend.loseNextResponse = true;
      await store.getState().sendNote('look at this', imageFile());

      // A failed insert is not proof that nothing was written. Here the row did
      // land and points at this object, so the failure path must leave it
      // alone -- deleting it leaves a delivered note with no picture.
      expect(backend.rows).toHaveLength(1);
      expect(backend.rows[0].image_url).toBe(`${USER_ID}/upload-1.jpg`);
      expect(mockedDeleteLoveNoteImage).not.toHaveBeenCalled();
    });

    it('deletes the image when the insert genuinely wrote nothing', async () => {
      uploadsDistinctPaths();
      const store = createTestStore();

      backend.failNextWrite = true;
      await store.getState().sendNote('look at this', imageFile());

      // Nothing references it, so it must not sit against the user's quota.
      expect(backend.rows).toHaveLength(0);
      expect(mockedDeleteLoveNoteImage).toHaveBeenCalledWith(`${USER_ID}/upload-1.jpg`);
    });

    it('keeps the image when the reference check itself fails', async () => {
      // The insert most likely failed because the network did, which is exactly
      // when the lookup fails too. An orphaned object costs quota; a wrong
      // delete costs the picture, so an unreadable answer must mean "keep".
      // The photoService twin has covered this since it was written; this fake
      // could not previously produce a failing read at all.
      uploadsDistinctPaths();
      const store = createTestStore();

      backend.failNextWrite = true;
      backend.failNextLookup = true;
      await store.getState().sendNote('look at this', imageFile());

      expect(backend.rows).toHaveLength(0);
      expect(mockedDeleteLoveNoteImage).not.toHaveBeenCalled();
    });

    it('deletes nothing when the retried note had no image', async () => {
      const store = createTestStore();

      backend.loseNextResponse = true;
      await store.getState().sendNote('no picture');
      const failed = store.getState().notes.find((n) => n.error);

      await store.getState().retryFailedMessage(failed!.tempId as string);

      expect(backend.rows).toHaveLength(1);
      expect(mockedDeleteLoveNoteImage).not.toHaveBeenCalled();
    });
  });
});
