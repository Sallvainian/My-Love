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
  reset() {
    this.rows = [];
    this.seq = 0;
    this.loseNextResponse = false;
  },
};

/** upsert(...).select().maybeSingle() and select().eq().eq().single() */
function fakeFrom(table: string) {
  if (table !== 'love_notes') throw new Error(`unmodelled table ${table}`);

  const filters: Array<{ column: string; value: unknown }> = [];
  let pending: FakeRow | null = null;
  let isInsert = false;

  const api = {
    upsert(values: Omit<FakeRow, 'id' | 'created_at'>, options?: { ignoreDuplicates?: boolean }) {
      isInsert = true;
      const clash = backend.rows.find(
        (r) =>
          r.from_user_id === values.from_user_id && r.idempotency_key === values.idempotency_key
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
      if (isInsert && backend.loseNextResponse) {
        backend.loseNextResponse = false;
        // Row is committed; only the response is lost.
        return { data: null, error: { message: 'network error' } };
      }
      return { data: pending, error: null };
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
  imageCompressionService: { validateImageFile: vi.fn(() => ({ valid: true })) },
}));

import { createNotesSlice, type NotesSlice } from '../../../src/stores/slices/notesSlice';

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
});
