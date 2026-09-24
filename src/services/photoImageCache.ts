/**
 * Photo image cache — keeps every photo's image on the device for offline use
 * (spec-unified-data-storage story 10, CAP-5).
 *
 * Photo images live in the shared per-account `image-cache` store
 * (`imageCache.ts`), keyed by storage path, next to love-note images. This
 * module owns the two rules that apply to PHOTO images only.
 *
 * ## The fill
 *
 * `requestPhotoImageFill(session)` downloads every photo image of the
 * session's list that is not cached yet. `photosSlice` requests it after each
 * successful list read, so "after one online session" holds even if the
 * gallery was never opened.
 * - One run per tab at a time. A request during a run makes it pass once more
 *   (with the latest request's session) after the current pass.
 * - Sequential, newest first (the list's order), skipping paths already
 *   cached, so one start never floods Storage and a later start resumes where
 *   the last one stopped.
 * - Stops when `navigator.onLine === false`, the session changes, or a cache
 *   write fails. A failed download of one photo is logged and skipped; the
 *   next run retries it. A photo deleted while its image downloads is not
 *   cached (`cachePhotoImage` re-checks the list before every write).
 * - Wi-Fi only unless the user allows mobile data. On a metered connection
 *   (`navigator.connection.type === 'cellular'`) the pass stops before its next download unless the device
 *   preference "Download photos over mobile data" is on
 *   (`photoDownloadPreference.ts`). The stopped session is held, and the fill
 *   resumes through `requestPhotoImageFill` — never as a second run — when the
 *   connection's `change` event reports an unmetered type or the preference is
 *   turned on. A browser that does not report the type (no
 *   `navigator.connection`, or a missing or `'unknown'` type: Safari, Firefox,
 *   most desktops) is not held: the fill runs on any connection. Only the fill is
 *   held; a photo on screen is still downloaded by `usePhotoImage`.
 *
 * ## Storage refusal (eviction)
 *
 * `cachePhotoImage(session, path, blob)` is the only way a photo image is
 * written — by the fill and by the display hook (`usePhotoImage`). When the
 * browser refuses the write (`isQuotaError`) while caching photo P, the cached
 * image of the OLDEST photo in the list that is older than P is deleted and
 * the write retried. When no older cached photo is left, P is not cached (the
 * fill then stops; a display still shows the image it holds). The victim is
 * picked from the photo LIST, never by scanning `image-cache`, so love-note
 * images can never be evicted. There is no count or size cap and no eviction
 * without a refusal.
 *
 * The refused photo is remembered (its account and storage path, for the
 * signed-in session that met the refusal), and a later pass that reaches it
 * uncached stops there BEFORE downloading it, rather than fetching a full-size
 * image only to be refused again. It is forgotten whenever room may have been
 * freed: a photo image is deleted (the list prune and a photo delete, both
 * through `deletePhotoImages`, or an eviction), a photo image write succeeds,
 * or the session ends (sign-out, or a different account). Only the fill
 * consults it; a display still downloads the photo it has to show.
 *
 * ## Cached notice
 *
 * Every successful write is announced to `onPhotoImageCached` listeners, so a
 * display that could not show an image (`usePhotoImage`'s `unavailable` or
 * `error`) reads the cache again as soon as the fill — or another display of
 * the same photo — has stored it.
 *
 * ## Identity
 *
 * Every read, write and delete runs under the session's CAPTURED `userId`, and
 * `session.isCurrent()` is re-checked before each cache write and delete, so
 * one account's images are never written or dropped under another.
 */
import { logger } from '../utils/logger';
import {
  deleteCachedImages,
  isQuotaError,
  readCachedImage,
  writeCachedImage,
} from './imageCache';
import {
  type ConnectionInfo,
  getConnection,
  getPhotosOverMobileData,
  onMeteredConnection,
  subscribePhotosOverMobileData,
} from './photoDownloadPreference';
import { photoService, type SupabasePhoto } from './photoService';

/** The fields of a photo row this module needs. */
export type PhotoImageRef = Pick<SupabasePhoto, 'id' | 'storage_path'>;

/** The account a fill or a display-time write runs for. */
export interface PhotoCacheSession {
  /** The account captured before the first await; every cache key uses it. */
  userId: string;
  /** Whether that account's session is still the signed-in one. */
  isCurrent: () => boolean;
  /** The account's photo list as it is NOW, newest first. */
  photos: () => readonly PhotoImageRef[];
}

/**
 * - `cached`: the image is in the cache.
 * - `refused`: storage refused and no older cached photo was left to drop.
 * - `failed`: the write failed for another reason (logged).
 * - `stale`: the session changed; nothing was written.
 * - `removed`: the photo is no longer in the list (deleted or pruned while its
 *   image downloaded); nothing was written, so no orphan is left.
 */
export type PhotoCacheWriteResult = 'cached' | 'refused' | 'failed' | 'stale' | 'removed';

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

type CachedListener = (userId: string, path: string) => void;
const cachedListeners = new Set<CachedListener>();

/**
 * Be told each time a photo image is written to the cache, with the account
 * and storage path it was written under. Returns the unsubscribe.
 */
export function onPhotoImageCached(listener: CachedListener): () => void {
  cachedListeners.add(listener);
  return () => {
    cachedListeners.delete(listener);
  };
}

function announceCached(userId: string, path: string): void {
  for (const listener of Array.from(cachedListeners)) {
    try {
      listener(userId, path);
    } catch (error) {
      console.error('[photoImageCache] A cached-image listener failed:', error);
    }
  }
}

/** On mobile data and the user has not allowed the fill there. */
const heldForMobileData = () => onMeteredConnection() && !getPhotosOverMobileData();

/**
 * The storage path of the oldest photo in the list that is older than the
 * photo at `path` and has a cached image, skipping `excluded`; `null` when
 * there is none (or `path` is not in the list).
 */
async function oldestCachedOlderPhoto(
  session: PhotoCacheSession,
  path: string,
  excluded: ReadonlySet<string>
): Promise<string | null> {
  const list = session.photos();
  const index = list.findIndex((photo) => photo.storage_path === path);
  if (index < 0) return null;
  for (let i = list.length - 1; i > index; i--) {
    const candidate = list[i].storage_path;
    if (candidate === path || excluded.has(candidate)) continue;
    if (!session.isCurrent()) return null;
    if (await readCachedImage(session.userId, candidate)) return candidate;
  }
  return null;
}

/**
 * The photo whose image storage last refused, with the account and the
 * session that met the refusal. One is enough: the fill stops at a refusal,
 * so it never reaches a photo behind it.
 */
let refused: { userId: string; path: string; isCurrent: () => boolean } | null = null;

/** Room may have been freed: a later pass downloads the refused photo again. */
function forgetRefusal(): void {
  refused = null;
}

/** Whether storage refused the image at `path` for this session's account. */
function isRefused(session: PhotoCacheSession, path: string): boolean {
  if (!refused) return false;
  // Signed out, or another account: the refusal no longer applies.
  if (refused.userId !== session.userId || !refused.isCurrent()) {
    forgetRefusal();
    return false;
  }
  return refused.path === path;
}

/**
 * Delete the cached images of the photos at `paths` for `userId` — the list
 * prune and a photo delete. Throws, as `deleteCachedImages` does. The room it
 * frees lets the fill try a refused photo again.
 */
export async function deletePhotoImages(userId: string, paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return;
  await deleteCachedImages(userId, paths);
  forgetRefusal();
}

/**
 * Cache `blob` as the image of the photo at `path`, applying the refusal rule:
 * on a storage refusal, drop the oldest cached photo older than this one and
 * retry, until it fits or none is left.
 */
export async function cachePhotoImage(
  session: PhotoCacheSession,
  path: string,
  blob: Blob
): Promise<PhotoCacheWriteResult> {
  const evicted = new Set<string>();
  for (;;) {
    if (!session.isCurrent()) return 'stale';
    // Checked immediately before every write: a delete or prune can land in
    // any await before this one.
    if (!session.photos().some((photo) => photo.storage_path === path)) return 'removed';
    try {
      await writeCachedImage(session.userId, path, blob);
      forgetRefusal();
      announceCached(session.userId, path);
      return 'cached';
    } catch (error) {
      if (!isQuotaError(error)) {
        console.error('[photoImageCache] Failed to cache a photo image:', error);
        return 'failed';
      }
      const victim = await oldestCachedOlderPhoto(session, path, evicted);
      if (!victim) {
        logger.debug('[photoImageCache] Storage refused and no older photo image is cached');
        refused = { userId: session.userId, path, isCurrent: session.isCurrent };
        return 'refused';
      }
      if (!session.isCurrent()) return 'stale';
      try {
        await deleteCachedImages(session.userId, [victim]);
      } catch (deleteError) {
        console.error('[photoImageCache] Failed to drop an older photo image:', deleteError);
        return 'failed';
      }
      evicted.add(victim);
      forgetRefusal();
      logger.debug('[photoImageCache] Storage refused; dropped an older photo image');
    }
  }
}

/** The session whose fill stopped for mobile data, resumed when allowed. */
let held: PhotoCacheSession | null = null;
let heldConnection: ConnectionInfo | null = null;
let unsubscribePreference: (() => void) | null = null;

function releaseHold(): void {
  held = null;
  unsubscribePreference?.();
  unsubscribePreference = null;
  heldConnection?.removeEventListener('change', resumeHeldFill);
  heldConnection = null;
}

/** Keep `session` to resume, listening (once) for the conditions that allow it. */
function holdFill(session: PhotoCacheSession): void {
  held = session;
  if (!unsubscribePreference) unsubscribePreference = subscribePhotosOverMobileData(resumeHeldFill);
  const connection = getConnection();
  if (connection && connection !== heldConnection && typeof connection.addEventListener === 'function') {
    heldConnection?.removeEventListener('change', resumeHeldFill);
    connection.addEventListener('change', resumeHeldFill);
    heldConnection = connection;
  }
  logger.debug('[photoImageCache] On mobile data: the photo image fill waits for Wi-Fi');
}

function resumeHeldFill(): void {
  if (!held || heldForMobileData()) return;
  const session = held;
  releaseHold();
  if (!session.isCurrent()) return;
  void requestPhotoImageFill(session);
}

/** One pass over the list as it was when the pass started. */
async function fillPass(session: PhotoCacheSession): Promise<void> {
  // A current pass supersedes any held one; it holds again if it has to.
  if (session.isCurrent()) releaseHold();
  const list = session.photos().slice();
  for (const photo of list) {
    if (isOffline() || !session.isCurrent()) return;
    const path = photo.storage_path;

    const cached = await readCachedImage(session.userId, path);
    if (!session.isCurrent()) return;
    if (cached) continue;
    if (isOffline()) return;
    // Storage refused this image and no room has been freed since: downloading
    // it again would only be refused again, so the pass stops as it did then.
    if (isRefused(session, path)) {
      logger.debug('[photoImageCache] Storage refused this photo image; waiting for room');
      return;
    }
    // Checked only before a download: reading what is cached costs no data.
    if (heldForMobileData()) {
      holdFill(session);
      return;
    }

    let blob: Blob;
    try {
      blob = await photoService.downloadPhoto(path);
    } catch (error) {
      console.warn('[photoImageCache] Skipping a photo whose image failed to download:', error);
      continue;
    }
    if (!session.isCurrent()) return;

    // `removed` (deleted while it downloaded) moves on; anything else that did
    // not cache stops the pass — a broken database would otherwise download
    // and discard the whole album on every pass.
    const result = await cachePhotoImage(session, path, blob);
    if (result === 'refused' || result === 'stale' || result === 'failed') return;
  }
}

let running: Promise<void> | null = null;
let pending: PhotoCacheSession | null = null;

/**
 * Start the fill for `session`, or — when one is running — make it pass once
 * more with this session afterwards. Resolves when the run (including that
 * extra pass) ends; never rejects.
 */
export function requestPhotoImageFill(session: PhotoCacheSession): Promise<void> {
  if (running) {
    pending = session;
    return running;
  }
  running = (async () => {
    let next: PhotoCacheSession | null = session;
    try {
      while (next) {
        const current: PhotoCacheSession = next;
        next = null;
        try {
          await fillPass(current);
        } catch (error) {
          console.error('[photoImageCache] Photo image fill failed:', error);
        }
        next = pending;
        pending = null;
      }
    } finally {
      running = null;
    }
  })();
  return running;
}
