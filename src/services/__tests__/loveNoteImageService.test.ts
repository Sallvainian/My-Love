/**
 * loveNoteImageService Tests
 *
 * Unit tests for the Love Notes image upload service.
 * Tests image upload via Edge Function, signed URL generation, and error handling.
 *
 * Love Notes Images: Task 11 - Unit tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  uploadLoveNoteImage,
  uploadCompressedBlob,
  getSignedImageUrl,
  deleteLoveNoteImage,
} from '../loveNoteImageService';

type SessionResponse = Awaited<
  ReturnType<(typeof import('../../api/supabaseClient'))['supabase']['auth']['getSession']>
>;
type StorageBucket = ReturnType<
  (typeof import('../../api/supabaseClient'))['supabase']['storage']['from']
>;

function createSessionResponse(accessToken: string | null): SessionResponse {
  return {
    data: {
      session: accessToken
        ? ({ access_token: accessToken } as NonNullable<SessionResponse['data']['session']>)
        : null,
    },
    error: null,
  };
}

function createStorageBucket(overrides: Partial<StorageBucket> = {}): StorageBucket {
  return {
    upload: vi.fn(),
    createSignedUrl: vi.fn(),
    remove: vi.fn(),
    ...overrides,
  } as unknown as StorageBucket;
}

// Mock Supabase client
vi.mock('../../api/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({
          data: {
            session: {
              access_token: 'mock-token-123',
            },
          },
        })
      ),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        createSignedUrl: vi.fn(),
        remove: vi.fn(),
      })),
    },
  },
}));

// Mock image compression service
vi.mock('../imageCompressionService', () => ({
  imageCompressionService: {
    validateImageFile: vi.fn(() => ({ valid: true })),
    compressImage: vi.fn(() =>
      Promise.resolve({
        blob: new Blob(['compressed-image'], { type: 'image/jpeg' }),
        compressedSize: 1024,
      })
    ),
  },
}));

// Mock fetch for Edge Function calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock crypto.randomUUID
const mockUUID = '12345678-1234-1234-1234-123456789012';
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => mockUUID),
});

// Mock import.meta.env
vi.stubGlobal('import', {
  meta: {
    env: {
      VITE_SUPABASE_URL: 'https://test-project.supabase.co',
    },
  },
});

describe('loveNoteImageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:30:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('uploadLoveNoteImage', () => {
    it('should compress and upload image via Edge Function successfully', async () => {
      const { imageCompressionService } = await import('../imageCompressionService');

      const mockStoragePath = 'user-123/1705315800000-uuid.jpg';
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            storagePath: mockStoragePath,
            size: 1024,
            mimeType: 'image/jpeg',
            rateLimitRemaining: 9,
          }),
      });

      const mockFile = new File(['test-image'], 'photo.jpg', { type: 'image/jpeg' });
      const userId = 'user-123';

      const result = await uploadLoveNoteImage(mockFile, userId);

      // Should validate file first
      expect(imageCompressionService.validateImageFile).toHaveBeenCalledWith(mockFile);

      // Should compress image
      expect(imageCompressionService.compressImage).toHaveBeenCalledWith(mockFile);

      // Should call Edge Function
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/functions/v1/upload-love-note-image'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token-123',
            'Content-Type': 'application/octet-stream',
          }),
          body: expect.any(Blob),
        })
      );

      // Should return storage path from Edge Function
      expect(result).toEqual({
        storagePath: mockStoragePath,
        compressedSize: 1024,
      });
    });

    it('should throw error for invalid file', async () => {
      const { imageCompressionService } = await import('../imageCompressionService');

      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({
        valid: false,
        error: 'Unsupported file format',
      });

      const mockFile = new File(['test'], 'doc.pdf', { type: 'application/pdf' });

      await expect(uploadLoveNoteImage(mockFile, 'user-123')).rejects.toThrow(
        'Unsupported file format'
      );

      // Should NOT call Edge Function for invalid files
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw error when not authenticated', async () => {
      const { supabase } = await import('../../api/supabaseClient');
      const { imageCompressionService } = await import('../imageCompressionService');

      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({ valid: true });
      vi.mocked(supabase.auth.getSession).mockResolvedValue(createSessionResponse(null));

      const mockFile = new File(['test-image'], 'photo.jpg', { type: 'image/jpeg' });

      await expect(uploadLoveNoteImage(mockFile, 'user-123')).rejects.toThrow(
        'Not authenticated'
      );
    });

    it('should throw error on rate limit exceeded (429)', async () => {
      const { supabase } = await import('../../api/supabaseClient');
      const { imageCompressionService } = await import('../imageCompressionService');

      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({ valid: true });
      vi.mocked(supabase.auth.getSession).mockResolvedValue(createSessionResponse('token'));

      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        json: () =>
          Promise.resolve({
            error: 'Rate limit exceeded',
            message: 'Too many uploads. Please wait a minute.',
          }),
      });

      const mockFile = new File(['test-image'], 'photo.jpg', { type: 'image/jpeg' });

      await expect(uploadLoveNoteImage(mockFile, 'user-123')).rejects.toThrow(
        'Too many uploads. Please wait a minute and try again.'
      );
    });

    it('should throw error on file too large (413)', async () => {
      const { supabase } = await import('../../api/supabaseClient');
      const { imageCompressionService } = await import('../imageCompressionService');

      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({ valid: true });
      vi.mocked(supabase.auth.getSession).mockResolvedValue(createSessionResponse('token'));

      mockFetch.mockResolvedValue({
        ok: false,
        status: 413,
        json: () =>
          Promise.resolve({
            error: 'File too large',
            message: 'Maximum file size is 5MB',
          }),
      });

      const mockFile = new File(['test-image'], 'photo.jpg', { type: 'image/jpeg' });

      await expect(uploadLoveNoteImage(mockFile, 'user-123')).rejects.toThrow(
        'Image is too large. Please try a smaller image.'
      );
    });

    it('should throw error on invalid file type (415)', async () => {
      const { supabase } = await import('../../api/supabaseClient');
      const { imageCompressionService } = await import('../imageCompressionService');

      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({ valid: true });
      vi.mocked(supabase.auth.getSession).mockResolvedValue(createSessionResponse('token'));

      mockFetch.mockResolvedValue({
        ok: false,
        status: 415,
        json: () =>
          Promise.resolve({
            error: 'Invalid file type',
            detectedType: 'application/pdf',
          }),
      });

      const mockFile = new File(['test'], 'photo.jpg', { type: 'image/jpeg' });

      await expect(uploadLoveNoteImage(mockFile, 'user-123')).rejects.toThrow(
        'Invalid image type. Please use JPEG, PNG, WebP, or GIF.'
      );
    });
  });

  describe('uploadCompressedBlob', () => {
    it('should upload pre-compressed blob via Edge Function', async () => {
      const { supabase } = await import('../../api/supabaseClient');

      vi.mocked(supabase.auth.getSession).mockResolvedValue(createSessionResponse('token'));

      const mockStoragePath = 'user-456/1705315800000-uuid.jpg';
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            storagePath: mockStoragePath,
          }),
      });

      const mockBlob = new Blob(['compressed-data'], { type: 'image/jpeg' });
      const userId = 'user-456';

      const result = await uploadCompressedBlob(mockBlob, userId);

      // Should call Edge Function with blob
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/functions/v1/upload-love-note-image'),
        expect.objectContaining({
          method: 'POST',
          body: mockBlob,
        })
      );

      expect(result).toEqual({
        storagePath: mockStoragePath,
        compressedSize: mockBlob.size,
      });
    });

    it('should throw error on blob upload failure', async () => {
      const { supabase } = await import('../../api/supabaseClient');

      vi.mocked(supabase.auth.getSession).mockResolvedValue(createSessionResponse('token'));

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () =>
          Promise.resolve({
            error: 'Upload failed',
            message: 'Network error',
          }),
      });

      const mockBlob = new Blob(['data'], { type: 'image/jpeg' });

      await expect(uploadCompressedBlob(mockBlob, 'user-123')).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('getSignedImageUrl', () => {
    it('should return signed URL with expiry timestamp', async () => {
      const { supabase } = await import('../../api/supabaseClient');

      const mockSignedUrl = 'https://storage.supabase.co/signed/love-notes-images/user-123/image.jpg?token=abc';
      const mockCreateSignedUrl = vi.fn().mockResolvedValue({
        data: { signedUrl: mockSignedUrl },
        error: null,
      });

      vi.mocked(supabase.storage.from).mockReturnValue(
        createStorageBucket({ createSignedUrl: mockCreateSignedUrl })
      );

      const storagePath = 'user-123/1705315800000-uuid.jpg';
      const result = await getSignedImageUrl(storagePath);

      expect(supabase.storage.from).toHaveBeenCalledWith('love-notes-images');
      expect(mockCreateSignedUrl).toHaveBeenCalledWith(storagePath, 3600);

      expect(result).toEqual({
        url: mockSignedUrl,
        expiresAt: expect.any(Number),
      });

      // Expiry should be ~1 hour from now
      const expectedExpiry = Date.now() + 3600 * 1000;
      expect(result.expiresAt).toBe(expectedExpiry);
    });

    it('should throw error on signed URL generation failure', async () => {
      const { supabase } = await import('../../api/supabaseClient');

      const mockCreateSignedUrl = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Object not found' },
      });

      vi.mocked(supabase.storage.from).mockReturnValue(
        createStorageBucket({ createSignedUrl: mockCreateSignedUrl })
      );

      await expect(getSignedImageUrl('invalid-path')).rejects.toThrow(
        'Failed to get image URL: Object not found'
      );
    });
  });

  describe('deleteLoveNoteImage', () => {
    it('should delete image from storage', async () => {
      const { supabase } = await import('../../api/supabaseClient');

      const mockRemove = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(supabase.storage.from).mockReturnValue(createStorageBucket({ remove: mockRemove }));

      const storagePath = 'user-123/1705315800000-uuid.jpg';
      await deleteLoveNoteImage(storagePath);

      expect(supabase.storage.from).toHaveBeenCalledWith('love-notes-images');
      expect(mockRemove).toHaveBeenCalledWith([storagePath]);
    });

    it('should throw error on delete failure', async () => {
      const { supabase } = await import('../../api/supabaseClient');

      const mockRemove = vi.fn().mockResolvedValue({
        error: { message: 'Permission denied' },
      });

      vi.mocked(supabase.storage.from).mockReturnValue(createStorageBucket({ remove: mockRemove }));

      await expect(deleteLoveNoteImage('path')).rejects.toThrow(
        'Failed to delete image: Permission denied'
      );
    });
  });
});
