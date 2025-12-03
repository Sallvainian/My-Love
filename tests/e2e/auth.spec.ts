/**
 * Authentication Tests - Login and Logout Journeys
 *
 * Tests the core authentication flow that gates all app functionality.
 */

import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.VITE_TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.VITE_TEST_USER_PASSWORD || 'testpassword123';

/**
 * Helper to complete login and any onboarding/intro steps.
 * The test user might need to complete profile setup and dismiss intro screens.
 */
async function loginAndCompleteOnboarding(page) {
  await page.goto('/');

  // Wait for page to be fully loaded (critical for CI)
  await page.waitForLoadState('domcontentloaded');

  // Wait for login form to be ready
  await page.getByLabel(/email/i).waitFor({ state: 'visible', timeout: 15000 });

  await page.getByLabel(/email/i).fill(TEST_EMAIL);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign in|login/i }).click();

  // Wait for response
  await page.waitForTimeout(2000);

  // Step 1: Check if onboarding screen appears (asking for display name)
  const displayNameInput = page.getByLabel(/display name/i);
  if (await displayNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await displayNameInput.fill('TestUser');
    await page.getByRole('button', { name: /continue|save|submit/i }).click();
    await page.waitForTimeout(1000);
  }

  // Step 2: Check if welcome/intro screen appears ("Welcome to Your App")
  const welcomeHeading = page.getByRole('heading', { name: /welcome to your app/i });
  if (await welcomeHeading.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.getByRole('button', { name: /continue/i }).click();
    await page.waitForTimeout(1000);
  }

  // Now wait for main navigation
  await expect(
    page.locator('nav, [data-testid="bottom-navigation"], [role="navigation"]').first()
  ).toBeVisible({ timeout: 10000 });
}

test.describe('Authentication', () => {
  test('user can login with valid credentials', async ({ page }) => {
    await page.goto('/');

    // Wait for page to be fully loaded (critical for CI)
    await page.waitForLoadState('domcontentloaded');

    // Wait for login form to be ready
    await page.getByLabel(/email/i).waitFor({ state: 'visible', timeout: 15000 });

    // Should see login screen
    await expect(page.getByRole('heading', { name: /welcome back|sign in/i })).toBeVisible();

    // Fill credentials
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);

    // Submit
    await page.getByRole('button', { name: /sign in|login/i }).click();

    // Wait for response
    await page.waitForTimeout(2000);

    // Step 1: Check if onboarding screen appears (asking for display name)
    const displayNameInput = page.getByLabel(/display name/i);
    if (await displayNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await displayNameInput.fill('TestUser');
      await page.getByRole('button', { name: /continue|save|submit/i }).click();
      await page.waitForTimeout(1000);
    }

    // Step 2: Check if welcome/intro screen appears ("Welcome to Your App")
    const welcomeHeading = page.getByRole('heading', { name: /welcome to your app/i });
    if (await welcomeHeading.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.getByRole('button', { name: /continue/i }).click();
      await page.waitForTimeout(1000);
    }

    // Should navigate to main app (no longer on login screen)
    await expect(
      page.locator('nav, [data-testid="bottom-navigation"], [role="navigation"]').first()
    ).toBeVisible({ timeout: 10000 });

    // Login heading should be gone
    await expect(page.getByRole('heading', { name: /welcome back|sign in/i })).not.toBeVisible();
  });

  test('user can logout', async ({ page }) => {
    // First login (with onboarding handling)
    await loginAndCompleteOnboarding(page);

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
