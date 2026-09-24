/**
 * Photos Slice
 *
 * Manages photo state and upload operations including:
 * - Photo list (own + partner photos), kept for offline use
 * - Storage quota warnings (80%/95% thresholds)
 * - Error handling for upload failures
 *
 * Story 6.2: Photo Upload with Progress Indicator
 *
 * Cross-slice dependencies:
 * - authSlice: every action (`loadPhotos` and the kind's refresher included)
 *   captures `{ userId, authSessionVersion }` before its first await and
 *   re-checks the pair before every state write, copy write, cache write and
 *   cache delete, so a continuation raised by one account — or by an earlier
 *   session of the same account — never lands in the next one's store, copy or
 *   image cache on a shared device.
 *
 * Persistence (spec-unified-data-storage story 10):
 * - Supabase holds the truth. The device keeps one per-account local copy,
 *   kind `photos` (`services/localCopy.ts`): EVERY photo row, plain data,
 *   newest `created_at` first (ties by `id`), with `signedUrl: null`, read back
 *   through a shape guard; a copy that fails the guard is ignored whole.
 * - `loadPhotos` shows the copy at once (only into an empty list, and only
 *   until this session has a server answer), then replaces state and copy with
 *   a full server read (`photoService.listAllPhotos`). A failed read changes
 *   nothing and sets only `photosLoadError`; an empty answer is saved as `[]`.
 *   It is the kind's refresher (signed-in start, reconnect) and the gallery
 *   calls it when it opens.
 * - After a successful read, the cached images of photos that were in the
 *   previous list but not in the new one are deleted, and the background image
 *   fill is requested (`services/photoImageCache.ts`). Images are kept in the
 *   per-account `image-cache`, keyed by storage path; the gallery shows them
 *   through `usePhotoImage`, never through a signed URL.
 * - A confirmed upload prepends to state and the copy; a confirmed delete
 *   removes the row from both and deletes its cached image. Upload and delete
 *   still need a connection; nothing is queued.
 * - NOT persisted to localStorage. Sign-out deletes the outgoing account's
 *   copies and cached images (`deleteAccountData`), and `signedOutState()`
 *   resets `photos`, `photosLoaded` and `photosLoadError`.
 */

import { deleteCachedImages } from '../../services/imageCache';
import { readLocalCopy, registerLocalCopy, writeLocalCopy } from '../../services/localCopy';
import { requestPhotoImageFill } from '../../services/photoImageCache';
import type { PhotoUploadInput, PhotoWithUrls, SupabasePhoto } from '../../services/photoService';
import { photoService } from '../../services/photoService';
import type { AppStateCreator } from '../types';

/** Local-copy kind for the whole photo list. */
export const PHOTOS_COPY_KIND = 'photos';

/** One saved photo: plain, structured-cloneable data only. */
function toSavedPhoto(photo: PhotoWithUrls): PhotoWithUrls {
  return {
    id: photo.id,
    user_id: photo.user_id,
    storage_path: photo.storage_path,
    filename: photo.filename,
    caption: photo.caption,
    mime_type: photo.mime_type,
    file_size: photo.file_size,
    width: photo.width,
    height: photo.height,
    created_at: photo.created_at,
    signedUrl: null,
    isOwn: photo.isOwn,
  };
}

/** A server row as the gallery holds it, owned relative to `userId`. */
function toGalleryPhoto(row: SupabasePhoto, userId: string): PhotoWithUrls {
  return toSavedPhoto({ ...row, signedUrl: null, isOwn: row.user_id === userId });
}

function parseSavedPhoto(value: unknown): PhotoWithUrls | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.id !== 'string' ||
    typeof v.user_id !== 'string' ||
    typeof v.storage_path !== 'string' ||
    typeof v.filename !== 'string' ||
    (v.caption !== null && typeof v.caption !== 'string') ||
    typeof v.mime_type !== 'string' ||
    typeof v.file_size !== 'number' ||
    typeof v.width !== 'number' ||
    typeof v.height !== 'number' ||
    typeof v.created_at !== 'string' ||
    typeof v.isOwn !== 'boolean'
  ) {
    return null;
  }
  return toSavedPhoto(v as unknown as PhotoWithUrls);
}

/**
 * A saved copy in a shape the gallery can use. The copy is written only by
 * this slice, so one unreadable entry means the whole copy is suspect: ignored.
 */
function parseSavedPhotos(value: unknown): PhotoWithUrls[] | null {
  if (!Array.isArray(value)) return null;
  const photos: PhotoWithUrls[] = [];
  for (const item of value) {
    const parsed = parseSavedPhoto(item);
    if (!parsed) return null;
    photos.push(parsed);
  }
  return photos;
}

/** A confirmed upload or delete, replayed onto a list read that was in flight. */
type ConfirmedChange = { userId: string; authSessionVersion: number } & (
  | { kind: 'upload'; photo: PhotoWithUrls }
  | { kind: 'delete'; photoId: string }
);

/**
 * Outcome of an upload attempt. The failure message is returned directly rather
 * than read back off the store, so callers get the message for *their* upload
 * and not whatever unrelated error the shared `error` key happens to hold.
 */
export type PhotoUploadResult = { success: true } | { success: false; error: string };

export interface PhotosSlice {
  // State
  photos: PhotoWithUrls[];
  /** The list on screen came from the copy or a server answer for this session. */
  photosLoaded: boolean;
  /** Why the last list read failed; cleared when a read starts or succeeds. */
  photosLoadError: string | null;
  error: string | null;
  storageWarning: string | null;

  // Actions
  uploadPhoto: (input: PhotoUploadInput) => Promise<PhotoUploadResult>;
  loadPhotos: () => Promise<void>;
  deletePhoto: (photoId: string) => Promise<boolean>;
  clearError: () => void;
  clearStorageWarning: () => void;
}

export const createPhotosSlice: AppStateCreator<PhotosSlice> = (set, get, _api) => {
  /**
   * The auth lifetime whose list already came from the server. The saved copy
   * is applied only before that, so a copy read landing late never replaces a
   * newer answer. Per slice instance.
   */
  let photosFreshFor: { userId: string; authSessionVersion: number } | null = null;
  const isFresh = (userId: string, authSessionVersion: number) =>
    photosFreshFor?.userId === userId && photosFreshFor.authSessionVersion === authSessionVersion;
  const ownsSession = (userId: string | null, authSessionVersion: number) =>
    !!userId && get().userId === userId && get().authSessionVersion === authSessionVersion;

  /**
   * Uploads and deletes confirmed while a list read was in flight. The read may
   * have been answered before the change reached the server, so the change is
   * replayed onto its answer. Kept only while a read is in flight.
   */
  let activeLoads = 0;
  let confirmedDuringLoads: ConfirmedChange[] = [];
  const recordChange = (change: ConfirmedChange) => {
    if (activeLoads > 0) confirmedDuringLoads.push(change);
  };

  /**
   * Save the whole shown list as the copy, under the captured `userId`.
   * Re-checks the identity first; a failed save is logged and changes nothing.
   */
  const savePhotosCopy = async (userId: string, authSessionVersion: number) => {
    if (!ownsSession(userId, authSessionVersion)) return;
    try {
      await writeLocalCopy(userId, PHOTOS_COPY_KIND, get().photos.map(toSavedPhoto));
    } catch (error) {
      console.error('[PhotosSlice] Failed to save the photos copy:', error);
    }
  };

  /** Delete cached images under the captured identity; a failure is logged. */
  const dropCachedImages = async (
    userId: string,
    authSessionVersion: number,
    paths: string[]
  ) => {
    if (paths.length === 0 || !ownsSession(userId, authSessionVersion)) return;
    try {
      await deleteCachedImages(userId, paths);
    } catch (error) {
      console.error('[PhotosSlice] Failed to delete cached photo images:', error);
    }
  };

  /** Start (or re-run) the background image fill for this session's list. */
  const fillImages = (userId: string, authSessionVersion: number) => {
    if (!ownsSession(userId, authSessionVersion)) return;
    void requestPhotoImageFill({
      userId,
      isCurrent: () => ownsSession(userId, authSessionVersion),
      photos: () => get().photos,
    });
  };

  // The kind's refresher for signed-in start and reconnect. Re-registering (a
  // second store in tests) replaces it.
  registerLocalCopy(PHOTOS_COPY_KIND, async () => {
    if (!get().userId) return;
    await get().loadPhotos();
  });

  return {
    // Initial state
    photos: [],
    photosLoaded: false,
    photosLoadError: null,
    error: null,
    storageWarning: null,

    // Actions

    /**
     * Upload a photo
     * AC 6.2.10: Warning if storage quota > 80%
     * AC 6.2.11: Upload rejected if storage quota > 95%
     */
    uploadPhoto: async (input: PhotoUploadInput) => {
      // Identity guard. An upload runs for seconds across several awaits, and
      // Sign Out sits in the bottom nav of the very screen that starts it — so
      // the request goes out with a still-valid token, succeeds, and its writes
      // land after the store has been handed to whoever signed in next. Without
      // this, A's picture and A's failure banner would appear in B's app.
      //
      // `authSessionVersion` is paired with `userId` rather than compared alone:
      // clearAuth bumps it on every sign-out, so A -> signed out -> A again is
      // distinguishable from an uninterrupted A. An id-only compare would let a
      // request from the dead session write as if it were live.
      const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
      const ownsUpload = () =>
        get().userId === requestedBy && get().authSessionVersion === requestedInSession;

      try {
        // Clear previous errors
        set({ error: null, storageWarning: null });

        // Check quota BEFORE upload (AC 6.2.10, 6.2.11)
        const quota = await photoService.checkStorageQuota();
        if (quota.percent >= 95) {
          // AC 6.2.11: Reject upload if storage nearly full
          const quotaError = `Storage nearly full (${quota.percent}%) - delete photos to continue`;
          // The rejection is real and is reported to this caller either way; it
          // is the shared store that is withheld from the account that did not
          // ask for the upload.
          if (ownsUpload()) {
            set({ error: quotaError });
          }
          return { success: false, error: quotaError };
        }
        if (quota.percent >= 80) {
          // AC 6.2.10: Warning if approaching limit
          if (ownsUpload()) {
            set({ storageWarning: `Storage ${quota.percent}% full - consider deleting old photos` });
          }
        }

        let checkError: string | undefined;
        const photo = await photoService.uploadPhoto(input, (message) => {
          checkError = message;
        });

        if (!photo) {
          throw new Error(checkError ?? 'Upload failed - no photo returned');
        }

        // The upload itself succeeded and is reported as such; the account
        // changed, so this session's gallery and copy are deliberately left
        // untouched.
        if (!requestedBy || !ownsUpload()) return { success: true };

        // The image is shown from the image cache or downloaded by storage
        // path (usePhotoImage), so no signed URL is minted here.
        const uploaded = toGalleryPhoto(photo, requestedBy);

        // Prepend the confirmed upload to state and the copy. A retry can
        // resolve to a row already listed, which must not appear twice.
        set((state) => ({
          photos: [uploaded, ...state.photos.filter((p) => p.id !== uploaded.id)],
        }));
        recordChange({
          userId: requestedBy,
          authSessionVersion: requestedInSession,
          kind: 'upload',
          photo: uploaded,
        });
        await savePhotosCopy(requestedBy, requestedInSession);

        // Check quota after upload and warn if approaching limit (AC 6.2.10)
        // Note: photoService.uploadPhoto() only logs warnings, doesn't expose them
        const newQuota = await photoService.checkStorageQuota();
        if (newQuota.warning === 'approaching' || newQuota.warning === 'critical') {
          const warningMsg = `Storage ${newQuota.percent}% full - consider deleting old photos`;
          if (ownsUpload()) {
            set({ storageWarning: warningMsg });
          }
        }

        return { success: true };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Upload failed';
        // `error` is the app-wide banner key (appSlice), and signedOutState()
        // does not reset it — so an unguarded write here outlives the session.
        if (ownsUpload()) {
          set({ error: errorMsg });
        }

        return { success: false, error: errorMsg };
      }
    },

    /**
     * Show the saved `photos` copy at once, then replace state and copy with a
     * full server read (every photo, newest first). A failed read changes
     * nothing but `photosLoadError`.
     */
    loadPhotos: async () => {
      const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
      if (!requestedBy) return;
      const owns = () => ownsSession(requestedBy, requestedInSession);

      activeLoads += 1;
      const changesBefore = confirmedDuringLoads.length;
      try {
        set({ photosLoadError: null });

        // The server read goes out at once, alongside the copy read below, so
        // the copy adds no latency. Marked handled now: it may reject while the
        // copy read is in flight, and is awaited below.
        const listRequest = photoService.listAllPhotos();
        Promise.resolve(listRequest).catch(() => {});

        // Paths the previous copy (or the list on screen) held, for the prune.
        const previousPaths = new Set(get().photos.map((p) => p.storage_path));

        if (!isFresh(requestedBy, requestedInSession)) {
          // 1. The saved copy, at once — online or offline. Never laid over a
          // list already on screen. readLocalCopy answers null on failure; a
          // malformed copy parses to null and is ignored whole.
          const raw = await readLocalCopy<unknown>(requestedBy, PHOTOS_COPY_KIND);
          if (!owns()) return;
          const saved = parseSavedPhotos(raw);
          if (raw !== null && raw !== undefined && !saved) {
            console.error('[PhotosSlice] Ignoring a malformed photos copy');
          }
          if (saved) {
            for (const photo of saved) previousPaths.add(photo.storage_path);
            if (!isFresh(requestedBy, requestedInSession) && get().photos.length === 0) {
              set({ photos: saved, photosLoaded: true });
            }
          }
        }

        // 2. The server's full list replaces state and copy.
        let rows: SupabasePhoto[];
        try {
          rows = await listRequest;
        } catch (error) {
          // A failed read changes nothing: state, copy and cache stay as they were.
          console.error('[PhotosSlice] Failed to load photos:', error);
          if (owns()) {
            set({
              photosLoadError: error instanceof Error ? error.message : 'Failed to load photos',
            });
          }
          return;
        }

        // Identity guard: the request goes out with a still-valid token, so it
        // can succeed after clearAuth — or after a same-account re-login — and
        // must not put the previous session's data back.
        if (!owns()) return;

        let photos = rows.map((row) => toGalleryPhoto(row, requestedBy));
        for (const change of confirmedDuringLoads.slice(changesBefore)) {
          if (change.userId !== requestedBy || change.authSessionVersion !== requestedInSession) {
            continue;
          }
          photos =
            change.kind === 'upload'
              ? photos.some((p) => p.id === change.photo.id)
                ? photos
                : [change.photo, ...photos]
              : photos.filter((p) => p.id !== change.photoId);
        }

        set({ photos, photosLoaded: true, photosLoadError: null });
        photosFreshFor = { userId: requestedBy, authSessionVersion: requestedInSession };
        await savePhotosCopy(requestedBy, requestedInSession);

        // Photos gone from the server take their cached images with them.
        const kept = new Set(get().photos.map((p) => p.storage_path));
        await dropCachedImages(
          requestedBy,
          requestedInSession,
          Array.from(previousPaths).filter((path) => !kept.has(path))
        );

        fillImages(requestedBy, requestedInSession);
      } finally {
        activeLoads -= 1;
        if (activeLoads === 0) confirmedDuringLoads = [];
      }
    },

    /**
     * Delete a photo
     * Only owner can delete (enforced by RLS)
     *
     * Resolves true once the photo is gone from the server, false on failure.
     * It never rejects, so the result is the only way a caller (the viewer) can
     * tell whether to move on from the row.
     */
    deletePhoto: async (photoId: string) => {
      // Same identity guard as uploadPhoto, for the same reason: the delete is
      // authorized as the account that asked for it, but the state write would
      // land in whichever gallery is on screen when the response arrives.
      const { userId: requestedBy, authSessionVersion: requestedInSession } = get();
      const ownsDelete = () =>
        get().userId === requestedBy && get().authSessionVersion === requestedInSession;

      try {
        const success = await photoService.deletePhoto(photoId);

        if (!success) {
          throw new Error('Failed to delete photo');
        }

        // The durable delete happened; only the local writes are withheld. This
        // id can genuinely be on screen for the next account — partners share a
        // gallery — but whether that row should go is the new session's own
        // question, answered by its next loadPhotos, not by a continuation
        // raised under a session that has already ended.
        if (!requestedBy || !ownsDelete()) return true;

        const removed = get().photos.find((p) => p.id === photoId);
        // Remove from state and the copy, and drop its cached image.
        set((state) => ({
          photos: state.photos.filter((p) => p.id !== photoId),
        }));
        recordChange({
          userId: requestedBy,
          authSessionVersion: requestedInSession,
          kind: 'delete',
          photoId,
        });
        await savePhotosCopy(requestedBy, requestedInSession);
        if (removed) {
          await dropCachedImages(requestedBy, requestedInSession, [removed.storage_path]);
        }
        return true;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Delete failed';
        if (ownsDelete()) set({ error: errorMsg });
        return false;
      }
    },

    /**
     * Clear error state
     */
    clearError: () => {
      set({ error: null });
    },

    /**
     * Clear storage warning
     */
    clearStorageWarning: () => {
      set({ storageWarning: null });
    },
  };
};
