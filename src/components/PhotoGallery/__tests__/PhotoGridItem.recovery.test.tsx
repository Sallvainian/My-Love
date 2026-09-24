/**
 * A grid tile whose image download failed while online recovers without a
 * remount (the grid keys tiles by photo id, so a list refresh never remounts
 * one): when the background fill caches that image, and — with the fill held
 * off mobile data — when its own automatic retry succeeds.
 *
 * Real tile, real `usePhotoImage`, real `photoImageCache`; only the image
 * cache (in memory), the download and the store are fakes.
 */
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const images = vi.hoisted(() => new Map<string, Blob>());
const downloadPhoto = vi.hoisted(() => vi.fn<(path: string) => Promise<Blob>>());

vi.mock('../../../services/imageCache', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../services/imageCache')>();
  return {
    isQuotaError: original.isQuotaError,
    readCachedImage: async (userId: string, path: string) => images.get(`${userId}|${path}`) ?? null,
    writeCachedImage: async (userId: string, path: string, blob: Blob) => {
      images.set(`${userId}|${path}`, blob);
    },
    deleteCachedImages: async (userId: string, paths: readonly string[]) => {
      for (const path of paths) images.delete(`${userId}|${path}`);
    },
  };
});
vi.mock('../../../services/photoService', () => ({
  photoService: { downloadPhoto: (path: string) => downloadPhoto(path) },
}));
vi.mock('../../../stores/useAppStore', async () => {
  const { create } = await import('zustand');
  return {
    useAppStore: create(() => ({
      userId: 'USER-A' as string | null,
      authSessionVersion: 1,
      photos: [{ id: 'photo-0', storage_path: 'me/0.jpg' }],
    })),
  };
});

import { ERROR_RETRY_DELAYS_MS } from '../../../hooks/usePhotoImage';
import { setPhotosOverMobileData } from '../../../services/photoDownloadPreference';
import { requestPhotoImageFill } from '../../../services/photoImageCache';
import type { PhotoWithUrls } from '../../../services/photoService';
import { PhotoGridItem } from '../PhotoGridItem';

const PATH = 'me/0.jpg';
const PHOTO = {
  id: 'photo-0',
  user_id: 'me',
  storage_path: PATH,
  caption: 'cap-0',
  signedUrl: null,
  isOwn: true,
  created_at: '2026-09-01T10:00:00.000Z',
} as unknown as PhotoWithUrls;

/** Every tile is in view at once. */
class VisibleObserver {
  constructor(private callback: IntersectionObserverCallback) {}
  observe() {
    this.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  }
  unobserve() {}
  disconnect() {}
}

const originalObserver = window.IntersectionObserver;
let urlCount = 0;
/** Sessions die with their test, so a held fill is never resumed by a later one. */
let alive = true;

function setConnection(connection: object | undefined) {
  Object.defineProperty(navigator, 'connection', { value: connection, configurable: true });
}

function renderTile() {
  render(
    <PhotoGridItem
      photo={PHOTO}
      ownInitial="Y"
      partnerInitial="P"
      partnerName={null}
      onPhotoClick={vi.fn()}
    />
  );
  return screen.getByTestId('photo-grid-item');
}

/** Settle pending awaits while timers are fake (waitFor needs real ones). */
async function settle() {
  for (let i = 0; i < 8; i++) await act(async () => {});
}

beforeEach(() => {
  window.IntersectionObserver = VisibleObserver as unknown as typeof IntersectionObserver;
  images.clear();
  urlCount = 0;
  downloadPhoto.mockReset();
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:test/${++urlCount}`);
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  alive = true;
  setPhotosOverMobileData(false);
});

afterEach(() => {
  alive = false;
  // Releases a hold left by the test; its session is stale, so nothing runs.
  setPhotosOverMobileData(true);
  setPhotosOverMobileData(false);
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  setConnection(undefined);
  window.IntersectionObserver = originalObserver;
});

describe('PhotoGridItem after an online download failure', () => {
  it('shows the image once the background fill caches it', async () => {
    downloadPhoto.mockRejectedValueOnce(new Error('Failed to download photo: 503'));
    const tile = renderTile();
    await waitFor(() => expect(within(tile).getByTestId('photo-grid-item-not-saved')).toBeInTheDocument());

    // The fill runs (a list refresh) and stores this photo's image.
    downloadPhoto.mockResolvedValue(new Blob(['IMAGE']));
    await act(async () => {
      await requestPhotoImageFill({
        userId: 'USER-A',
        isCurrent: () => alive,
        photos: () => [{ id: 'photo-0', storage_path: PATH }],
      });
    });

    await waitFor(() =>
      expect(within(tile).queryByTestId('photo-grid-item-not-saved')).toBeNull()
    );
    expect(within(tile).getByTestId('photo-grid-item-image').getAttribute('src')).toMatch(/^blob:test\//);
    // The fill's one download; the tile read the cache instead of downloading again.
    expect(downloadPhoto).toHaveBeenCalledTimes(2);
  });

  it('on mobile data with the fill held, loads on its own retry', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    setConnection(Object.assign(new EventTarget(), { type: 'cellular' }));
    downloadPhoto.mockRejectedValueOnce(new Error('Failed to download photo: 503'));
    downloadPhoto.mockResolvedValue(new Blob(['IMAGE']));

    const tile = renderTile();
    await settle();
    expect(within(tile).getByTestId('photo-grid-item-not-saved')).toBeInTheDocument();

    // The fill is held off mobile data, so it will not cache this image.
    await act(async () => {
      await requestPhotoImageFill({
        userId: 'USER-A',
        isCurrent: () => alive,
        photos: () => [{ id: 'photo-0', storage_path: PATH }],
      });
    });
    expect(downloadPhoto).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ERROR_RETRY_DELAYS_MS[0]);
    });
    await settle();

    expect(within(tile).queryByTestId('photo-grid-item-not-saved')).toBeNull();
    expect(within(tile).getByTestId('photo-grid-item-image').getAttribute('src')).toMatch(/^blob:test\//);
  });
});
