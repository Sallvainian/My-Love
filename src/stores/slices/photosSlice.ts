/**
 * Photos Slice
 *
 * Manages photo state and upload operations including:
 * - Photo list (own + partner photos)
 * - Upload progress tracking (0-100%)
 * - Storage quota warnings (80%/95% thresholds)
 * - Error handling for upload failures
 *
 * Story 6.2: Photo Upload with Progress Indicator
 *
 * Cross-slice dependencies:
 * - authSlice: `uploadPhoto` and `deletePhoto` each capture
 *   `userId` + `authSessionVersion` first and recheck the pair before every
 *   post-await write, so a continuation raised by one account cannot land in
 *   the next one's store on a shared device. `loadPhotos` carries the older,
 *   weaker form of the same guard — `userId` alone — and is deliberately not
 *   retrofitted here: it writes only `photos`, so the one case the weaker form
 *   misses (A signs out and back in as A) repopulates A's own gallery with A's
 *   own rows. No cross-account disclosure follows from it, so widening that
 *   guard is a separate change with its own contract.
 *
 * Persistence:
 * - Supabase: photos stored in photos table + storage bucket
 * - No local persistence (photos loaded on demand)
 */

import type { PhotoUploadInput, PhotoWithUrls } from '../../services/photoService';
import { photoService } from '../../services/photoService';
import type { AppStateCreator } from '../types';

/**
 * Outcome of an upload attempt. The failure message is returned directly rather
 * than read back off the store, so callers get the message for *their* upload
 * and not whatever unrelated error the shared `error` key happens to hold.
 */
export type PhotoUploadResult = { success: true } | { success: false; error: string };

export interface PhotosSlice {
  // State
  photos: PhotoWithUrls[];
  isUploading: boolean;
  uploadProgress: number; // 0-100%
  error: string | null;
  storageWarning: string | null;

  // Actions
  uploadPhoto: (input: PhotoUploadInput) => Promise<PhotoUploadResult>;
  loadPhotos: () => Promise<void>;
  deletePhoto: (photoId: string) => Promise<boolean>;
  clearError: () => void;
  clearStorageWarning: () => void;
}

export const createPhotosSlice: AppStateCreator<PhotosSlice> = (set, get, _api) => ({
  // Initial state
  photos: [],
  isUploading: false,
  uploadProgress: 0,
  error: null,
  storageWarning: null,

  // Actions

  /**
   * Upload a photo with progress tracking
   * AC 6.2.2: Progress bar shows 0-100% during upload
   * AC 6.2.3: Progress updates at least every 100ms
   * AC 6.2.10: Warning if storage quota > 80%
   * AC 6.2.11: Upload rejected if storage quota > 95%
   */
  uploadPhoto: async (input: PhotoUploadInput) => {
    // Identity guard. An upload runs for seconds across four awaits, and Sign
    // Out sits in the bottom nav of the very screen that starts it — so the
    // request goes out with a still-valid token, succeeds, and its writes land
    // after the store has been handed to whoever signed in next. Without this,
    // A's picture, A's signed URL and A's failure banner all appear in B's app.
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
      set({ error: null, storageWarning: null, isUploading: true, uploadProgress: 0 });

      // Check quota BEFORE upload (AC 6.2.10, 6.2.11)
      const quota = await photoService.checkStorageQuota();
      if (quota.percent >= 95) {
        // AC 6.2.11: Reject upload if storage nearly full
        const quotaError = `Storage nearly full (${quota.percent}%) - delete photos to continue`;
        // The rejection is real and is reported to this caller either way; it
        // is the shared store that is withheld from the account that did not
        // ask for the upload.
        if (ownsUpload()) {
          set({ error: quotaError, isUploading: false, uploadProgress: 0 });
        }
        return { success: false, error: quotaError };
      }
      if (quota.percent >= 80) {
        // AC 6.2.10: Warning if approaching limit
        if (ownsUpload()) {
          set({ storageWarning: `Storage ${quota.percent}% full - consider deleting old photos` });
        }
      }

      // Upload with progress callback (AC 6.2.2, 6.2.3)
      let checkError: string | undefined;
      const photo = await photoService.uploadPhoto(
        input,
        (percent) => {
          // photoService calls this from inside the await above, so it is a
          // post-await write despite no `await` preceding it here. A stranded
          // value paints B a progress bar for a photo B never chose.
          if (ownsUpload()) set({ uploadProgress: percent });
        },
        (message) => {
          checkError = message;
        }
      );

      if (!photo) {
        throw new Error(checkError ?? 'Upload failed - no photo returned');
      }

      // Get signed URL for the uploaded photo
      const signedUrl = await photoService.getSignedUrl(photo.storage_path);

      // The upload itself succeeded and is reported as such; the account
      // changed, so this session's gallery is deliberately left untouched.
      if (!ownsUpload()) return { success: true };

      // Create PhotoWithUrls from SupabasePhoto. Ownership reads the captured
      // id rather than the live one purely so the whole continuation speaks of
      // one identity; the guard above has already established they are equal
      // here, so this is not a behaviour change.
      const photoWithUrl: PhotoWithUrls = {
        ...photo,
        signedUrl,
        isOwn: requestedBy ? photo.user_id === requestedBy : false,
      };

      // Add uploaded photo to state (optimistic update)
      set((state) => ({
        photos: [photoWithUrl, ...state.photos],
        isUploading: false,
        uploadProgress: 0, // Reset progress after completion
      }));

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
        set({
          error: errorMsg,
          isUploading: false,
          uploadProgress: 0,
        });
      }

      return { success: false, error: errorMsg };
    }
  },

  /**
   * Load photos for current user and partner
   * Photos sorted by created_at DESC (newest first)
   */
  loadPhotos: async () => {
    const requestedBy = get().userId;
    try {
      set({ error: null });
      const photos = await photoService.getPhotos();
      // Identity guard: Sign Out sits on the same screen that fires this, and the
      // request goes out with a still-valid token — so it succeeds and its write
      // lands after clearAuth, putting the previous account's data back.
      if (get().userId !== requestedBy) return;
      set({ photos });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to load photos';
      if (get().userId !== requestedBy) return;
      set({ error: errorMsg, photos: [] });
    }
  },

  /**
   * Delete a photo
   * Only owner can delete (enforced by RLS)
   *
   * Resolves true once the photo is gone from the server, false on failure. It
   * never rejects, so the result is the only way a caller holding its own copy
   * of the list (the gallery's paginated page) can tell whether to drop the row.
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

      // The durable delete happened; only the state write is withheld. This id
      // can genuinely be on screen for the next account — partners share a
      // gallery — but whether that row should go is the new session's own
      // question, answered by its next loadPhotos, not by a continuation raised
      // under a session that has already ended.
      if (!ownsDelete()) return true;

      // Remove from state on successful deletion
      set((state) => ({
        photos: state.photos.filter((p) => p.id !== photoId),
      }));
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
});
