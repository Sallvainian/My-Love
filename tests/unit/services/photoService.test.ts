/**
 * PhotoService Unit Tests
 *
 * Story 6.0: Photo Storage Schema & Buckets Setup
 * Tests for photoService methods: getSignedUrl, checkStorageQuota, getPhotos, uploadPhoto, deletePhoto
 *
 * @module tests/unit/services/photoService.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { PhotoUploadInput } from '../../../src/services/photoService';

// Mock Supabase client
const mockStorageFrom = vi.fn();
const mockFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
    },
    storage: {
      from: (bucket: string) => mockStorageFrom(bucket),
    },
    from: (table: string) => mockFrom(table),
  },
}));

// Test data
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEST_PARTNER_ID = '550e8400-e29b-41d4-a716-446655440002';
const TEST_PHOTO_ID = '550e8400-e29b-41d4-a716-446655440100';
const TEST_STORAGE_PATH = `${TEST_USER_ID}/photo_12345.jpg`;

const mockPhoto = {
  id: TEST_PHOTO_ID,
  user_id: TEST_USER_ID,
  storage_path: TEST_STORAGE_PATH,
  filename: 'photo.jpg',
  caption: 'Test caption',
  mime_type: 'image/jpeg' as const,
  file_size: 1024000,
  width: 1920,
  height: 1080,
  created_at: '2024-01-15T10:30:00.000Z',
};

describe('PhotoService', () => {
  let photoService: typeof import('../../../src/services/photoService').photoService;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset module to get fresh instance
    vi.resetModules();

    // Default mock for authenticated user
    mockGetUser.mockResolvedValue({
      data: { user: { id: TEST_USER_ID } },
      error: null,
    });

    // Import fresh instance after mocks are set up
    const module = await import('../../../src/services/photoService');
    photoService = module.photoService;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSignedUrl', () => {
    it('should generate a signed URL for a storage path', async () => {
      const mockSignedUrl = 'https://storage.supabase.co/signed/photos/test.jpg?token=abc123';

      mockStorageFrom.mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: mockSignedUrl },
          error: null,
        }),
      });

      const result = await photoService.getSignedUrl(TEST_STORAGE_PATH);

      expect(mockStorageFrom).toHaveBeenCalledWith('photos');
      expect(result).toBe(mockSignedUrl);
    });

    it('should use default expiry of 3600 seconds (1 hour)', async () => {
      const mockCreateSignedUrl = vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://signed.url' },
        error: null,
      });

      mockStorageFrom.mockReturnValue({
        createSignedUrl: mockCreateSignedUrl,
      });

      await photoService.getSignedUrl(TEST_STORAGE_PATH);

      expect(mockCreateSignedUrl).toHaveBeenCalledWith(TEST_STORAGE_PATH, 3600);
    });

    it('should accept custom expiry time', async () => {
      const customExpiry = 7200;
      const mockCreateSignedUrl = vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://signed.url' },
        error: null,
      });

      mockStorageFrom.mockReturnValue({
        createSignedUrl: mockCreateSignedUrl,
      });

      await photoService.getSignedUrl(TEST_STORAGE_PATH, customExpiry);

      expect(mockCreateSignedUrl).toHaveBeenCalledWith(TEST_STORAGE_PATH, customExpiry);
    });

    it('should return null on error', async () => {
      mockStorageFrom.mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Object not found' },
        }),
      });

      const result = await photoService.getSignedUrl(TEST_STORAGE_PATH);

      expect(result).toBeNull();
    });

    it('should return null on exception', async () => {
      mockStorageFrom.mockReturnValue({
        createSignedUrl: vi.fn().mockRejectedValue(new Error('Network error')),
      });

      const result = await photoService.getSignedUrl(TEST_STORAGE_PATH);

      expect(result).toBeNull();
    });
  });

  describe('getSignedUrls', () => {
    it('should generate signed URLs for multiple storage paths', async () => {
      const paths = [
        `${TEST_USER_ID}/photo1.jpg`,
        `${TEST_USER_ID}/photo2.jpg`,
        `${TEST_USER_ID}/photo3.jpg`,
      ];

      const mockCreateSignedUrl = vi.fn().mockImplementation((path: string) =>
        Promise.resolve({
          data: { signedUrl: `https://signed.url/${path}` },
          error: null,
        })
      );

      mockStorageFrom.mockReturnValue({
        createSignedUrl: mockCreateSignedUrl,
      });

      const result = await photoService.getSignedUrls(paths);

      expect(result.size).toBe(3);
      paths.forEach((path) => {
        expect(result.has(path)).toBe(true);
        expect(result.get(path)).toBe(`https://signed.url/${path}`);
      });
    });

    it('should handle partial failures gracefully', async () => {
      const paths = [`${TEST_USER_ID}/photo1.jpg`, `${TEST_USER_ID}/photo2.jpg`];

      let callCount = 0;
      const mockCreateSignedUrl = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            data: { signedUrl: 'https://signed.url/photo1' },
            error: null,
          });
        }
        return Promise.resolve({
          data: null,
          error: { message: 'Object not found' },
        });
      });

      mockStorageFrom.mockReturnValue({
        createSignedUrl: mockCreateSignedUrl,
      });

      const result = await photoService.getSignedUrls(paths);

      expect(result.size).toBe(1);
      expect(result.has(paths[0])).toBe(true);
    });

    it('should return empty map for empty input', async () => {
      const result = await photoService.getSignedUrls([]);

      expect(result.size).toBe(0);
    });
  });

  describe('checkStorageQuota', () => {
    it('should calculate storage usage from photos table', async () => {
      // Mock photos with known file sizes (total: 3MB)
      const mockPhotos = [
        { file_size: 1024000 }, // 1MB
        { file_size: 1024000 }, // 1MB
        { file_size: 1024000 }, // 1MB
      ];

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: mockPhotos,
            error: null,
          }),
        }),
      });

      const result = await photoService.checkStorageQuota();

      expect(result.used).toBe(3072000); // 3MB
      expect(result.quota).toBe(1024 * 1024 * 1024); // 1GB
      expect(result.percent).toBeCloseTo(0.3, 1); // ~0.3%
      expect(result.warning).toBe('none');
    });

    it('should return "approaching" warning at 80% usage', async () => {
      // 81% of 1GB = 869656781 bytes (use value > 80% to avoid floating point issues)
      const mockPhotos = [{ file_size: 869656781 }];

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: mockPhotos,
            error: null,
          }),
        }),
      });

      const result = await photoService.checkStorageQuota();

      expect(result.warning).toBe('approaching');
    });

    it('should return "critical" warning at 95% usage', async () => {
      // 95% of 1GB = 1020054733 bytes
      const mockPhotos = [{ file_size: 1020054733 }];

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: mockPhotos,
            error: null,
          }),
        }),
      });

      const result = await photoService.checkStorageQuota();

      expect(result.warning).toBe('critical');
    });

    it('should return "exceeded" warning at 100%+ usage', async () => {
      // 101% of 1GB = 1084479242 bytes
      const mockPhotos = [{ file_size: 1084479242 }];

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: mockPhotos,
            error: null,
          }),
        }),
      });

      const result = await photoService.checkStorageQuota();

      expect(result.warning).toBe('exceeded');
    });

    it('should throw error when not authenticated', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      // Re-import to get fresh instance with new mock
      vi.resetModules();
      const module = await import('../../../src/services/photoService');

      const result = await module.photoService.checkStorageQuota();

      // Should return safe default on auth error
      expect(result.used).toBe(0);
      expect(result.warning).toBe('none');
    });

    it('should return safe default on database error', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        }),
      });

      const result = await photoService.checkStorageQuota();

      expect(result.used).toBe(0);
      expect(result.quota).toBe(1024 * 1024 * 1024);
      expect(result.percent).toBe(0);
      expect(result.warning).toBe('none');
    });
  });

  describe('getPhotos', () => {
    it('should fetch photos with signed URLs', async () => {
      const mockPhotos = [mockPhoto, { ...mockPhoto, id: 'photo-2', storage_path: 'user/photo2.jpg' }];

      // Mock photos table query
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({
              data: mockPhotos,
              error: null,
            }),
          }),
        }),
      });

      // Mock signed URL generation
      mockStorageFrom.mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://signed.url' },
          error: null,
        }),
      });

      const result = await photoService.getPhotos();

      expect(result).toHaveLength(2);
      expect(result[0].signedUrl).toBe('https://signed.url');
      expect(result[0].isOwn).toBe(true);
    });

    it('should mark photos as not own when user_id differs', async () => {
      const partnerPhoto = { ...mockPhoto, user_id: TEST_PARTNER_ID };

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({
              data: [partnerPhoto],
              error: null,
            }),
          }),
        }),
      });

      mockStorageFrom.mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://signed.url' },
          error: null,
        }),
      });

      const result = await photoService.getPhotos();

      expect(result[0].isOwn).toBe(false);
    });

    it('should apply pagination with limit and offset', async () => {
      const mockRange = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockOrder = vi.fn().mockReturnValue({ range: mockRange });

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: mockOrder,
        }),
      });

      await photoService.getPhotos(20, 40);

      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockRange).toHaveBeenCalledWith(40, 59); // offset to offset + limit - 1
    });

    it('should return empty array when no photos found', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      const result = await photoService.getPhotos();

      expect(result).toEqual([]);
    });

    it('should return empty array when not authenticated', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      vi.resetModules();
      const module = await import('../../../src/services/photoService');

      const result = await module.photoService.getPhotos();

      expect(result).toEqual([]);
    });
  });

  describe('uploadPhoto', () => {
    const mockUploadInput: PhotoUploadInput = {
      file: new Blob(['test'], { type: 'image/jpeg' }),
      filename: 'test-photo.jpg',
      caption: 'Test caption',
      mimeType: 'image/jpeg',
      width: 1920,
      height: 1080,
    };

    beforeEach(() => {
      // Mock crypto.randomUUID
      vi.stubGlobal('crypto', {
        randomUUID: vi.fn().mockReturnValue('test-uuid-12345'),
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should upload photo to storage and create metadata', async () => {
      // Mock storage quota check
      const mockQuotaSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      // Mock metadata insert
      const mockInsertSelect = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: mockPhoto, error: null }),
      });
      const mockInsert = vi.fn().mockReturnValue({
        select: mockInsertSelect,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'photos') {
          return {
            select: mockQuotaSelect,
            insert: mockInsert,
          };
        }
        return { select: mockQuotaSelect };
      });

      // Mock storage upload
      mockStorageFrom.mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      const result = await photoService.uploadPhoto(mockUploadInput);

      expect(result).toEqual(mockPhoto);
      expect(mockStorageFrom).toHaveBeenCalledWith('photos');
    });

    it('should reject upload when quota is exceeded', async () => {
      // Mock exceeded quota
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ file_size: 1100000000 }], // > 1GB
            error: null,
          }),
        }),
      });

      const result = await photoService.uploadPhoto(mockUploadInput);

      expect(result).toBeNull();
    });

    it('should rollback storage upload on database insert failure', async () => {
      const mockRemove = vi.fn().mockResolvedValue({ error: null });

      // Mock quota check (ok)
      mockFrom.mockImplementation((table: string) => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Insert failed' },
            }),
          }),
        }),
      }));

      // Mock storage operations
      mockStorageFrom.mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        remove: mockRemove,
        createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      const result = await photoService.uploadPhoto(mockUploadInput);

      expect(result).toBeNull();
      expect(mockRemove).toHaveBeenCalled();
    });

    it('should generate correct storage path with user ID and UUID', async () => {
      const mockUpload = vi.fn().mockResolvedValue({ error: null });

      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockPhoto, error: null }),
          }),
        }),
      }));

      mockStorageFrom.mockReturnValue({
        upload: mockUpload,
        createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      await photoService.uploadPhoto(mockUploadInput);

      expect(mockUpload).toHaveBeenCalledWith(
        `${TEST_USER_ID}/test-uuid-12345.jpeg`,
        mockUploadInput.file,
        expect.objectContaining({
          contentType: 'image/jpeg',
          upsert: false,
        })
      );
    });

    it('should return null when not authenticated', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      vi.resetModules();
      const module = await import('../../../src/services/photoService');

      const result = await module.photoService.uploadPhoto(mockUploadInput);

      expect(result).toBeNull();
    });

    it('should call progress callback during upload (AC 6.2.2, 6.2.3)', async () => {
      const progressCallback = vi.fn();
      const mockUpload = vi.fn().mockImplementation((path, file, options) => {
        // Simulate progress updates
        if (options?.onUploadProgress) {
          options.onUploadProgress({ loaded: 0, total: 1000 });
          options.onUploadProgress({ loaded: 500, total: 1000 });
          options.onUploadProgress({ loaded: 1000, total: 1000 });
        }
        return Promise.resolve({ error: null });
      });

      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockPhoto, error: null }),
          }),
        }),
      }));

      mockStorageFrom.mockReturnValue({
        upload: mockUpload,
        createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      await photoService.uploadPhoto(mockUploadInput, progressCallback);

      expect(progressCallback).toHaveBeenCalledWith(0);
      expect(progressCallback).toHaveBeenCalledWith(50);
      expect(progressCallback).toHaveBeenCalledWith(100);
      expect(progressCallback).toHaveBeenCalledTimes(3);
    });

    it('should work without progress callback (optional parameter)', async () => {
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockPhoto, error: null }),
          }),
        }),
      }));

      mockStorageFrom.mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      const result = await photoService.uploadPhoto(mockUploadInput);

      expect(result).toEqual(mockPhoto);
    });

    it('should reject upload before storage if quota > 95% (AC 6.2.11)', async () => {
      // Mock critical quota (96%)
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ file_size: 1030792151 }], // 96% of 1GB
            error: null,
          }),
        }),
      });

      const mockUpload = vi.fn();
      mockStorageFrom.mockReturnValue({
        upload: mockUpload,
      });

      const result = await photoService.uploadPhoto(mockUploadInput);

      expect(result).toBeNull();
      expect(mockUpload).not.toHaveBeenCalled(); // Should never reach upload
    });

    it('should log warning after upload if quota > 80% (AC 6.2.10)', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Mock quota checks: before = 75%, after = 81%
      let quotaCallCount = 0;
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: quotaCallCount++ === 0
              ? [{ file_size: 805306368 }]  // 75% - ok to upload
              : [{ file_size: 869793587 }], // 81% - warning after upload
            error: null,
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockPhoto, error: null }),
          }),
        }),
      }));

      mockStorageFrom.mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      const result = await photoService.uploadPhoto(mockUploadInput);

      expect(result).toEqual(mockPhoto);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Storage warning')
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('deletePhoto', () => {
    it('should delete photo from storage and database', async () => {
      const mockStorageRemove = vi.fn().mockResolvedValue({ error: null });
      const mockDbDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      // Mock fetch photo
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { storage_path: TEST_STORAGE_PATH, user_id: TEST_USER_ID },
              error: null,
            }),
          }),
        }),
        delete: mockDbDelete,
      }));

      mockStorageFrom.mockReturnValue({
        remove: mockStorageRemove,
      });

      const result = await photoService.deletePhoto(TEST_PHOTO_ID);

      expect(result).toBe(true);
      expect(mockStorageRemove).toHaveBeenCalledWith([TEST_STORAGE_PATH]);
    });

    it('should reject deletion of photos owned by another user', async () => {
      // Mock photo owned by different user
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { storage_path: TEST_STORAGE_PATH, user_id: TEST_PARTNER_ID },
              error: null,
            }),
          }),
        }),
      });

      const result = await photoService.deletePhoto(TEST_PHOTO_ID);

      expect(result).toBe(false);
    });

    it('should return false when photo not found', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'No rows found' },
            }),
          }),
        }),
      });

      const result = await photoService.deletePhoto(TEST_PHOTO_ID);

      expect(result).toBe(false);
    });

    it('should continue with database deletion even if storage deletion fails', async () => {
      const mockDbDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { storage_path: TEST_STORAGE_PATH, user_id: TEST_USER_ID },
              error: null,
            }),
          }),
        }),
        delete: mockDbDelete,
      }));

      // Mock storage remove failure
      mockStorageFrom.mockReturnValue({
        remove: vi.fn().mockResolvedValue({ error: { message: 'Storage error' } }),
      });

      const result = await photoService.deletePhoto(TEST_PHOTO_ID);

      expect(result).toBe(true);
      expect(mockDbDelete).toHaveBeenCalled();
    });

    it('should return false when not authenticated', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      vi.resetModules();
      const module = await import('../../../src/services/photoService');

      const result = await module.photoService.deletePhoto(TEST_PHOTO_ID);

      expect(result).toBe(false);
    });
  });

  describe('getPhoto', () => {
    it('should fetch single photo with signed URL', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockPhoto,
              error: null,
            }),
          }),
        }),
      });

      mockStorageFrom.mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://signed.url/photo' },
          error: null,
        }),
      });

      const result = await photoService.getPhoto(TEST_PHOTO_ID);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(TEST_PHOTO_ID);
      expect(result?.signedUrl).toBe('https://signed.url/photo');
      expect(result?.isOwn).toBe(true);
    });

    it('should mark partner photos as not own', async () => {
      const partnerPhoto = { ...mockPhoto, user_id: TEST_PARTNER_ID };

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: partnerPhoto,
              error: null,
            }),
          }),
        }),
      });

      mockStorageFrom.mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://signed.url' },
          error: null,
        }),
      });

      const result = await photoService.getPhoto(TEST_PHOTO_ID);

      expect(result?.isOwn).toBe(false);
    });

    it('should return null when photo not found', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'No rows found' },
            }),
          }),
        }),
      });

      const result = await photoService.getPhoto(TEST_PHOTO_ID);

      expect(result).toBeNull();
    });

    it('should return null when not authenticated', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      vi.resetModules();
      const module = await import('../../../src/services/photoService');

      const result = await module.photoService.getPhoto(TEST_PHOTO_ID);

      expect(result).toBeNull();
    });
  });
});
