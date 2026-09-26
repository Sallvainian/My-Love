/**
 * loveNoteImageService Tests
 *
 * Unit tests for the Love Notes image upload service.
 * Tests image upload via Edge Function, signed URL generation, and error handling.
 *
 * Love Notes Images: Task 11 - Unit tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteLoveNoteImage,
  downloadLoveNoteImage,
  getSignedImageUrl,
  uploadCompressedBlob,
  uploadLoveNoteImage,
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
  } as unknown as SessionResponse;
}

/** The picture every upload test hands the service. */
function jpegFile(): File {
  return new File(['test-image'], 'photo.jpg', { type: 'image/jpeg' });
}

/** A refusal from the upload Edge Function: its status and JSON error body. */
function edgeError(
  status: number,
  error: string,
  message?: string,
  detail: Record<string, string> = {}
) {
  const body = { error, ...(message === undefined ? {} : { message }), ...detail };
  return { ok: false, status, json: () => Promise.resolve(body) };
}

function createStorageBucket(overrides: Partial<StorageBucket> = {}): StorageBucket {
  return {
    upload: vi.fn(),
    createSignedUrl: vi.fn(),
    remove: vi.fn(),
    download: vi.fn(),
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
    // resetAllMocks, not clearAllMocks: it also puts every vi.fn(impl) factory
    // default back (validateImageFile, getSession, compressImage, storage.from,
    // crypto.randomUUID) and drops unconsumed *Once queues, so one test's
    // override cannot reach the next.
    vi.resetAllMocks();
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

      const mockFile = jpegFile();
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

      vi.mocked(supabase.auth.getSession).mockResolvedValue(createSessionResponse(null));

      const mockFile = jpegFile();

      await expect(uploadLoveNoteImage(mockFile, 'user-123')).rejects.toThrow('Not authenticated');
    });

    it('should throw error on rate limit exceeded (429)', async () => {
      const { supabase } = await import('../../api/supabaseClient');

      vi.mocked(supabase.auth.getSession).mockResolvedValue(createSessionResponse('token'));

      mockFetch.mockResolvedValue(
        edgeError(429, 'Rate limit exceeded', 'Too many uploads. Please wait a minute.')
      );

      const mockFile = jpegFile();

      await expect(uploadLoveNoteImage(mockFile, 'user-123')).rejects.toThrow(
        'Too many uploads. Please wait a minute and try again.'
      );
    });

    it('should throw error on file too large (413)', async () => {
      const { supabase } = await import('../../api/supabaseClient');

      vi.mocked(supabase.auth.getSession).mockResolvedValue(createSessionResponse('token'));

      mockFetch.mockResolvedValue(edgeError(413, 'File too large', 'Maximum file size is 5MB'));

      const mockFile = jpegFile();

      await expect(uploadLoveNoteImage(mockFile, 'user-123')).rejects.toThrow(
        'Image is too large. Please try a smaller image.'
      );
    });

    it('should throw error on invalid file type (415)', async () => {
      const { supabase } = await import('../../api/supabaseClient');

      vi.mocked(supabase.auth.getSession).mockResolvedValue(createSessionResponse('token'));

      mockFetch.mockResolvedValue(
        edgeError(415, 'Invalid file type', undefined, { detectedType: 'application/pdf' })
      );

      const mockFile = jpegFile();

      await expect(uploadLoveNoteImage(mockFile, 'user-123')).rejects.toThrow(
        'Invalid image type. Please use JPEG, PNG, WebP, or GIF.'
      );
    });

    it('should map a missing Content-Length refusal (411) rather than surface protocol text', async () => {
      const { supabase } = await import('../../api/supabaseClient');

      vi.mocked(supabase.auth.getSession).mockResolvedValue(createSessionResponse('token'));

      mockFetch.mockResolvedValue(
        edgeError(411, 'Length required', 'A Content-Length header is required')
      );

      const mockFile = jpegFile();

      await expect(uploadLoveNoteImage(mockFile, 'user-123')).rejects.toThrow(
        'Image upload was interrupted. Please try again.'
      );
    });

    it('should map a truncated-body refusal (400) rather than surface protocol text', async () => {
      const { supabase } = await import('../../api/supabaseClient');

      vi.mocked(supabase.auth.getSession).mockResolvedValue(createSessionResponse('token'));

      mockFetch.mockResolvedValue(
        edgeError(
          400,
          'Content-Length mismatch',
          'Content-Length declared 1048576 bytes but 524288 were received'
        )
      );

      const mockFile = jpegFile();

      await expect(uploadLoveNoteImage(mockFile, 'user-123')).rejects.toThrow(
        'Image upload was interrupted. Please try again.'
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

      mockFetch.mockResolvedValue(edgeError(500, 'Upload failed', 'Network error'));

      const mockBlob = new Blob(['data'], { type: 'image/jpeg' });

      await expect(uploadCompressedBlob(mockBlob, 'user-123')).rejects.toThrow('Network error');
    });
  });

  describe('getSignedImageUrl', () => {
    it('should return signed URL with expiry timestamp', async () => {
      const { supabase } = await import('../../api/supabaseClient');

      const mockSignedUrl =
        'https://storage.supabase.co/signed/love-notes-images/user-123/image.jpg?token=abc';
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

  describe('downloadLoveNoteImage', () => {
    it('downloads the Blob by storage path, with no signed URL', async () => {
      const { supabase } = await import('../../api/supabaseClient');
      const blob = new Blob(['image-bytes'], { type: 'image/jpeg' });
      const mockDownload = vi.fn().mockResolvedValue({ data: blob, error: null });
      const mockCreateSignedUrl = vi.fn();
      vi.mocked(supabase.storage.from).mockReturnValue(
        createStorageBucket({ download: mockDownload, createSignedUrl: mockCreateSignedUrl })
      );

      const storagePath = 'partner-456/1705315800000-uuid.jpg';
      await expect(downloadLoveNoteImage(storagePath)).resolves.toBe(blob);

      expect(supabase.storage.from).toHaveBeenCalledWith('love-notes-images');
      expect(mockDownload).toHaveBeenCalledWith(storagePath);
      expect(mockCreateSignedUrl).not.toHaveBeenCalled();
    });

    it('throws when the download fails (offline included)', async () => {
      const { supabase } = await import('../../api/supabaseClient');
      const mockDownload = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Failed to fetch' },
      });
      vi.mocked(supabase.storage.from).mockReturnValue(createStorageBucket({ download: mockDownload }));

      await expect(downloadLoveNoteImage('path')).rejects.toThrow(
        'Failed to download image: Failed to fetch'
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
