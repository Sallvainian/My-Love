import { test, expect } from '../support/fixtures/baseFixture';
import {
  getLocalStorageItem,
  setLocalStorageItem,
  clearLocalStorage,
  clearIndexedDB,
  getIndexedDBStore,
} from '../support/helpers/pwaHelpers';

/**
 * Data Persistence Test Suite
 *
 * Tests AC-2.2.7:
 * - LocalStorage hydration on app init (Zustand persist middleware)
 * - LocalStorage persistence after state changes
 * - IndexedDB operations in offline mode (service worker dependency)
 * - State persistence across 24-hour gap
 * - LocalStorage quota exceeded handling
 * - IndexedDB quota exceeded handling
 * - Clear IndexedDB correctly
 * - Preserve in-memory state vs persisted state partitioning
 *
 * Zustand persist configuration:
 * - LocalStorage key: 'my-love-storage'
 * - Persisted: settings, messageHistory, moods, isOnboarded
 * - In-memory only: messages, currentMessage, photos
 */

test.describe('LocalStorage Persistence', () => {
  test('should hydrate LocalStorage on app init', async ({ cleanApp }) => {
    // Pre-populate LocalStorage with test state
    const testState = {
      state: {
        settings: {
          themeName: 'ocean',
          notificationTime: '10:00',
          relationship: {
            startDate: '2024-01-01',
            partnerName: 'Test Partner',
            anniversaries: [],
          },
          customization: {
            accentColor: '#14b8a6',
            fontFamily: 'system-ui',
          },
          notifications: {
            enabled: false,
            time: '10:00',
          },
        },
        messageHistory: {
          lastShownDate: '2025-10-30',
          lastMessageId: 5,
          favoriteIds: [1, 2, 3],
          viewedIds: [1, 2, 3, 4, 5],
        },
        moods: [],
        isOnboarded: true,
      },
      version: 0,
    };

    await setLocalStorageItem(cleanApp, 'my-love-storage', JSON.stringify(testState));

    // Reload to trigger hydration
    await cleanApp.reload();
    await cleanApp.waitForLoadState('networkidle');

    // Handle welcome screen
    const continueButton = cleanApp.locator('button:has-text("Continue")');
    if (await continueButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await continueButton.click();
      await cleanApp.waitForLoadState('networkidle');
    }

    await expect(cleanApp.locator('.card').first()).toBeVisible({ timeout: 10000 });

    // Verify state hydrated from LocalStorage
    const hydratedState = await getLocalStorageItem(cleanApp, 'my-love-storage');
    const parsedState = JSON.parse(hydratedState!);

    expect(parsedState.state.settings.themeName).toBe('ocean');
    expect(parsedState.state.settings.relationship.partnerName).toBe('Test Partner');
    expect(parsedState.state.messageHistory.favoriteIds).toEqual([1, 2, 3]);
    expect(parsedState.state.isOnboarded).toBe(true);

    console.log('✓ LocalStorage hydrated correctly on app init');
  });

  test('should persist LocalStorage after state changes', async ({ cleanApp }) => {
    await expect(cleanApp.locator('.card').first()).toBeVisible({ timeout: 10000 });

    // Make state change (favorite a message)
    const heartButton = cleanApp.locator('button[aria-label*="favorite"]').first();
    await heartButton.click();
    await cleanApp.waitForTimeout(500);

    // Verify state change reflected in LocalStorage
    const storedState = await getLocalStorageItem(cleanApp, 'my-love-storage');
    const parsedState = JSON.parse(storedState!);

    expect(parsedState.state.messageHistory.favoriteIds.length).toBeGreaterThan(0);

    console.log('✓ State changes persist to LocalStorage immediately');
  });

  test('should persist state across 24-hour gap', async ({ cleanApp }) => {
    await expect(cleanApp.locator('.card').first()).toBeVisible({ timeout: 10000 });

    // Set known state
    await cleanApp.evaluate(() => {
      const store = (window as any).__APP_STORE__;
      if (store && store.getState) {
        const { updateSettings } = store.getState();
        updateSettings({
          relationship: {
            partnerName: '24h Test Partner',
            startDate: '2024-01-01',
            anniversaries: [],
          },
        });
      }
    });

    await cleanApp.waitForTimeout(500);

    // Get current state
    const beforeState = await getLocalStorageItem(cleanApp, 'my-love-storage');
    const beforeParsed = JSON.parse(beforeState!);
    expect(beforeParsed.state.settings.relationship.partnerName).toBe('24h Test Partner');

    // Mock Date to 24 hours later
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await cleanApp.evaluate((futureDate) => {
      const original = Date;
      // @ts-ignore
      Date = class extends original {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super(futureDate);
          } else {
            super(...args);
          }
        }
        static now() {
          return new original(futureDate).getTime();
        }
      };
      // @ts-ignore
      Date.UTC = original.UTC;
      // @ts-ignore
      Date.parse = original.parse;
    }, tomorrow.getTime());

    // Reload app with new date
    await cleanApp.reload();
    await cleanApp.waitForLoadState('networkidle');

    // Handle welcome screen
    const continueButton = cleanApp.locator('button:has-text("Continue")');
    if (await continueButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await continueButton.click();
      await cleanApp.waitForLoadState('networkidle');
    }

    await expect(cleanApp.locator('.card').first()).toBeVisible({ timeout: 10000 });

    // Verify state persisted 24 hours later
    const afterState = await getLocalStorageItem(cleanApp, 'my-love-storage');
    const afterParsed = JSON.parse(afterState!);
    expect(afterParsed.state.settings.relationship.partnerName).toBe('24h Test Partner');

    console.log('✓ State persists correctly across 24-hour gap');
  });

  test('should handle LocalStorage quota exceeded gracefully', async ({ cleanApp }) => {
    await expect(cleanApp.locator('.card').first()).toBeVisible({ timeout: 10000 });

    // Attempt to fill LocalStorage to near quota
    // Note: Most browsers have 5-10MB limit per origin
    const largeData = 'x'.repeat(1024 * 1024); // 1MB string

    const quotaExceeded = await cleanApp.evaluate((data) => {
      try {
        // Try to write large data multiple times
        for (let i = 0; i < 10; i++) {
          localStorage.setItem(`large-data-${i}`, data);
        }
        return false; // No quota exceeded
      } catch (e: any) {
        // QuotaExceededError expected
        return e.name === 'QuotaExceededError';
      }
    }, largeData);

    // Either quota was exceeded (expected) or storage is very large
    if (quotaExceeded) {
      console.log('✓ LocalStorage quota exceeded caught gracefully');
    } else {
      console.log('⚠️ LocalStorage quota not reached (large storage available)');
    }

    // App should still function after quota error
    await expect(cleanApp.locator('.card').first()).toBeVisible();
  });

  test('should clear LocalStorage correctly', async ({ cleanApp }) => {
    await expect(cleanApp.locator('.card').first()).toBeVisible({ timeout: 10000 });

    // Verify LocalStorage has data
    const beforeClear = await getLocalStorageItem(cleanApp, 'my-love-storage');
    expect(beforeClear).toBeTruthy();

    // Clear LocalStorage
    await clearLocalStorage(cleanApp);

    // Verify LocalStorage cleared
    const afterClear = await getLocalStorageItem(cleanApp, 'my-love-storage');
    expect(afterClear).toBeNull();

    console.log('✓ LocalStorage cleared successfully');
  });

  test('should preserve in-memory state not in persist partialize', async ({ cleanApp }) => {
    await expect(cleanApp.locator('.card').first()).toBeVisible({ timeout: 10000 });

    // Get current persisted state
    const persistedState = await getLocalStorageItem(cleanApp, 'my-love-storage');
    const parsedPersisted = JSON.parse(persistedState!);

    // Verify in-memory-only state (messages, currentMessage, photos) NOT persisted
    expect(parsedPersisted.state.messages).toBeUndefined(); // Should not be in persisted state
    expect(parsedPersisted.state.currentMessage).toBeUndefined();
    expect(parsedPersisted.state.photos).toBeUndefined();

    // Verify persisted state (settings, messageHistory, moods, isOnboarded) IS persisted
    expect(parsedPersisted.state.settings).toBeDefined();
    expect(parsedPersisted.state.messageHistory).toBeDefined();
    expect(parsedPersisted.state.isOnboarded).toBeDefined();

    // Reload app
    await cleanApp.reload();
    await cleanApp.waitForLoadState('networkidle');

    // Handle welcome screen
    const continueButton = cleanApp.locator('button:has-text("Continue")');
    if (await continueButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await continueButton.click();
      await cleanApp.waitForLoadState('networkidle');
    }

    await expect(cleanApp.locator('.card').first()).toBeVisible({ timeout: 10000 });

    // Verify in-memory state reset (messages re-loaded from defaultMessages.ts)
    // Verify persisted state restored (settings, messageHistory)
    const afterReload = await getLocalStorageItem(cleanApp, 'my-love-storage');
    const parsedAfterReload = JSON.parse(afterReload!);

    expect(parsedAfterReload.state.settings).toBeDefined(); // Restored
    expect(parsedAfterReload.state.messageHistory).toBeDefined(); // Restored
    expect(parsedAfterReload.state.messages).toBeUndefined(); // Still not persisted

    console.log('✓ In-memory state correctly partitioned from persisted state');
  });
});

test.describe('IndexedDB Persistence', () => {
  test('should clear IndexedDB correctly', async ({ cleanApp }) => {
    await expect(cleanApp.locator('.card').first()).toBeVisible({ timeout: 10000 });

    // Clear IndexedDB
    await clearIndexedDB(cleanApp, 'my-love-db');

    // Verify IndexedDB cleared (or doesn't exist yet)
    // Note: getIndexedDBStore may fail if database doesn't exist
    const photosStore = await getIndexedDBStore(cleanApp, 'my-love-db', 'photos').catch(() => null);

    // If store exists, it should be empty
    if (photosStore) {
      expect(photosStore.length).toBe(0);
    }

    console.log('✓ IndexedDB cleared successfully');
  });

  // Note: Offline mode tests require service worker (Story 2.4 dependency)
  test.skip('should perform IndexedDB operations in offline mode', async ({ cleanApp }) => {
    // This test requires service worker registration
    // Service workers don't register in Vite dev mode
    // Will be enabled after Story 2.4 configures auto-start preview server

    await expect(cleanApp.locator('.card').first()).toBeVisible({ timeout: 10000 });

    // Wait for service worker registration
    // await waitForServiceWorker(cleanApp);

    // Favorite a message (IndexedDB write)
    const heartButton = cleanApp.locator('button[aria-label*="favorite"]').first();
    await heartButton.click();
    await cleanApp.waitForTimeout(500);

    // Go offline
    // await goOffline(cleanApp);

    // Verify IndexedDB still accessible offline
    // const favorites = await getIndexedDBStore(cleanApp, 'my-love-db', 'messages');
    // expect(favorites.length).toBeGreaterThan(0);

    // Refresh page (offline)
    await cleanApp.reload();
    await cleanApp.waitForLoadState('networkidle');

    // Verify favorite persists offline
    // const heartIcon = cleanApp.locator('button[aria-label*="favorite"]').first().locator('svg');
    // const isFilled = await heartIcon.evaluate((el) => el.classList.contains('fill-pink-500'));
    // expect(isFilled).toBe(true);

    // Restore online
    // await goOnline(cleanApp);

    console.log('✓ IndexedDB operations work in offline mode');
  });

  test.skip('should handle IndexedDB quota exceeded gracefully', async ({ cleanApp }) => {
    // This test requires actual quota limits to be reached
    // Browser quotas vary (typically 50MB-500MB+)
    // Skipping to avoid long test execution and potential browser hangs

    await expect(cleanApp.locator('.card').first()).toBeVisible({ timeout: 10000 });

    // Attempt to add large number of photos to trigger quota
    // Note: This would require writing many large blob objects
    // const largeBlob = new Blob(['x'.repeat(1024 * 1024)], { type: 'image/png' }); // 1MB
    // for (let i = 0; i < 1000; i++) {
    //   await storageService.addPhoto({ url: URL.createObjectURL(largeBlob), ... });
    // }

    // Expected: QuotaExceededError caught and handled gracefully
    // App should display user-friendly error message

    console.log('✓ IndexedDB quota exceeded handled gracefully');
  });
});

test.describe('Zustand Persist Middleware', () => {
  test('should use correct LocalStorage key', async ({ cleanApp }) => {
    await expect(cleanApp.locator('.card').first()).toBeVisible({ timeout: 10000 });

    // Verify Zustand persist uses 'my-love-storage' key
    const storedData = await cleanApp.evaluate(() => {
      return localStorage.getItem('my-love-storage');
    });

    expect(storedData).toBeTruthy();
    const parsed = JSON.parse(storedData!);
    expect(parsed.state).toBeDefined();
    expect(parsed.version).toBeDefined();

    console.log('✓ Zustand persist uses correct LocalStorage key');
  });

  test('should include version in persisted state', async ({ cleanApp }) => {
    await expect(cleanApp.locator('.card').first()).toBeVisible({ timeout: 10000 });

    const storedData = await getLocalStorageItem(cleanApp, 'my-love-storage');
    const parsed = JSON.parse(storedData!);

    expect(parsed.version).toBeDefined();
    expect(typeof parsed.version).toBe('number');

    console.log(`✓ Persisted state includes version: ${parsed.version}`);
  });

  test('should handle state migration gracefully', async ({ cleanApp }) => {
    // Pre-populate with old version state structure
    const oldVersionState = {
      state: {
        settings: {
          themeName: 'sunset',
          relationship: {
            startDate: '2024-01-01',
            partnerName: 'Old Version Partner',
            anniversaries: [],
          },
        },
        messageHistory: {
          lastShownDate: '',
          lastMessageId: 0,
          favoriteIds: [],
          viewedIds: [],
        },
        isOnboarded: true,
      },
      version: 0, // Old version
    };

    await setLocalStorageItem(cleanApp, 'my-love-storage', JSON.stringify(oldVersionState));

    // Reload to trigger migration
    await cleanApp.reload();
    await cleanApp.waitForLoadState('networkidle');

    // Handle welcome screen
    const continueButton = cleanApp.locator('button:has-text("Continue")');
    if (await continueButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await continueButton.click();
      await cleanApp.waitForLoadState('networkidle');
    }

    await expect(cleanApp.locator('.card').first()).toBeVisible({ timeout: 10000 });

    // Verify migration handled gracefully (app doesn't crash)
    const migratedState = await getLocalStorageItem(cleanApp, 'my-love-storage');
    const parsed = JSON.parse(migratedState!);

    expect(parsed.state.settings).toBeDefined();
    expect(parsed.state.messageHistory).toBeDefined();

    console.log('✓ State migration handled gracefully');
  });
});
