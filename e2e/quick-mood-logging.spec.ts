/**
 * Quick Mood Logging Flow Tests
 * Story 5.2: AC-5.2.1 through AC-5.2.6
 *
 * Tests the quick mood logging flow including:
 * - < 5 second completion time (AC-5.2.1)
 * - Success toast display and auto-dismiss (AC-5.2.3)
 * - Optional note field (AC-5.2.4)
 * - Non-blocking background sync (AC-5.2.5)
 * - Offline indicator (AC-5.2.6)
 *
 * NOTE: These tests require test credentials. They will be skipped if
 * VITE_TEST_USER_EMAIL and VITE_TEST_USER_PASSWORD are not set.
 */

import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.VITE_TEST_USER_EMAIL;
const TEST_PASSWORD = process.env.VITE_TEST_USER_PASSWORD;

// Skip entire test suite if credentials not configured
test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Test credentials not configured');

test.describe('Quick Mood Logging Flow', () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear all storage to ensure clean state for each test
    await context.clearCookies();
    await context.clearPermissions();

    // Navigate to app
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Check if already authenticated by looking for navigation
    const nav = page.locator('nav, [data-testid="bottom-navigation"]').first();
    const loginForm = page.getByLabel(/email/i);

    // Wait for either nav (authenticated) or login form
    await expect(nav.or(loginForm)).toBeVisible({ timeout: 10000 });

    // If login form is visible, perform authentication
    if (await loginForm.isVisible()) {
      await loginForm.fill(TEST_EMAIL!);
      await page.getByLabel(/password/i).fill(TEST_PASSWORD!);

      // Set up auth response listener before clicking
      const authResponse = page.waitForResponse(
        (resp) =>
          (resp.url().includes('auth') || resp.url().includes('token') || resp.url().includes('session')) &&
          resp.status() >= 200 &&
          resp.status() < 400,
        { timeout: 15000 }
      ).catch(() => null);

      await page.getByRole('button', { name: /sign in|login/i }).click();
      await authResponse;

      // Handle welcome/intro screen if needed
      const welcomeHeading = page.getByRole('heading', { name: /welcome to your app/i });
      if (await welcomeHeading.isVisible({ timeout: 3000 }).catch(() => false)) {
        await page.getByRole('button', { name: /continue/i }).click();
        await expect(welcomeHeading).toBeHidden({ timeout: 5000 });
      }

      // Handle onboarding if needed
      const displayNameInput = page.getByLabel(/display name/i);
      if (await displayNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await displayNameInput.fill('TestUser');
        await page.getByRole('button', { name: /continue|save|submit/i }).click();
        await expect(displayNameInput).toBeHidden({ timeout: 5000 });
      }
    }

    // Wait for app navigation to load
    await expect(nav).toBeVisible({ timeout: 15000 });

    // Navigate to mood page - use data-testid for precise targeting
    const moodNav = page.getByTestId('nav-mood');
    if (await moodNav.isVisible({ timeout: 2000 }).catch(() => false)) {
      await moodNav.click();
      // Wait for mood page content - look for mood tracker container
      await expect(page.getByTestId('mood-tracker')).toBeVisible({ timeout: 5000 });
    }
  });

  test('AC-5.2.1: User can log mood in under 5 seconds', async ({ page }) => {
    const startTime = Date.now();

    // Click on a mood button (happy)
    const happyButton = page.getByTestId('mood-button-happy');
    await expect(happyButton).toBeVisible({ timeout: 3000 });
    await happyButton.click();

    // Click submit button
    const submitButton = page.getByTestId('mood-submit-button');
    await expect(submitButton).toBeEnabled({ timeout: 2000 });
    await submitButton.click();

    // Wait for success toast
    const toast = page.getByTestId('mood-success-toast');
    await expect(toast).toBeVisible({ timeout: 3000 });

    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(5000);
  });

  test('AC-5.2.3: Success toast appears for 3 seconds after save', async ({ page }) => {
    // Select a mood
    const gratefulButton = page.getByTestId('mood-button-grateful');
    await expect(gratefulButton).toBeVisible({ timeout: 3000 });
    await gratefulButton.click();

    // Submit
    const submitButton = page.getByTestId('mood-submit-button');
    await expect(submitButton).toBeEnabled({ timeout: 2000 });
    await submitButton.click();

    // Toast should appear
    const toast = page.getByTestId('mood-success-toast');
    await expect(toast).toBeVisible({ timeout: 3000 });
    await expect(toast).toContainText(/mood logged|updated/i);

    // Toast should auto-dismiss after ~3 seconds
    await expect(toast).toBeHidden({ timeout: 4500 });
  });

  test('AC-5.2.4: Can save mood without note', async ({ page }) => {
    // Select a mood without filling in note
    const calmButton = page.getByTestId('mood-button-calm').or(
      page.getByTestId('mood-button-content')
    );
    await expect(calmButton.first()).toBeVisible({ timeout: 3000 });
    await calmButton.first().click();

    // Note input should exist but not be required - verify it's empty
    const noteInput = page.getByTestId('mood-note-input');
    if (await noteInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(noteInput).toHaveValue('');
    }

    // Submit should work without note
    const submitButton = page.getByTestId('mood-submit-button');
    await expect(submitButton).toBeEnabled({ timeout: 2000 });
    await submitButton.click();

    // Success toast should appear (note was optional)
    const toast = page.getByTestId('mood-success-toast');
    await expect(toast).toBeVisible({ timeout: 3000 });
  });

  test('AC-5.2.5: Background sync does not block UI', async ({ page }) => {
    // Select a mood
    const excitedButton = page.getByTestId('mood-button-excited').or(
      page.getByTestId('mood-button-happy')
    );
    await expect(excitedButton.first()).toBeVisible({ timeout: 3000 });
    await excitedButton.first().click();

    const startTime = Date.now();

    // Submit
    const submitButton = page.getByTestId('mood-submit-button');
    await expect(submitButton).toBeEnabled({ timeout: 2000 });
    await submitButton.click();

    // Toast should appear quickly (before sync completes)
    const toast = page.getByTestId('mood-success-toast');
    await expect(toast).toBeVisible({ timeout: 1500 });

    // Should complete quickly (UI not blocked)
    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(2000);
  });

  test('AC-5.2.6: Shows offline indicator when disconnected', async ({ page, context }) => {
    // Ensure mood tracker is visible first
    await expect(
      page.locator('[data-testid="mood-tracker"]').or(page.locator('form')).first()
    ).toBeVisible({ timeout: 5000 });

    // Go offline
    await context.setOffline(true);

    // Network status indicator should show offline state (if implemented)
    const networkIndicator = page.getByTestId('network-status-indicator');
    await expect.soft(networkIndicator).toHaveAttribute('data-status', 'offline', { timeout: 3000 });

    // Can still interact with mood buttons while offline
    const sadButton = page.getByTestId('mood-button-sad');
    await expect(sadButton).toBeVisible({ timeout: 2000 });
    await sadButton.click();

    // Submit should work (saves locally)
    const submitButton = page.getByTestId('mood-submit-button');
    await expect(submitButton).toBeEnabled({ timeout: 2000 });
    await submitButton.click();

    // Success toast should still appear (local save)
    const toast = page.getByTestId('mood-success-toast');
    await expect(toast).toBeVisible({ timeout: 3000 });

    // Restore online state
    await context.setOffline(false);
  });

  test('multiple moods can be selected', async ({ page }) => {
    // Select multiple moods
    const happyButton = page.getByTestId('mood-button-happy');
    const gratefulButton = page.getByTestId('mood-button-grateful');

    await expect(happyButton).toBeVisible({ timeout: 3000 });
    await expect(gratefulButton).toBeVisible();

    await happyButton.click();
    await gratefulButton.click();

    // Submit should work with multiple moods
    const submitButton = page.getByTestId('mood-submit-button');
    await expect(submitButton).toBeEnabled({ timeout: 2000 });
    await submitButton.click();

    const toast = page.getByTestId('mood-success-toast');
    await expect(toast).toBeVisible({ timeout: 3000 });
  });
});
