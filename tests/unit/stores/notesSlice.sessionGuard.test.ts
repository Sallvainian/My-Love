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

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    from: () => loveNotesQuery(),
    auth: {},
    channel: vi.fn(),
    removeChannel: vi.fn(),
    rpc: vi.fn(),
  },
  getPartnerId: vi.fn(),
}));

vi.mock('../../../src/api/ephemeralBroadcast', () => ({
  sendEphemeralBroadcast: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/services/imageCompressionService', () => ({
  imageCompressionService: {
    validateImageFile: () => ({ valid: true }),
    compressImage: (file: File) => compressImage(file),
  },
}));

vi.mock('../../../src/services/loveNoteImageService', () => ({
  uploadCompressedBlob: (blob: Blob, userId: string) => uploadCompressedBlob(blob, userId),
  deleteLoveNoteImage: vi.fn().mockResolvedValue(undefined),
}));

import { getPartnerId } from '../../../src/api/supabaseClient';
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

/** Drain already-resolved promises so the continuation under test has run. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
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
  beforeEach(() => {
    vi.clearAllMocks();
    // An empty rotation pool keeps setAuthUser from firing a background reload
    // whose write would land inside the case under test.
    useAppStore.setState({ messages: [], currentMessage: null } as unknown as SetStateArg);
    useAppStore.getState().clearAuth();
    useAppStore.getState().setAuthUser(A);
    vi.mocked(getPartnerId).mockResolvedValue(PARTNER);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchNotes: a stale snapshot does not overwrite the new session', async () => {
    const pending = deferred<{ data: unknown; error: unknown }>();
    loveNotesQuery.mockReturnValue(builder(pending.promise));

    const inFlight = useAppStore.getState().fetchNotes();
    await flush();
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
    await flush();
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
    await flush();
    signOutAndBackInAsA();
    const fresh = [note('a1', 'FIRST')];
    useAppStore.setState({ notes: fresh } as unknown as SetStateArg);

    pending.settle({ data: [note('a0', 'STALE-OLDER-PAGE')], error: null });
    await inFlight;

    expect(useAppStore.getState().notes).toEqual(fresh);
  });

  it('sendNote: a stale partner lookup adds no optimistic note and sends nothing', async () => {
    const partner = deferred<string | null>();
    vi.mocked(getPartnerId).mockReturnValue(partner.promise);

    const inFlight = useAppStore.getState().sendNote('STALE-DRAFT');
    signOutAndBackInAsA();

    partner.settle(PARTNER);
    await inFlight;

    expect(JSON.stringify(useAppStore.getState().notes)).not.toContain('STALE-DRAFT');
    expect(loveNotesQuery).not.toHaveBeenCalled();
  });

  it('sendNote: a stale insert failure raises no error in the new session', async () => {
    const pending = deferred<{ data: unknown; error: unknown }>();
    loveNotesQuery.mockReturnValue(builder(pending.promise));

    const inFlight = useAppStore.getState().sendNote('hello');
    await flush();
    signOutAndBackInAsA();

    pending.settle({
      data: null,
      error: { code: '23514', message: 'check violation', details: '', hint: '' },
    });
    await inFlight;

    expect(useAppStore.getState().notesError).toBeNull();
  });

  it("sendNote's image branch: a stale compression neither writes nor uploads", async () => {
    const compressed = deferred<{ blob: Blob }>();
    compressImage.mockReturnValue(compressed.promise);

    const inFlight = useAppStore
      .getState()
      .sendNote('with picture', new File(['x'], 'a.jpg', { type: 'image/jpeg' }));
    await flush();
    signOutAndBackInAsA();
    await flush();

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
    await flush();
    expect(uploadCompressedBlob).toHaveBeenCalledTimes(1);
    signOutAndBackInAsA();
    await flush();

    const writes = countWrites();
    upload.fail(new Error('upload failed'));
    await inFlight;
    writes.stop();

    expect(writes.count()).toBe(0);
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
    await flush();
    expect(uploadCompressedBlob).toHaveBeenCalledTimes(1);
    signOutAndBackInAsA();
    await flush();

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
    await inFlight.catch(() => {});

    expect(useAppStore.getState().notes).toEqual(fresh);
  });
});
