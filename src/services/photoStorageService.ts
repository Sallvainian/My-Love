import { openDB } from 'idb';
import type { Photo } from '../types';
import { BaseIndexedDBService } from './BaseIndexedDBService';
import { PhotoSchema } from '../validation/schemas';
import { createValidationError, isZodError } from '../validation/errorMessages';
import { ZodError } from 'zod';

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
      console.log('[PhotoStorage] Initializing IndexedDB (version 2)...');

      this.db = await openDB<any>(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion, _transaction) {
          console.log(`[PhotoStorage] Upgrading database from v${oldVersion} to v${newVersion}`);

          // Migration: Recreate photos store if upgrading from v1
          // v1 had photos store but with old schema (blob instead of imageBlob)
          if (oldVersion < 2) {
            // If photos store exists from v1, delete it
            if (db.objectStoreNames.contains('photos')) {
              db.deleteObjectStore('photos');
              console.log('[PhotoStorage] Deleted old photos store from v1');
            }

            // Create new photos store with enhanced schema
            const photosStore = db.createObjectStore('photos', {
              keyPath: 'id',
              autoIncrement: true,
            });
            photosStore.createIndex('by-date', 'uploadDate', { unique: false });
            console.log('[PhotoStorage] Created photos store with by-date index (v2)');
          }

          // Ensure messages store exists (should have been created in v1)
          if (!db.objectStoreNames.contains('messages')) {
            const messageStore = db.createObjectStore('messages', {
              keyPath: 'id',
              autoIncrement: true,
            });
            messageStore.createIndex('by-category', 'category');
            messageStore.createIndex('by-date', 'createdAt');
            console.log('[PhotoStorage] Created messages store (fallback)');
          }
        },
      });

      console.log('[PhotoStorage] IndexedDB initialized successfully (v2)');
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
    try {
      // Validate photo data before saving to IndexedDB
      const validated = PhotoSchema.parse(photo);

      const created = await super.add(validated);
      const sizeKB = (validated.compressedSize / 1024).toFixed(0);
      console.log(`[PhotoStorage] Saved photo ID: ${created.id}, size: ${sizeKB}KB, dimensions: ${validated.width}x${validated.height}`);

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
  }

  /**
   * Get all photos sorted by date (newest first)
   * Overrides base getAll() to use by-date index for efficient chronological retrieval
   *
   * @returns Array of photos (newest first)
   */
  async getAll(): Promise<Photo[]> {
    try {
      await this.init();

      // Use by-date index for sorted retrieval
      const photos = await this.db!.getAllFromIndex('photos', 'by-date');
      // Reverse to get newest first
      const sortedPhotos = photos.reverse();

      console.log(`[PhotoStorage] Retrieved ${sortedPhotos.length} photos (newest first)`);
      return sortedPhotos;
    } catch (error) {
      console.error('[PhotoStorage] Failed to load photos:', error);
      return []; // Graceful fallback: return empty array
    }
  }

  /**
   * Get paginated photos sorted by date (newest first)
   * Story 4.2: AC-4.2.4 - Lazy loading pagination
   * Overrides base getPage() to use by-date index for efficient pagination
   *
   * @param offset - Number of photos to skip (0 = first page)
   * @param limit - Number of photos to return per page (default: 20)
   * @returns Array of photos for the requested page
   */
  async getPage(offset: number = 0, limit: number = 20): Promise<Photo[]> {
    try {
      await this.init();

      // Get all photos sorted by date
      const allPhotos = await this.db!.getAllFromIndex('photos', 'by-date');
      // Reverse to get newest first
      const sortedPhotos = allPhotos.reverse();

      // Slice to get requested page
      const page = sortedPhotos.slice(offset, offset + limit);

      console.log(
        `[PhotoStorage] Retrieved page: offset=${offset}, limit=${limit}, returned=${page.length}, total=${sortedPhotos.length}`
      );

      return page;
    } catch (error) {
      console.error('[PhotoStorage] Failed to load photo page:', error);
      return []; // Graceful fallback
    }
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
      console.log(`[PhotoStorage] Updated photo ID: ${id}`);
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

      const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
      console.log(`[PhotoStorage] Total photo storage: ${sizeMB}MB (${photos.length} photos)`);

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
        const quota = estimate.quota || 50 * 1024 * 1024; // Default 50MB
        const remaining = quota - used;
        const percentUsed = (used / quota) * 100;

        const usedMB = (used / 1024 / 1024).toFixed(2);
        const quotaMB = (quota / 1024 / 1024).toFixed(2);
        console.log(`[PhotoStorage] Quota: ${usedMB}MB / ${quotaMB}MB (${percentUsed.toFixed(0)}% used)`);

        return { used, quota, remaining, percentUsed };
      } else {
        // Fallback for browsers without Storage API
        console.warn('[PhotoStorage] Storage API not available, using conservative default');
        const defaultQuota = 50 * 1024 * 1024; // 50MB
        return {
          used: 0,
          quota: defaultQuota,
          remaining: defaultQuota,
          percentUsed: 0,
        };
      }
    } catch (error) {
      console.error('[PhotoStorage] Failed to estimate quota:', error);
      const defaultQuota = 50 * 1024 * 1024;
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
