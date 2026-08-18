/**
 * notesSlice — removing a note takes it out of one person's history only
 *
 * The thing that must not regress: love_notes holds exactly one row per message
 * and that row IS the partner's copy. A removal therefore writes to
 * love_note_removals and leaves love_notes alone; the reads go through
 * love_notes_visible, which anti-joins the caller's removals.
 *
 * The fake models the pieces that carry the guarantee rather than call shapes:
 * love_notes rows survive independently of removals, removals dedup on their
 * (user_id, note_id) primary key, and the view applies the anti-join for
 * whichever user is asking — so "does the partner still see it" is an
 * observable outcome here, not an assertion about which method was called.
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

const USER_ID = '00000000-0000-4000-8000-0000000000a0';
const PARTNER_ID = '00000000-0000-4000-8000-0000000000b0';

const backend = {
  notes: [] as FakeRow[],
  /** `${user_id}|${note_id}` — a Set is exactly the (user_id, note_id) primary key */
  removals: new Set<string>(),
  /** whose eyes love_notes_visible is being read through */
  readingAs: USER_ID,
  failNextRemoval: false,
  failNextRead: false,
  /** hold the next read's response so it can be delivered after a removal returns */
  holdNextRead: false,
  releaseHeldRead: null as (() => void) | null,
  /** fires inside the removal write, before it resolves */
  duringRemoval: null as (() => void) | null,
  reset() {
    this.notes = [];
    this.removals = new Set();
    this.readingAs = USER_ID;
    this.failNextRemoval = false;
    this.failNextRead = false;
    this.holdNextRead = false;
    this.releaseHeldRead = null;
    this.duringRemoval = null;
  },
  seed(count: number) {
    for (let i = 0; i < count; i++) {
      this.notes.push({
        id: `note-${i}`,
        from_user_id: i % 2 === 0 ? USER_ID : PARTNER_ID,
        to_user_id: i % 2 === 0 ? PARTNER_ID : USER_ID,
        content: `message ${i}`,
        image_url: i === 0 ? 'a0/pic.jpg' : null,
        idempotency_key: `k${i}`,
        created_at: `2026-08-17T10:0${i}:00.000Z`,
      });
    }
  },
};

function fakeFrom(table: string) {
  if (table === 'love_note_removals') {
    return {
      upsert(
        values: { user_id: string; note_id: string },
        options?: { onConflict?: string; ignoreDuplicates?: boolean }
      ) {
        return (async () => {
          backend.duringRemoval?.();
          if (backend.failNextRemoval) {
            backend.failNextRemoval = false;
            return { data: null, error: { message: 'removal rejected' } };
          }
          // Postgres uses the conflict target verbatim, and PostgREST turns a
          // missing ignoreDuplicates into ON CONFLICT DO UPDATE — which needs an
          // UPDATE privilege the authenticated role does not hold, so the write
          // fails 42501 rather than degrading. A fake that ignored these options
          // would stay green with the flag deleted.
          if (options?.ignoreDuplicates !== true) {
            return {
              data: null,
              error: { code: '42501', message: 'permission denied for table love_note_removals' },
            };
          }
          if (options?.onConflict !== 'user_id,note_id') {
            return {
              data: null,
              error: { code: '42P10', message: 'no unique constraint matching the ON CONFLICT' },
            };
          }
          // Set semantics == the primary key: a second identical write is a no-op.
          backend.removals.add(`${values.user_id}|${values.note_id}`);
          return { data: null, error: null };
        })();
      },
    };
  }

  if (table !== 'love_notes_visible' && table !== 'love_notes') {
    throw new Error(`unmodelled table ${table}`);
  }

  let before: string | null = null;
  let take = 50;

  const api = {
    select: () => api,
    or: () => api,
    lt: (_col: string, value: string) => {
      before = value;
      return api;
    },
    order: () => api,
    limit: (n: number) => {
      take = n;
      return api;
    },
    then(onFulfilled: (r: { data: FakeRow[] | null; error: unknown }) => unknown) {
      if (backend.failNextRead) {
        backend.failNextRead = false;
        return Promise.resolve(onFulfilled({ data: null, error: { message: 'network error' } }));
      }

      // Snapshot HERE, where the server evaluates the SELECT — not at delivery.
      // Anything committing after this point is invisible to this response, which
      // is the whole shape of the resurrect race: a page evaluated before a
      // removal commits can still be in flight when the removal finishes.
      let rows = backend.notes.slice();
      // Only the view hides anything. Reading love_notes directly must still
      // return every row — that is the partner's copy staying intact.
      if (table === 'love_notes_visible') {
        rows = rows.filter((r) => !backend.removals.has(`${backend.readingAs}|${r.id}`));
      }
      if (before) rows = rows.filter((r) => r.created_at < before!);
      rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
      const snapshot = rows.slice(0, take);
      const deliver = () => onFulfilled({ data: snapshot, error: null });

      if (backend.holdNextRead) {
        backend.holdNextRead = false;
        return new Promise((resolve) => {
          backend.releaseHeldRead = () => resolve(deliver());
        });
      }
      return Promise.resolve(deliver());
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

import { deleteLoveNoteImage } from '../../../src/services/loveNoteImageService';
import { createNotesSlice, type NotesSlice } from '../../../src/stores/slices/notesSlice';

const mockedDeleteLoveNoteImage = vi.mocked(deleteLoveNoteImage);

type TestStore = NotesSlice & { userId: string | null };

function createTestStore() {
  const store = create<TestStore>()(createNotesSlice as unknown as StateCreator<TestStore>);
  store.setState({ userId: USER_ID });
  return store;
}

describe('notesSlice removeNote', () => {
  beforeEach(() => {
    backend.reset();
    vi.clearAllMocks();
  });

  it('takes the note out of this user’s thread without touching the message row', async () => {
    backend.seed(3);
    const store = createTestStore();
    await store.getState().fetchNotes();
    expect(store.getState().notes).toHaveLength(3);

    await store.getState().removeNote('note-1');

    expect(store.getState().notes.map((n) => n.id)).toEqual(['note-0', 'note-2']);
    // The message itself is still there — it is the partner's copy.
    expect(backend.notes.map((r) => r.id)).toEqual(['note-0', 'note-1', 'note-2']);
    expect(backend.removals.has(`${USER_ID}|note-1`)).toBe(true);
  });

  it('leaves the partner’s history untouched, image and all', async () => {
    backend.seed(3);
    const store = createTestStore();
    await store.getState().fetchNotes();
    // note-0 is the one carrying an image.
    await store.getState().removeNote('note-0');

    // The partner reads the same conversation through the same view.
    backend.readingAs = PARTNER_ID;
    const partnerStore = createTestStore();
    partnerStore.setState({ userId: PARTNER_ID });
    await partnerStore.getState().fetchNotes();

    const seenByPartner = partnerStore.getState().notes.find((n) => n.id === 'note-0');
    expect(seenByPartner).toBeDefined();
    expect(seenByPartner?.content).toBe('message 0');
    expect(seenByPartner?.image_url).toBe('a0/pic.jpg');
  });

  it('never deletes the attached image from storage', async () => {
    backend.seed(1);
    const store = createTestStore();
    await store.getState().fetchNotes();
    await store.getState().removeNote('note-0');

    expect(mockedDeleteLoveNoteImage).not.toHaveBeenCalled();
  });

  it('removing the same note twice converges on one removal', async () => {
    backend.seed(2);
    const store = createTestStore();
    await store.getState().fetchNotes();

    const before = store.getState().notes;
    await store.getState().removeNote('note-0');

    // Put it back in the thread so the second call actually reaches the write —
    // what a stale second device, or a refetch racing the removal, would do.
    // Returning early on a missing note would pass this test without ever
    // exercising the (user_id, note_id) conflict target.
    store.setState({ notes: before });
    await store.getState().removeNote('note-0');

    expect(backend.removals.size).toBe(1);
    expect(store.getState().notes.map((n) => n.id)).toEqual(['note-1']);
    expect(store.getState().notesError).toBeNull();
  });

  it('refuses a note that has no server row yet', async () => {
    const store = createTestStore();
    store.setState({
      notes: [
        {
          id: 'temp-123-abc',
          tempId: 'temp-123-abc',
          from_user_id: USER_ID,
          to_user_id: PARTNER_ID,
          content: 'still sending',
          created_at: '2026-08-17T10:05:00.000Z',
          error: true,
        },
      ],
    });

    // A failed send keeps its temp id, so this is the state that would have
    // posted `temp-…` into a uuid column. It must reject rather than resolve:
    // the dialog closes on a resolved promise.
    await expect(store.getState().removeNote('temp-123-abc')).rejects.toThrow();

    expect(backend.removals.size).toBe(0);
    expect(store.getState().notes).toHaveLength(1);
  });

  it('puts the note back when the write fails', async () => {
    backend.seed(3);
    const store = createTestStore();
    await store.getState().fetchNotes();

    backend.failNextRemoval = true;
    // It has to reject, not resolve: the confirmation dialog closes on a
    // resolved promise, so swallowing the error would dismiss it as though the
    // removal had worked while the message reappeared behind it.
    await expect(store.getState().removeNote('note-1')).rejects.toThrow();

    // Restored at its original index rather than re-sorted: server timestamps
    // and optimistic toISOString ones do not collate against each other.
    expect(store.getState().notes.map((n) => n.id)).toEqual(['note-0', 'note-1', 'note-2']);
    // The thrown error is the single owner of this failure — setting notesError
    // too would render it a second time in the page banner, which then outlives
    // the dialog the user cancels out of.
    expect(store.getState().notesError).toBeNull();
    expect(backend.removals.size).toBe(0);
  });

  it('does not write the previous account’s thread back after a sign-out mid-flight', async () => {
    backend.seed(3);
    const store = createTestStore();
    await store.getState().fetchNotes();

    // Sign Out lands while the removal request is in flight.
    backend.failNextRemoval = true;
    backend.duringRemoval = () => store.setState({ userId: null, notes: [] });
    await store.getState().removeNote('note-1');

    // The rollback must not resurrect the signed-out account's messages.
    expect(store.getState().notes).toEqual([]);
    expect(store.getState().notesError).toBeNull();
  });

  it('refills the window when a removal empties it and older history remains', async () => {
    backend.seed(3);
    const store = createTestStore();
    // A single-note page, so there is more behind it.
    await store.getState().fetchNotes(1);
    expect(store.getState().notes.map((n) => n.id)).toEqual(['note-2']);
    expect(store.getState().notesHasMore).toBe(true);

    await store.getState().removeNote('note-2');

    // Without the refill the thread would render its empty state with two
    // unread messages still behind it.
    expect(store.getState().notes.length).toBeGreaterThan(0);
    expect(store.getState().notes.map((n) => n.id)).not.toContain('note-2');
  });

  it('keeps notesHasMore honest when a removal falls inside the page', async () => {
    backend.seed(5);
    const store = createTestStore();
    backend.removals.add(`${USER_ID}|note-3`);

    await store.getState().fetchNotes(2);

    // A full page of VISIBLE notes, and more genuinely behind it. Excluding
    // after the response would give one row here and flip notesHasMore to false,
    // ending the thread early with three messages still unread.
    expect(store.getState().notes).toHaveLength(2);
    expect(store.getState().notes.map((n) => n.id)).toEqual(['note-2', 'note-4']);
    expect(store.getState().notesHasMore).toBe(true);
  });

  it('does not resurrect a note when a read evaluated before it lands after it', async () => {
    backend.seed(3);
    const store = createTestStore();
    await store.getState().fetchNotes();

    // The real ordering, and the only one that matters: a read — the mount fetch
    // in useLoveNotes, or a page request — is evaluated by the server BEFORE the
    // removal commits, so its rows still contain the note, and it resolves AFTER
    // removeNote has already returned. The tiny removal insert round-tripping
    // faster than a 50-row page query is the normal case, not the exotic one.
    backend.holdNextRead = true;
    const readInFlight = store.getState().fetchNotes();

    // Let the read actually reach the server and take its snapshot BEFORE the
    // removal commits. Without this the snapshot is taken afterwards, the fake's
    // own anti-join already excludes the note, and the test passes whether or not
    // the client-side guard exists — which is exactly how the previous version
    // of this test managed to prove nothing.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(backend.releaseHeldRead).not.toBeNull();

    await store.getState().removeNote('note-1');

    backend.releaseHeldRead?.();
    await readInFlight;

    expect(store.getState().notes.map((n) => n.id)).not.toContain('note-1');
  });

  it('keeps the pending marker after the write commits, so a late read stays filtered', async () => {
    backend.seed(3);
    const store = createTestStore();
    await store.getState().fetchNotes();

    await store.getState().removeNote('note-1');

    // Clearing it here would drop the guard exactly while a read issued before
    // the commit is still in flight. Ids are uuids and never reused, and
    // signedOutState resets the list.
    expect(store.getState().notesPendingRemoval).toEqual(['note-1']);
  });

  it('clears the pending marker when the write fails, so the note is not filtered forever', async () => {
    backend.seed(3);
    const store = createTestStore();
    await store.getState().fetchNotes();

    backend.failNextRemoval = true;
    await expect(store.getState().removeNote('note-1')).rejects.toThrow();

    expect(store.getState().notesPendingRemoval).toEqual([]);
  });

  it('keeps removed notes out of the older-notes page too', async () => {
    backend.seed(5);
    const store = createTestStore();
    await store.getState().fetchNotes(2);
    expect(store.getState().notes.map((n) => n.id)).toEqual(['note-3', 'note-4']);

    // Remove one that lives in the next page back, then page into it.
    backend.removals.add(`${USER_ID}|note-1`);
    await store.getState().fetchOlderNotes(2);

    expect(store.getState().notes.map((n) => n.id)).toEqual(['note-0', 'note-2', 'note-3', 'note-4']);
  });

  it('signals rather than reporting success when the note is no longer loaded', async () => {
    backend.seed(3);
    const store = createTestStore();
    await store.getState().fetchNotes();

    // The dialog is open on a note the window no longer holds — the refill path
    // inside this same action can replace it. A resolved promise here is the
    // dialog's success signal, so it would close as though the message had been
    // removed while nothing was recorded.
    await expect(store.getState().removeNote('note-does-not-exist')).rejects.toThrow();

    expect(backend.removals.size).toBe(0);
    expect(store.getState().notes).toHaveLength(3);
  });
});
