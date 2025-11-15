/**
 * Photos Slice
 *
 * Manages all photo-related state and actions including:
 * - Photo loading and CRUD operations
 * - Photo upload with compression
 * - Photo gallery and carousel state
 * - Storage quota management
 *
 * Cross-slice dependencies:
 * - None (self-contained)
 *
 * Persistence:
 * - NOT persisted (all photo state is loaded from IndexedDB on init)
 * - Photos are too large for LocalStorage, stored in IndexedDB instead
 */

import type { StateCreator } from 'zustand';
import type { Photo, PhotoUploadInput } from '../../types';
import { photoStorageService } from '../../services/photoStorageService';
import { imageCompressionService } from '../../services/imageCompressionService';

export interface PhotosSlice {
  // State
  photos: Photo[];
  isLoadingPhotos: boolean;
  photoError: string | null;
  storageWarning: string | null;
  selectedPhotoId: number | null;

  // Actions
  loadPhotos: () => Promise<void>;
  uploadPhoto: (input: PhotoUploadInput) => Promise<Photo>;
  getPhotoById: (photoId: number) => Photo | null;
  getStorageUsage: () => Promise<{ used: number; quota: number; percentUsed: number }>;
  clearStorageWarning: () => void;

  // Photo edit/delete actions
  updatePhoto: (photoId: number, updates: { caption?: string; tags: string[] }) => Promise<void>;
  deletePhoto: (photoId: number) => Promise<void>;

  // Gallery actions
  selectPhoto: (photoId: number) => void;
  clearPhotoSelection: () => void;
}

export const createPhotosSlice: StateCreator<
  PhotosSlice,
  [],
  [],
  PhotosSlice
> = (set, get) => ({
  // Initial state
  photos: [],
  isLoadingPhotos: false,
  photoError: null,
  storageWarning: null,
  selectedPhotoId: null,

  // Actions
  loadPhotos: async () => {
    try {
      set({ isLoadingPhotos: true, photoError: null });
      const photos = await photoStorageService.getAll();
      set({ photos, isLoadingPhotos: false });
      console.log(`[AppStore] Loaded ${photos.length} photos`);
    } catch (error) {
      console.error('[AppStore] Failed to load photos:', error);
      set({
        photoError: 'Failed to load photos',
        isLoadingPhotos: false,
        photos: [] // Fallback to empty array
      });
    }
  },

  uploadPhoto: async (input: PhotoUploadInput) => {
    try {
      set({ isLoadingPhotos: true, photoError: null });

      // Validate file
      const validation = imageCompressionService.validateImageFile(input.file);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid file');
      }

      // Log warning if file is large
      if (validation.warning) {
        console.warn(`[AppStore] ${validation.warning}`);
      }

      // Parse tags from comma-separated string
      const parsedTags = input.tags
        ? input.tags
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0)
            .filter((tag, index, arr) =>
              // Case-insensitive duplicate detection
              arr.findIndex(t => t.toLowerCase() === tag.toLowerCase()) === index
            )
            .slice(0, 10) // Max 10 tags
            .map(tag => tag.slice(0, 50)) // Max 50 chars per tag
        : [];

      // Validate caption
      const caption = input.caption?.slice(0, 500); // Max 500 chars

      // Compress image
      const compressionResult = await imageCompressionService.compressImage(input.file);

      // Check storage quota before saving
      const quotaInfo = await photoStorageService.estimateQuotaRemaining();

      // Warn if 80% full (AC-4.1.9: Show UI notification)
      if (quotaInfo.percentUsed >= 80 && quotaInfo.percentUsed < 95) {
        const usedMB = (quotaInfo.used / 1024 / 1024).toFixed(2);
        const quotaMB = (quotaInfo.quota / 1024 / 1024).toFixed(2);
        const warningMessage = `Storage ${quotaInfo.percentUsed.toFixed(0)}% full (${usedMB}MB / ${quotaMB}MB). Consider deleting old photos.`;

        set({ storageWarning: warningMessage });
        console.warn(`[AppStore] ${warningMessage}`);
      } else {
        // Clear warning if under 80%
        set({ storageWarning: null });
      }

      // Block if 95% full
      if (quotaInfo.percentUsed >= 95) {
        throw new Error('Storage full! Delete some photos to free up space.');
      }

      // Save to IndexedDB
      const photo: Omit<Photo, 'id'> = {
        imageBlob: compressionResult.blob,
        caption,
        tags: parsedTags,
        uploadDate: new Date(),
        originalSize: compressionResult.originalSize,
        compressedSize: compressionResult.compressedSize,
        width: compressionResult.width,
        height: compressionResult.height,
        mimeType: 'image/jpeg',
      };

      const savedPhoto = await photoStorageService.create(photo);

      // Update state (optimistic UI update)
      set(state => ({
        photos: [savedPhoto, ...state.photos], // Add to beginning (newest first)
        isLoadingPhotos: false,
      }));

      console.log(`[AppStore] Photo uploaded successfully, ID: ${savedPhoto.id}`);
      return savedPhoto;
    } catch (error) {
      console.error('[AppStore] Failed to upload photo:', error);
      set({
        photoError: (error as Error).message || 'Failed to upload photo',
        isLoadingPhotos: false
      });
      throw error; // Re-throw for UI error handling
    }
  },

  getPhotoById: (photoId: number) => {
    const { photos } = get();
    return photos.find(p => p.id === photoId) || null;
  },

  getStorageUsage: async () => {
    try {
      const quotaInfo = await photoStorageService.estimateQuotaRemaining();
      return {
        used: quotaInfo.used,
        quota: quotaInfo.quota,
        percentUsed: quotaInfo.percentUsed,
      };
    } catch (error) {
      console.error('[AppStore] Failed to get storage usage:', error);
      // Return conservative defaults on error
      return {
        used: 0,
        quota: 50 * 1024 * 1024, // 50MB
        percentUsed: 0,
      };
    }
  },

  clearStorageWarning: () => {
    set({ storageWarning: null });
  },

  // Photo edit/delete actions
  updatePhoto: async (photoId: number, updates: { caption?: string; tags: string[] }) => {
    try {
      // Update in IndexedDB
      await photoStorageService.update(photoId, updates);

      // Update in state (find photo by ID and replace with updated version)
      set(state => ({
        photos: state.photos.map(photo =>
          photo.id === photoId
            ? { ...photo, ...updates }
            : photo
        ),
      }));

      console.log(`[AppStore] Photo ${photoId} updated successfully`);
    } catch (error) {
      console.error(`[AppStore] Failed to update photo ${photoId}:`, error);
      throw error; // Re-throw for UI error handling
    }
  },

  deletePhoto: async (photoId: number) => {
    try {
      const { photos, selectedPhotoId } = get();

      // Find current photo index before deletion
      const currentIndex = photos.findIndex(p => p.id === photoId);
      const photosCount = photos.length;

      // Delete from IndexedDB
      await photoStorageService.delete(photoId);

      // Update state (filter out deleted photo)
      set(state => ({
        photos: state.photos.filter(photo => photo.id !== photoId),
      }));

      console.log(`[AppStore] Photo ${photoId} deleted successfully`);

      // AC-4.4.7: Navigation logic after delete (only if deleted photo was selected)
      if (selectedPhotoId === photoId) {
        const remainingPhotosCount = photosCount - 1;

        if (remainingPhotosCount === 0) {
          // No photos left → close carousel
          get().clearPhotoSelection();
          console.log('[AppStore] Last photo deleted - closing carousel');
        } else if (currentIndex < remainingPhotosCount) {
          // Not last photo → navigate to same index (which is now next photo)
          const updatedPhotos = photos.filter(p => p.id !== photoId);
          const nextPhoto = updatedPhotos[currentIndex];
          get().selectPhoto(nextPhoto.id);
          console.log(`[AppStore] Navigated to next photo: ${nextPhoto.id}`);
        } else {
          // Was last photo → navigate to new last photo (previous photo)
          const updatedPhotos = photos.filter(p => p.id !== photoId);
          const prevPhoto = updatedPhotos[remainingPhotosCount - 1];
          get().selectPhoto(prevPhoto.id);
          console.log(`[AppStore] Navigated to previous photo: ${prevPhoto.id}`);
        }
      }
    } catch (error) {
      console.error(`[AppStore] Failed to delete photo ${photoId}:`, error);
      throw error; // Re-throw for UI error handling
    }
  },

  // Gallery actions
  selectPhoto: (photoId: number) => {
    set({ selectedPhotoId: photoId });
    console.log(`[AppStore] Selected photo for carousel: ${photoId}`);
  },

  clearPhotoSelection: () => {
    set({ selectedPhotoId: null });
    console.log('[AppStore] Cleared photo selection - carousel closed');
  },
});
