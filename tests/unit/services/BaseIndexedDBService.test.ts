/**
 * Unit tests for BaseIndexedDBService
 * Target coverage: 85%+
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openDB, type IDBPDatabase } from 'idb';
import { BaseIndexedDBService } from '@/services/BaseIndexedDBService';

// Test entity type
interface TestItem {
  id?: number;
  name: string;
  value: number;
  createdAt: Date;
}

// Concrete implementation for testing
class TestService extends BaseIndexedDBService<TestItem> {
  protected getStoreName(): string {
    return 'test-items';
  }

  protected async _doInit(): Promise<void> {
    this.db = await openDB('test-db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('test-items')) {
          db.createObjectStore('test-items', {
            keyPath: 'id',
            autoIncrement: true,
          });
        }
      },
    });
  }

  // P2 FIX: Public wrapper for testing protected add() method
  // In production, services expose create() which validates before calling add()
  async testAdd(item: Omit<TestItem, 'id'>): Promise<TestItem> {
    return super.add(item);
  }
}

describe('BaseIndexedDBService', () => {
  let service: TestService;

  beforeEach(() => {
    service = new TestService();
  });

  describe('init', () => {
    it('initializes database connection', async () => {
      await service.init();
      expect((service as any).db).not.toBeNull();
    });

    it('only initializes once for multiple calls', async () => {
      const spy = vi.spyOn(service as any, '_doInit');

      await Promise.all([service.init(), service.init(), service.init()]);

      // Should only be called once
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('returns immediately if already initialized', async () => {
      await service.init();
      const spy = vi.spyOn(service as any, '_doInit');

      await service.init();

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('add', () => {
    it('adds item to store and returns with id', async () => {
      const newItem: Omit<TestItem, 'id'> = {
        name: 'Test Item',
        value: 42,
        createdAt: new Date(),
      };

      const added = await service.testAdd(newItem);

      expect(added.id).toBeDefined();
      expect(added.name).toBe(newItem.name);
      expect(added.value).toBe(newItem.value);
    });

    it('auto-increments ids for multiple items', async () => {
      const item1 = await service.testAdd({
        name: 'Item 1',
        value: 1,
        createdAt: new Date(),
      });
      const item2 = await service.testAdd({
        name: 'Item 2',
        value: 2,
        createdAt: new Date(),
      });

      expect(item2.id).toBeGreaterThan(item1.id!);
    });

    it('initializes service before adding', async () => {
      const spy = vi.spyOn(service, 'init');

      await service.testAdd({
        name: 'Test',
        value: 1,
        createdAt: new Date(),
      });

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('retrieves item by id', async () => {
      const added = await service.testAdd({
        name: 'Test Item',
        value: 42,
        createdAt: new Date(),
      });

      const retrieved = await service.get(added.id!);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(added.id);
      expect(retrieved!.name).toBe(added.name);
    });

    it('returns null for non-existent id', async () => {
      const result = await service.get(99999);
      expect(result).toBeNull();
    });

    it('handles errors gracefully', async () => {
      // Break the db connection
      (service as any).db = null;
      vi.spyOn(service as any, '_doInit').mockRejectedValueOnce(new Error('DB init failed'));

      const result = await service.get(1);
      expect(result).toBeNull();
    });
  });

  describe('getAll', () => {
    it('returns all items from store', async () => {
      await service.testAdd({ name: 'Item 1', value: 1, createdAt: new Date() });
      await service.testAdd({ name: 'Item 2', value: 2, createdAt: new Date() });
      await service.testAdd({ name: 'Item 3', value: 3, createdAt: new Date() });

      const items = await service.getAll();

      expect(items).toHaveLength(3);
      expect(items.map((i) => i.name)).toEqual(['Item 1', 'Item 2', 'Item 3']);
    });

    it('returns empty array when store is empty', async () => {
      const items = await service.getAll();
      expect(items).toEqual([]);
    });

    it('handles errors gracefully', async () => {
      (service as any).db = null;
      vi.spyOn(service as any, '_doInit').mockRejectedValueOnce(new Error('DB init failed'));

      const result = await service.getAll();
      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('updates existing item', async () => {
      const added = await service.testAdd({
        name: 'Original',
        value: 1,
        createdAt: new Date(),
      });

      await service.update(added.id!, { name: 'Updated', value: 2 });

      const retrieved = await service.get(added.id!);
      expect(retrieved!.name).toBe('Updated');
      expect(retrieved!.value).toBe(2);
    });

    it('merges partial updates with existing data', async () => {
      const added = await service.testAdd({
        name: 'Original',
        value: 1,
        createdAt: new Date('2024-01-01'),
      });

      await service.update(added.id!, { value: 999 });

      const retrieved = await service.get(added.id!);
      expect(retrieved!.name).toBe('Original'); // Unchanged
      expect(retrieved!.value).toBe(999); // Updated
    });

    it('throws error for non-existent id', async () => {
      await expect(service.update(99999, { name: 'Updated' })).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('deletes item by id', async () => {
      const added = await service.testAdd({
        name: 'To Delete',
        value: 1,
        createdAt: new Date(),
      });

      await service.delete(added.id!);

      const retrieved = await service.get(added.id!);
      expect(retrieved).toBeNull();
    });

    it('does not error when deleting non-existent id', async () => {
      // IndexedDB delete is idempotent
      await expect(service.delete(99999)).resolves.not.toThrow();
    });

    it('removes item from getAll results', async () => {
      const item1 = await service.testAdd({ name: 'Item 1', value: 1, createdAt: new Date() });
      const item2 = await service.add({ name: 'Item 2', value: 2, createdAt: new Date() });

      await service.delete(item1.id!);

      const items = await service.getAll();
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe(item2.id);
    });
  });

  describe('clear', () => {
    it('removes all items from store', async () => {
      await service.testAdd({ name: 'Item 1', value: 1, createdAt: new Date() });
      await service.testAdd({ name: 'Item 2', value: 2, createdAt: new Date() });
      await service.testAdd({ name: 'Item 3', value: 3, createdAt: new Date() });

      await service.clear();

      const items = await service.getAll();
      expect(items).toHaveLength(0);
    });

    it('handles empty store gracefully', async () => {
      await expect(service.clear()).resolves.not.toThrow();
    });
  });

  describe('getPage', () => {
    beforeEach(async () => {
      // Add 10 test items
      for (let i = 1; i <= 10; i++) {
        await service.testAdd({
          name: `Item ${i}`,
          value: i,
          createdAt: new Date(),
        });
      }
    });

    it('returns first page of items', async () => {
      const page = await service.getPage(0, 3);

      expect(page).toHaveLength(3);
      expect(page[0].name).toBe('Item 1');
      expect(page[1].name).toBe('Item 2');
      expect(page[2].name).toBe('Item 3');
    });

    it('returns second page with offset', async () => {
      const page = await service.getPage(3, 3);

      expect(page).toHaveLength(3);
      expect(page[0].name).toBe('Item 4');
      expect(page[1].name).toBe('Item 5');
      expect(page[2].name).toBe('Item 6');
    });

    it('returns partial page when near end', async () => {
      const page = await service.getPage(8, 5);

      expect(page).toHaveLength(2); // Only 2 items remaining
      expect(page[0].name).toBe('Item 9');
      expect(page[1].name).toBe('Item 10');
    });

    it('returns empty array when offset beyond data', async () => {
      const page = await service.getPage(100, 10);
      expect(page).toEqual([]);
    });

    it('handles zero limit', async () => {
      const page = await service.getPage(0, 0);
      expect(page).toEqual([]);
    });

    it('handles errors gracefully', async () => {
      (service as any).db = null;
      vi.spyOn(service as any, '_doInit').mockRejectedValueOnce(new Error('DB init failed'));

      const result = await service.getPage(0, 10);
      expect(result).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('logs and throws errors from add operation', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Force an error by closing the db
      await service.init();
      const db = (service as any).db as IDBPDatabase;
      db.close();
      (service as any).db = null;
      (service as any).initPromise = null;

      // Mock _doInit to throw error
      vi.spyOn(service as any, '_doInit').mockRejectedValueOnce(new Error('DB error'));

      await expect(
        service.testAdd({ name: 'Test', value: 1, createdAt: new Date() })
      ).rejects.toThrow();

      consoleSpy.mockRestore();
    });

    it('throws error from handleError method', () => {
      const error = new Error('Test error');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        (service as any).handleError('test-operation', error);
      }).toThrow('Test error');

      consoleSpy.mockRestore();
    });

    it('throws quota exceeded error', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        (service as any).handleQuotaExceeded();
      }).toThrow('IndexedDB storage quota exceeded');

      consoleSpy.mockRestore();
    });
  });

  describe('concurrent operations', () => {
    it('handles concurrent add operations', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        service.testAdd({
          name: `Concurrent Item ${i}`,
          value: i,
          createdAt: new Date(),
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      // All should have unique ids
      const ids = results.map((r) => r.id);
      expect(new Set(ids).size).toBe(5);
    });

    it('handles concurrent read operations', async () => {
      const item = await service.add({
        name: 'Test',
        value: 1,
        createdAt: new Date(),
      });

      const promises = Array.from({ length: 10 }, () => service.get(item.id!));

      const results = await Promise.all(promises);

      // All should return the same item
      results.forEach((result) => {
        expect(result).not.toBeNull();
        expect(result!.id).toBe(item.id);
      });
    });
  });
});
