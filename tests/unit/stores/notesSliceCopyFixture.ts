/**
 * Shared fakes and helpers for the notesSlice `love-notes` local-copy specs
 * (`notesSlice.localCopy.test.ts`, `notesSlice.localCopyWrites.test.ts`): the
 * fake server behind `supabase.from`, the `vi.fn`s the per-file mocks of
 * `supabaseClient` and `localCopy` delegate to, the saved-copy map, and the
 * store and assertion helpers. The mocks themselves stay in each test file.
 */
import { expect, vi, type Mock } from 'vitest';
import { create, type StateCreator } from 'zustand';
import type { LoveNote } from '../../../src/types/models';
import {
  createNotesSlice,
  LOVE_NOTES_COPY_KIND,
  type NotesSlice,
} from '../../../src/stores/slices/notesSlice';

export const USER_A = 'USER-A-ID';
export const PARTNER = 'PARTNER-ID';
export const USER_B = 'USER-B-ID';

type Row = Required<Pick<LoveNote, 'id' | 'from_user_id' | 'to_user_id' | 'content' | 'created_at'>> & {
  image_url: string | null;
  /** The view is `select *`: rows carry the key the sender composed with. */
  idempotency_key?: string;
};

/** What the fake server answers, and how. */
export const server = {
  rows: [] as Row[],
  lookup: { status: 'linked', partnerId: PARTNER } as
    | { status: 'linked'; partnerId: string }
    | { status: 'unlinked' }
    | { status: 'error'; reason: string },
  /** Hold the next page read until released (account-switch cases). */
  hold: null as Promise<void> | null,
  /** Page reads that have reached `hold` and are parked on it. */
  heldReads: 0,
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
        if (server.hold) {
          server.heldReads += 1;
          await server.hold;
        }
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

export function fakeFrom(table: string) {
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

export const getPartnerId: Mock = vi.fn();
export const lookupPartnerId: Mock = vi.fn();

export const savedCopies = new Map<string, unknown>();
export const readLocalCopy: Mock = vi.fn();
export const writeLocalCopy: Mock = vi.fn();
export const registerLocalCopy: Mock = vi.fn();

type TestStore = NotesSlice & { userId: string | null; authSessionVersion: number };

export function createTestStore() {
  const store = create<TestStore>()(createNotesSlice as unknown as StateCreator<TestStore>);
  store.setState({ userId: USER_A, authSessionVersion: 1 });
  return store;
}

export function row(id: string, overrides: Partial<Row> = {}): Row {
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

export const key = (userId: string) => `${userId}|${LOVE_NOTES_COPY_KIND}`;
export const savedIds = (userId = USER_A) =>
  (savedCopies.get(key(userId)) as { id: string }[] | undefined)?.map((n) => n.id);
export const stateIds = (store: ReturnType<typeof createTestStore>) =>
  store.getState().notes.map((n) => n.id);

export function deferred<T = void>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** Waits until `n` page reads in this test are parked on `server.hold`. */
export const readsHeld = (n: number) => vi.waitFor(() => expect(server.heldReads).toBe(n));

export function goOffline() {
  lookupPartnerId.mockResolvedValue({ status: 'error', reason: 'TypeError: Failed to fetch' });
  getPartnerId.mockResolvedValue(null);
}
