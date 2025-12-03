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
 * - None (self-contained)
 *
 * Persistence:
 * - Supabase: photos stored in photos table + storage bucket
 * - No local persistence (photos loaded on demand)
 */

import type { StateCreator } from 'zustand';
import { photoService } from '../../services/photoService';
import type { SupabasePhoto, PhotoUploadInput } from '../../services/photoService';

export interface PhotosSlice {
  // State
  photos: SupabasePhoto[];
  isUploading: boolean;
  uploadProgress: number; // 0-100%
  error: string | null;
  storageWarning: string | null;

  // Actions
  uploadPhoto: (input: PhotoUploadInput) => Promise<void>;
  loadPhotos: () => Promise<void>;
  deletePhoto: (photoId: string) => Promise<void>;
  clearError: () => void;
  clearStorageWarning: () => void;
}

export const createPhotosSlice: StateCreator<PhotosSlice, [], [], PhotosSlice> = (set, _get) => ({
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
    try {
      // Clear previous errors
      set({ error: null, storageWarning: null, isUploading: true, uploadProgress: 0 });

      // Check quota BEFORE upload (AC 6.2.10, 6.2.11)
      const quota = await photoService.checkStorageQuota();
      if (quota.percent >= 95) {
        // AC 6.2.11: Reject upload if storage nearly full
        set({
          error: `Storage nearly full (${quota.percent}%) - delete photos to continue`,
          isUploading: false,
          uploadProgress: 0,
        });
        return;
      }
      if (quota.percent >= 80) {
        // AC 6.2.10: Warning if approaching limit
        set({ storageWarning: `Storage ${quota.percent}% full - consider deleting old photos` });
      }

      // Upload with progress callback (AC 6.2.2, 6.2.3)
      const photo = await photoService.uploadPhoto(input, (percent) => {
        set({ uploadProgress: percent });
      });

      if (!photo) {
        throw new Error('Upload failed - no photo returned');
      }

      // Add uploaded photo to state (optimistic update)
      set((state) => ({
        photos: [photo, ...state.photos],
        isUploading: false,
        uploadProgress: 0, // Reset progress after completion
      }));

      // Check quota after upload and warn if approaching limit (AC 6.2.10)
      // Note: photoService.uploadPhoto() only logs warnings, doesn't expose them
      const newQuota = await photoService.checkStorageQuota();
      if (newQuota.warning === 'approaching' || newQuota.warning === 'critical') {
        const warningMsg = `Storage ${newQuota.percent}% full - consider deleting old photos`;
        set({ storageWarning: warningMsg });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Upload failed';
      set({
        error: errorMsg,
        isUploading: false,
        uploadProgress: 0,
      });
    }
  },

  /**
   * Load photos for current user and partner
   * Photos sorted by created_at DESC (newest first)
   */
  loadPhotos: async () => {
    try {
      set({ error: null });
      const photos = await photoService.getPhotos();
      set({ photos });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to load photos';
      set({ error: errorMsg, photos: [] });
    }
  },

  /**
   * Delete a photo
   * Only owner can delete (enforced by RLS)
   */
  deletePhoto: async (photoId: string) => {
    try {
      const success = await photoService.deletePhoto(photoId);

      if (!success) {
        throw new Error('Failed to delete photo');
      }

      // Remove from state on successful deletion
      set((state) => ({
        photos: state.photos.filter((p) => p.id !== photoId),
      }));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Delete failed';
      set({ error: errorMsg });
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
