/**
 * Offline Resilience Tests - Network Detection
 *
 * Tests the PWA offline functionality - verifies app handles offline state.
 */

import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.VITE_TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.VITE_TEST_USER_PASSWORD || 'testpassword123';

test.describe('Offline Resilience', () => {
  test('app handles offline state gracefully', async ({ page, context }) => {
    // Login first
    await page.goto('/');
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
    const nav = page.locator('nav, [data-testid="bottom-navigation"]').first();
    await expect(nav).toBeVisible({ timeout: 10000 });

    // Go offline
    await context.setOffline(true);
    await page.waitForTimeout(1000);

    // App should still be visible (PWA should work offline)
    await expect(nav).toBeVisible();

    // Go back online
    await context.setOffline(false);
    await page.waitForTimeout(1000);

    // App should still be functional
    await expect(nav).toBeVisible();
  });

  test('app recovers when coming back online', async ({ page, context }) => {
    // Login first
    await page.goto('/');
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
    const nav = page.locator('nav, [data-testid="bottom-navigation"]').first();
    await expect(nav).toBeVisible({ timeout: 10000 });

    // Go offline then back online
    await context.setOffline(true);
    await page.waitForTimeout(500);
    await context.setOffline(false);
    await page.waitForTimeout(1000);

    // App should still be functional after reconnect
    await expect(nav).toBeVisible();
  });
});
