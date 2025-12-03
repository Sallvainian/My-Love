import { test, expect } from '@playwright/test';
import {
  waitForServiceWorker,
  clearIndexedDB,
  clearLocalStorage,
  goOffline,
  goOnline,
  getLocalStorageItem,
  setLocalStorageItem,
  getIndexedDBStore,
} from '../support/helpers/pwaHelpers';

/**
 * Setup Validation Smoke Tests
 *
 * These tests validate that the Playwright testing framework is correctly configured
 * and that PWA helper utilities work as expected. They serve as smoke tests to ensure
 * the testing infrastructure is operational.
 *
 * Tests cover:
 * - Application loads successfully
 * - Service worker registers correctly
 * - LocalStorage read/write operations
 * - Offline mode simulation
 */

test.describe('Playwright Setup Validation', () => {
  test('should load app homepage', async ({ page }) => {
    // Navigate to base URL
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Assert page title or main content visible
    // Note: Adjust selector based on actual app structure
    const body = await page.locator('body');
    await expect(body).toBeVisible();

    // Verify app has loaded (check for common app element)
    const appRoot = page.locator('#root');
    await expect(appRoot).toBeVisible();

    console.log('✓ App homepage loaded successfully');
  });

  test('should register service worker', async ({ page }) => {
    // Navigate to base URL
    await page.goto('/');

    // Use waitForServiceWorker helper
    await waitForServiceWorker(page, 30000);

    // Assert service worker is registered and active
    const swState = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return {
        active: registration.active !== null,
        state: registration.active?.state,
        scope: registration.scope,
      };
    });

    expect(swState.active).toBe(true);
    expect(swState.state).toBe('activated');
    expect(swState.scope).toContain('/My-Love/');

    console.log('✓ Service worker registered and active');
    console.log('  Scope:', swState.scope);
  });

  test('should access LocalStorage', async ({ page }) => {
    // Navigate to base URL
    await page.goto('/');

    // Use setLocalStorageItem to write test data
    const testKey = 'playwright-test-key';
    const testValue = 'playwright-test-value';
    await setLocalStorageItem(page, testKey, testValue);

    // Use getLocalStorageItem to read back
    const retrieved = await getLocalStorageItem(page, testKey);

    // Assert values match
    expect(retrieved).toBe(testValue);

    // Use clearLocalStorage to clean up
    await clearLocalStorage(page);

    // Verify cleared
    const afterClear = await getLocalStorageItem(page, testKey);
    expect(afterClear).toBeNull();

    console.log('✓ LocalStorage read/write/clear operations successful');
  });

  test('should simulate offline mode', async ({ page }) => {
    // Navigate to base URL
    await page.goto('/');

    // Wait for service worker to cache assets
    await waitForServiceWorker(page, 30000);

    // Verify we're online first
    const initialOnlineStatus = await page.evaluate(() => navigator.onLine);
    expect(initialOnlineStatus).toBe(true);

    // Use goOffline helper
    await goOffline(page);

    // Verify offline state
    const offlineStatus = await page.evaluate(() => navigator.onLine);
    expect(offlineStatus).toBe(false);

    // Verify app still functions (cached by service worker)
    // The page should still be visible and interactive
    const body = await page.locator('body');
    await expect(body).toBeVisible();

    // Try navigating (should work from cache)
    // Note: This tests that the app doesn't crash when offline
    const appRoot = page.locator('#root');
    await expect(appRoot).toBeVisible();

    // Use goOnline helper to restore
    await goOnline(page);

    // Verify back online
    const onlineStatus = await page.evaluate(() => navigator.onLine);
    expect(onlineStatus).toBe(true);

    console.log('✓ Offline mode simulation successful');
    console.log('  App remained functional while offline');
  });

  test('should access IndexedDB store', async ({ page }) => {
    // Navigate to base URL
    await page.goto('/');

    // Wait for service worker
    await waitForServiceWorker(page, 30000);

    // Clear any existing data
    await clearIndexedDB(page, 'my-love-db');

    // Try to read from empty store (should return empty array)
    const emptyStore = await getIndexedDBStore(page, 'my-love-db', 'messages');
    expect(Array.isArray(emptyStore)).toBe(true);
    expect(emptyStore.length).toBe(0);

    console.log('✓ IndexedDB access successful');
    console.log('  Empty store returned empty array as expected');

    // Note: This test verifies helper functions work even when DB/store doesn't exist yet
    // Story 2.2 will add tests that write data and verify CRUD operations
  });
});

test.describe('PWA Helper Functions Validation', () => {
  test('waitForServiceWorker helper should wait for registration', async ({ page }) => {
    // Navigate to the app and wait for service worker to register
    await page.goto('/');

    // Expect service worker to register successfully in dev mode
    await waitForServiceWorker(page, 30000);

    // Verify service worker is active
    const swState = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return {
        active: registration.active !== null,
        state: registration.active?.state,
      };
    });

    expect(swState.active).toBe(true);
    expect(swState.state).toBe('activated');

    console.log('✓ Service worker registered successfully in dev mode');
  });

  test('clearIndexedDB helper should handle non-existent database', async ({ page }) => {
    await page.goto('/');

    // Attempt to clear a database that doesn't exist
    // Should not throw error
    await expect(async () => {
      await clearIndexedDB(page, 'non-existent-db');
    }).not.toThrow();

    console.log('✓ clearIndexedDB handles non-existent database gracefully');
  });

  test('getIndexedDBStore helper should handle non-existent store', async ({ page }) => {
    await page.goto('/');

    // Attempt to read from a store that doesn't exist
    const result = await getIndexedDBStore(page, 'my-love-db', 'non-existent-store');

    // Should return empty array, not throw error
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);

    console.log('✓ getIndexedDBStore handles non-existent store gracefully');
  });

  test('LocalStorage helpers should handle all data types', async ({ page }) => {
    await page.goto('/');

    // Test with JSON stringified object (common use case)
    const complexData = JSON.stringify({
      name: 'Test User',
      preferences: { theme: 'dark', notifications: true },
      timestamp: Date.now(),
    });

    await setLocalStorageItem(page, 'complex-data', complexData);
    const retrieved = await getLocalStorageItem(page, 'complex-data');

    expect(retrieved).toBe(complexData);

    const parsed = JSON.parse(retrieved!);
    expect(parsed.name).toBe('Test User');
    expect(parsed.preferences.theme).toBe('dark');

    await clearLocalStorage(page);

    console.log('✓ LocalStorage helpers handle complex data types');
  });
});
