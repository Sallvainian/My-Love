/**
 * PhotosSlice Unit Tests
 *
 * Story 6.2: Photo Upload with Progress Indicator
 * Tests for photosSlice state management and actions
 *
 * @module tests/unit/stores/photosSlice.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createStore } from 'zustand';
import type { PhotosSlice } from '../../../src/stores/slices/photosSlice';
import { createPhotosSlice } from '../../../src/stores/slices/photosSlice';

// Mock photoService
const mockUploadPhoto = vi.fn();
const mockGetPhotos = vi.fn();
const mockDeletePhoto = vi.fn();
const mockCheckStorageQuota = vi.fn();
const mockGetSignedUrl = vi.fn();

vi.mock('../../../src/services/photoService', () => ({
  photoService: {
    uploadPhoto: (...args: unknown[]) => mockUploadPhoto(...args),
    getPhotos: (...args: unknown[]) => mockGetPhotos(...args),
    deletePhoto: (...args: unknown[]) => mockDeletePhoto(...args),
    checkStorageQuota: () => mockCheckStorageQuota(),
    getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
  },
}));

// Mock supabase client
vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
  },
}));

// Test data
const mockPhoto = {
  id: 'photo-1',
  user_id: 'user-1',
  storage_path: 'user-1/photo.jpg',
  filename: 'test.jpg',
  caption: 'Test caption',
  mime_type: 'image/jpeg' as const,
  file_size: 1024000,
  width: 1920,
  height: 1080,
  created_at: '2024-01-15T10:30:00.000Z',
};

describe('PhotosSlice', () => {
  let store: ReturnType<typeof createStore<PhotosSlice>>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock for getSignedUrl
    mockGetSignedUrl.mockResolvedValue('https://example.com/signed-url');
    store = createStore<PhotosSlice>()(createPhotosSlice);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should have empty photos array', () => {
      const state = store.getState();
      expect(state.photos).toEqual([]);
    });

    it('should have isUploading false', () => {
      const state = store.getState();
      expect(state.isUploading).toBe(false);
    });

    it('should have uploadProgress 0', () => {
      const state = store.getState();
      expect(state.uploadProgress).toBe(0);
    });

    it('should have no error', () => {
      const state = store.getState();
      expect(state.error).toBeNull();
    });

    it('should have no storage warning', () => {
      const state = store.getState();
      expect(state.storageWarning).toBeNull();
    });
  });

  describe('uploadPhoto', () => {
    const uploadInput = {
      file: new Blob(['test'], { type: 'image/jpeg' }),
      filename: 'test.jpg',
      caption: 'Test',
      mimeType: 'image/jpeg' as const,
      width: 1920,
      height: 1080,
    };

    it('should upload photo with progress tracking (AC 6.2.2, 6.2.3)', async () => {
      mockCheckStorageQuota.mockResolvedValue({
        used: 0,
        quota: 1073741824,
        percent: 0,
        warning: 'none',
      });

      mockUploadPhoto.mockImplementation(async (input, onProgress) => {
        // Simulate progress updates
        if (onProgress) {
          onProgress(0);
          await new Promise((resolve) => setTimeout(resolve, 10));
          onProgress(50);
          await new Promise((resolve) => setTimeout(resolve, 10));
          onProgress(100);
        }
        return mockPhoto;
      });

      await store.getState().uploadPhoto(uploadInput);

      // Check completed state
      expect(store.getState().isUploading).toBe(false);
      expect(store.getState().uploadProgress).toBe(0); // Reset after upload
      expect(store.getState().photos).toHaveLength(1);
      // Photo includes additional properties from processing
      expect(store.getState().photos[0]).toMatchObject({
        ...mockPhoto,
        signedUrl: 'https://example.com/signed-url',
        isOwn: true,
      });
      expect(store.getState().error).toBeNull();
    });

    it('should handle upload error and set error state (AC 6.2.9)', async () => {
      const errorMessage = 'Upload failed';
      mockCheckStorageQuota.mockResolvedValue({
        used: 0,
        quota: 1073741824,
        percent: 0,
        warning: 'none',
      });
      mockUploadPhoto.mockRejectedValue(new Error(errorMessage));

      await store.getState().uploadPhoto(uploadInput);

      expect(store.getState().isUploading).toBe(false);
      expect(store.getState().error).toBe(errorMessage);
      expect(store.getState().photos).toHaveLength(0);
    });

    it('should reset progress after successful upload', async () => {
      mockCheckStorageQuota.mockResolvedValue({
        used: 0,
        quota: 1073741824,
        percent: 0,
        warning: 'none',
      });
      mockUploadPhoto.mockResolvedValue(mockPhoto);

      await store.getState().uploadPhoto(uploadInput);

      // Progress should be reset to 0 after upload completes
      expect(store.getState().uploadProgress).toBe(0);
      expect(store.getState().isUploading).toBe(false);
    });

    it('should check quota and warn if > 80% (AC 6.2.10)', async () => {
      // First quota check: before upload (under 80%)
      mockCheckStorageQuota.mockResolvedValueOnce({
        used: 805306368, // 75%
        quota: 1073741824,
        percent: 75,
        warning: 'none',
      });

      // Second quota check: after upload (over 80%)
      mockCheckStorageQuota.mockResolvedValueOnce({
        used: 869656781, // 81%
        quota: 1073741824,
        percent: 81,
        warning: 'approaching',
      });

      mockUploadPhoto.mockResolvedValue(mockPhoto);

      await store.getState().uploadPhoto(uploadInput);

      expect(store.getState().storageWarning).toContain('81%');
      expect(mockCheckStorageQuota).toHaveBeenCalled();
    });

    it('should reject upload if quota > 95% (AC 6.2.11)', async () => {
      mockCheckStorageQuota.mockResolvedValue({
        used: 1020054733, // 95%
        quota: 1073741824,
        percent: 95,
        warning: 'critical',
      });

      await store.getState().uploadPhoto(uploadInput);

      expect(store.getState().error).toContain('nearly full');
      expect(mockUploadPhoto).not.toHaveBeenCalled();
    });
  });

  describe('loadPhotos', () => {
    it('should load photos from service', async () => {
      const photos = [mockPhoto, { ...mockPhoto, id: 'photo-2' }];
      mockGetPhotos.mockResolvedValue(photos);

      await store.getState().loadPhotos();

      expect(store.getState().photos).toEqual(photos);
      expect(store.getState().error).toBeNull();
    });

    it('should handle load error', async () => {
      mockGetPhotos.mockRejectedValue(new Error('Load failed'));

      await store.getState().loadPhotos();

      expect(store.getState().error).toBe('Load failed');
      expect(store.getState().photos).toEqual([]);
    });
  });

  describe('deletePhoto', () => {
    beforeEach(() => {
      // Set initial state with photos
      store.setState({ photos: [mockPhoto, { ...mockPhoto, id: 'photo-2' }] });
    });

    it('should delete photo and remove from state', async () => {
      mockDeletePhoto.mockResolvedValue(true);

      await store.getState().deletePhoto('photo-1');

      expect(store.getState().photos).toHaveLength(1);
      expect(store.getState().photos[0].id).toBe('photo-2');
    });

    it('should handle delete error', async () => {
      mockDeletePhoto.mockResolvedValue(false);

      await store.getState().deletePhoto('photo-1');

      expect(store.getState().error).toBeTruthy();
      expect(store.getState().photos).toHaveLength(2); // Not removed on failure
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      store.setState({ error: 'Test error' });

      store.getState().clearError();

      expect(store.getState().error).toBeNull();
    });
  });

  describe('clearStorageWarning', () => {
    it('should clear storage warning', () => {
      store.setState({ storageWarning: 'Test warning' });

      store.getState().clearStorageWarning();

      expect(store.getState().storageWarning).toBeNull();
    });
  });
});
