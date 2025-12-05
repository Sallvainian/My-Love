/**
 * loveNoteImageService Tests
 *
 * Unit tests for the Love Notes image upload service.
 * Tests image upload, signed URL generation, and error handling.
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

// Mock Supabase client
vi.mock('../../api/supabaseClient', () => ({
  supabase: {
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

// Mock crypto.randomUUID
const mockUUID = '12345678-1234-1234-1234-123456789012';
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => mockUUID),
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
    it('should compress and upload image successfully', async () => {
      const { supabase } = await import('../../api/supabaseClient');
      const { imageCompressionService } = await import('../imageCompressionService');

      const mockUpload = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(supabase.storage.from).mockReturnValue({
        upload: mockUpload,
        createSignedUrl: vi.fn(),
        remove: vi.fn(),
      } as any);

      const mockFile = new File(['test-image'], 'photo.jpg', { type: 'image/jpeg' });
      const userId = 'user-123';

      const result = await uploadLoveNoteImage(mockFile, userId);

      // Should validate file first
      expect(imageCompressionService.validateImageFile).toHaveBeenCalledWith(mockFile);

      // Should compress image
      expect(imageCompressionService.compressImage).toHaveBeenCalledWith(mockFile);

      // Should upload to correct bucket and path
      expect(supabase.storage.from).toHaveBeenCalledWith('love-notes-images');
      expect(mockUpload).toHaveBeenCalledWith(
        `user-123/${Date.now()}-${mockUUID}.jpg`,
        expect.any(Blob),
        {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false,
        }
      );

      // Should return storage path
      expect(result).toEqual({
        storagePath: `user-123/${Date.now()}-${mockUUID}.jpg`,
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
    });

    it('should throw error on upload failure', async () => {
      const { supabase } = await import('../../api/supabaseClient');
      const { imageCompressionService } = await import('../imageCompressionService');

      // Reset validation mock to return valid (previous test set it to invalid)
      vi.mocked(imageCompressionService.validateImageFile).mockReturnValue({ valid: true });

      const mockUpload = vi.fn().mockResolvedValue({
        error: { message: 'Storage quota exceeded' },
      });
      vi.mocked(supabase.storage.from).mockReturnValue({
        upload: mockUpload,
        createSignedUrl: vi.fn(),
        remove: vi.fn(),
      } as any);

      const mockFile = new File(['test-image'], 'photo.jpg', { type: 'image/jpeg' });

      await expect(uploadLoveNoteImage(mockFile, 'user-123')).rejects.toThrow(
        'Upload failed: Storage quota exceeded'
      );
    });
  });

  describe('uploadCompressedBlob', () => {
    it('should upload pre-compressed blob without re-compression', async () => {
      const { supabase } = await import('../../api/supabaseClient');

      const mockUpload = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(supabase.storage.from).mockReturnValue({
        upload: mockUpload,
        createSignedUrl: vi.fn(),
        remove: vi.fn(),
      } as any);

      const mockBlob = new Blob(['compressed-data'], { type: 'image/jpeg' });
      const userId = 'user-456';

      const result = await uploadCompressedBlob(mockBlob, userId);

      // Should upload directly without calling compression
      expect(supabase.storage.from).toHaveBeenCalledWith('love-notes-images');
      expect(mockUpload).toHaveBeenCalledWith(
        `user-456/${Date.now()}-${mockUUID}.jpg`,
        mockBlob,
        {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false,
        }
      );

      expect(result).toEqual({
        storagePath: `user-456/${Date.now()}-${mockUUID}.jpg`,
        compressedSize: mockBlob.size,
      });
    });

    it('should throw error on blob upload failure', async () => {
      const { supabase } = await import('../../api/supabaseClient');

      const mockUpload = vi.fn().mockResolvedValue({
        error: { message: 'Network error' },
      });
      vi.mocked(supabase.storage.from).mockReturnValue({
        upload: mockUpload,
        createSignedUrl: vi.fn(),
        remove: vi.fn(),
      } as any);

      const mockBlob = new Blob(['data'], { type: 'image/jpeg' });

      await expect(uploadCompressedBlob(mockBlob, 'user-123')).rejects.toThrow(
        'Upload failed: Network error'
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

      vi.mocked(supabase.storage.from).mockReturnValue({
        upload: vi.fn(),
        createSignedUrl: mockCreateSignedUrl,
        remove: vi.fn(),
      } as any);

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

      vi.mocked(supabase.storage.from).mockReturnValue({
        upload: vi.fn(),
        createSignedUrl: mockCreateSignedUrl,
        remove: vi.fn(),
      } as any);

      await expect(getSignedImageUrl('invalid-path')).rejects.toThrow(
        'Failed to get image URL: Object not found'
      );
    });
  });

  describe('deleteLoveNoteImage', () => {
    it('should delete image from storage', async () => {
      const { supabase } = await import('../../api/supabaseClient');

      const mockRemove = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(supabase.storage.from).mockReturnValue({
        upload: vi.fn(),
        createSignedUrl: vi.fn(),
        remove: mockRemove,
      } as any);

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

      vi.mocked(supabase.storage.from).mockReturnValue({
        upload: vi.fn(),
        createSignedUrl: vi.fn(),
        remove: mockRemove,
      } as any);

      await expect(deleteLoveNoteImage('path')).rejects.toThrow(
        'Failed to delete image: Permission denied'
      );
    });
  });
});
