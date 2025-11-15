import { openDB } from 'idb';
import type { Photo } from '../types';
import { BaseIndexedDBService } from './BaseIndexedDBService';
import { PhotoSchema } from '../validation/schemas';
import { createValidationError, isZodError } from '../validation/errorMessages';
import { ZodError } from 'zod';
import {
  PAGINATION,
  STORAGE_QUOTAS,
  BYTES_PER_KB,
  BYTES_PER_MB,
} from '../config/performance';
import { performanceMonitor } from './performanceMonitor';

const DB_NAME = 'my-love-db';
const DB_VERSION = 2; // Story 4.1: Increment from 1 to 2 for photos store enhancement

/**
 * Photo Storage Service - IndexedDB CRUD operations for photos
 * Story 4.1: AC-4.1.7 - Save photos to IndexedDB with metadata
 * Story 5.3: Refactored to extend BaseIndexedDBService to reduce duplication
 *
 * Extends: BaseIndexedDBService<Photo>
 * - Inherits: init(), add(), get(), update(), delete(), clear(), getPage()
 * - Implements: getStoreName(), _doInit()
 * - Overrides: getAll() (uses 'by-date' index), getPage() (custom pagination)
 * - Preserves: Service-specific methods (getStorageSize, estimateQuotaRemaining)
 *
 * DB Migration: v1 → v2
 * - Version 1: Basic photos store existed but wasn't actively used
 * - Version 2: Enhanced Photo schema with compression metadata
 */
class PhotoStorageService extends BaseIndexedDBService<Photo> {
  /**
   * Get the object store name for photos
   */
  protected getStoreName(): string {
    return 'photos';
  }

  /**
   * Initialize IndexedDB connection with DB version 2
   * Story 4.1: Migrate from v1 to v2 if needed
   */
  protected async _doInit(): Promise<void> {
    try {
      if (import.meta.env.DEV) {
        console.log('[PhotoStorage] Initializing IndexedDB (version 2)...');
      }

      this.db = await openDB<any>(DB_NAME, DB_VERSION, {
        async upgrade(db, oldVersion, newVersion, transaction) {
          if (import.meta.env.DEV) {
            console.log(`[PhotoStorage] Upgrading database from v${oldVersion} to v${newVersion}`);
          }

          // Migration: v1 → v2 with data preservation
          // v1 had photos store but with old schema (blob instead of imageBlob)
          if (oldVersion < 2) {
            let migratedPhotos: any[] = [];

            // Step 1: Preserve existing v1 photos before deleting store
            if (db.objectStoreNames.contains('photos')) {
              const oldPhotosStore = transaction.objectStore('photos');
              const allV1Photos = await oldPhotosStore.getAll();

              if (import.meta.env.DEV) {
                console.log(`[PhotoStorage] Found ${allV1Photos.length} photos to migrate from v1`);
              }

              // Step 2: Transform v1 schema to v2 schema (blob → imageBlob)
              migratedPhotos = allV1Photos.map((photo: any) => ({
                ...photo,
                imageBlob: photo.blob,  // Rename blob → imageBlob
                // Remove old 'blob' field to avoid duplication
                blob: undefined,
              }));

              // Step 3: Delete old v1 store
              db.deleteObjectStore('photos');
              if (import.meta.env.DEV) {
                console.log('[PhotoStorage] Deleted old photos store from v1');
              }
            }

            // Step 4: Create new v2 photos store with enhanced schema
            const photosStore = db.createObjectStore('photos', {
              keyPath: 'id',
              autoIncrement: true,
            });
            photosStore.createIndex('by-date', 'uploadDate', { unique: false });
            if (import.meta.env.DEV) {
              console.log('[PhotoStorage] Created photos store with by-date index (v2)');
            }

            // Step 5: Re-insert migrated photos into new v2 store
            if (migratedPhotos.length > 0) {
              for (const photo of migratedPhotos) {
                // Remove undefined blob field before inserting
                const { blob, ...cleanPhoto } = photo;
                await photosStore.add(cleanPhoto);
              }
              if (import.meta.env.DEV) {
                console.log(`[PhotoStorage] Successfully migrated ${migratedPhotos.length} photos to v2 schema`);
              }
            }
          }

          // Ensure messages store exists (should have been created in v1)
          if (!db.objectStoreNames.contains('messages')) {
            const messageStore = db.createObjectStore('messages', {
              keyPath: 'id',
              autoIncrement: true,
            });
            messageStore.createIndex('by-category', 'category');
            messageStore.createIndex('by-date', 'createdAt');
            if (import.meta.env.DEV) {
              console.log('[PhotoStorage] Created messages store (fallback)');
            }
          }
        },
      });

      if (import.meta.env.DEV) {
        console.log('[PhotoStorage] IndexedDB initialized successfully (v2)');
      }
    } catch (error) {
      this.handleError('initialize', error as Error);
    }
  }

  /**
   * Create a new photo in IndexedDB
   * AC-4.1.7: Save with full metadata (imageBlob, caption, tags, sizes, dimensions)
   * Story 5.5: Added runtime validation with Zod schema
   * Uses inherited add() method from base class
   *
   * @param photo - Photo data (without id)
   * @returns Photo with auto-generated id
   * @throws {ValidationError} if photo data is invalid
   */
  async create(photo: Omit<Photo, 'id'>): Promise<Photo> {
    return performanceMonitor.measureAsync('photo-create', async () => {
      try {
        // Validate photo data before saving to IndexedDB
        const validated = PhotoSchema.parse(photo);

        const created = await super.add(validated);

        // Record photo size metric
        performanceMonitor.recordMetric('photo-size-kb', validated.compressedSize / BYTES_PER_KB);

        if (import.meta.env.DEV) {
          const sizeKB = (validated.compressedSize / BYTES_PER_KB).toFixed(0);
          console.log(`[PhotoStorage] Saved photo ID: ${created.id}, size: ${sizeKB}KB, dimensions: ${validated.width}x${validated.height}`);
        }

        return created;
      } catch (error) {
        // Transform Zod validation errors into user-friendly messages
        if (isZodError(error)) {
          throw createValidationError(error as ZodError);
        }

        console.error('[PhotoStorage] Failed to save photo:', error);
        console.error('[PhotoStorage] Photo data:', {
          caption: photo.caption?.substring(0, 50),
          tags: photo.tags,
          size: photo.compressedSize,
        });
        throw error;
      }
    });
  }

  /**
   * Get all photos sorted by date (newest first)
   * Overrides base getAll() to use by-date index for efficient chronological retrieval
   *
   * @returns Array of photos (newest first)
   */
  async getAll(): Promise<Photo[]> {
    return performanceMonitor.measureAsync('photo-getAll', async () => {
      try {
        await this.init();

        // Use by-date index for sorted retrieval
        const photos = await this.db!.getAllFromIndex('photos', 'by-date');
        // Reverse to get newest first
        const sortedPhotos = photos.reverse();

        if (import.meta.env.DEV) {
          console.log(`[PhotoStorage] Retrieved ${sortedPhotos.length} photos (newest first)`);
        }
        return sortedPhotos;
      } catch (error) {
        console.error('[PhotoStorage] Failed to load photos:', error);
        return []; // Graceful fallback: return empty array
      }
    });
  }

  /**
   * Get paginated photos sorted by date (newest first) using cursor
   * Story 4.2: AC-4.2.4 - Lazy loading pagination
   * Overrides base getPage() to use by-date index with descending cursor
   *
   * Performance: O(offset + limit) instead of O(n) with slice approach
   *
   * @param offset - Number of photos to skip (0 = first page)
   * @param limit - Number of photos to return per page (default: 20)
   * @returns Array of photos for the requested page (newest first)
   */
  async getPage(offset: number = 0, limit: number = PAGINATION.DEFAULT_PAGE_SIZE): Promise<Photo[]> {
    return performanceMonitor.measureAsync('photo-getPage', async () => {
      try {
        await this.init();

        const transaction = this.db!.transaction('photos', 'readonly');
        const index = transaction.objectStore('photos').index('by-date');

        const results: Photo[] = [];
        let cursor = await index.openCursor(null, 'prev'); // 'prev' = descending order
        let skipped = 0;
        let collected = 0;

        // Advance cursor to offset position
        while (cursor && skipped < offset) {
          cursor = await cursor.continue();
          skipped++;
        }

        // Collect photos up to limit
        while (cursor && collected < limit) {
          results.push(cursor.value as Photo);
          collected++;
          cursor = await cursor.continue();
        }

        if (import.meta.env.DEV) {
          console.log(
            `[PhotoStorage] Retrieved page (cursor): offset=${offset}, limit=${limit}, returned=${results.length}`
          );
        }

        return results;
      } catch (error) {
        console.error('[PhotoStorage] Failed to load photo page (cursor):', error);
        return []; // Graceful fallback
      }
    });
  }

  /**
   * Update an existing photo in IndexedDB
   * Story 5.5: Override to add runtime validation with Zod schema
   * Overrides inherited update() method from base class
   *
   * @param id - Photo ID to update
   * @param updates - Partial photo data to update
   * @throws {ValidationError} if update data is invalid
   */
  async update(id: number, updates: Partial<Photo>): Promise<void> {
    try {
      // Validate partial update data
      // Use partial schema to allow updating individual fields
      const validated = PhotoSchema.partial().parse(updates);

      await super.update(id, validated);
      if (import.meta.env.DEV) {
        console.log(`[PhotoStorage] Updated photo ID: ${id}`);
      }
    } catch (error) {
      // Transform Zod validation errors into user-friendly messages
      if (isZodError(error)) {
        throw createValidationError(error as ZodError);
      }

      console.error('[PhotoStorage] Failed to update photo:', error);
      console.error('[PhotoStorage] Update data:', updates);
      throw error;
    }
  }

  /**
   * Note: get() and delete() methods are inherited from BaseIndexedDBService
   * - get(id: number): Promise<Photo | null> - Get photo by ID (replaces getById)
   * - delete(id: number): Promise<void> - Delete photo by ID
   */

  /**
   * Get total storage size used by all photos
   * AC-4.1.9: Calculate storage usage for quota warnings
   *
   * @returns Total compressed size of all photos in bytes
   */
  async getStorageSize(): Promise<number> {
    try {
      const photos = await this.getAll();
      const totalSize = photos.reduce((total, photo) => total + photo.compressedSize, 0);

      if (import.meta.env.DEV) {
        const sizeMB = (totalSize / BYTES_PER_MB).toFixed(2);
        console.log(`[PhotoStorage] Total photo storage: ${sizeMB}MB (${photos.length} photos)`);
      }

      return totalSize;
    } catch (error) {
      console.error('[PhotoStorage] Failed to calculate storage size:', error);
      return 0; // Graceful fallback
    }
  }

  /**
   * Estimate remaining IndexedDB quota
   * AC-4.1.9: Quota warnings at 80%, error at 95%
   *
   * @returns Object with usage, quota, and remaining bytes
   */
  async estimateQuotaRemaining(): Promise<{
    used: number;
    quota: number;
    remaining: number;
    percentUsed: number;
  }> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        const quota = estimate.quota || STORAGE_QUOTAS.DEFAULT_QUOTA_BYTES;
        const remaining = quota - used;
        const percentUsed = (used / quota) * 100;

        if (import.meta.env.DEV) {
          const usedMB = (used / BYTES_PER_MB).toFixed(2);
          const quotaMB = (quota / BYTES_PER_MB).toFixed(2);
          console.log(`[PhotoStorage] Quota: ${usedMB}MB / ${quotaMB}MB (${percentUsed.toFixed(0)}% used)`);
        }

        return { used, quota, remaining, percentUsed };
      } else {
        // Fallback for browsers without Storage API
        console.warn('[PhotoStorage] Storage API not available, using conservative default');
        const defaultQuota = STORAGE_QUOTAS.DEFAULT_QUOTA_BYTES;
        return {
          used: 0,
          quota: defaultQuota,
          remaining: defaultQuota,
          percentUsed: 0,
        };
      }
    } catch (error) {
      console.error('[PhotoStorage] Failed to estimate quota:', error);
      const defaultQuota = STORAGE_QUOTAS.DEFAULT_QUOTA_BYTES;
      return {
        used: 0,
        quota: defaultQuota,
        remaining: defaultQuota,
        percentUsed: 0,
      };
    }
  }
}

// Singleton instance
export const photoStorageService = new PhotoStorageService();
