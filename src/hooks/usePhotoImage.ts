/**
 * usePhotoImage — one photo's image for display, cache-first
 * (spec-unified-data-storage story 10).
 *
 * 1. The cached Blob (per-account `image-cache`, keyed by storage path) as an
 *    object URL, revoked when no longer shown.
 * 2. Otherwise, online: download by storage path, cache it under the
 *    storage-refusal rule (`cachePhotoImage`) and show it — even when it could
 *    not be cached.
 * 3. Otherwise `unavailable`: the caller shows a placeholder saying the photo
 *    is not saved on this device. A download that fails while online is
 *    `error` (the viewer offers a retry).
 *
 * There is no signed-URL fallback. Identity is captured before the first
 * await; a result raised for one account or session is never cached or shown
 * under another.
 *
 * An `unavailable` or `error` image loads again, without a remount, when the
 * connection returns and when this account's image for the path is cached
 * (the background fill, or another display of the same photo). An `error` is
 * also retried on its own a few times (`ERROR_RETRY_DELAYS_MS`), because on an
 * already-online device neither of those may ever happen: the fill can be held
 * off mobile data, and a failure it met is only retried by its next run.
 */
import { useEffect, useRef, useState } from 'react';
import { readCachedImage } from '../services/imageCache';
import { cachePhotoImage, onPhotoImageCached } from '../services/photoImageCache';
import { photoService } from '../services/photoService';
import { useAppStore } from '../stores/useAppStore';
import { logger } from '../utils/logger';

export type PhotoImageStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';

export interface PhotoImage {
  status: PhotoImageStatus;
  /** An object URL while `ready`, otherwise null. */
  url: string | null;
}

export interface UsePhotoImageOptions {
  /** False defers any read or download (a tile not yet scrolled into view). */
  enabled?: boolean;
  /** Changing it re-runs the load (the viewer's Retry). */
  retryKey?: number;
}

type Loaded = PhotoImage & { key: string };

/** Read fresh at each call: TypeScript would otherwise keep an earlier narrowing. */
const isOffline = () => navigator.onLine === false;

/** Automatic retries of an online download failure, then it stays `error`. */
export const ERROR_RETRY_DELAYS_MS = [2_000, 10_000, 30_000] as const;

const IDLE: PhotoImage = { status: 'idle', url: null };
const LOADING: PhotoImage = { status: 'loading', url: null };

export function usePhotoImage(
  storagePath: string | null | undefined,
  { enabled = true, retryKey = 0 }: UsePhotoImageOptions = {}
): PhotoImage {
  const userId = useAppStore((state) => state.userId);
  const authSessionVersion = useAppStore((state) => state.authSessionVersion);
  // The photo list the refusal rule picks an eviction from, read when a write
  // is refused rather than when the effect started.
  const photos = useAppStore((state) => state.photos);
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  // Automatic `error` retries already spent on `baseKey`.
  const errorRetries = useRef({ baseKey: '', count: 0 });

  const active = !!storagePath && enabled && !!userId;
  const baseKey = `${userId ?? ''}|${authSessionVersion}|${storagePath ?? ''}|${retryKey}`;
  const key = `${baseKey}|${reloadTick}`;

  useEffect(() => {
    if (!active || !storagePath || !userId) return;

    let isMounted = true;
    let objectUrl: string | null = null;

    // The subscription notices an account switch synchronously, before React
    // re-renders and re-runs this effect.
    let sessionChanged = false;
    const unsubscribe = useAppStore.subscribe((state) => {
      if (state.userId !== userId || state.authSessionVersion !== authSessionVersion) {
        sessionChanged = true;
      }
    });
    const ownsSession = () => !sessionChanged;
    const live = () => isMounted && ownsSession();

    const show = (blob: Blob) => {
      objectUrl = URL.createObjectURL(blob);
      setLoaded({ key, status: 'ready', url: objectUrl });
    };

    void (async () => {
      const cached = await readCachedImage(userId, storagePath);
      if (!live()) return;
      if (cached) {
        show(cached);
        return;
      }

      if (isOffline()) {
        setLoaded({ key, status: 'unavailable', url: null });
        return;
      }

      let downloaded: Blob;
      try {
        downloaded = await photoService.downloadPhoto(storagePath);
      } catch (error) {
        logger.debug('[usePhotoImage] Photo download failed', error);
        if (!live()) return;
        setLoaded({
          key,
          status: isOffline() ? 'unavailable' : 'error',
          url: null,
        });
        return;
      }
      if (!ownsSession()) return;

      // Shown whether or not it could be cached; failures are logged there.
      await cachePhotoImage(
        {
          userId,
          isCurrent: ownsSession,
          photos: () => photosRef.current,
        },
        storagePath,
        downloaded
      );
      if (!live()) return;
      show(downloaded);
    })();

    return () => {
      isMounted = false;
      unsubscribe();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [active, key, storagePath, userId, authSessionVersion]);

  const current: PhotoImage = !active
    ? IDLE
    : loaded?.key === key
      ? { status: loaded.status, url: loaded.url }
      : LOADING;

  // Not saved here, or the download failed: load again when the connection
  // returns, or as soon as this account's image for the path is cached.
  const waiting = active && (current.status === 'unavailable' || current.status === 'error');
  useEffect(() => {
    if (!waiting || !userId || !storagePath) return;
    const reload = () => setReloadTick((tick) => tick + 1);
    window.addEventListener('online', reload);
    const unsubscribe = onPhotoImageCached((cachedUserId, cachedPath) => {
      if (cachedUserId === userId && cachedPath === storagePath) reload();
    });
    return () => {
      window.removeEventListener('online', reload);
      unsubscribe();
    };
  }, [waiting, userId, storagePath]);

  // An online download failure (a Storage 5xx, a rate limit, a token-refresh
  // race) is retried a few times with a growing delay. A new photo, session or
  // retryKey starts the count again.
  const failed = active && current.status === 'error';
  useEffect(() => {
    if (!failed) return;
    const spent = errorRetries.current.baseKey === baseKey ? errorRetries.current.count : 0;
    if (spent >= ERROR_RETRY_DELAYS_MS.length) return;
    const timer = setTimeout(() => {
      errorRetries.current = { baseKey, count: spent + 1 };
      setReloadTick((tick) => tick + 1);
    }, ERROR_RETRY_DELAYS_MS[spent]);
    return () => clearTimeout(timer);
  }, [failed, baseKey]);

  return current;
}
