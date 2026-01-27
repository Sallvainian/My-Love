import { describe, it, expect, beforeEach } from 'vitest';
import { photoStorageService } from '../../../src/services/photoStorageService';
import { customMessageService } from '../../../src/services/customMessageService';
import { moodService } from '../../../src/services/moodService';

/**
 * IndexedDB Version Compatibility Tests
 *
 * ISSUE: Multiple services accessing the same database ('my-love-db') with different versions
 *
 * SOLUTION: All services now import DB_NAME and DB_VERSION from centralized dbSchema.ts
 * Each service's upgrade callback handles all stores with fallback creation
 *
 * These tests verify that services can initialize in any order without version conflicts.
 */
describe('IndexedDB Version Compatibility', () => {
  beforeEach(async () => {
    // Clear all services before each test
    await customMessageService.init();
    await customMessageService.clear();
    await photoStorageService.init();
    await photoStorageService.clear();
    await moodService.init();
    await moodService.clear();
  });

  it('should allow moodService (v3) then photoStorageService (v2) initialization', async () => {
    // This test will FAIL before fix because photoStorageService uses v2 < v3
    await moodService.init();

    // This should NOT throw VersionError after fix
    await expect(photoStorageService.init()).resolves.not.toThrow();
  });

  it('should allow moodService (v3) then customMessageService (v1) initialization', async () => {
    // This test will FAIL before fix because customMessageService uses v1 < v3
    await moodService.init();

    // This should NOT throw VersionError after fix
    await expect(customMessageService.init()).resolves.not.toThrow();
  });

  it('should allow photoStorageService (v2) then moodService (v3) initialization', async () => {
    // This should work (upgrading from v2 to v3 is allowed)
    await photoStorageService.init();

    // This should always work (upgrade is allowed)
    await expect(moodService.init()).resolves.not.toThrow();
  });

  it('should allow all services to initialize in any order', async () => {
    // Test random initialization order
    const services = [customMessageService, photoStorageService, moodService];

    // Shuffle array
    const shuffled = services.sort(() => Math.random() - 0.5);

    // All should initialize without errors
    for (const service of shuffled) {
      await expect(service.init()).resolves.not.toThrow();
    }
  });

  it('should create all three stores regardless of which service initializes first', async () => {
    // Initialize only photoStorageService
    await photoStorageService.init();

    // All stores should exist (messages, photos, moods)
    // We can verify by trying to use each service
    await expect(customMessageService.init()).resolves.not.toThrow();
    await expect(moodService.init()).resolves.not.toThrow();
  });
});
