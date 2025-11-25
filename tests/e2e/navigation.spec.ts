/**
 * Navigation Test - Tab Navigation
 *
 * Tests that core navigation works between app sections.
 */

import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.VITE_TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.VITE_TEST_USER_PASSWORD || 'testpassword123';

test('user can navigate between app sections', async ({ page }) => {
  // Login first
  await page.goto('/');
  await page.getByLabel(/email/i).fill(TEST_EMAIL);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign in|login/i }).click();

  // Wait for app to load
  await expect(
    page.locator('nav, [data-testid="bottom-navigation"]').first()
  ).toBeVisible({ timeout: 10000 });

  // Find navigation items
  const nav = page.locator('nav, [data-testid="bottom-navigation"]').first();

  // Get all nav buttons/tabs
  const navItems = nav.locator('button, a, [role="tab"]');
  const count = await navItems.count();

  // Should have at least 2 navigation items
  expect(count).toBeGreaterThanOrEqual(2);

  // Click through each nav item and verify it responds
  for (let i = 0; i < Math.min(count, 4); i++) {
    const navItem = navItems.nth(i);

    // Skip if not visible
    if (!(await navItem.isVisible())) continue;

    // Click the nav item
    await navItem.click();

    // Wait a moment for navigation to complete
    await page.waitForTimeout(500);

    // App should still be functional (nav still visible)
    await expect(nav).toBeVisible();
  }
});
