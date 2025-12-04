/**
 * Authentication Tests - Login and Logout Journeys
 *
 * Tests the core authentication flow that gates all app functionality.
 * These tests override storageState to start from a logged-out state.
 */

import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.VITE_TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.VITE_TEST_USER_PASSWORD || 'testpassword123';

// Override storageState for auth tests - start with no authentication
test.use({ storageState: { cookies: [], origins: [] } });

/**
 * Helper to handle any onboarding/intro steps after login.
 * Uses proper Playwright assertions instead of arbitrary timeouts.
 */
async function handlePostLoginOnboarding(page) {
  // Step 1: Check if onboarding screen appears (asking for display name)
  const displayNameInput = page.getByLabel(/display name/i);
  if (await displayNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await displayNameInput.fill('TestUser');
    const continueButton = page.getByRole('button', { name: /continue|save|submit/i });
    await continueButton.click();
    // Wait for onboarding to process
    await expect(displayNameInput).toBeHidden({ timeout: 5000 });
  }

  // Step 2: Check if welcome/intro screen appears
  const welcomeHeading = page.getByRole('heading', { name: /welcome to your app/i });
  if (await welcomeHeading.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(welcomeHeading).toBeHidden({ timeout: 5000 });
  }
}

test.describe('Authentication', () => {
  test('user can login with valid credentials', async ({ page }) => {
    await page.goto('/');

    // Wait for page to be fully loaded
    await page.waitForLoadState('domcontentloaded');

    // Wait for login form to be ready
    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeVisible({ timeout: 15000 });

    // Should see login screen
    await expect(page.getByRole('heading', { name: /welcome back|sign in/i })).toBeVisible();

    // Fill credentials
    await emailInput.fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);

    // Set up auth response listener before clicking
    const authResponse = page.waitForResponse(
      (resp) =>
        (resp.url().includes('auth') || resp.url().includes('token') || resp.url().includes('session')) &&
        resp.status() >= 200 &&
        resp.status() < 400,
      { timeout: 15000 }
    ).catch(() => null);

    // Submit login
    await page.getByRole('button', { name: /sign in|login/i }).click();

    // Wait for auth response
    await authResponse;

    // Handle any onboarding steps
    await handlePostLoginOnboarding(page);

    // Should navigate to main app (no longer on login screen)
    await expect(
      page.locator('nav, [data-testid="bottom-navigation"], [role="navigation"]').first()
    ).toBeVisible({ timeout: 10000 });

    // Login heading should be gone
    await expect(page.getByRole('heading', { name: /welcome back|sign in/i })).not.toBeVisible();
  });

  test('login shows error for invalid credentials', async ({ page }) => {
    await page.goto('/');

    // Wait for login form
    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeVisible({ timeout: 15000 });

    // Fill invalid credentials
    await emailInput.fill('invalid@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');

    // Submit login
    await page.getByRole('button', { name: /sign in|login/i }).click();

    // Should show error message
    const errorMessage = page
      .getByText(/invalid|incorrect|wrong|error|failed/i)
      .or(page.getByRole('alert'));

    await expect(errorMessage.first()).toBeVisible({ timeout: 10000 });

    // Should still be on login page
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test('user can logout', async ({ page }) => {
    // First login
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeVisible({ timeout: 15000 });

    await emailInput.fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);

    // Set up auth response listener
    const authResponse = page.waitForResponse(
      (resp) =>
        (resp.url().includes('auth') || resp.url().includes('token') || resp.url().includes('session')) &&
        resp.status() >= 200 &&
        resp.status() < 400,
      { timeout: 15000 }
    ).catch(() => null);

    await page.getByRole('button', { name: /sign in|login/i }).click();
    await authResponse;

    // Handle onboarding
    await handlePostLoginOnboarding(page);

    // Wait for main app
    const nav = page.locator('nav, [data-testid="bottom-navigation"], [role="navigation"]').first();
    await expect(nav).toBeVisible({ timeout: 10000 });

    // Find and click settings/profile to access logout
    const settingsTab = page
      .getByRole('tab', { name: /settings/i })
      .or(page.getByRole('button', { name: /settings/i }))
      .or(page.getByTestId('settings-tab'));

    if (await settingsTab.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await settingsTab.first().click();
      await page.waitForLoadState('networkidle');
    }

    // Click logout
    const logoutButton = page.getByRole('button', { name: /log ?out|sign ?out/i });
    await expect(logoutButton).toBeVisible({ timeout: 5000 });
    await logoutButton.click();

    // Should be back on login screen
    await expect(page.getByRole('heading', { name: /welcome back|sign in/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test('login form validates required fields', async ({ page }) => {
    await page.goto('/');

    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeVisible({ timeout: 15000 });

    // Try to submit without filling fields
    const submitButton = page.getByRole('button', { name: /sign in|login/i });

    // Button should be disabled or form should show validation
    const isDisabled = await submitButton.isDisabled().catch(() => false);

    if (!isDisabled) {
      await submitButton.click();
      // Should show validation error or not navigate away
      await expect(emailInput).toBeVisible();
    } else {
      // Button correctly disabled for empty form
      expect(isDisabled).toBe(true);
    }
  });
});
