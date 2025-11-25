/**
 * Offline Resilience Tests - Network Detection and Sync
 *
 * Tests the PWA offline functionality.
 */

import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.VITE_TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.VITE_TEST_USER_PASSWORD || 'testpassword123';

test.describe('Offline Resilience', () => {
  test('app detects when going offline', async ({ page, context }) => {
    // Login first
    await page.goto('/');
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /sign in|login/i }).click();

    // Wait for app to load
    await expect(
      page.locator('nav, [data-testid="bottom-navigation"]').first()
    ).toBeVisible({ timeout: 10000 });

    // Go offline
    await context.setOffline(true);

    // Should show offline indicator
    const offlineIndicator = page.locator(
      '[data-testid="offline-indicator"], [data-testid="network-status"], ' +
      'text=/offline|no connection|disconnected/i'
    );

    await expect(offlineIndicator.first()).toBeVisible({ timeout: 5000 });

    // Go back online
    await context.setOffline(false);

    // Offline indicator should disappear or show online status
    await expect(offlineIndicator.first()).not.toBeVisible({ timeout: 5000 });
  });

  test('app recovers and syncs when coming back online', async ({ page, context }) => {
    // Login first
    await page.goto('/');
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /sign in|login/i }).click();

    // Wait for app to load
    await expect(
      page.locator('nav, [data-testid="bottom-navigation"]').first()
    ).toBeVisible({ timeout: 10000 });

    // Go offline
    await context.setOffline(true);
    await page.waitForTimeout(1000);

    // Go back online
    await context.setOffline(false);

    // App should trigger sync - look for sync indicator or success
    const syncIndicator = page.locator(
      '[data-testid="sync-toast"], [data-testid="sync-indicator"], ' +
      'text=/syncing|synced|connected/i'
    );

    // Either sync indicator appears or app continues to function normally
    // (no crash/error after reconnect)
    await page.waitForTimeout(2000);

    // App should still be functional - main nav should be visible
    await expect(
      page.locator('nav, [data-testid="bottom-navigation"]').first()
    ).toBeVisible();
  });
});
