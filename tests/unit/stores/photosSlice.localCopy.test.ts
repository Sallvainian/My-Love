/**
 * photosSlice — the `photos` local copy (spec-unified-data-storage story 10)
 *
 * `loadPhotos` shows the account's saved list at once, then replaces state and
 * copy with a full server read. A failed read changes nothing; an empty answer
 * saves `[]`. After a successful read, the cached images of photos gone from
 * the server are deleted and the background image fill is requested. A
 * confirmed upload prepends to state and copy; a confirmed delete removes the
 * row from both and deletes its cached image. A result raised for one account
 * or session is never shown, saved or cached under another.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { create, type StateCreator } from 'zustand';

const listAllPhotos = vi.fn();
const uploadPhotoService = vi.fn();
const deletePhotoService = vi.fn();
const checkStorageQuota = vi.fn();

vi.mock('../../../src/services/photoService', () => ({
  photoService: {
    listAllPhotos: () => listAllPhotos(),
    uploadPhoto: (input: unknown, onCheckError?: (message: string) => void) =>
      uploadPhotoService(input, onCheckError),
    deletePhoto: (photoId: string) => deletePhotoService(photoId),
    checkStorageQuota: () => checkStorageQuota(),
  },
}));

const savedCopies = new Map<string, unknown>();
const readLocalCopy = vi.fn();
const writeLocalCopy = vi.fn();
const registerLocalCopy = vi.fn();

vi.mock('../../../src/services/localCopy', () => ({
  readLocalCopy: (userId: string, kind: string) => readLocalCopy(userId, kind),
  writeLocalCopy: (userId: string, kind: string, value: unknown) =>
    writeLocalCopy(userId, kind, value),
  registerLocalCopy: (kind: string, refresh: () => Promise<void>) =>
    registerLocalCopy(kind, refresh),
}));

const deletePhotoImages = vi.fn();
const requestPhotoImageFill = vi.fn();
vi.mock('../../../src/services/photoImageCache', () => ({
  deletePhotoImages: (userId: string, paths: string[]) => deletePhotoImages(userId, paths),
  requestPhotoImageFill: (session: unknown) => requestPhotoImageFill(session),
}));

import type { PhotoCacheSession } from '../../../src/services/photoImageCache';
import type { PhotoWithUrls, SupabasePhoto } from '../../../src/services/photoService';
import {
  createPhotosSlice,
  PHOTOS_COPY_KIND,
  type PhotosSlice,
} from '../../../src/stores/slices/photosSlice';

const USER_A = 'USER-A-ID';
const PARTNER = 'PARTNER-ID';
const USER_B = 'USER-B-ID';

type TestStore = PhotosSlice & { userId: string | null; authSessionVersion: number };

function createTestStore() {
  const store = create<TestStore>()(createPhotosSlice as unknown as StateCreator<TestStore>);
  store.setState({ userId: USER_A, authSessionVersion: 1 });
  return store;
}

/** A server row; `n` orders them (a higher n is older). */
function row(n: number, owner = USER_A): SupabasePhoto {
  return {
    id: `photo-${n}`,
    user_id: owner,
    storage_path: `${owner}/photo-${n}.jpg`,
    filename: `photo-${n}.jpg`,
    caption: n % 2 ? null : `caption ${n}`,
    mime_type: 'image/jpeg',
    file_size: 1000 + n,
    width: 800,
    height: 600,
    created_at: new Date(Date.UTC(2026, 8, 20) - n * 60_000).toISOString(),
  };
}

/** The row as the gallery holds it, and as the copy saves it. */
function shown(r: SupabasePhoto, userId = USER_A): PhotoWithUrls {
  return { ...r, signedUrl: null, isOwn: r.user_id === userId };
}

const key = (userId: string) => `${userId}|${PHOTOS_COPY_KIND}`;

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

/**
 * The copy read `loadPhotos` started, as the promise it awaits. The slice
 * registers its own `await` on it first, so a test awaiting it next resumes
 * only after the slice has acted on the saved copy and is waiting on the
 * server read.
 */
const copyReadSettled = (call = 0) => readLocalCopy.mock.results[call].value as Promise<unknown>;

function lastFillSession(): PhotoCacheSession {
  const call = requestPhotoImageFill.mock.calls.at(-1);
  if (!call) throw new Error('no fill was requested');
  return call[0] as PhotoCacheSession;
}

describe('photosSlice local copy', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    savedCopies.clear();
    setOnline(true);
    readLocalCopy.mockImplementation(async (userId: string, kind: string) =>
      savedCopies.has(`${userId}|${kind}`) ? savedCopies.get(`${userId}|${kind}`) : null
    );
    writeLocalCopy.mockImplementation(async (userId: string, kind: string, value: unknown) => {
      savedCopies.set(`${userId}|${kind}`, value);
    });
    deletePhotoImages.mockResolvedValue(undefined);
    requestPhotoImageFill.mockResolvedValue(undefined);
    checkStorageQuota.mockResolvedValue({ used: 0, quota: 1, percent: 0, warning: 'none' });
    // Mirrors the real service: offline the read fails.
    listAllPhotos.mockImplementation(async () => {
      if (!navigator.onLine) throw new Error('Failed to fetch');
      return [];
    });
  });

  describe('loadPhotos', () => {
    it('first online start: lists every photo, saves the copy, requests the fill', async () => {
      const rows = Array.from({ length: 60 }, (_, n) => row(n, n % 3 ? USER_A : PARTNER));
      listAllPhotos.mockResolvedValue(rows);
      const store = createTestStore();

      await store.getState().loadPhotos();

      const expected = rows.map((r) => shown(r));
      expect(store.getState().photos).toEqual(expected);
      expect(store.getState().photosLoaded).toBe(true);
      expect(store.getState().photosLoadError).toBeNull();
      expect(savedCopies.get(key(USER_A))).toEqual(expected);

      expect(requestPhotoImageFill).toHaveBeenCalledTimes(1);
      const session = lastFillSession();
      expect(session.userId).toBe(USER_A);
      expect(session.isCurrent()).toBe(true);
      expect(session.photos()).toEqual(expected);
    });

    it('saves the copy as plain data: signedUrl null, isOwn per account, nothing else', async () => {
      listAllPhotos.mockResolvedValue([
        { ...row(0), extra_column: 'not saved' },
        row(1, PARTNER),
      ]);
      const store = createTestStore();

      await store.getState().loadPhotos();

      const saved = savedCopies.get(key(USER_A)) as PhotoWithUrls[];
      expect(saved).toEqual([shown(row(0)), shown(row(1, PARTNER))]);
      expect(saved[0].isOwn).toBe(true);
      expect(saved[1].isOwn).toBe(false);
      expect(structuredClone(saved)).toEqual(saved);
    });

    it('offline reload: shows every saved photo and keeps the copy', async () => {
      const saved = [shown(row(0)), shown(row(1, PARTNER)), shown(row(2))];
      savedCopies.set(key(USER_A), saved);
      setOnline(false);
      const store = createTestStore();

      await store.getState().loadPhotos();

      expect(store.getState().photos).toEqual(saved);
      expect(store.getState().photosLoaded).toBe(true);
      expect(writeLocalCopy).not.toHaveBeenCalled();
      expect(deletePhotoImages).not.toHaveBeenCalled();
      expect(requestPhotoImageFill).not.toHaveBeenCalled();
      expect(savedCopies.get(key(USER_A))).toEqual(saved);
    });

    it('offline with no copy: nothing loaded, the read failure reported', async () => {
      setOnline(false);
      const store = createTestStore();

      await store.getState().loadPhotos();

      expect(store.getState().photos).toEqual([]);
      expect(store.getState().photosLoaded).toBe(false);
      expect(store.getState().photosLoadError).toBe('Failed to fetch');
    });

    it('online: shows the copy first, then the server list replaces and is saved', async () => {
      savedCopies.set(key(USER_A), [shown(row(5))]);
      const server = deferred<SupabasePhoto[]>();
      listAllPhotos.mockReturnValue(server.promise);
      const store = createTestStore();

      const inFlight = store.getState().loadPhotos();
      await vi.waitFor(() => expect(store.getState().photos).toEqual([shown(row(5))]));
      expect(store.getState().photosLoaded).toBe(true);

      server.resolve([row(1), row(5)]);
      await inFlight;

      expect(store.getState().photos).toEqual([shown(row(1)), shown(row(5))]);
      expect(savedCopies.get(key(USER_A))).toEqual([shown(row(1)), shown(row(5))]);
    });

    it('a failed server read changes neither the list nor the copy', async () => {
      const store = createTestStore();
      listAllPhotos.mockResolvedValueOnce([row(0), row(1)]);
      await store.getState().loadPhotos();
      writeLocalCopy.mockClear();
      requestPhotoImageFill.mockClear();

      listAllPhotos.mockRejectedValueOnce(new Error('500'));
      await store.getState().loadPhotos();

      expect(store.getState().photos).toEqual([shown(row(0)), shown(row(1))]);
      expect(store.getState().photosLoaded).toBe(true);
      expect(writeLocalCopy).not.toHaveBeenCalled();
      expect(deletePhotoImages).not.toHaveBeenCalled();
      expect(requestPhotoImageFill).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    it('an empty answer replaces the list and is saved as []', async () => {
      savedCopies.set(key(USER_A), [shown(row(0))]);
      listAllPhotos.mockResolvedValue([]);
      const store = createTestStore();

      await store.getState().loadPhotos();

      expect(store.getState().photos).toEqual([]);
      expect(store.getState().photosLoaded).toBe(true);
      expect(savedCopies.get(key(USER_A))).toEqual([]);
    });

    it('a photo removed elsewhere leaves the list and the copy, and its cached image is deleted', async () => {
      savedCopies.set(key(USER_A), [shown(row(0)), shown(row(1, PARTNER)), shown(row(2))]);
      listAllPhotos.mockResolvedValue([row(0), row(2)]);
      const store = createTestStore();

      await store.getState().loadPhotos();

      expect(store.getState().photos).toEqual([shown(row(0)), shown(row(2))]);
      expect(savedCopies.get(key(USER_A))).toEqual([shown(row(0)), shown(row(2))]);
      expect(deletePhotoImages).toHaveBeenCalledWith(USER_A, [row(1, PARTNER).storage_path]);
    });

    it('also prunes rows that were only in state (a later refresh in the same session)', async () => {
      const store = createTestStore();
      listAllPhotos.mockResolvedValueOnce([row(0), row(1)]);
      await store.getState().loadPhotos();
      deletePhotoImages.mockClear();

      listAllPhotos.mockResolvedValueOnce([row(1)]);
      await store.getState().loadPhotos();

      expect(deletePhotoImages).toHaveBeenCalledWith(USER_A, [row(0).storage_path]);
    });

    it('ignores a malformed copy whole', async () => {
      savedCopies.set(key(USER_A), [shown(row(0)), { id: 'broken' }]);
      setOnline(false);
      const store = createTestStore();

      await store.getState().loadPhotos();

      expect(store.getState().photos).toEqual([]);
      expect(store.getState().photosLoaded).toBe(false);
    });

    it('does nothing when signed out', async () => {
      const store = createTestStore();
      store.setState({ userId: null });

      await store.getState().loadPhotos();

      expect(listAllPhotos).not.toHaveBeenCalled();
      expect(readLocalCopy).not.toHaveBeenCalled();
    });

    it('keeps an upload confirmed while the read was in flight', async () => {
      const server = deferred<SupabasePhoto[]>();
      listAllPhotos.mockReturnValue(server.promise);
      uploadPhotoService.mockResolvedValue(row(0));
      const store = createTestStore();

      const inFlight = store.getState().loadPhotos();
      await copyReadSettled();
      await store.getState().uploadPhoto({} as never);
      // The server answered before the upload committed.
      server.resolve([row(1)]);
      await inFlight;

      expect(store.getState().photos).toEqual([shown(row(0)), shown(row(1))]);
      expect(savedCopies.get(key(USER_A))).toEqual([shown(row(0)), shown(row(1))]);
      expect(deletePhotoImages).not.toHaveBeenCalled();
    });

    it('keeps a delete confirmed while the read was in flight', async () => {
      const store = createTestStore();
      listAllPhotos.mockResolvedValueOnce([row(0), row(1)]);
      await store.getState().loadPhotos();
      deletePhotoImages.mockClear();

      const server = deferred<SupabasePhoto[]>();
      listAllPhotos.mockReturnValueOnce(server.promise);
      deletePhotoService.mockResolvedValue(true);
      // Fresh in this session, so the load skips the copy and is already
      // waiting on the server read when it returns.
      const inFlight = store.getState().loadPhotos();
      await store.getState().deletePhoto('photo-0');
      server.resolve([row(0), row(1)]);
      await inFlight;

      expect(store.getState().photos).toEqual([shown(row(1))]);
      expect(savedCopies.get(key(USER_A))).toEqual([shown(row(1))]);
    });
  });

  describe('stale session', () => {
    it('an account switch during the read: no state, copy or cache write, no fill', async () => {
      savedCopies.set(key(USER_A), [shown(row(9))]);
      const server = deferred<SupabasePhoto[]>();
      listAllPhotos.mockReturnValue(server.promise);
      const store = createTestStore();

      const inFlight = store.getState().loadPhotos();
      await copyReadSettled();
      expect(store.getState().photos).toEqual([shown(row(9))]);
      writeLocalCopy.mockClear();
      store.setState({ userId: USER_B, authSessionVersion: 2, photos: [] });

      server.resolve([row(0)]);
      await inFlight;

      expect(store.getState().photos).toEqual([]);
      expect(writeLocalCopy).not.toHaveBeenCalled();
      expect(deletePhotoImages).not.toHaveBeenCalled();
      expect(requestPhotoImageFill).not.toHaveBeenCalled();
    });

    it('the same account signing back in during the read writes nothing', async () => {
      const server = deferred<SupabasePhoto[]>();
      listAllPhotos.mockReturnValue(server.promise);
      const store = createTestStore();

      const inFlight = store.getState().loadPhotos();
      await copyReadSettled();
      store.setState({ authSessionVersion: 2, photos: [] });

      server.resolve([row(0)]);
      await inFlight;

      expect(store.getState().photos).toEqual([]);
      expect(writeLocalCopy).not.toHaveBeenCalled();
      expect(requestPhotoImageFill).not.toHaveBeenCalled();
    });

    it('a switch during the copy read shows nothing of the old copy', async () => {
      savedCopies.set(key(USER_A), [shown(row(0))]);
      const copyRead = deferred<unknown>();
      readLocalCopy.mockReturnValueOnce(copyRead.promise);
      listAllPhotos.mockReturnValue(new Promise(() => {}));
      const store = createTestStore();

      const inFlight = store.getState().loadPhotos();
      store.setState({ userId: USER_B, authSessionVersion: 2 });
      copyRead.resolve([shown(row(0))]);
      await inFlight;

      expect(store.getState().photos).toEqual([]);
      expect(store.getState().photosLoaded).toBe(false);
    });

    it('a failure raised under the old session is not reported to the new one', async () => {
      const server = deferred<SupabasePhoto[]>();
      listAllPhotos.mockReturnValue(server.promise);
      const store = createTestStore();

      const inFlight = store.getState().loadPhotos();
      await copyReadSettled();
      store.setState({ userId: USER_B, authSessionVersion: 2 });
      server.reject(new Error('A-FAILURE'));
      await inFlight;

      expect(store.getState().photosLoadError).toBeNull();
    });

    it("the fill's session stops being current on sign-out", async () => {
      listAllPhotos.mockResolvedValue([row(0)]);
      const store = createTestStore();
      await store.getState().loadPhotos();
      const session = lastFillSession();

      store.setState({ userId: null, authSessionVersion: 2 });

      expect(session.isCurrent()).toBe(false);
    });
  });

  describe('uploads and deletes', () => {
    it('a confirmed upload prepends to state and the copy, unsigned', async () => {
      const store = createTestStore();
      listAllPhotos.mockResolvedValueOnce([row(1)]);
      await store.getState().loadPhotos();
      uploadPhotoService.mockResolvedValue(row(0));

      await expect(store.getState().uploadPhoto({} as never)).resolves.toEqual({ success: true });

      expect(store.getState().photos).toEqual([shown(row(0)), shown(row(1))]);
      expect(savedCopies.get(key(USER_A))).toEqual([shown(row(0)), shown(row(1))]);
    });

    it('a retried upload that resolves to a listed row does not list it twice', async () => {
      const store = createTestStore();
      listAllPhotos.mockResolvedValueOnce([row(0), row(1)]);
      await store.getState().loadPhotos();
      uploadPhotoService.mockResolvedValue(row(0));

      await store.getState().uploadPhoto({} as never);

      expect(store.getState().photos.map((p) => p.id)).toEqual(['photo-0', 'photo-1']);
    });

    it('a failed upload changes neither the list nor the copy', async () => {
      const store = createTestStore();
      listAllPhotos.mockResolvedValueOnce([row(1)]);
      await store.getState().loadPhotos();
      writeLocalCopy.mockClear();
      uploadPhotoService.mockResolvedValue(null);

      await store.getState().uploadPhoto({} as never);

      expect(store.getState().photos).toEqual([shown(row(1))]);
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });

    it('an upload confirmed after an account switch is not saved anywhere', async () => {
      const upload = deferred<SupabasePhoto>();
      uploadPhotoService.mockReturnValue(upload.promise);
      const store = createTestStore();

      const inFlight = store.getState().uploadPhoto({} as never);
      // The upload request is out: only its answer lands after the switch.
      await vi.waitFor(() => expect(uploadPhotoService).toHaveBeenCalledTimes(1));
      store.setState({ userId: USER_B, authSessionVersion: 2 });
      upload.resolve(row(0));
      await inFlight;

      expect(store.getState().photos).toEqual([]);
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });

    it('a confirmed delete removes the row from state and copy and deletes its cached image', async () => {
      const store = createTestStore();
      listAllPhotos.mockResolvedValueOnce([row(0), row(1)]);
      await store.getState().loadPhotos();
      deletePhotoImages.mockClear();
      deletePhotoService.mockResolvedValue(true);

      await expect(store.getState().deletePhoto('photo-0')).resolves.toBe(true);

      expect(store.getState().photos).toEqual([shown(row(1))]);
      expect(savedCopies.get(key(USER_A))).toEqual([shown(row(1))]);
      expect(deletePhotoImages).toHaveBeenCalledWith(USER_A, [row(0).storage_path]);
    });

    it('a failed delete keeps the row, the copy and the cached image', async () => {
      const store = createTestStore();
      listAllPhotos.mockResolvedValueOnce([row(0)]);
      await store.getState().loadPhotos();
      writeLocalCopy.mockClear();
      deletePhotoImages.mockClear();
      deletePhotoService.mockResolvedValue(false);

      await expect(store.getState().deletePhoto('photo-0')).resolves.toBe(false);

      expect(store.getState().photos).toEqual([shown(row(0))]);
      expect(writeLocalCopy).not.toHaveBeenCalled();
      expect(deletePhotoImages).not.toHaveBeenCalled();
    });

    it('a delete confirmed after a session change touches no copy or cache', async () => {
      const store = createTestStore();
      listAllPhotos.mockResolvedValueOnce([row(0)]);
      await store.getState().loadPhotos();
      writeLocalCopy.mockClear();
      deletePhotoImages.mockClear();
      const pending = deferred<boolean>();
      deletePhotoService.mockReturnValue(pending.promise);

      const inFlight = store.getState().deletePhoto('photo-0');
      store.setState({ authSessionVersion: 2 });
      pending.resolve(true);
      await inFlight;

      expect(store.getState().photos).toEqual([shown(row(0))]);
      expect(writeLocalCopy).not.toHaveBeenCalled();
      expect(deletePhotoImages).not.toHaveBeenCalled();
    });
  });

  describe('refresher', () => {
    it('registers the photos kind, which loads the list when signed in', async () => {
      const store = createTestStore();
      const call = registerLocalCopy.mock.calls.find(([kind]) => kind === PHOTOS_COPY_KIND);
      expect(call).toBeDefined();
      const refresh = call![1] as () => Promise<void>;

      listAllPhotos.mockResolvedValue([row(0)]);
      await refresh();
      expect(store.getState().photos).toEqual([shown(row(0))]);

      listAllPhotos.mockClear();
      store.setState({ userId: null });
      await refresh();
      expect(listAllPhotos).not.toHaveBeenCalled();
    });
  });
});
