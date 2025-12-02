/**
 * usePhotos Hook Tests
 *
 * Story 6.2: Photo Upload with Progress Indicator
 * Tests for the Photos custom hook that manages photo state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePhotos } from '../../../src/hooks/usePhotos';
import { useAppStore } from '../../../src/stores/useAppStore';
import type { SupabasePhoto, PhotoUploadInput } from '../../../src/services/photoService';

// Mock the store
vi.mock('../../../src/stores/useAppStore');

// Mock Supabase client before any imports that use it
vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockReturnThis(),
        createSignedUrl: vi.fn().mockReturnThis(),
        remove: vi.fn().mockReturnThis(),
      })),
    },
  },
}));

describe('usePhotos', () => {
  const mockPhotos: SupabasePhoto[] = [
    {
      id: 'photo-1',
      user_id: 'user-1',
      storage_path: 'user-1/photo.jpg',
      filename: 'test.jpg',
      caption: 'Test photo',
      mime_type: 'image/jpeg',
      file_size: 1024000,
      width: 1920,
      height: 1080,
      created_at: '2024-01-15T10:30:00.000Z',
    },
    {
      id: 'photo-2',
      user_id: 'user-2',
      storage_path: 'user-2/photo.jpg',
      filename: 'partner.jpg',
      caption: null,
      mime_type: 'image/jpeg',
      file_size: 512000,
      width: 1280,
      height: 720,
      created_at: '2024-01-15T11:00:00.000Z',
    },
  ];

  const mockUploadPhoto = vi.fn();
  const mockLoadPhotos = vi.fn();
  const mockDeletePhoto = vi.fn();
  const mockClearError = vi.fn();
  const mockClearStorageWarning = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock implementation
    (useAppStore as any).mockImplementation((selector: any) => {
      const state = {
        photos: mockPhotos,
        isUploading: false,
        uploadProgress: 0,
        error: null,
        storageWarning: null,
        uploadPhoto: mockUploadPhoto,
        loadPhotos: mockLoadPhotos,
        deletePhoto: mockDeletePhoto,
        clearError: mockClearError,
        clearStorageWarning: mockClearStorageWarning,
      };
      return selector(state);
    });
  });

  describe('initialization', () => {
    it('returns initial state from store', () => {
      const { result } = renderHook(() => usePhotos(false)); // Skip auto-load

      expect(result.current.photos).toEqual(mockPhotos);
      expect(result.current.isUploading).toBe(false);
      expect(result.current.uploadProgress).toBe(0);
      expect(result.current.error).toBe(null);
      expect(result.current.storageWarning).toBe(null);
    });

    it('provides uploadPhoto action', () => {
      const { result } = renderHook(() => usePhotos(false));

      expect(typeof result.current.uploadPhoto).toBe('function');
    });

    it('provides loadPhotos action', () => {
      const { result } = renderHook(() => usePhotos(false));

      expect(typeof result.current.loadPhotos).toBe('function');
    });

    it('provides deletePhoto action', () => {
      const { result } = renderHook(() => usePhotos(false));

      expect(typeof result.current.deletePhoto).toBe('function');
    });

    it('provides clearError action', () => {
      const { result } = renderHook(() => usePhotos(false));

      expect(typeof result.current.clearError).toBe('function');
    });

    it('provides clearStorageWarning action', () => {
      const { result } = renderHook(() => usePhotos(false));

      expect(typeof result.current.clearStorageWarning).toBe('function');
    });
  });

  describe('auto-load behavior', () => {
    it('loads photos on mount when autoLoad is true', async () => {
      renderHook(() => usePhotos(true));

      await waitFor(() => {
        expect(mockLoadPhotos).toHaveBeenCalledTimes(1);
      });
    });

    it('does not load photos on mount when autoLoad is false', () => {
      renderHook(() => usePhotos(false));

      expect(mockLoadPhotos).not.toHaveBeenCalled();
    });

    it('loads photos on mount when autoLoad is not provided (defaults to true)', async () => {
      renderHook(() => usePhotos());

      await waitFor(() => {
        expect(mockLoadPhotos).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('upload state', () => {
    it('reflects isUploading state from store', () => {
      (useAppStore as any).mockImplementation((selector: any) => {
        const state = {
          photos: [],
          isUploading: true,
          uploadProgress: 50,
          error: null,
          storageWarning: null,
          uploadPhoto: mockUploadPhoto,
          loadPhotos: mockLoadPhotos,
          deletePhoto: mockDeletePhoto,
          clearError: mockClearError,
          clearStorageWarning: mockClearStorageWarning,
        };
        return selector(state);
      });

      const { result } = renderHook(() => usePhotos(false));

      expect(result.current.isUploading).toBe(true);
      expect(result.current.uploadProgress).toBe(50);
    });
  });

  describe('error state', () => {
    it('reflects error state from store', () => {
      const errorMessage = 'Upload failed';

      (useAppStore as any).mockImplementation((selector: any) => {
        const state = {
          photos: [],
          isUploading: false,
          uploadProgress: 0,
          error: errorMessage,
          storageWarning: null,
          uploadPhoto: mockUploadPhoto,
          loadPhotos: mockLoadPhotos,
          deletePhoto: mockDeletePhoto,
          clearError: mockClearError,
          clearStorageWarning: mockClearStorageWarning,
        };
        return selector(state);
      });

      const { result } = renderHook(() => usePhotos(false));

      expect(result.current.error).toBe(errorMessage);
    });

    it('calls clearError when clearError is invoked', () => {
      const { result } = renderHook(() => usePhotos(false));

      result.current.clearError();

      expect(mockClearError).toHaveBeenCalledTimes(1);
    });
  });

  describe('storage warning state', () => {
    it('reflects storageWarning state from store', () => {
      const warningMessage = 'Storage 80% full';

      (useAppStore as any).mockImplementation((selector: any) => {
        const state = {
          photos: [],
          isUploading: false,
          uploadProgress: 0,
          error: null,
          storageWarning: warningMessage,
          uploadPhoto: mockUploadPhoto,
          loadPhotos: mockLoadPhotos,
          deletePhoto: mockDeletePhoto,
          clearError: mockClearError,
          clearStorageWarning: mockClearStorageWarning,
        };
        return selector(state);
      });

      const { result } = renderHook(() => usePhotos(false));

      expect(result.current.storageWarning).toBe(warningMessage);
    });

    it('calls clearStorageWarning when clearStorageWarning is invoked', () => {
      const { result } = renderHook(() => usePhotos(false));

      result.current.clearStorageWarning();

      expect(mockClearStorageWarning).toHaveBeenCalledTimes(1);
    });
  });

  describe('actions', () => {
    it('calls uploadPhoto action from store', async () => {
      const { result } = renderHook(() => usePhotos(false));

      const uploadInput: PhotoUploadInput = {
        file: new Blob(['test'], { type: 'image/jpeg' }),
        filename: 'test.jpg',
        caption: 'Test',
        mimeType: 'image/jpeg',
        width: 1920,
        height: 1080,
      };

      await result.current.uploadPhoto(uploadInput);

      expect(mockUploadPhoto).toHaveBeenCalledTimes(1);
      expect(mockUploadPhoto).toHaveBeenCalledWith(uploadInput);
    });

    it('calls loadPhotos action from store', async () => {
      const { result } = renderHook(() => usePhotos(false));

      await result.current.loadPhotos();

      expect(mockLoadPhotos).toHaveBeenCalledTimes(1);
    });

    it('calls deletePhoto action from store', async () => {
      const { result } = renderHook(() => usePhotos(false));

      await result.current.deletePhoto('photo-1');

      expect(mockDeletePhoto).toHaveBeenCalledTimes(1);
      expect(mockDeletePhoto).toHaveBeenCalledWith('photo-1');
    });
  });

  describe('automatic photo reload after upload', () => {
    it('reloads photos after successful upload', async () => {
      const { result } = renderHook(() => usePhotos(false));

      // Mock successful upload
      mockUploadPhoto.mockResolvedValue(undefined);

      const uploadInput: PhotoUploadInput = {
        file: new Blob(['test'], { type: 'image/jpeg' }),
        filename: 'test.jpg',
        caption: 'Test',
        mimeType: 'image/jpeg',
        width: 1920,
        height: 1080,
      };

      await result.current.uploadPhoto(uploadInput);

      await waitFor(() => {
        expect(mockLoadPhotos).toHaveBeenCalledTimes(1);
      });
    });

    it('does not reload photos if upload fails', async () => {
      const { result } = renderHook(() => usePhotos(false));

      // Mock failed upload
      mockUploadPhoto.mockRejectedValue(new Error('Upload failed'));

      const uploadInput: PhotoUploadInput = {
        file: new Blob(['test'], { type: 'image/jpeg' }),
        filename: 'test.jpg',
        caption: 'Test',
        mimeType: 'image/jpeg',
        width: 1920,
        height: 1080,
      };

      try {
        await result.current.uploadPhoto(uploadInput);
      } catch {
        // Expected error
      }

      expect(mockLoadPhotos).not.toHaveBeenCalled();
    });
  });
});
