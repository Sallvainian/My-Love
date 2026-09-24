/**
 * photoImageCache — the background photo image fill and the storage-refusal
 * rule (spec-unified-data-storage story 10, CAP-5).
 *
 * The image cache is an in-memory fake with an optional capacity: a write of a
 * new path past it is refused with a QuotaExceededError, the way a browser
 * refuses an IndexedDB write. Downloads are a fake keyed by storage path.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cache = vi.hoisted(() => ({
  images: new Map<string, Blob>(),
  /** Max images per account; Infinity = never refused. */
  capacity: Infinity,
  writes: [] as string[],
  deletes: [] as string[],
  /** A non-quota failure for the next write, when set. */
  failNextWrite: null as Error | null,
}));
const download = vi.hoisted(() => vi.fn<(path: string) => Promise<Blob>>());

vi.mock('../../../src/services/imageCache', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/services/imageCache')>();
  const key = (userId: string, path: string) => `${userId}|${path}`;
  return {
    isQuotaError: original.isQuotaError,
    readCachedImage: async (userId: string, path: string) =>
      cache.images.get(key(userId, path)) ?? null,
    writeCachedImage: async (userId: string, path: string, blob: Blob) => {
      if (cache.failNextWrite) {
        const error = cache.failNextWrite;
        cache.failNextWrite = null;
        throw error;
      }
      const own = Array.from(cache.images.keys()).filter((k) => k.startsWith(`${userId}|`));
      if (!cache.images.has(key(userId, path)) && own.length >= cache.capacity) {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      }
      cache.images.set(key(userId, path), blob);
      cache.writes.push(path);
    },
    deleteCachedImages: async (userId: string, paths: readonly string[]) => {
      for (const path of paths) {
        cache.images.delete(key(userId, path));
        cache.deletes.push(path);
      }
    },
  };
});

vi.mock('../../../src/services/photoService', () => ({
  photoService: { downloadPhoto: (path: string) => download(path) },
}));

import {
  cachePhotoImage,
  requestPhotoImageFill,
  type PhotoCacheSession,
  type PhotoImageRef,
} from '../../../src/services/photoImageCache';

const A = 'USER-A';

/** Photos p0 (newest) … p{n-1} (oldest), as the list holds them. */
function list(count: number): PhotoImageRef[] {
  return Array.from({ length: count }, (_, i) => ({ id: `p${i}`, storage_path: `owner/p${i}.jpg` }));
}

function session(photos: () => readonly PhotoImageRef[], isCurrent = () => true): PhotoCacheSession {
  return { userId: A, isCurrent, photos };
}

function cached(path: string, userId = A) {
  return cache.images.has(`${userId}|${path}`);
}

function seed(path: string, userId = A) {
  cache.images.set(`${userId}|${path}`, new Blob([`SEED ${path}`]));
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  cache.images.clear();
  cache.capacity = Infinity;
  cache.writes = [];
  cache.deletes = [];
  cache.failNextWrite = null;
  download.mockReset();
  download.mockImplementation(async (path) => new Blob([`IMAGE ${path}`]));
  setOnline(true);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  setOnline(true);
});

describe('the fill', () => {
  it('downloads and caches every photo image, newest first', async () => {
    const photos = list(4);
    await requestPhotoImageFill(session(() => photos));

    expect(download.mock.calls.map(([path]) => path)).toEqual(photos.map((p) => p.storage_path));
    expect(cache.writes).toEqual(photos.map((p) => p.storage_path));
  });

  it('skips paths already cached', async () => {
    const photos = list(3);
    seed(photos[1].storage_path);

    await requestPhotoImageFill(session(() => photos));

    expect(download.mock.calls.map(([path]) => path)).toEqual([
      photos[0].storage_path,
      photos[2].storage_path,
    ]);
  });

  it('logs and skips a failed download, and caches the rest', async () => {
    const photos = list(3);
    download.mockImplementation(async (path) => {
      if (path === photos[1].storage_path) throw new Error('Failed to fetch');
      return new Blob([path]);
    });

    await requestPhotoImageFill(session(() => photos));

    expect(cached(photos[0].storage_path)).toBe(true);
    expect(cached(photos[1].storage_path)).toBe(false);
    expect(cached(photos[2].storage_path)).toBe(true);
    expect(console.warn).toHaveBeenCalled();
  });

  it('runs once at a time: a request during a run makes it pass once more', async () => {
    let photos = list(2);
    const gate = deferred<Blob>();
    download.mockImplementationOnce(() => gate.promise);

    const first = requestPhotoImageFill(session(() => photos));
    await Promise.resolve();
    // Two more requests while the first download is in flight: one extra pass.
    photos = [{ id: 'new', storage_path: 'owner/new.jpg' }, ...photos];
    const second = requestPhotoImageFill(session(() => photos));
    const third = requestPhotoImageFill(session(() => photos));
    expect(second).toBe(first);
    expect(third).toBe(first);

    gate.resolve(new Blob(['p0']));
    await first;

    // First pass: p0, p1 (its list snapshot). Extra pass: only `new` is missing.
    expect(download.mock.calls.map(([path]) => path)).toEqual([
      'owner/p0.jpg',
      'owner/p1.jpg',
      'owner/new.jpg',
    ]);
    expect(cached('owner/new.jpg')).toBe(true);
  });

  it('stops when the device goes offline', async () => {
    const photos = list(3);
    download.mockImplementation(async (path) => {
      setOnline(false);
      return new Blob([path]);
    });

    await requestPhotoImageFill(session(() => photos));

    expect(download).toHaveBeenCalledTimes(1);
    expect(cache.writes).toEqual([photos[0].storage_path]);
  });

  it('does not start offline', async () => {
    setOnline(false);
    await requestPhotoImageFill(session(() => list(3)));
    expect(download).not.toHaveBeenCalled();
  });

  it('stops, writing nothing, when the session changes', async () => {
    const photos = list(3);
    let current = true;
    download.mockImplementation(async (path) => {
      current = false;
      return new Blob([path]);
    });

    await requestPhotoImageFill(session(() => photos, () => current));

    expect(download).toHaveBeenCalledTimes(1);
    expect(cache.writes).toEqual([]);
  });

  it('stops the pass when a write fails for another reason', async () => {
    const photos = list(3);
    cache.failNextWrite = new Error('disk error');

    await requestPhotoImageFill(session(() => photos));

    // p0's write failed: nothing further is downloaded and thrown away.
    expect(download).toHaveBeenCalledTimes(1);
    expect(cache.writes).toEqual([]);
  });

  it('does not cache a photo deleted while it downloaded', async () => {
    let photos = list(2);
    download.mockImplementationOnce(async (path) => {
      photos = photos.filter((p) => p.storage_path !== path);
      return new Blob([path]);
    });

    await requestPhotoImageFill(session(() => photos));

    expect(cached('owner/p0.jpg')).toBe(false);
    expect(cached('owner/p1.jpg')).toBe(true);
  });
});

describe('storage refusal', () => {
  it('drops the oldest older cached photo image first, then retries', async () => {
    const photos = list(5);
    cache.capacity = 3;
    seed('owner/p2.jpg');
    seed('owner/p3.jpg');
    seed('owner/p4.jpg');

    await requestPhotoImageFill(session(() => photos));

    // p0 displaced p4 (the oldest), p1 displaced p3.
    expect(cache.deletes).toEqual(['owner/p4.jpg', 'owner/p3.jpg']);
    expect(['p0', 'p1', 'p2'].map((id) => cached(`owner/${id}.jpg`))).toEqual([true, true, true]);
    expect(['p3', 'p4'].map((id) => cached(`owner/${id}.jpg`))).toEqual([false, false]);
  });

  it('leaves the photo uncached and stops the fill when no older image is cached', async () => {
    const photos = list(3);
    cache.capacity = 1;

    await requestPhotoImageFill(session(() => photos));

    // p0 fits; p1 is refused with nothing older cached, so the fill stops.
    expect(cached('owner/p0.jpg')).toBe(true);
    expect(cached('owner/p1.jpg')).toBe(false);
    expect(download.mock.calls.map(([path]) => path)).toEqual(['owner/p0.jpg', 'owner/p1.jpg']);
    expect(cache.deletes).toEqual([]);
  });

  it('never drops a newer photo image or a love-note image', async () => {
    const photos = list(3);
    cache.capacity = 2;
    seed('owner/p0.jpg');
    seed('partner/love-note.jpg');

    const result = await cachePhotoImage(
      session(() => photos),
      'owner/p1.jpg',
      new Blob(['p1'])
    );

    expect(result).toBe('refused');
    expect(cache.deletes).toEqual([]);
    expect(cached('owner/p0.jpg')).toBe(true);
    expect(cached('partner/love-note.jpg')).toBe(true);
  });

  it('never drops another account\'s images', async () => {
    const photos = list(2);
    cache.capacity = 1;
    seed('owner/p0.jpg');
    seed('owner/p1.jpg', 'USER-B');

    const result = await cachePhotoImage(session(() => photos), 'owner/p0.jpg', new Blob(['x']));
    // Replacing an existing path is not a new image; still fits.
    expect(result).toBe('cached');

    cache.images.delete(`${A}|owner/p0.jpg`);
    seed('owner/other.jpg');
    expect(await cachePhotoImage(session(() => photos), 'owner/p0.jpg', new Blob(['x']))).toBe(
      'refused'
    );
    expect(cached('owner/p1.jpg', 'USER-B')).toBe(true);
  });

  it('writes nothing for a photo no longer in the list', async () => {
    const result = await cachePhotoImage(session(() => list(2)), 'owner/deleted.jpg', new Blob(['x']));

    expect(result).toBe('removed');
    expect(cache.writes).toEqual([]);
  });

  it('re-checks the list before the retry that follows an eviction', async () => {
    let photos = list(2);
    cache.capacity = 1;
    seed('owner/p1.jpg');
    const originalDelete = cache.deletes;
    // The photo is deleted while the older image is being dropped.
    const session_ = session(() => {
      if (originalDelete.length > 0) photos = photos.filter((p) => p.id !== 'p0');
      return photos;
    });

    const result = await cachePhotoImage(session_, 'owner/p0.jpg', new Blob(['x']));

    expect(result).toBe('removed');
    expect(cached('owner/p0.jpg')).toBe(false);
  });

  it('reports another write failure as failed, without evicting', async () => {
    const photos = list(2);
    seed('owner/p1.jpg');
    cache.failNextWrite = new Error('disk error');

    const result = await cachePhotoImage(session(() => photos), 'owner/p0.jpg', new Blob(['x']));

    expect(result).toBe('failed');
    expect(cache.deletes).toEqual([]);
    expect(cached('owner/p1.jpg')).toBe(true);
  });

  it('recognises a transaction aborted with a quota error', async () => {
    const photos = list(2);
    seed('owner/p1.jpg');
    cache.failNextWrite = Object.assign(new DOMException('aborted', 'AbortError'), {
      target: { error: new DOMException('full', 'QuotaExceededError') },
    });

    const result = await cachePhotoImage(session(() => photos), 'owner/p0.jpg', new Blob(['x']));

    expect(result).toBe('cached');
    expect(cache.deletes).toEqual(['owner/p1.jpg']);
  });

  it('writes and drops nothing for a stale session', async () => {
    const photos = list(2);
    seed('owner/p1.jpg');
    cache.capacity = 1;

    const result = await cachePhotoImage(
      session(() => photos, () => false),
      'owner/p0.jpg',
      new Blob(['x'])
    );

    expect(result).toBe('stale');
    expect(cache.writes).toEqual([]);
    expect(cache.deletes).toEqual([]);
  });
});
