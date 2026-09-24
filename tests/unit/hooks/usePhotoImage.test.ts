/**
 * usePhotoImage — one photo's image for display (spec-unified-data-storage
 * story 10).
 *
 * Cache first (a blob URL, revoked when no longer shown); otherwise, online,
 * download, cache under the storage-refusal rule and show — even when it could
 * not be cached; otherwise `unavailable` (the placeholder). An online download
 * failure is `error`. Nothing raised for one session is cached or shown under
 * another.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const readCachedImage = vi.hoisted(() => vi.fn<(userId: string, path: string) => Promise<Blob | null>>());
const downloadPhoto = vi.hoisted(() => vi.fn<(path: string) => Promise<Blob>>());
const cachePhotoImage = vi.hoisted(() => vi.fn());
/** The real module's "image cached" notice, as a registry the tests fire. */
const cachedListeners = vi.hoisted(() => new Set<(userId: string, path: string) => void>());

vi.mock('@/services/imageCache', () => ({
  readCachedImage: (userId: string, path: string) => readCachedImage(userId, path),
}));
vi.mock('@/services/photoService', () => ({
  photoService: { downloadPhoto: (path: string) => downloadPhoto(path) },
}));
vi.mock('@/services/photoImageCache', () => ({
  cachePhotoImage: (...args: unknown[]) => cachePhotoImage(...args),
  onPhotoImageCached: (listener: (userId: string, path: string) => void) => {
    cachedListeners.add(listener);
    return () => {
      cachedListeners.delete(listener);
    };
  },
}));
vi.mock('@/stores/useAppStore', async () => {
  const { create } = await import('zustand');
  return {
    useAppStore: create(() => ({
      userId: 'USER-A' as string | null,
      authSessionVersion: 1,
      photos: [{ id: 'p0', storage_path: 'owner/p0.jpg' }],
    })),
  };
});

import { ERROR_RETRY_DELAYS_MS, usePhotoImage } from '@/hooks/usePhotoImage';
import type { PhotoCacheSession } from '@/services/photoImageCache';
import { useAppStore } from '@/stores/useAppStore';

const PATH = 'owner/p0.jpg';

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

let urlCount = 0;
const revoked: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  urlCount = 0;
  revoked.length = 0;
  setOnline(true);
  useAppStore.setState({
    userId: 'USER-A',
    authSessionVersion: 1,
    photos: [{ id: 'p0', storage_path: PATH }],
  } as unknown as Parameters<typeof useAppStore.setState>[0]);
  readCachedImage.mockResolvedValue(null);
  downloadPhoto.mockResolvedValue(new Blob(['DOWNLOADED']));
  cachePhotoImage.mockResolvedValue('cached');
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:test/${++urlCount}`);
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url: string) => {
    revoked.push(url);
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  setOnline(true);
});

/** Announce that `path` was cached for `userId`, as `cachePhotoImage` does. */
function announceCached(userId: string, path: string) {
  act(() => {
    for (const listener of Array.from(cachedListeners)) listener(userId, path);
  });
}

/** Settle the hook's awaits while timers are fake (waitFor needs real ones). */
async function settle() {
  for (let i = 0; i < 5; i++) await act(async () => {});
}

describe('usePhotoImage', () => {
  it('shows the cached image without downloading', async () => {
    readCachedImage.mockResolvedValue(new Blob(['CACHED']));

    const { result } = renderHook(() => usePhotoImage(PATH));

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', url: 'blob:test/1' }));
    expect(readCachedImage).toHaveBeenCalledWith('USER-A', PATH);
    expect(downloadPhoto).not.toHaveBeenCalled();
    expect(cachePhotoImage).not.toHaveBeenCalled();
  });

  it('online and not cached: downloads, caches under the refusal rule, shows it', async () => {
    const { result } = renderHook(() => usePhotoImage(PATH));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(downloadPhoto).toHaveBeenCalledWith(PATH);
    expect(cachePhotoImage).toHaveBeenCalledTimes(1);
    const [session, path, blob] = cachePhotoImage.mock.calls[0] as [PhotoCacheSession, string, Blob];
    expect(session.userId).toBe('USER-A');
    expect(session.isCurrent()).toBe(true);
    expect(session.photos()).toEqual([{ id: 'p0', storage_path: PATH }]);
    expect(path).toBe(PATH);
    expect(await blob.text()).toBe('DOWNLOADED');
  });

  it("hands cachePhotoImage the store's live list, so a photo deleted mid-download is not cached", async () => {
    const pending = deferred<Blob>();
    downloadPhoto.mockReturnValueOnce(pending.promise);
    renderHook(() => usePhotoImage(PATH));
    await waitFor(() => expect(downloadPhoto).toHaveBeenCalled());

    // The photo is deleted (or pruned) while its image downloads.
    act(() => {
      useAppStore.setState({ photos: [] });
    });
    pending.resolve(new Blob(['IMAGE']));

    await waitFor(() => expect(cachePhotoImage).toHaveBeenCalled());
    const [session] = cachePhotoImage.mock.calls[0] as [PhotoCacheSession];
    expect(session.photos()).toEqual([]);
  });

  it('shows the downloaded image even when storage refused to cache it', async () => {
    cachePhotoImage.mockResolvedValue('refused');

    const { result } = renderHook(() => usePhotoImage(PATH));

    await waitFor(() => expect(result.current).toEqual({ status: 'ready', url: 'blob:test/1' }));
  });

  it('offline and not cached: unavailable, with no download', async () => {
    setOnline(false);

    const { result } = renderHook(() => usePhotoImage(PATH));

    await waitFor(() => expect(result.current).toEqual({ status: 'unavailable', url: null }));
    expect(downloadPhoto).not.toHaveBeenCalled();
  });

  it('an online download failure is an error; going offline mid-download is unavailable', async () => {
    downloadPhoto.mockRejectedValueOnce(new Error('500'));
    const first = renderHook(() => usePhotoImage(PATH));
    await waitFor(() => expect(first.result.current.status).toBe('error'));
    first.unmount();

    downloadPhoto.mockImplementationOnce(async () => {
      setOnline(false);
      throw new Error('Failed to fetch');
    });
    const second = renderHook(() => usePhotoImage(PATH));
    await waitFor(() => expect(second.result.current.status).toBe('unavailable'));
  });

  it('tries again when the connection returns', async () => {
    setOnline(false);
    const { result } = renderHook(() => usePhotoImage(PATH));
    await waitFor(() => expect(result.current.status).toBe('unavailable'));

    setOnline(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(downloadPhoto).toHaveBeenCalledTimes(1);
  });

  it('reads nothing while disabled, or without a path', async () => {
    const disabled = renderHook(() => usePhotoImage(PATH, { enabled: false }));
    const noPath = renderHook(() => usePhotoImage(null));

    await act(async () => {});
    expect(disabled.result.current).toEqual({ status: 'idle', url: null });
    expect(noPath.result.current).toEqual({ status: 'idle', url: null });
    expect(readCachedImage).not.toHaveBeenCalled();
  });

  it('revokes the object URL when the image is no longer shown', async () => {
    readCachedImage.mockResolvedValue(new Blob(['CACHED']));
    const { result, rerender, unmount } = renderHook(({ path }) => usePhotoImage(path), {
      initialProps: { path: PATH },
    });
    await waitFor(() => expect(result.current.url).toBe('blob:test/1'));

    rerender({ path: 'owner/p1.jpg' });
    expect(revoked).toEqual(['blob:test/1']);
    await waitFor(() => expect(result.current.url).toBe('blob:test/2'));

    unmount();
    expect(revoked).toEqual(['blob:test/1', 'blob:test/2']);
  });

  it('retries on a new retryKey', async () => {
    downloadPhoto.mockRejectedValueOnce(new Error('500'));
    const { result, rerender } = renderHook(({ retryKey }) => usePhotoImage(PATH, { retryKey }), {
      initialProps: { retryKey: 0 },
    });
    await waitFor(() => expect(result.current.status).toBe('error'));

    rerender({ retryKey: 1 });

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(downloadPhoto).toHaveBeenCalledTimes(2);
  });

  it('a session change during the download caches and shows nothing', async () => {
    const pending = deferred<Blob>();
    downloadPhoto.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => usePhotoImage(PATH));
    await waitFor(() => expect(downloadPhoto).toHaveBeenCalled());

    readCachedImage.mockClear();
    downloadPhoto.mockReturnValue(new Promise(() => {}));
    act(() => {
      useAppStore.setState({ userId: 'USER-B', authSessionVersion: 2 });
    });
    pending.resolve(new Blob(['A-IMAGE']));
    await act(async () => {});

    expect(cachePhotoImage).not.toHaveBeenCalled();
    expect(result.current.url).toBeNull();
    // The new session reads under its own account.
    await waitFor(() => expect(readCachedImage).toHaveBeenCalledWith('USER-B', PATH));
  });
});

describe('usePhotoImage recovers without a remount', () => {
  it('an error shows the image once the fill caches it, with no second download', async () => {
    downloadPhoto.mockRejectedValueOnce(new Error('503'));
    const { result } = renderHook(() => usePhotoImage(PATH));
    await waitFor(() => expect(result.current.status).toBe('error'));

    // The background fill stores this photo's image a moment later.
    readCachedImage.mockResolvedValue(new Blob(['CACHED BY THE FILL']));
    announceCached('USER-A', PATH);

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(downloadPhoto).toHaveBeenCalledTimes(1);
  });

  it('an unavailable image shows once it is cached', async () => {
    setOnline(false);
    const { result } = renderHook(() => usePhotoImage(PATH));
    await waitFor(() => expect(result.current.status).toBe('unavailable'));

    readCachedImage.mockResolvedValue(new Blob(['CACHED']));
    announceCached('USER-A', PATH);

    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it("ignores another photo's or another account's cached image", async () => {
    setOnline(false);
    const { result } = renderHook(() => usePhotoImage(PATH));
    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    readCachedImage.mockClear();

    announceCached('USER-A', 'owner/other.jpg');
    announceCached('USER-B', PATH);
    await act(async () => {});

    expect(readCachedImage).not.toHaveBeenCalled();
    expect(result.current.status).toBe('unavailable');
  });

  it('stops listening once the image is shown or the hook unmounts', async () => {
    readCachedImage.mockResolvedValue(new Blob(['CACHED']));
    const shown = renderHook(() => usePhotoImage(PATH));
    await waitFor(() => expect(shown.result.current.status).toBe('ready'));
    expect(cachedListeners.size).toBe(0);

    readCachedImage.mockResolvedValue(null);
    setOnline(false);
    const waiting = renderHook(() => usePhotoImage('owner/p1.jpg'));
    await waitFor(() => expect(waiting.result.current.status).toBe('unavailable'));
    expect(cachedListeners.size).toBe(1);
    waiting.unmount();
    expect(cachedListeners.size).toBe(0);
  });

  it('retries an online download failure on its own', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    downloadPhoto.mockRejectedValueOnce(new Error('503'));
    const { result } = renderHook(() => usePhotoImage(PATH));
    await settle();
    expect(result.current.status).toBe('error');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ERROR_RETRY_DELAYS_MS[0]);
    });
    await settle();

    expect(result.current.status).toBe('ready');
    expect(downloadPhoto).toHaveBeenCalledTimes(2);
  });

  it('stops retrying on its own after the last delay, and a retryKey starts again', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    downloadPhoto.mockRejectedValue(new Error('503'));
    const { result, rerender } = renderHook(({ retryKey }) => usePhotoImage(PATH, { retryKey }), {
      initialProps: { retryKey: 0 },
    });
    await settle();

    for (const delay of ERROR_RETRY_DELAYS_MS) {
      expect(result.current.status).toBe('error');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(delay);
      });
      await settle();
    }
    expect(result.current.status).toBe('error');
    expect(downloadPhoto).toHaveBeenCalledTimes(1 + ERROR_RETRY_DELAYS_MS.length);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60_000);
    });
    await settle();
    expect(downloadPhoto).toHaveBeenCalledTimes(1 + ERROR_RETRY_DELAYS_MS.length);

    // The viewer's Retry: a fresh load, and a fresh set of automatic retries.
    downloadPhoto.mockRejectedValueOnce(new Error('503'));
    downloadPhoto.mockResolvedValueOnce(new Blob(['OK']));
    rerender({ retryKey: 1 });
    await settle();
    expect(result.current.status).toBe('error');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ERROR_RETRY_DELAYS_MS[0]);
    });
    await settle();
    expect(result.current.status).toBe('ready');
  });

  it('does not retry an unavailable image on a timer', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    setOnline(false);
    const { result } = renderHook(() => usePhotoImage(PATH));
    await settle();
    expect(result.current.status).toBe('unavailable');
    readCachedImage.mockClear();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60_000);
    });
    await settle();

    expect(readCachedImage).not.toHaveBeenCalled();
  });
});
