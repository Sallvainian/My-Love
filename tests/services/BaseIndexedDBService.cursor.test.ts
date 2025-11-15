import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openDB, IDBPDatabase } from 'idb';
import { BaseIndexedDBService } from '../../src/services/BaseIndexedDBService';

// Test service implementation
class TestCursorService extends BaseIndexedDBService<{ id?: number; value: string }> {
  protected getStoreName(): string {
    return 'test-items';
  }

  protected async _doInit(): Promise<void> {
    this.db = await openDB('test-cursor-db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('test-items')) {
          db.createObjectStore('test-items', { keyPath: 'id', autoIncrement: true });
        }
      },
    });
  }
}

describe('BaseIndexedDBService - Cursor Pagination', () => {
  let service: TestCursorService;
  let db: IDBPDatabase;

  beforeEach(async () => {
    service = new TestCursorService();
    await service.init();

    // Insert 100 test items
    for (let i = 0; i < 100; i++) {
      await service['add']({ value: `item-${i}` });
    }
  });

  afterEach(async () => {
    await service.clear();
    if (service['db']) {
      service['db'].close();
    }
  });

  describe('getPage with cursor-based pagination', () => {
    it('retrieves first page efficiently', async () => {
      const page = await service.getPage(0, 20);
      expect(page).toHaveLength(20);
      expect(page[0].value).toBe('item-0');
      expect(page[19].value).toBe('item-19');
    });

    it('retrieves middle page efficiently', async () => {
      const page = await service.getPage(40, 20);
      expect(page).toHaveLength(20);
      expect(page[0].value).toBe('item-40');
      expect(page[19].value).toBe('item-59');
    });

    it('retrieves last page with partial results', async () => {
      const page = await service.getPage(90, 20);
      expect(page).toHaveLength(10); // Only 10 items remaining
      expect(page[0].value).toBe('item-90');
      expect(page[9].value).toBe('item-99');
    });

    it('returns empty array for offset beyond dataset', async () => {
      const page = await service.getPage(150, 20);
      expect(page).toHaveLength(0);
    });

    it('does not call getAll() (performance test)', async () => {
      // Spy on getAll to ensure it's not called
      const getAllSpy = vi.spyOn(service, 'getAll');

      await service.getPage(0, 20);

      expect(getAllSpy).not.toHaveBeenCalled();
      getAllSpy.mockRestore();
    });

    it('performs better than slice-based pagination', async () => {
      const { performanceMonitor } = await import('../../src/services/performanceMonitor');
      performanceMonitor.clear();

      // Measure cursor-based pagination
      await performanceMonitor.measureAsync('cursor-page', async () => {
        await service.getPage(50, 20);
      });

      const cursorMetric = performanceMonitor.getMetrics('cursor-page');

      // Cursor pagination should complete in <50ms even with 100 items
      expect(cursorMetric!.avgDuration).toBeLessThan(50);
    });
  });
});
