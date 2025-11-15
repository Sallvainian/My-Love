import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { photoStorageService } from '../../../src/services/photoStorageService';
import type { Photo } from '../../../src/types';

// Helper to create mock photo data
function createMockPhoto(overrides?: Partial<Omit<Photo, 'id'>>): Omit<Photo, 'id'> {
  return {
    imageBlob: new Blob(['test image data'], { type: 'image/jpeg' }),
    caption: 'Test photo',
    tags: [],
    uploadDate: new Date(),
    originalSize: 1024,
    compressedSize: 512,
    width: 800,
    height: 600,
    mimeType: 'image/jpeg',
    ...overrides,
  };
}

describe('PhotoStorageService', () => {
  beforeEach(async () => {
    // Service is a singleton instance, initialize and clear before each test
    await photoStorageService.init();
    await photoStorageService.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // === CRUD Operations ===
  describe('create()', () => {
    it('creates a new photo with valid data', async () => {
      const photoData = createMockPhoto({ caption: 'Sunset at the beach' });
      const created = await photoStorageService.create(photoData);

      expect(created).toBeDefined();
      expect(created.id).toBeGreaterThan(0);
      expect(created.caption).toBe('Sunset at the beach');
      expect(created.mimeType).toBe('image/jpeg');
      expect(created.uploadDate).toBeInstanceOf(Date);
    });

    it('auto-increments id for multiple photos', async () => {
      const photo1 = await photoStorageService.create(createMockPhoto());
      const photo2 = await photoStorageService.create(createMockPhoto());

      expect(photo2.id).toBe(photo1.id! + 1);
    });

    it('stores the image blob correctly', async () => {
      const blob = new Blob(['test data'], { type: 'image/png' });
      const photoData = createMockPhoto({ imageBlob: blob, mimeType: 'image/png' });
      const created = await photoStorageService.create(photoData);

      expect(created.imageBlob).toBeInstanceOf(Blob);
      expect(created.imageBlob.size).toBe(blob.size);
      expect(created.imageBlob.type).toBe('image/png');
    });
  });

  describe('get()', () => {
    it('retrieves photo by id', async () => {
      const created = await photoStorageService.create(
        createMockPhoto({ caption: 'Test retrieval' })
      );
      const retrieved = await photoStorageService.get(created.id!);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.caption).toBe('Test retrieval');
    });

    it('returns null for non-existent id', async () => {
      const result = await photoStorageService.get(99999);
      expect(result).toBeNull();
    });
  });

  describe('getAll()', () => {
    it('returns all photos in the store', async () => {
      await photoStorageService.create(createMockPhoto({ caption: 'Photo 1' }));
      await photoStorageService.create(createMockPhoto({ caption: 'Photo 2' }));
      await photoStorageService.create(createMockPhoto({ caption: 'Photo 3' }));

      const allPhotos = await photoStorageService.getAll();

      expect(allPhotos).toHaveLength(3);
      // Photos are sorted by date descending (newest first)
      expect(allPhotos.map((p) => p.caption)).toEqual(['Photo 3', 'Photo 2', 'Photo 1']);
    });

    it('returns empty array when no photos exist', async () => {
      const allPhotos = await photoStorageService.getAll();
      expect(allPhotos).toEqual([]);
    });
  });

  describe('update()', () => {
    it('updates photo caption', async () => {
      const created = await photoStorageService.create(createMockPhoto({ caption: 'Original' }));
      await photoStorageService.update(created.id!, { caption: 'Updated caption' });

      const updated = await photoStorageService.get(created.id!);
      expect(updated?.caption).toBe('Updated caption');
    });

    it('updates photo tags', async () => {
      const created = await photoStorageService.create(createMockPhoto({ tags: ['old'] }));
      await photoStorageService.update(created.id!, { tags: ['new', 'updated'] });

      const updated = await photoStorageService.get(created.id!);
      expect(updated?.tags).toEqual(['new', 'updated']);
    });
  });

  describe('delete()', () => {
    it('deletes a photo by id', async () => {
      const created = await photoStorageService.create(createMockPhoto());
      await photoStorageService.delete(created.id!);

      const deleted = await photoStorageService.get(created.id!);
      expect(deleted).toBeNull();
    });

    it('does not throw error when deleting non-existent id', async () => {
      await expect(photoStorageService.delete(99999)).resolves.not.toThrow();
    });
  });

  // === Pagination ===
  describe('getPage()', () => {
    beforeEach(async () => {
      // Create 10 test photos
      for (let i = 1; i <= 10; i++) {
        await photoStorageService.create(createMockPhoto({ caption: `Photo ${i}` }));
      }
    });

    it('returns first page of photos with offset 0', async () => {
      const photos = await photoStorageService.getPage(0, 3);

      expect(photos).toHaveLength(3);
      expect(photos[0]).toHaveProperty('caption');
      expect(photos[0]).toHaveProperty('id');
    });

    it('returns photos sorted by date (newest first)', async () => {
      const photos = await photoStorageService.getPage(0, 10);

      // Should be sorted newest first (Photo 10, Photo 9, ...)
      expect(photos[0].caption).toBe('Photo 10');
      expect(photos[9].caption).toBe('Photo 1');
    });

    it('returns second page with correct offset', async () => {
      const firstPage = await photoStorageService.getPage(0, 3);
      const secondPage = await photoStorageService.getPage(3, 3);

      expect(firstPage).toHaveLength(3);
      expect(secondPage).toHaveLength(3);
      // Photos should not overlap
      expect(firstPage[0].id).not.toBe(secondPage[0].id);
    });

    it('returns partial page when near end', async () => {
      const page = await photoStorageService.getPage(9, 3); // Offset 9, limit 3

      expect(page).toHaveLength(1); // Only 1 photo left
    });

    it('returns empty array when beyond total items', async () => {
      const page = await photoStorageService.getPage(100, 3);

      expect(page).toEqual([]);
    });

    it('handles different page sizes', async () => {
      const smallPage = await photoStorageService.getPage(0, 2);
      const largePage = await photoStorageService.getPage(0, 5);

      expect(smallPage).toHaveLength(2);
      expect(largePage).toHaveLength(5);
    });
  });

  // === Storage Quota ===
  describe('getStorageSize()', () => {
    it('returns 0 for empty store', async () => {
      const size = await photoStorageService.getStorageSize();
      expect(size).toBe(0);
    });

    it('calculates total storage size of all photos', async () => {
      const blob1 = new Blob(['a'.repeat(1000)], { type: 'image/jpeg' });
      const blob2 = new Blob(['b'.repeat(2000)], { type: 'image/jpeg' });

      await photoStorageService.create(
        createMockPhoto({ imageBlob: blob1, compressedSize: blob1.size })
      );
      await photoStorageService.create(
        createMockPhoto({ imageBlob: blob2, compressedSize: blob2.size })
      );

      const totalSize = await photoStorageService.getStorageSize();
      expect(totalSize).toBe(3000); // 1000 + 2000
    });
  });

  describe('estimateQuotaRemaining()', () => {
    it('returns quota estimation with correct properties', async () => {
      const quota = await photoStorageService.estimateQuotaRemaining();

      expect(quota).toHaveProperty('used');
      expect(quota).toHaveProperty('quota');
      expect(quota).toHaveProperty('remaining');
      expect(quota).toHaveProperty('percentUsed');

      expect(quota.used).toBeGreaterThanOrEqual(0);
      expect(quota.quota).toBeGreaterThan(0);
      expect(quota.remaining).toBeGreaterThanOrEqual(0);
      expect(quota.percentUsed).toBeGreaterThanOrEqual(0);
      expect(quota.percentUsed).toBeLessThanOrEqual(100);
    });

    it('calculates quota correctly after storing photos', async () => {
      const quotaBefore = await photoStorageService.estimateQuotaRemaining();

      // Create a photo with known size
      const blob = new Blob(['a'.repeat(1000)], { type: 'image/jpeg' });
      await photoStorageService.create(createMockPhoto({ imageBlob: blob, compressedSize: 1000 }));

      const quotaAfter = await photoStorageService.estimateQuotaRemaining();

      // After adding a photo, used should increase (or stay same if IndexedDB overhead is small)
      expect(quotaAfter.used).toBeGreaterThanOrEqual(quotaBefore.used);
      // Remaining should decrease or stay same
      expect(quotaAfter.remaining).toBeLessThanOrEqual(quotaBefore.remaining);
    });
  });

  describe('clear()', () => {
    it('removes all photos from the store', async () => {
      await photoStorageService.create(createMockPhoto());
      await photoStorageService.create(createMockPhoto());

      await photoStorageService.clear();

      const allPhotos = await photoStorageService.getAll();
      expect(allPhotos).toHaveLength(0);
    });
  });

  describe('PhotoStorageService Validation', () => {
    beforeEach(async () => {
      await photoStorageService.init();
      await photoStorageService.clear();
    });

    describe('create() validation', () => {
      it('should reject photo with caption exceeding 500 chars', async () => {
        const longCaption = 'a'.repeat(501);
        const invalidPhoto = {
          imageBlob: new Blob(['test'], { type: 'image/jpeg' }),
          caption: longCaption,
          tags: [],
          uploadDate: new Date(),
          originalSize: 1000,
          compressedSize: 800,
          width: 100,
          height: 100,
          mimeType: 'image/jpeg' as const,
        };

        await expect(photoStorageService.create(invalidPhoto)).rejects.toThrow();
      });

      it('should reject photo with negative width', async () => {
        const invalidPhoto = {
          imageBlob: new Blob(['test'], { type: 'image/jpeg' }),
          caption: 'Valid caption',
          tags: [],
          uploadDate: new Date(),
          originalSize: 1000,
          compressedSize: 800,
          width: -100, // Invalid: negative
          height: 100,
          mimeType: 'image/jpeg' as const,
        };

        await expect(photoStorageService.create(invalidPhoto)).rejects.toThrow();
      });

      it('should reject photo with invalid MIME type', async () => {
        const invalidPhoto = {
          imageBlob: new Blob(['test'], { type: 'image/jpeg' }),
          caption: 'Valid caption',
          tags: [],
          uploadDate: new Date(),
          originalSize: 1000,
          compressedSize: 800,
          width: 100,
          height: 100,
          mimeType: 'image/invalid' as any, // Invalid MIME type
        };

        await expect(photoStorageService.create(invalidPhoto)).rejects.toThrow();
      });
    });

    describe('update() validation', () => {
      it('should reject update with caption exceeding 500 chars', async () => {
        const longCaption = 'a'.repeat(501);

        await expect(photoStorageService.update(1, { caption: longCaption })).rejects.toThrow();
      });

      it('should accept valid caption update', async () => {
        // Create a test photo first
        const validPhoto = {
          imageBlob: new Blob(['test'], { type: 'image/jpeg' }),
          caption: 'Initial caption',
          tags: [],
          uploadDate: new Date(),
          originalSize: 1000,
          compressedSize: 800,
          width: 100,
          height: 100,
          mimeType: 'image/jpeg' as const,
        };

        const created = await photoStorageService.create(validPhoto);

        // Update with valid data - should not throw
        const validUpdate = { caption: 'Valid caption under 500 chars' };
        await expect(photoStorageService.update(created.id!, validUpdate)).resolves.not.toThrow();

        // Verify update succeeded
        const updated = await photoStorageService.get(created.id!);
        expect(updated?.caption).toBe('Valid caption under 500 chars');
      });
    });

    // === P2 Edge Case Tests ===
    describe('edge cases', () => {
      it('should allow empty caption', async () => {
        const validPhoto = createMockPhoto({ caption: '' });

        await expect(photoStorageService.create(validPhoto)).resolves.toBeDefined();

        const created = await photoStorageService.create(validPhoto);
        expect(created.caption).toBe('');
      });

      it('should reject photo with zero width', async () => {
        const invalidPhoto = createMockPhoto({ width: 0 });

        await expect(photoStorageService.create(invalidPhoto)).rejects.toThrow();
      });

      it('should reject photo with zero height', async () => {
        const invalidPhoto = createMockPhoto({ height: 0 });

        await expect(photoStorageService.create(invalidPhoto)).rejects.toThrow();
      });

      it('should reject photo with negative height', async () => {
        const invalidPhoto = createMockPhoto({ height: -50 });

        await expect(photoStorageService.create(invalidPhoto)).rejects.toThrow();
      });

      it('should reject unsupported MIME type (image/gif)', async () => {
        const invalidPhoto = createMockPhoto({
          imageBlob: new Blob(['test'], { type: 'image/gif' }),
          mimeType: 'image/gif' as any,
        });

        await expect(photoStorageService.create(invalidPhoto)).rejects.toThrow();
      });

      it('should reject unsupported MIME type (image/bmp)', async () => {
        const invalidPhoto = createMockPhoto({
          imageBlob: new Blob(['test'], { type: 'image/bmp' }),
          mimeType: 'image/bmp' as any,
        });

        await expect(photoStorageService.create(invalidPhoto)).rejects.toThrow();
      });

      it('should handle very large blob sizes (quota handling)', async () => {
        // Create a ~5MB blob to test quota handling
        const largeBlob = new Blob([new ArrayBuffer(5 * 1024 * 1024)], { type: 'image/jpeg' });
        const largePhoto = createMockPhoto({
          imageBlob: largeBlob,
          originalSize: largeBlob.size,
          compressedSize: largeBlob.size,
        });

        // Should not throw error - just handle gracefully
        const created = await photoStorageService.create(largePhoto);
        expect(created).toBeDefined();
        expect(created.imageBlob.size).toBe(largeBlob.size);

        // Verify quota tracking is available (may be 0 in test environment)
        const quota = await photoStorageService.estimateQuotaRemaining();
        expect(quota.used).toBeGreaterThanOrEqual(0);
        expect(quota.quota).toBeGreaterThan(0);
        expect(quota.remaining).toBeGreaterThanOrEqual(0);
      });

      it('should track storage usage correctly with multiple large photos', async () => {
        const quotaBefore = await photoStorageService.estimateQuotaRemaining();

        // Add two large photos
        const blob1 = new Blob([new ArrayBuffer(1 * 1024 * 1024)], { type: 'image/jpeg' }); // 1MB
        const blob2 = new Blob([new ArrayBuffer(2 * 1024 * 1024)], { type: 'image/jpeg' }); // 2MB

        await photoStorageService.create(
          createMockPhoto({ imageBlob: blob1, compressedSize: blob1.size })
        );
        await photoStorageService.create(
          createMockPhoto({ imageBlob: blob2, compressedSize: blob2.size })
        );

        const quotaAfter = await photoStorageService.estimateQuotaRemaining();

        // In test environment (fake-indexeddb), quota may not update realistically
        // Just verify quota structure is correct
        expect(quotaAfter.used).toBeGreaterThanOrEqual(quotaBefore.used);
        expect(quotaAfter.remaining).toBeLessThanOrEqual(quotaBefore.remaining);
        expect(quotaAfter.percentUsed).toBeGreaterThanOrEqual(quotaBefore.percentUsed);
        expect(quotaAfter.quota).toBe(quotaBefore.quota); // Quota limit should not change
      });
    });
  });
}); // Close outer PhotoStorageService describe block
