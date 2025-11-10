import { openDB, type IDBPDatabase } from 'idb';
import type { Photo } from '../types';

const DB_NAME = 'my-love-db';
const DB_VERSION = 2; // Story 4.1: Increment from 1 to 2 for photos store enhancement

/**
 * Photo Storage Service - IndexedDB CRUD operations for photos
 * Story 4.1: AC-4.1.7 - Save photos to IndexedDB with metadata
 *
 * Patterns followed from CustomMessageService:
 * - Singleton class with init() guard
 * - Comprehensive error handling and logging
 * - Graceful fallbacks for failures
 *
 * DB Migration: v1 → v2
 * - Version 1: Basic photos store existed but wasn't actively used
 * - Version 2: Enhanced Photo schema with compression metadata
 */
class PhotoStorageService {
  private db: IDBPDatabase<any> | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize IndexedDB connection with DB version 2
   * Story 4.1: Migrate from v1 to v2 if needed
   */
  async init(): Promise<void> {
    // Return existing promise if initialization already in progress
    if (this.initPromise) {
      console.log('[PhotoStorage] Init already in progress, waiting...');
      return this.initPromise;
    }

    // Return immediately if already initialized
    if (this.db) {
      console.log('[PhotoStorage] Already initialized');
      return Promise.resolve();
    }

    // Store promise to prevent concurrent initialization
    this.initPromise = this._doInit();

    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private async _doInit(): Promise<void> {
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
      console.error('[PhotoStorage] Failed to initialize IndexedDB:', error);
      console.error('[PhotoStorage] Error details:', {
        name: (error as Error).name,
        message: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Create a new photo in IndexedDB
   * AC-4.1.7: Save with full metadata (imageBlob, caption, tags, sizes, dimensions)
   *
   * @param photo - Photo data (without id)
   * @returns Photo with auto-generated id
   */
  async create(photo: Omit<Photo, 'id'>): Promise<Photo> {
    try {
      await this.init();

      const id = await this.db!.add('photos', photo as Photo);
      const sizeKB = (photo.compressedSize / 1024).toFixed(0);
      console.log(`[PhotoStorage] Saved photo ID: ${id}, size: ${sizeKB}KB, dimensions: ${photo.width}x${photo.height}`);

      return { ...photo, id: id as number } as Photo;
    } catch (error) {
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
   * Uses by-date index for efficient chronological retrieval
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
   * Get single photo by ID
   *
   * @param photoId - Photo ID to retrieve
   * @returns Photo or null if not found
   */
  async getById(photoId: number): Promise<Photo | null> {
    try {
      await this.init();

      const photo = await this.db!.get('photos', photoId);
      if (photo) {
        console.log(`[PhotoStorage] Retrieved photo ID: ${photoId}`);
      } else {
        console.warn(`[PhotoStorage] Photo not found: ${photoId}`);
      }

      return photo || null;
    } catch (error) {
      console.error(`[PhotoStorage] Failed to get photo ${photoId}:`, error);
      return null; // Graceful fallback
    }
  }

  /**
   * Update existing photo
   * Story 4.4 will use this for edit functionality
   *
   * @param photoId - Photo ID to update
   * @param updates - Partial photo data to update
   */
  async update(photoId: number, updates: Partial<Photo>): Promise<void> {
    try {
      await this.init();

      const photo = await this.getById(photoId);
      if (!photo) {
        throw new Error(`Photo ${photoId} not found`);
      }

      const updated: Photo = { ...photo, ...updates };
      await this.db!.put('photos', updated);

      console.log(`[PhotoStorage] Updated photo ID: ${photoId}`);
    } catch (error) {
      console.error(`[PhotoStorage] Failed to update photo ${photoId}:`, error);
      throw error;
    }
  }

  /**
   * Delete photo by ID
   * Story 4.4 will use this for delete functionality
   *
   * @param photoId - Photo ID to delete
   */
  async delete(photoId: number): Promise<void> {
    try {
      await this.init();

      await this.db!.delete('photos', photoId);
      console.log(`[PhotoStorage] Deleted photo ID: ${photoId}`);
    } catch (error) {
      console.error(`[PhotoStorage] Failed to delete photo ${photoId}:`, error);
      throw error;
    }
  }

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
