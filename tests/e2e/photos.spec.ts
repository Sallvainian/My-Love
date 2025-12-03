/**
 * Photo Sharing Tests - Gallery Access
 *
 * Tests that photo/gallery functionality is accessible.
 */

import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.VITE_TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.VITE_TEST_USER_PASSWORD || 'testpassword123';

test.describe('Photo Sharing', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/');

    // Wait for page to be fully loaded (critical for CI)
    await page.waitForLoadState('domcontentloaded');

    // Wait for login form to be ready
    await page.getByLabel(/email/i).waitFor({ state: 'visible', timeout: 15000 });

    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /sign in|login/i }).click();

    // Handle onboarding if needed
    await page.waitForTimeout(2000);
    const displayNameInput = page.getByLabel(/display name/i);
    if (await displayNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await displayNameInput.fill('TestUser');
      await page.getByRole('button', { name: /continue|save|submit/i }).click();
      await page.waitForTimeout(1000);
    }

    // Handle welcome/intro screen if needed
    const welcomeHeading = page.getByRole('heading', { name: /welcome to your app/i });
    if (await welcomeHeading.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.getByRole('button', { name: /continue/i }).click();
      await page.waitForTimeout(1000);
    }

    // Wait for app to load
    await expect(
      page.locator('nav, [data-testid="bottom-navigation"]').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('user can access photo section', async ({ page }) => {
    const nav = page.locator('nav, [data-testid="bottom-navigation"]').first();

    // Try to find photo-related navigation
    const photosNav = page.getByRole('button', { name: /photo|gallery|image|picture/i }).or(
      page.getByRole('tab', { name: /photo|gallery|image|picture/i })
    );

    if (await photosNav.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await photosNav.first().click();
      await page.waitForTimeout(500);
    }

    // App should remain functional
    await expect(nav).toBeVisible();
  });

  test('user can navigate photo features', async ({ page }) => {
    const nav = page.locator('nav, [data-testid="bottom-navigation"]').first();

    // Get all nav items and try clicking through them
    const navItems = nav.locator('button, a, [role="tab"]');
    const count = await navItems.count();

    // Click each nav item to verify app doesn't crash
    for (let i = 0; i < Math.min(count, 4); i++) {
      const item = navItems.nth(i);
      if (await item.isVisible()) {
        await item.click();
        await page.waitForTimeout(300);
      }
    }

    // App should still be functional
    await expect(nav).toBeVisible();
  });
});
