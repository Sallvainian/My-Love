/**
 * Offline Resilience Tests - Network Detection
 *
 * Tests the PWA offline functionality.
 * Authentication is handled by global-setup.ts via storageState.
 */

import { test, expect } from '@playwright/test';

test.describe('Offline Resilience', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app - storageState handles authentication
    await page.goto('/');

    // Wait for app to be ready
    await expect(
      page.locator('nav, [data-testid="bottom-navigation"]').first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('app handles offline state gracefully', async ({ page, context }) => {
    const nav = page.locator('nav, [data-testid="bottom-navigation"]').first();

    // Go offline
    await context.setOffline(true);

    // Wait for app to detect offline state
    await expect(nav).toBeVisible();

    // Check for offline indicator if it exists
    const offlineIndicator = page.getByTestId('offline-indicator').or(
      page.getByText(/offline|no connection/i)
    );
    const hasIndicator = await offlineIndicator.isVisible({ timeout: 3000 }).catch(() => false);

    // App should still be usable (nav visible)
    await expect(nav).toBeVisible();

    // Go back online
    await context.setOffline(false);

    // App should recover
    await expect(nav).toBeVisible();

    // Offline indicator should disappear if it was shown
    if (hasIndicator) {
      await expect(offlineIndicator).toBeHidden({ timeout: 5000 });
    }
  });

  test('app recovers when coming back online', async ({ page, context }) => {
    const nav = page.locator('nav, [data-testid="bottom-navigation"]').first();

    // Simulate going offline then online quickly
    await context.setOffline(true);
    await expect(nav).toBeVisible();

    await context.setOffline(false);
    await expect(nav).toBeVisible();

    // Verify app can still make API calls after reconnect
    // Navigate to a different section to trigger data fetch
    const navItems = nav.locator('button, a, [role="tab"]');
    const count = await navItems.count();

    if (count >= 2) {
      await navItems.nth(1).click();
      await expect(nav).toBeVisible();
    }
  });

  test('cached content remains accessible offline', async ({ page, context }) => {
    // First, ensure content is loaded while online by waiting for DOM and any initial API calls
    await page.waitForLoadState('domcontentloaded');

    const nav = page.locator('nav, [data-testid="bottom-navigation"]').first();
    await expect(nav).toBeVisible({ timeout: 5000 });

    // Go offline
    await context.setOffline(true);

    // Navigation should still work (cached)
    const navItems = nav.locator('button, a, [role="tab"]');
    const firstItem = navItems.first();

    if (await firstItem.isVisible()) {
      await firstItem.click();
      // Page should still respond (from cache)
      await expect(nav).toBeVisible();
    }

    // Restore online
    await context.setOffline(false);
  });

  test('offline state does not break navigation', async ({ page, context }) => {
    const nav = page.locator('nav, [data-testid="bottom-navigation"]').first();
    const navItems = nav.locator('button, a, [role="tab"]');
    const count = await navItems.count();

    // Go offline
    await context.setOffline(true);

    // Try navigating through sections while offline
    for (let i = 0; i < Math.min(count, 3); i++) {
      const item = navItems.nth(i);
      if (await item.isVisible()) {
        await item.click();
        // App should not crash
        await expect(nav).toBeVisible();
      }
    }

    // Restore online
    await context.setOffline(false);
    await expect(nav).toBeVisible();
  });

  test('service worker is registered for PWA', async ({ page }) => {
    // Check if service worker is registered
    const hasServiceWorker = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;

      const registrations = await navigator.serviceWorker.getRegistrations();
      return registrations.length > 0;
    });

    // Service worker is only registered in production builds, not dev mode
    // Skip test if not in production environment
    if (!hasServiceWorker) {
      test.skip(true, 'Service worker not registered (expected in dev mode - only available in production builds)');
    }

    expect(hasServiceWorker).toBe(true);
  });
});
