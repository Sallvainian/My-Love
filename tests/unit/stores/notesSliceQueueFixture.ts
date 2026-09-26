/**
 * Shared fakes and helpers for the `notesSlice.offlineQueue.test.ts` and
 * `notesSlice.queue*.test.ts` files. Each test file keeps its own `vi.mock`s,
 * the hoisted `copyWrites` and its hooks; this module only builds on the
 * modules those mocks replace, and the mock factories call into it lazily.
 *
 * The Supabase fake models the `(from_user_id, idempotency_key)` unique
 * constraint and ON CONFLICT DO NOTHING, so "how many rows exist" is an
 * observable outcome.
 */
import { expect, vi, type Mock } from 'vitest';
import { create, type StateCreator } from 'zustand';
import { openMyLoveDB } from '../../../src/services/dbSchema';
import { readLocalCopy } from '../../../src/services/localCopy';
import { listQueuedNotes, type QueuedNote } from '../../../src/services/noteQueue';
import {
  createNotesSlice,
  LOVE_NOTES_COPY_KIND,
  type NotesSlice,
} from '../../../src/stores/slices/notesSlice';

export const A = 'USER-A-ID';
export const PARTNER = 'PARTNER-ID';
export const B = 'USER-B-ID';

interface Row {
  id: string;
  from_user_id: string;
  to_user_id: string;
  content: string;
  image_url: string | null;
  idempotency_key: string;
  created_at: string;
  written_at?: string | null;
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

export const server = {
  rows: [] as Row[],
  seq: 0,
  /** One outcome per upsert, in order; 'ok' once exhausted. */
  outcomes: [] as Outcome[],
  upserts: 0,
  lookup: { status: 'linked', partnerId: PARTNER } as
    | { status: 'linked'; partnerId: string }
    | { status: 'unlinked' }
    | { status: 'error'; reason: string; offline?: true },
  readError: null as { message: string } | null,
  /** Every table a request went to, in order. */
  requests: [] as string[],
  reset() {
    this.requests = [];
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

/** The `supabase.from` of the mocked client: one fake builder per table. */
export function fakeFrom(table: string) {
  server.requests.push(table);
  if (table === 'love_notes_visible') return readBuilder();
  if (table === 'love_notes') return notesBuilder();
  throw new Error(`unmodelled table ${table}`);
}

export const sendEphemeralBroadcast: Mock = vi.fn();
export const uploadCompressedBlob: Mock = vi.fn();

type TestStore = NotesSlice & {
  userId: string | null;
  authSessionVersion: number;
  partner: { id: string } | null;
};

/** Every store a test made; signed out after it, which cancels any retry timer. */
const liveStores: Array<{ setState: (partial: Partial<TestStore>) => void; getState: () => TestStore }> = [];

export function createTestStore(options: { partnerLoaded?: boolean; userId?: string } = {}) {
  const store = create<TestStore>()(createNotesSlice as unknown as StateCreator<TestStore>);
  store.setState({
    userId: options.userId ?? A,
    authSessionVersion: 1,
    partner: options.partnerLoaded === false ? null : { id: PARTNER },
  });
  liveStores.push(store);
  return store;
}
export type Store = ReturnType<typeof createTestStore>;

let online = true;
export function setOnline(value: boolean) {
  online = value;
}

/** Make `navigator.onLine` answer what `setOnline` last set. */
export function stubOnline() {
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
}

/** Sign out every store a test made, which cancels any retry timer. */
export function signOutLiveStores() {
  for (const store of liveStores.splice(0)) {
    store.setState({ userId: null, authSessionVersion: store.getState().authSessionVersion + 1 });
  }
}

/** The ids in the account's saved love-notes copy. */
export const copyIds = async (userId = A) =>
  (await readLocalCopy<{ id: string }[]>(userId, LOVE_NOTES_COPY_KIND))?.map((n) => n.id);

export function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

export const contents = (store: Store) => store.getState().notes.map((n) => n.content);

/** A queue row: A's text note to PARTNER, not yet sent and not refused. */
export function queued(id: string, content: string, overrides: Partial<QueuedNote> = {}): QueuedNote {
  return {
    id,
    userId: A,
    toUserId: PARTNER,
    content,
    createdAt: '2026-09-24T09:00:00.000Z',
    failed: false,
    ...overrides,
  };
}

/** A row the server already holds for A's note to PARTNER, sent under `idempotency_key`. */
export function serverRow(fields: Pick<Row, 'id' | 'content' | 'idempotency_key' | 'created_at'>): Row {
  return { from_user_id: A, to_user_id: PARTNER, image_url: null, ...fields };
}

/** The one confirmed row in A's saved love-notes copy, from before this session. */
export const SAVED_COPY_ROW = {
  id: 'saved-1',
  from_user_id: PARTNER,
  to_user_id: A,
  content: 'saved',
  created_at: '2026-09-20T10:00:00.000000+00:00',
  image_url: null,
};

export const queuedIds = async (userId = A) => (await listQueuedNotes(userId)).map((row) => row.id);

export async function clearStores() {
  const db = await openMyLoveDB();
  try {
    await db.clear('note-queue');
    await db.clear('local-copies');
  } finally {
    db.close();
  }
}

/** Send three notes while offline; each is queued and none is sent. */
export async function sendThreeOffline(store: Store) {
  setOnline(false);
  await store.getState().sendNote('one');
  await store.getState().sendNote('two');
  await store.getState().sendNote('three');
  await store.getState().drainQueuedNotes();
}

/**
 * The three notes of `sendThreeOffline` were delivered: each sent once, in
 * order, under its own key, then shown, saved to the copy, removed from the
 * queue and broadcast.
 */
export async function expectQueueDeliveredOnceInOrder(store: Store, keys: (string | undefined)[]) {
  expect(server.rows.map((r) => [r.content, r.idempotency_key])).toEqual([
    ['one', keys[0]],
    ['two', keys[1]],
    ['three', keys[2]],
  ]);
  expect(server.upserts).toBe(3);
  expect(store.getState().notes.map((n) => n.id)).toEqual(['server-1', 'server-2', 'server-3']);
  expect(store.getState().notes.every((n) => !n.queued && !n.sending && !n.error)).toBe(true);
  // The drain saves the copy without awaiting it.
  await vi.waitFor(async () => expect(await copyIds()).toEqual(['server-1', 'server-2', 'server-3']));
  expect(await queuedIds()).toEqual([]);
  expect(sendEphemeralBroadcast.mock.calls.map(([topic, , payload]) => [
    topic,
    (payload as { message: Row }).message.content,
  ])).toEqual([
    [`love-notes:${PARTNER}`, 'one'],
    [`love-notes:${PARTNER}`, 'two'],
    [`love-notes:${PARTNER}`, 'three'],
  ]);
}
