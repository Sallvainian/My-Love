/**
 * usePhotos Hook
 *
 * Custom hook for components to consume Photos state from the store.
 * Handles photo uploads, loading states, and exposes actions.
 *
 * Features:
 * - Auto-load photos on mount
 * - Upload with progress tracking
 * - Storage quota warnings
 * - Automatic reload after successful upload
 *
 * Story 6.2: Photo Upload with Progress Indicator
 */

import { useEffect, useCallback } from 'react';
import { useAppStore } from '../stores/useAppStore';
import type { SupabasePhoto, PhotoUploadInput } from '../services/photoService';

/**
 * Return type for usePhotos hook
 */
export interface UsePhotosResult {
  /** Array of photos (own + partner) sorted newest first */
  photos: SupabasePhoto[];
  /** Whether a photo is currently being uploaded */
  isUploading: boolean;
  /** Upload progress percentage (0-100) */
  uploadProgress: number;
  /** Error message if operation failed */
  error: string | null;
  /** Storage warning message if quota approaching limit */
  storageWarning: string | null;
  /** Upload a photo with progress tracking */
  uploadPhoto: (input: PhotoUploadInput) => Promise<void>;
  /** Load/refresh photos from server */
  loadPhotos: () => Promise<void>;
  /** Delete a photo by ID */
  deletePhoto: (photoId: string) => Promise<void>;
  /** Clear any error state */
  clearError: () => void;
  /** Clear storage warning */
  clearStorageWarning: () => void;
}

/**
 * Custom hook for Photos functionality
 *
 * Provides access to photos state and actions from the store.
 * Automatically loads photos on component mount.
 * Automatically reloads photos after successful upload.
 *
 * @param autoLoad - Whether to automatically load photos on mount (default: true)
 * @returns UsePhotosResult object with state and actions
 *
 * @example
 * ```tsx
 * function PhotoGallery() {
 *   const {
 *     photos,
 *     isUploading,
 *     uploadProgress,
 *     error,
 *     uploadPhoto,
 *     loadPhotos
 *   } = usePhotos();
 *
 *   if (photos.length === 0) {
 *     return <EmptyState />;
 *   }
 *
 *   return (
 *     <div>
 *       {photos.map(photo => <PhotoCard key={photo.id} photo={photo} />)}
 *       {isUploading && <ProgressBar value={uploadProgress} />}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePhotos(autoLoad = true): UsePhotosResult {
  // Select state from store
  const photos = useAppStore((state) => state.photos);
  const isUploading = useAppStore((state) => state.isUploading);
  const uploadProgress = useAppStore((state) => state.uploadProgress);
  const error = useAppStore((state) => state.error);
  const storageWarning = useAppStore((state) => state.storageWarning);

  // Get actions from store
  const uploadPhotoAction = useAppStore((state) => state.uploadPhoto);
  const loadPhotosAction = useAppStore((state) => state.loadPhotos);
  const deletePhotoAction = useAppStore((state) => state.deletePhoto);
  const clearErrorAction = useAppStore((state) => state.clearError);
  const clearStorageWarningAction = useAppStore((state) => state.clearStorageWarning);

  // Memoize load function
  const loadPhotos = useCallback(async () => {
    await loadPhotosAction();
  }, [loadPhotosAction]);

  // Memoize upload function
  // Note: photosSlice.uploadPhoto already does optimistic update, no reload needed
  const uploadPhoto = useCallback(
    async (input: PhotoUploadInput) => {
      await uploadPhotoAction(input);
    },
    [uploadPhotoAction]
  );

  // Memoize delete function
  const deletePhoto = useCallback(
    async (photoId: string) => {
      await deletePhotoAction(photoId);
    },
    [deletePhotoAction]
  );

  // Memoize clear actions
  const clearError = useCallback(() => {
    clearErrorAction();
  }, [clearErrorAction]);

  const clearStorageWarning = useCallback(() => {
    clearStorageWarningAction();
  }, [clearStorageWarningAction]);

  // Auto-load photos on mount
  useEffect(() => {
    if (autoLoad) {
      loadPhotos();
    }
  }, [autoLoad, loadPhotos]);

  return {
    photos,
    isUploading,
    uploadProgress,
    error,
    storageWarning,
    uploadPhoto,
    loadPhotos,
    deletePhoto,
    clearError,
    clearStorageWarning,
  };
}

export default usePhotos;
