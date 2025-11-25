/**
 * Authentication Tests - Login and Logout Journeys
 *
 * Tests the core authentication flow that gates all app functionality.
 */

import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.VITE_TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.VITE_TEST_USER_PASSWORD || 'testpassword123';

test.describe('Authentication', () => {
  test('user can login with valid credentials', async ({ page }) => {
    await page.goto('/');

    // Should see login screen
    await expect(page.getByRole('heading', { name: /welcome back|sign in/i })).toBeVisible();

    // Fill credentials
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);

    // Submit
    await page.getByRole('button', { name: /sign in|login/i }).click();

    // Should navigate to main app (no longer on login screen)
    // Wait for either main content or bottom navigation (indicates logged in)
    await expect(
      page.locator('nav, [data-testid="bottom-navigation"], [role="navigation"]').first()
    ).toBeVisible({ timeout: 10000 });

    // Login heading should be gone
    await expect(page.getByRole('heading', { name: /welcome back|sign in/i })).not.toBeVisible();
  });

  test('user can logout', async ({ page }) => {
    // First login
    await page.goto('/');
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /sign in|login/i }).click();

    // Wait for main app to load
    await expect(
      page.locator('nav, [data-testid="bottom-navigation"], [role="navigation"]').first()
    ).toBeVisible({ timeout: 10000 });

    // Find and click logout button (usually in settings or profile)
    // Try common locations
    const settingsTab = page.getByRole('tab', { name: /settings/i }).or(
      page.getByRole('button', { name: /settings/i })
    );

    if (await settingsTab.isVisible()) {
      await settingsTab.click();
    }

    // Click logout
    const logoutButton = page.getByRole('button', { name: /log ?out|sign ?out/i });
    await logoutButton.click();

    // Should be back on login screen
    await expect(page.getByRole('heading', { name: /welcome back|sign in/i })).toBeVisible({ timeout: 10000 });
  });
});
