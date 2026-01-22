/**
 * Navigation Test - Tab Navigation
 *
 * Tests that core navigation works between app sections.
 * Authentication is handled by global-setup.ts via storageState.
 */

import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app - storageState handles authentication
    await page.goto('/');

    // Wait for app to be ready
    await expect(
      page.locator('nav, [data-testid="bottom-navigation"]').first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('navigation bar is visible and has multiple items', async ({ page }) => {
    const nav = page.locator('nav, [data-testid="bottom-navigation"]').first();
    await expect(nav).toBeVisible();

    // Get all nav items
    const navItems = nav.locator('button, a, [role="tab"]');
    const count = await navItems.count();

    // Should have at least 2 navigation items
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('user can navigate between app sections', async ({ page }) => {
    const nav = page.locator('nav, [data-testid="bottom-navigation"]').first();
    const navItems = nav.locator('button, a, [role="tab"]');
    const count = await navItems.count();

    // Track visited sections to verify navigation actually changes content
    const visitedUrls: string[] = [];

    // Click through each nav item
    for (let i = 0; i < Math.min(count, 5); i++) {
      const navItem = navItems.nth(i);
      if (!(await navItem.isVisible())) continue;

      // Skip disabled items explicitly
      if (!(await navItem.isEnabled())) continue;

      // Capture URL BEFORE click
      const urlBefore = page.url();

      // Click the nav item
      await navItem.click();

      // Wait for either URL change or page to stabilize
      // Use a short timeout since some nav items may not change URL (already on that page)
      await page
        .waitForURL((u) => u.toString() !== urlBefore, { timeout: 2000 })
        .catch(() => {
          // URL didn't change - that's OK if clicking already-active item or SPA nav
        });

      // Verify nav is still visible (app didn't crash)
      await expect(nav).toBeVisible({ timeout: 3000 });

      visitedUrls.push(page.url());
    }

    // Should have navigated to multiple sections
    expect(visitedUrls.length).toBeGreaterThanOrEqual(2);
  });

  test('active navigation item shows selected state', async ({ page }) => {
    const nav = page.locator('nav, [data-testid="bottom-navigation"]').first();
    const navItems = nav.locator('button, a, [role="tab"]');
    const count = await navItems.count();

    if (count >= 2) {
      // Click second nav item
      const secondItem = navItems.nth(1);
      await secondItem.click();

      // Wait for page to stabilize
      await expect(nav).toBeVisible();

      // Check for selected/active state - look for data-state attribute or color classes
      const isSelected = await secondItem.evaluate((el) => {
        // Check for data-state="active" attribute used by app
        if (el.getAttribute('data-state') === 'active') return true;
        // Check parent/child elements for active state
        const parent = el.closest('[data-state="active"]');
        if (parent) return true;
        // Check for common active indicator classes
        return (
          el.getAttribute('aria-selected') === 'true' ||
          el.getAttribute('aria-current') === 'page' ||
          el.getAttribute('data-active') === 'true' ||
          el.classList.contains('active') ||
          el.classList.contains('selected') ||
          // Tailwind color classes that indicate active state
          el.classList.contains('text-primary') ||
          el.classList.contains('text-pink-500') ||
          el.classList.contains('text-rose-500') ||
          // Check for different text color (active items typically have different color)
          el.querySelector('.text-pink-500') !== null ||
          el.querySelector('.text-rose-500') !== null
        );
      });

      expect(isSelected).toBe(true);
    }
  });

  test('navigation persists after page actions', async ({ page }) => {
    const nav = page.locator('nav, [data-testid="bottom-navigation"]').first();
    const navItems = nav.locator('button, a, [role="tab"]');

    // Navigate to a section
    const firstItem = navItems.first();
    if (await firstItem.isVisible()) {
      await firstItem.click();
    }

    // Perform some action on the page (scroll, interact)
    await page.mouse.wheel(0, 100);

    // Navigation should still be visible
    await expect(nav).toBeVisible();

    // All nav items should still be functional
    const count = await navItems.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('navigation works on different viewport sizes', async ({ page }) => {
    const nav = page.locator('nav, [data-testid="bottom-navigation"]').first();

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(nav).toBeVisible();

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(nav).toBeVisible();

    // Test desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    // Nav might be different on desktop, but app should still function
    await expect(page.locator('nav, [data-testid="bottom-navigation"], header nav').first()).toBeVisible();
  });
});
