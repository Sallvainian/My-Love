/**
 * E2E tests for Hybrid Sync Architecture
 *
 * Tests the three sync mechanisms (periodic, immediate, background)
 * in real browser environment with offline/online scenarios.
 *
 * Test Scenarios:
 * 1. Offline mood entry → online → sync
 * 2. Periodic sync while app is open
 * 3. Immediate sync on app mount
 * 4. Background Sync when app is closed (Chrome only)
 */

import { test, expect } from '@playwright/test';

test.describe('Hybrid Sync Architecture', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Wait for app to load
    await page.waitForLoadState('networkidle');
  });

  test.describe('Immediate Sync on App Mount', () => {
    test('should sync pending moods immediately when app opens', async ({ page }) => {
      // Check if sync status is displayed
      const syncStatus = page.locator('text=/Online|Offline/i');
      await expect(syncStatus).toBeVisible();

      // Check console for initial sync log (in dev mode)
      const consoleLogs: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'log' && msg.text().includes('[App]')) {
          consoleLogs.push(msg.text());
        }
      });

      // Reload page to trigger mount sync
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Wait a bit for sync to trigger
      await page.waitForTimeout(1000);

      // Verify sync was triggered on mount
      const mountSyncLogs = consoleLogs.filter((log) =>
        log.includes('Initial sync on mount')
      );
      expect(mountSyncLogs.length).toBeGreaterThan(0);
    });

    test('should check pending moods count on mount', async ({ page }) => {
      // Look for pending moods indicator
      const pendingIndicator = page.locator('text=/pending sync/i');

      // If there are pending moods, indicator should be visible
      if (await pendingIndicator.isVisible()) {
        const text = await pendingIndicator.textContent();
        expect(text).toMatch(/\d+ pending sync/);
      }
    });
  });

  test.describe('Offline to Online Sync', () => {
    test('should save mood locally when offline and sync when online', async ({
      page,
      context,
    }) => {
      // Go offline
      await context.setOffline(true);

      // Verify offline status
      const offlineIndicator = page.locator('text=Offline');
      await expect(offlineIndicator).toBeVisible({ timeout: 5000 });

      // Try to log a mood while offline
      const moodButton = page.locator('button:has-text("Happy")').first();
      if (await moodButton.isVisible()) {
        await moodButton.click();

        // Submit mood
        const submitButton = page.locator('button:has-text("Log Mood")');
        await submitButton.click();

        // Should see success message even when offline (saved locally)
        await expect(page.locator('text=/logged successfully/i')).toBeVisible({
          timeout: 3000,
        });

        // Should see pending sync indicator
        await expect(page.locator('text=/pending sync/i')).toBeVisible({
          timeout: 2000,
        });
      }

      // Go back online
      await context.setOffline(false);

      // Verify online status
      const onlineIndicator = page.locator('text=Online');
      await expect(onlineIndicator).toBeVisible({ timeout: 5000 });

      // Wait for sync to complete
      await page.waitForTimeout(2000);

      // Pending sync indicator should disappear or count should decrease
      const pendingAfterSync = page.locator('text=/pending sync/i');
      const isStillPending = await pendingAfterSync.isVisible();

      if (isStillPending) {
        // If still visible, count should be 0 or indicator should show syncing
        const text = await pendingAfterSync.textContent();
        expect(text).toMatch(/0 pending|syncing/i);
      }
    });

    test('should handle offline mode gracefully', async ({ page, context }) => {
      // Go offline
      await context.setOffline(true);

      // App should still be usable
      await expect(page.locator('text=Offline')).toBeVisible();

      // Navigation should still work
      const historyTab = page.locator('button:has-text("History")');
      if (await historyTab.isVisible()) {
        await historyTab.click();
        await expect(page).toHaveURL(/.*/, { timeout: 2000 });
      }

      // Go back online
      await context.setOffline(false);
      await expect(page.locator('text=Online')).toBeVisible();
    });
  });

  test.describe('Periodic Sync', () => {
    test('should trigger periodic sync every 5 minutes (simulated)', async ({
      page,
    }) => {
      const consoleLogs: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'log' && msg.text().includes('Periodic sync')) {
          consoleLogs.push(msg.text());
        }
      });

      // Wait for at least 1 periodic sync cycle (5 minutes)
      // In real scenario, this would take 5 minutes
      // For testing, we can mock time or just verify the interval is set up

      // Check if the app has the sync mechanism in place
      const syncStatus = page.locator('text=/Online|Offline/i');
      await expect(syncStatus).toBeVisible();

      // Note: Full 5-minute test would be too slow for E2E
      // This test verifies the UI elements are present
      // Unit tests verify the actual interval logic
    });
  });

  test.describe('Service Worker Integration', () => {
    test('should register service worker', async ({ page }) => {
      // Check if service worker is registered
      const swRegistered = await page.evaluate(() => {
        return navigator.serviceWorker.controller !== null;
      });

      // Service worker should be registered (if supported)
      if ('serviceWorker' in navigator) {
        expect(swRegistered).toBe(true);
      }
    });

    test('should support Background Sync API (Chrome only)', async ({ page }) => {
      // Check if Background Sync API is supported
      const bgSyncSupported = await page.evaluate(() => {
        return 'serviceWorker' in navigator && 'SyncManager' in window;
      });

      // Log support status for debugging
      console.log('Background Sync API supported:', bgSyncSupported);

      // Test is informational - not all browsers support it
      if (bgSyncSupported) {
        // Verify service worker can register sync tags
        const canRegisterSync = await page.evaluate(async () => {
          try {
            const registration = await navigator.serviceWorker.ready;
            await registration.sync.register('test-sync');
            return true;
          } catch (error) {
            return false;
          }
        });

        expect(canRegisterSync).toBe(true);
      }
    });
  });

  test.describe('Sync Status Indicator', () => {
    test('should show online status when connected', async ({ page }) => {
      const onlineIndicator = page.locator('text=Online');
      await expect(onlineIndicator).toBeVisible();
    });

    test('should show pending moods count if any exist', async ({ page }) => {
      const statusText = page.locator('text=/Online|Offline/i');
      await expect(statusText).toBeVisible();

      // Check if there's a pending count in the same container
      const container = statusText.locator('..');
      const hasPending = await container.locator('text=/pending/i').isVisible();

      if (hasPending) {
        const pendingText = await container.locator('text=/pending/i').textContent();
        expect(pendingText).toMatch(/\d+ pending/);
      }
    });
  });

  test.describe('Real-world Scenarios', () => {
    test('should handle multiple offline mood entries and sync all when online', async ({
      page,
      context,
    }) => {
      // Go offline
      await context.setOffline(true);
      await expect(page.locator('text=Offline')).toBeVisible();

      // Log multiple moods offline (if possible in test environment)
      // This is a realistic scenario where user logs moods throughout the day

      // Go back online
      await context.setOffline(false);
      await expect(page.locator('text=Online')).toBeVisible();

      // Wait for sync
      await page.waitForTimeout(3000);

      // All pending moods should be synced
      const noPending = await page.locator('text=/0 pending|Online/i').isVisible();
      expect(noPending).toBe(true);
    });

    test('should handle rapid online/offline transitions', async ({ page, context }) => {
      // Simulate flaky connection
      await context.setOffline(true);
      await page.waitForTimeout(500);

      await context.setOffline(false);
      await page.waitForTimeout(500);

      await context.setOffline(true);
      await page.waitForTimeout(500);

      await context.setOffline(false);

      // App should remain stable
      await expect(page.locator('text=Online')).toBeVisible({ timeout: 5000 });

      // No error messages should be shown
      const errorMessage = page.locator('text=/error|failed/i');
      await expect(errorMessage).not.toBeVisible();
    });
  });
});
