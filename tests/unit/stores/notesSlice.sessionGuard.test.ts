/**
 * notesSlice — a request from a dead session must not write, even for the SAME account
 *
 * Signing out and straight back in as the same user leaves `userId` exactly as
 * it was, so a guard that compares `userId` alone lets a continuation from the
 * signed-out session write into the new one. `clearAuth` bumps
 * `authSessionVersion` on every sign-out; capturing it with `userId` before the
 * first await and re-checking the pair is what tells the two sessions apart.
 *
 * Every case drives the real `clearAuth()` + `setAuthUser(A)` pair while a
 * request is held open, then settles it. A `userId`-only guard passes all of
 * these; each assertion fails against it.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const loveNotesQuery = vi.fn();
const compressImage = vi.fn();
const uploadCompressedBlob = vi.fn();
const deleteLoveNoteImage = vi.fn();
const sendEphemeralBroadcast = vi.fn();

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    from: () => loveNotesQuery(),
    auth: {},
    channel: vi.fn(),
    removeChannel: vi.fn(),
    rpc: vi.fn(),
  },
  getPartnerId: vi.fn(),
  lookupPartnerId: vi.fn(),
}));

vi.mock('../../../src/api/ephemeralBroadcast', () => ({
  sendEphemeralBroadcast: (topic: string, event: string, payload: unknown) =>
    sendEphemeralBroadcast(topic, event, payload),
}));

vi.mock('../../../src/services/imageCompressionService', () => ({
  imageCompressionService: {
    validateImageFile: () => ({ valid: true }),
    compressImage: (file: File) => compressImage(file),
  },
}));

vi.mock('../../../src/services/loveNoteImageService', () => ({
  uploadCompressedBlob: (blob: Blob, userId: string) => uploadCompressedBlob(blob, userId),
  deleteLoveNoteImage: (storagePath: string) => deleteLoveNoteImage(storagePath),
}));

import 'fake-indexeddb/auto';
import { getPartnerId, lookupPartnerId } from '../../../src/api/supabaseClient';
import { serializeAccountDataWrite } from '../../../src/services/accountDataQueue';
import { openMyLoveDB } from '../../../src/services/dbSchema';
import { listQueuedNotes } from '../../../src/services/noteQueue';
import { useAppStore } from '../../../src/stores/useAppStore';

const A = 'USER-A-ID';
const PARTNER = 'USER-B-ID';

type SetStateArg = Parameters<typeof useAppStore.setState>[0];

/** A promise this test resolves by hand, so the re-sign-in can land mid-flight */
function deferred<T>() {
  let settle: (value: T) => void = () => {};
  let fail: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  promise.catch(() => {});
  return { promise, settle, fail };
}

/** Chainable, thenable PostgREST builder; every terminal resolves to `result`. */
function builder(result: Promise<{ data: unknown; error: unknown }>) {
  const b: Record<string, unknown> = {};
  for (const method of ['select', 'or', 'order', 'limit', 'lt', 'eq', 'upsert']) {
    b[method] = () => b;
  }
  b.maybeSingle = () => result;
  b.single = () => result;
  b.then = (onFulfilled: (value: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    result.then(onFulfilled, onRejected);
  return b;
}

function note(id: string, content: string) {
  return {
    id,
    from_user_id: A,
    to_user_id: PARTNER,
    content,
    created_at: `2026-09-20T06:00:0${id.length}.000Z`,
  };
}

/** Sign out, then straight back in as the same account. */
function signOutAndBackInAsA(): void {
  useAppStore.getState().clearAuth();
  useAppStore.getState().setAuthUser(A);
}

/** Count store writes from here on. */
function countWrites(): { count: () => number; stop: () => void } {
  let writes = 0;
  const stop = useAppStore.subscribe(() => {
    writes += 1;
  });
  return { count: () => writes, stop };
}

describe('notesSlice session guard — same account signs back in mid-flight', () => {
  beforeEach(async () => {
    const db = await openMyLoveDB();
    await db.clear('note-queue');
    db.close();
    vi.clearAllMocks();
    // An empty rotation pool keeps setAuthUser from firing a background reload
    // whose write would land inside the case under test.
    useAppStore.setState({ messages: [], currentMessage: null } as unknown as SetStateArg);
    useAppStore.getState().clearAuth();
    useAppStore.getState().setAuthUser(A);
    vi.mocked(getPartnerId).mockResolvedValue(PARTNER);
    vi.mocked(lookupPartnerId).mockResolvedValue({ status: 'linked', partnerId: PARTNER });
    deleteLoveNoteImage.mockResolvedValue(undefined);
    sendEphemeralBroadcast.mockResolvedValue(undefined);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    // Sign-out's deletes do not go through the account-data queue:
    // `deleteAccountData` starts them fire-and-forget. The queue carries the
    // account-data mirror writes and refreshes; drain it so anything a case
    // queued lands inside the test rather than after the worker closes.
    await serializeAccountDataWrite(async () => {});
  });

  it('fetchNotes: a stale snapshot does not overwrite the new session', async () => {
    const pending = deferred<{ data: unknown; error: unknown }>();
    loveNotesQuery.mockReturnValue(builder(pending.promise));

    const inFlight = useAppStore.getState().fetchNotes();
    // The held query is really reached, so the guard below is what is measured.
    await vi.waitFor(() => expect(loveNotesQuery).toHaveBeenCalled());
    signOutAndBackInAsA();
    const fresh = [note('a1', 'FIRST'), note('a2', 'SENT-SINCE')];
    useAppStore.setState({ notes: fresh } as unknown as SetStateArg);

    pending.settle({ data: [note('a1', 'STALE-SNAPSHOT')], error: null });
    await inFlight;

    expect(useAppStore.getState().notes).toEqual(fresh);
  });

  it('fetchNotes: a stale failure raises no error in the new session', async () => {
    const pending = deferred<{ data: unknown; error: unknown }>();
    loveNotesQuery.mockReturnValue(builder(pending.promise));

    const inFlight = useAppStore.getState().fetchNotes();
    // The held query is really reached, so the guard below is what is measured.
    await vi.waitFor(() => expect(loveNotesQuery).toHaveBeenCalled());
    signOutAndBackInAsA();

    pending.settle({ data: null, error: new Error('STALE-FAILURE') });
    await inFlight;

    expect(useAppStore.getState().notesError).toBeNull();
  });

  it('fetchOlderNotes: a stale page is not prepended to the new session', async () => {
    useAppStore.setState({
      notes: [note('a1', 'ON-SCREEN')],
      notesHasMore: true,
      notesIsLoading: false,
    } as unknown as SetStateArg);
    const pending = deferred<{ data: unknown; error: unknown }>();
    loveNotesQuery.mockReturnValue(builder(pending.promise));

    const inFlight = useAppStore.getState().fetchOlderNotes();
    // The held query is really reached, so the guard below is what is measured.
    await vi.waitFor(() => expect(loveNotesQuery).toHaveBeenCalled());
    signOutAndBackInAsA();
    const fresh = [note('a1', 'FIRST')];
    useAppStore.setState({ notes: fresh } as unknown as SetStateArg);

    pending.settle({ data: [note('a0', 'STALE-OLDER-PAGE')], error: null });
    await inFlight;

    expect(useAppStore.getState().notes).toEqual(fresh);
  });

  it('sendNote: a stale partner lookup adds no optimistic note, queues nothing and sends nothing', async () => {
    const lookup = deferred<{ status: 'linked'; partnerId: string }>();
    vi.mocked(lookupPartnerId).mockReturnValue(lookup.promise);

    const inFlight = useAppStore.getState().sendNote('STALE-DRAFT');
    signOutAndBackInAsA();

    lookup.settle({ status: 'linked', partnerId: PARTNER });
    await inFlight;
    await useAppStore.getState().drainQueuedNotes();

    expect(JSON.stringify(useAppStore.getState().notes)).not.toContain('STALE-DRAFT');
    expect(await listQueuedNotes(A)).toEqual([]);
    expect(loveNotesQuery).not.toHaveBeenCalled();
  });

  it('sendNote: a stale insert failure raises no error in the new session', async () => {
    const pending = deferred<{ data: unknown; error: unknown }>();
    loveNotesQuery.mockReturnValue(builder(pending.promise));

    await useAppStore.getState().sendNote('hello');
    // The queue's drain holds the insert open.
    await vi.waitFor(() => expect(loveNotesQuery).toHaveBeenCalled());
    signOutAndBackInAsA();

    pending.settle({
      data: null,
      error: { code: '23514', message: 'check violation', details: '', hint: '' },
    });
    await useAppStore.getState().drainQueuedNotes();

    expect(useAppStore.getState().notesError).toBeNull();
  });

  it("sendNote's image branch: a stale compression neither writes nor uploads", async () => {
    const compressed = deferred<{ blob: Blob }>();
    compressImage.mockReturnValue(compressed.promise);

    const inFlight = useAppStore
      .getState()
      .sendNote('with picture', new File(['x'], 'a.jpg', { type: 'image/jpeg' }));
    // Parked on the held compression.
    await vi.waitFor(() => expect(compressImage).toHaveBeenCalledTimes(1));
    signOutAndBackInAsA();

    const writes = countWrites();
    compressed.settle({ blob: new Blob(['x'], { type: 'image/jpeg' }) });
    await inFlight;
    writes.stop();

    expect(writes.count()).toBe(0);
    expect(uploadCompressedBlob).not.toHaveBeenCalled();
  });

  it("sendNote's image branch: a stale upload failure does not write", async () => {
    compressImage.mockResolvedValue({ blob: new Blob(['x'], { type: 'image/jpeg' }) });
    const upload = deferred<{ storagePath: string }>();
    uploadCompressedBlob.mockReturnValue(upload.promise);

    const inFlight = useAppStore
      .getState()
      .sendNote('with picture', new File(['x'], 'a.jpg', { type: 'image/jpeg' }));
    await vi.waitFor(() => expect(uploadCompressedBlob).toHaveBeenCalledTimes(1));
    signOutAndBackInAsA();

    const writes = countWrites();
    upload.fail(new Error('upload failed'));
    await inFlight;
    writes.stop();

    expect(writes.count()).toBe(0);
  });

  it("sendNote's image branch: a stale upload success neither inserts nor writes, and discards the image", async () => {
    compressImage.mockResolvedValue({ blob: new Blob(['x'], { type: 'image/jpeg' }) });
    const upload = deferred<{ storagePath: string }>();
    uploadCompressedBlob.mockReturnValue(upload.promise);

    const inFlight = useAppStore
      .getState()
      .sendNote('STALE-PICTURE-NOTE', new File(['x'], 'a.jpg', { type: 'image/jpeg' }));
    await vi.waitFor(() => expect(uploadCompressedBlob).toHaveBeenCalledTimes(1));
    signOutAndBackInAsA();

    const writes = countWrites();
    upload.settle({ storagePath: `${A}/stale-upload.jpg` });
    await inFlight;
    writes.stop();

    expect(loveNotesQuery, 'the stale send reached the insert').not.toHaveBeenCalled();
    expect(writes.count()).toBe(0);
    expect(deleteLoveNoteImage).toHaveBeenCalledWith(`${A}/stale-upload.jpg`);
  });

  it('sendNote: a committed insert is still broadcast when the same account signed back in', async () => {
    // The row is in the database, so the partner is owed it over realtime;
    // only the store write belongs to the session that sent it.
    const committed = { ...note('row-1', 'COMMITTED-NOTE'), image_url: null };
    const insert = deferred<{ data: unknown; error: unknown }>();
    loveNotesQuery.mockReturnValue(builder(insert.promise));

    await useAppStore.getState().sendNote('COMMITTED-NOTE');
    // The queue's drain holds the insert open.
    await vi.waitFor(() => expect(loveNotesQuery).toHaveBeenCalledTimes(1));
    signOutAndBackInAsA();

    const writes = countWrites();
    insert.settle({ data: committed, error: null });
    await useAppStore.getState().drainQueuedNotes();
    writes.stop();

    expect(writes.count()).toBe(0);
    expect(sendEphemeralBroadcast).toHaveBeenCalledWith(`love-notes:${PARTNER}`, 'new_message', {
      message: committed,
    });
  });

  it('retryFailedMessage: a stale upload success neither inserts nor writes, and discards the image', async () => {
    useAppStore.setState({
      notes: [
        {
          ...note('temp-1', 'RETRIED'),
          tempId: 'temp-1',
          error: true,
          imageBlob: new Blob(['x'], { type: 'image/jpeg' }),
        },
      ],
    } as unknown as SetStateArg);
    const upload = deferred<{ storagePath: string }>();
    uploadCompressedBlob.mockReturnValue(upload.promise);

    const inFlight = useAppStore.getState().retryFailedMessage('temp-1');
    await vi.waitFor(() => expect(uploadCompressedBlob).toHaveBeenCalledTimes(1));
    signOutAndBackInAsA();

    const writes = countWrites();
    upload.settle({ storagePath: `${A}/stale-retry.jpg` });
    await inFlight;
    writes.stop();

    expect(loveNotesQuery, 'the stale retry reached the insert').not.toHaveBeenCalled();
    expect(writes.count()).toBe(0);
    expect(deleteLoveNoteImage).toHaveBeenCalledWith(`${A}/stale-retry.jpg`);
  });

  it('retryFailedMessage: a stale image-upload failure does not write', async () => {
    useAppStore.setState({
      notes: [
        {
          ...note('temp-1', 'RETRIED'),
          tempId: 'temp-1',
          error: true,
          imageBlob: new Blob(['x'], { type: 'image/jpeg' }),
        },
      ],
    } as unknown as SetStateArg);
    const upload = deferred<{ storagePath: string }>();
    uploadCompressedBlob.mockReturnValue(upload.promise);

    const inFlight = useAppStore.getState().retryFailedMessage('temp-1');
    await vi.waitFor(() => expect(uploadCompressedBlob).toHaveBeenCalledTimes(1));
    signOutAndBackInAsA();

    const writes = countWrites();
    upload.fail(new Error('upload failed'));
    await inFlight;
    writes.stop();

    expect(writes.count()).toBe(0);
  });

  it('removeNote: a stale failure does not restore the note into the new session', async () => {
    useAppStore.setState({
      notes: [note('a1', 'REMOVED'), note('a2', 'KEPT')],
      notesHasMore: false,
      notesPendingRemoval: [],
    } as unknown as SetStateArg);
    const pending = deferred<{ data: unknown; error: unknown }>();
    loveNotesQuery.mockReturnValue(builder(pending.promise));

    const inFlight = useAppStore.getState().removeNote('a1');
    signOutAndBackInAsA();
    const fresh = [note('a2', 'KEPT')];
    useAppStore.setState({ notes: fresh } as unknown as SetStateArg);

    pending.settle({ data: null, error: new Error('STALE-FAILURE') });
    // The stale path returns before it looks at the error, so nothing throws.
    await expect(inFlight).resolves.toBeUndefined();

    expect(useAppStore.getState().notes).toEqual(fresh);
  });
});
