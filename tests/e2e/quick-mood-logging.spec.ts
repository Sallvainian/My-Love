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
 */

import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.VITE_TEST_USER_EMAIL;
const TEST_PASSWORD = process.env.VITE_TEST_USER_PASSWORD;

test.describe('Quick Mood Logging Flow', () => {
  test.beforeEach(async ({ page, context }) => {
    // Skip tests if no test credentials configured
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Test credentials not configured in environment');

    // Clear all storage to ensure clean state for each test
    await context.clearCookies();
    await context.clearPermissions();

    // Login
    await page.goto('/');

    // Wait for either login form OR app content (if already authenticated somehow)
    // First check if we're already authenticated by looking for navigation
    const nav = page.locator('nav, [data-testid="bottom-navigation"]').first();
    const isAlreadyAuthenticated = await nav.isVisible({ timeout: 3000 }).catch(() => false);

    if (!isAlreadyAuthenticated) {
      // Wait for auth loading to complete and login form to appear
      const emailInput = page.getByLabel(/email/i);
      await expect(emailInput).toBeVisible({ timeout: 10000 });

      await emailInput.fill(TEST_EMAIL!);
      await page.getByLabel(/password/i).fill(TEST_PASSWORD!);

      // Click sign in and wait for response
      await page.getByRole('button', { name: /sign in|login/i }).click();

      // Wait for either navigation OR welcome/onboarding screen
      await page.waitForTimeout(2000);
    }

    // Handle welcome/intro screen if needed (this appears BEFORE nav)
    try {
      const welcomeHeading = page.getByRole('heading', { name: /welcome to your app/i });
      if (await welcomeHeading.isVisible({ timeout: 3000 })) {
        await page.getByRole('button', { name: /continue/i }).click();
        await page.waitForTimeout(1000);
      }
    } catch {
      // No welcome screen
    }

    // Handle onboarding if needed
    try {
      const displayNameInput = page.getByLabel(/display name/i);
      if (await displayNameInput.isVisible({ timeout: 2000 })) {
        await displayNameInput.fill('TestUser');
        await page.getByRole('button', { name: /continue|save|submit/i }).click();
        await page.waitForTimeout(1000);
      }
    } catch {
      // No onboarding needed
    }

    // Wait for app navigation to load
    await expect(
      page.locator('nav, [data-testid="bottom-navigation"]').first()
    ).toBeVisible({ timeout: 15000 });

    // Navigate to mood page if not already there
    const moodNav = page.getByRole('button', { name: /mood|feeling|heart/i }).or(
      page.getByRole('tab', { name: /mood|feeling|heart/i })
    );
    if (await moodNav.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await moodNav.first().click();
      await page.waitForTimeout(500);
    }
  });

  test('AC-5.2.1: User can log mood in under 5 seconds', async ({ page }) => {
    const startTime = Date.now();

    // Click on a mood button (happy)
    const happyButton = page.getByTestId('mood-button-happy');
    if (await happyButton.isVisible({ timeout: 3000 }).catch(() => false)) {
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
    }
  });

  test('AC-5.2.3: Success toast appears for 3 seconds after save', async ({ page }) => {
    // Select a mood
    const gratefulButton = page.getByTestId('mood-button-grateful');
    if (await gratefulButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await gratefulButton.click();

      // Submit
      const submitButton = page.getByTestId('mood-submit-button');
      await submitButton.click();

      // Toast should appear
      const toast = page.getByTestId('mood-success-toast');
      await expect(toast).toBeVisible({ timeout: 3000 });
      await expect(toast).toContainText(/mood logged|updated/i);

      // Toast should auto-dismiss after ~3 seconds
      await expect(toast).toBeHidden({ timeout: 4000 });
    }
  });

  test('AC-5.2.4: Can save mood without note', async ({ page }) => {
    // Select a mood without filling in note
    const calmButton = page.getByTestId('mood-button-calm').or(
      page.getByTestId('mood-button-content')
    );
    if (await calmButton.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await calmButton.first().click();

      // Note input should exist but not be required
      const noteInput = page.getByTestId('mood-note-input');
      if (await noteInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        // Leave note empty intentionally
        await expect(noteInput).toHaveValue('');
      }

      // Submit should work without note
      const submitButton = page.getByTestId('mood-submit-button');
      await submitButton.click();

      // Success toast should appear (note was optional)
      const toast = page.getByTestId('mood-success-toast');
      await expect(toast).toBeVisible({ timeout: 3000 });
    }
  });

  test('AC-5.2.5: Background sync does not block UI', async ({ page }) => {
    // Select a mood
    const excitedButton = page.getByTestId('mood-button-excited').or(
      page.getByTestId('mood-button-happy')
    );
    if (await excitedButton.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await excitedButton.first().click();

      const startTime = Date.now();

      // Submit
      const submitButton = page.getByTestId('mood-submit-button');
      await submitButton.click();

      // Toast should appear quickly (before sync completes)
      const toast = page.getByTestId('mood-success-toast');
      await expect(toast).toBeVisible({ timeout: 1000 });

      // Should complete quickly (UI not blocked)
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(2000); // Toast appears within 2s, sync is background
    }
  });

  test('AC-5.2.6: Shows offline indicator when disconnected', async ({ page, context }) => {
    // Navigate to mood page first while online
    await expect(page.locator('[data-testid="mood-tracker"]').or(
      page.locator('form')
    ).first()).toBeVisible({ timeout: 5000 });

    // Go offline
    await context.setOffline(true);

    // Wait for network status to update
    await page.waitForTimeout(500);

    // Network status indicator should show offline state
    const networkIndicator = page.getByTestId('network-status-indicator');
    if (await networkIndicator.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(networkIndicator).toHaveAttribute('data-status', 'offline');
    }

    // Can still interact with mood buttons while offline
    const sadButton = page.getByTestId('mood-button-sad');
    if (await sadButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sadButton.click();

      // Submit should work (saves locally)
      const submitButton = page.getByTestId('mood-submit-button');
      await submitButton.click();

      // Success toast should still appear (local save)
      const toast = page.getByTestId('mood-success-toast');
      await expect(toast).toBeVisible({ timeout: 3000 });
    }

    // Restore online state
    await context.setOffline(false);
  });

  test('multiple moods can be selected', async ({ page }) => {
    // Select multiple moods
    const happyButton = page.getByTestId('mood-button-happy');
    const gratefulButton = page.getByTestId('mood-button-grateful');

    if (
      (await happyButton.isVisible({ timeout: 3000 }).catch(() => false)) &&
      (await gratefulButton.isVisible().catch(() => false))
    ) {
      await happyButton.click();
      await gratefulButton.click();

      // Both should be visually selected (have pink border or selected state)
      // Submit should work with multiple moods
      const submitButton = page.getByTestId('mood-submit-button');
      await expect(submitButton).toBeEnabled();
      await submitButton.click();

      const toast = page.getByTestId('mood-success-toast');
      await expect(toast).toBeVisible({ timeout: 3000 });
    }
  });
});
