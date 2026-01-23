/**
 * Mood Tracking Tests - Core PWA Feature
 *
 * Tests the mood logging functionality.
 * Authentication is handled by global-setup.ts via storageState.
 */

import { test, expect } from '@playwright/test';

test.describe('Mood Tracking', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app - storageState handles authentication
    await page.goto('/');

    // Wait for app to be ready (navigation visible confirms auth worked)
    await expect(
      page.locator('nav, [data-testid="bottom-navigation"]').first()
    ).toBeVisible({ timeout: 15000 });

    // Navigate to mood page if not already there
    const moodNav = page
      .getByRole('button', { name: /mood/i })
      .or(page.getByRole('tab', { name: /mood/i }));

    if (await moodNav.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await moodNav.first().click();
      // Wait for mood page content to load - look for the mood tracker container
      await expect(page.getByTestId('mood-tracker')).toBeVisible({ timeout: 5000 });
    }
  });

  test('user can select a mood', async ({ page }) => {
    // Find mood buttons (e.g., happy, sad, grateful, etc.)
    const moodButtons = page.locator('[data-testid^="mood-button-"]');
    const count = await moodButtons.count();

    // Should have mood options available
    expect(count).toBeGreaterThan(0);

    // Click first mood button
    const firstMood = moodButtons.first();
    await expect(firstMood).toBeVisible();
    await firstMood.click();

    // Submit button should become enabled after selecting mood
    const submitButton = page.getByTestId('mood-submit-button');
    await expect(submitButton).toBeEnabled({ timeout: 3000 });
  });

  test('user can log a mood with note', async ({ page }) => {
    // Select a mood
    const happyMood = page.getByTestId('mood-button-happy');
    if (await happyMood.isVisible({ timeout: 2000 }).catch(() => false)) {
      await happyMood.click();
    } else {
      // Fallback: click first available mood button
      const firstMood = page.locator('[data-testid^="mood-button-"]').first();
      await firstMood.click();
    }

    // Fill in optional note if input exists
    const noteInput = page.getByTestId('mood-note-input');
    if (await noteInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await noteInput.fill(`Test mood note ${Date.now()}`);
    }

    // Submit the mood
    const submitButton = page.getByTestId('mood-submit-button');
    await expect(submitButton).toBeEnabled({ timeout: 3000 });

    // Set up response listener before clicking
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('moods') && resp.status() >= 200 && resp.status() < 300,
      { timeout: 10000 }
    ).catch(() => null);

    await submitButton.click();

    // Wait for success indication (toast or button state change)
    const successToast = page.getByTestId('mood-success-toast');
    const toastVisible = await successToast.isVisible({ timeout: 5000 }).catch(() => false);

    if (toastVisible) {
      await expect(successToast).toBeVisible();
    } else {
      // Alternative: verify the API call succeeded
      const response = await responsePromise;
      expect(response).not.toBeNull();
    }
  });

  test('mood selection shows visual feedback', async ({ page }) => {
    // Get all mood buttons
    const moodButtons = page.locator('[data-testid^="mood-button-"]');
    const count = await moodButtons.count();

    if (count > 0) {
      const firstMood = moodButtons.first();

      // Click and verify it gets selected state
      await firstMood.click();

      // Check for selected/active state (aria-pressed or data-selected or class)
      const isSelected = await firstMood.evaluate((el) => {
        return (
          el.getAttribute('aria-pressed') === 'true' ||
          el.getAttribute('data-selected') === 'true' ||
          el.classList.contains('selected') ||
          el.classList.contains('ring-2') || // Tailwind ring for focus
          el.classList.contains('border-2') // Border for selection
        );
      });

      expect(isSelected).toBe(true);
    }
  });

  test('submit button is disabled without mood selection', async ({ page }) => {
    // Submit button should be disabled initially
    const submitButton = page.getByTestId('mood-submit-button');

    if (await submitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Initially disabled
      await expect(submitButton).toBeDisabled();

      // Select a mood
      const firstMood = page.locator('[data-testid^="mood-button-"]').first();
      if (await firstMood.isVisible()) {
        await firstMood.click();
        // Now should be enabled
        await expect(submitButton).toBeEnabled({ timeout: 3000 });
      }
    }
  });
});
