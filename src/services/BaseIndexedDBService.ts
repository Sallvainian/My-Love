import type { IDBPDatabase, DBSchema } from 'idb';

/**
 * Base IndexedDB Service - Generic CRUD operations for IndexedDB stores
 * Story 5.3: Extract shared service logic to reduce ~80% code duplication
 *
 * Generic Type Constraints:
 * - T extends { id?: number }: Entity type with optional id field for IndexedDB auto-increment keys
 * - DBTypes extends DBSchema: Database schema type for type-safe IndexedDB operations
 * - Services provide concrete types: Message, Photo, MoodEntry
 *
 * Abstract Methods (services must implement):
 * - getStoreName(): Returns object store name ('messages', 'photos', 'moods')
 * - _doInit(): DB-specific initialization and schema upgrade logic
 *
 * Shared Methods (inherited by all services):
 * - init(): Initialization guard to prevent concurrent DB setup
 * - add(), get(), getAll(), update(), delete(), clear(): Standard CRUD
 * - getPage(): Pagination helper for lazy loading
 * - handleError(), handleQuotaExceeded(): Centralized error handling
 *
 * Error Handling Strategy:
 * - **Read operations** (get, getAll, getPage): Return null or empty array on error
 *   - Rationale: Graceful degradation - app continues functioning with empty state
 *   - Users see empty UI instead of crashes, can retry or reload
 * - **Write operations** (add, update, delete, clear): Throw errors on failure
 *   - Rationale: Data integrity - mutations must succeed or fail explicitly
 *   - Prevents silent data loss or inconsistent state
 *   - Allows callers to handle failures with proper user feedback
 */
export abstract class BaseIndexedDBService<T extends { id?: number }, DBTypes extends DBSchema = DBSchema> {
  protected db: IDBPDatabase<DBTypes> | null = null;
  protected initPromise: Promise<void> | null = null;

  /**
   * Initialize IndexedDB connection
   * Uses guard to prevent concurrent initialization
   *
   * Pattern: Single shared implementation across all services
   */
  async init(): Promise<void> {
    // Return existing promise if initialization already in progress
    if (this.initPromise) {
      if (import.meta.env.DEV) {
        console.log(`[${this.constructor.name}] Init already in progress, waiting...`);
      }
      return this.initPromise;
    }

    // Return immediately if already initialized
    if (this.db) {
      if (import.meta.env.DEV) {
        console.log(`[${this.constructor.name}] Already initialized`);
      }
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

  /**
   * Abstract method: Service-specific DB initialization
   * Each service implements its own schema creation and migration logic
   */
  protected abstract _doInit(): Promise<void>;

  /**
   * Abstract method: Get the object store name
   * Each service returns its store name: 'messages', 'photos', 'moods'
   */
  protected abstract getStoreName(): string;

  /**
   * Add a new item to the store
   * P2 FIX: Made protected to enforce validation through create() method
   * Services should expose create() which validates before calling add()
   * @param item - Item data (without id)
   * @returns Item with auto-generated id
   */
  protected async add(item: Omit<T, 'id'>): Promise<T> {
    try {
      await this.init();

      const storeName = this.getStoreName();
      const id = await (this.db! as any).add(storeName, item as T);
      if (import.meta.env.DEV) {
        console.log(`[${this.constructor.name}] Added item to ${storeName}, id: ${id}`);
      }

      return { ...item, id: id as number } as T;
    } catch (error) {
      this.handleError('add', error as Error);
    }
  }

  /**
   * Get a single item by ID
   * @param id - Item ID
   * @returns Item or null if not found
   */
  async get(id: number): Promise<T | null> {
    try {
      await this.init();

      const storeName = this.getStoreName();
      const item = await (this.db! as any).get(storeName, id);

      if (item) {
        if (import.meta.env.DEV) {
          console.log(`[${this.constructor.name}] Retrieved item from ${storeName}, id: ${id}`);
        }
      } else {
        console.warn(`[${this.constructor.name}] Item not found in ${storeName}, id: ${id}`);
      }

      return item || null;
    } catch (error) {
      console.error(`[${this.constructor.name}] Failed to get item ${id}:`, error);
      return null; // Graceful fallback
    }
  }

  /**
   * Get all items from the store
   * @returns Array of all items
   */
  async getAll(): Promise<T[]> {
    try {
      await this.init();

      const storeName = this.getStoreName();
      const items = await (this.db! as any).getAll(storeName);

      if (import.meta.env.DEV) {
        console.log(`[${this.constructor.name}] Retrieved ${items.length} items from ${storeName}`);
      }
      return items;
    } catch (error) {
      console.error(`[${this.constructor.name}] Failed to get all items:`, error);
      return []; // Graceful fallback: return empty array
    }
  }

  /**
   * Update an existing item
   * @param id - Item ID to update
   * @param updates - Partial item data to merge
   */
  async update(id: number, updates: Partial<T>): Promise<void> {
    try {
      await this.init();

      const storeName = this.getStoreName();
      const item = await (this.db! as any).get(storeName, id);

      if (!item) {
        throw new Error(`Item ${id} not found in ${storeName}`);
      }

      const updated: T = { ...item, ...updates };
      await (this.db! as any).put(storeName, updated);

      if (import.meta.env.DEV) {
        console.log(`[${this.constructor.name}] Updated item in ${storeName}, id: ${id}`);
      }
    } catch (error) {
      console.error(`[${this.constructor.name}] Failed to update item ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete an item by ID
   * @param id - Item ID to delete
   */
  async delete(id: number): Promise<void> {
    try {
      await this.init();

      const storeName = this.getStoreName();
      await (this.db! as any).delete(storeName, id);

      if (import.meta.env.DEV) {
        console.log(`[${this.constructor.name}] Deleted item from ${storeName}, id: ${id}`);
      }
    } catch (error) {
      console.error(`[${this.constructor.name}] Failed to delete item ${id}:`, error);
      throw error;
    }
  }

  /**
   * Clear all items from the store
   */
  async clear(): Promise<void> {
    try {
      await this.init();

      const storeName = this.getStoreName();
      await (this.db! as any).clear(storeName);

      if (import.meta.env.DEV) {
        console.log(`[${this.constructor.name}] Cleared all items from ${storeName}`);
      }
    } catch (error) {
      console.error(`[${this.constructor.name}] Failed to clear store:`, error);
      throw error;
    }
  }

  /**
   * Get paginated items using cursor-based pagination for efficiency
   * Replaces inefficient getAll().slice() with IDBCursor advancement
   *
   * Performance improvement:
   * - Before: O(n) - fetches ALL items, then slices (wasteful for large datasets)
   * - After: O(offset + limit) - advances cursor to offset, reads only needed items
   *
   * @param offset - Number of items to skip (0 = first page)
   * @param limit - Number of items to return
   * @returns Array of items for the requested page
   */
  async getPage(offset: number, limit: number): Promise<T[]> {
    try {
      await this.init();

      const storeName = this.getStoreName();
      const transaction = (this.db! as any).transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);

      const results: T[] = [];
      let cursor = await store.openCursor();
      let skipped = 0;
      let collected = 0;

      // Advance cursor to offset position
      while (cursor && skipped < offset) {
        cursor = await cursor.continue();
        skipped++;
      }

      // Collect items up to limit
      while (cursor && collected < limit) {
        results.push(cursor.value as T);
        collected++;
        cursor = await cursor.continue();
      }

      if (import.meta.env.DEV) {
        console.log(
          `[${this.constructor.name}] Retrieved page (cursor): offset=${offset}, limit=${limit}, returned=${results.length}`
        );
      }

      return results;
    } catch (error) {
      console.error(`[${this.constructor.name}] Failed to get page (cursor):`, error);
      return []; // Graceful fallback
    }
  }

  /**
   * Centralized error handling with logging
   * @param operation - Name of the operation that failed
   * @param error - Error object
   */
  protected handleError(operation: string, error: Error): never {
    console.error(`[${this.constructor.name}] Failed to ${operation}:`, error);
    console.error(`[${this.constructor.name}] Error details:`, {
      name: error.name,
      message: error.message,
    });
    throw error;
  }

  /**
   * Handle IndexedDB quota exceeded errors
   * Story 4.1: AC-4.1.9 - Quota warnings at 80%, error at 95%
   */
  protected handleQuotaExceeded(): never {
    const error = new Error('IndexedDB storage quota exceeded');
    console.error(`[${this.constructor.name}] Storage quota exceeded`);
    throw error;
  }
}
