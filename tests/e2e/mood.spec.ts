/**
 * Mood Tracking Tests - Log and View Mood
 *
 * Tests the core mood tracking functionality.
 */

import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.VITE_TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.VITE_TEST_USER_PASSWORD || 'testpassword123';

test.describe('Mood Tracking', () => {
  test.beforeEach(async ({ page }) => {
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
    await expect(
      page.locator('nav, [data-testid="bottom-navigation"]').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('user can log a mood', async ({ page }) => {
    // Navigate to mood tracker (if not already there)
    const moodTab = page.getByRole('tab', { name: /mood/i }).or(
      page.getByRole('button', { name: /mood/i })
    );
    if (await moodTab.isVisible()) {
      await moodTab.click();
    }

    // Find mood selection buttons (emoji or text-based)
    const moodOptions = page.locator('[data-testid^="mood-"], button:has-text("Happy"), button:has-text("Loved")');

    // Select first available mood
    const firstMood = moodOptions.first();
    await expect(firstMood).toBeVisible({ timeout: 5000 });
    await firstMood.click();

    // Look for save/submit button or confirmation
    const saveButton = page.getByRole('button', { name: /save|submit|log/i });
    if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveButton.click();
    }

    // Should see confirmation or the mood reflected in UI
    // Either a success message, or the mood showing as "logged today"
    const confirmation = page.getByText(/saved|logged|recorded|today/i);
    await expect(confirmation).toBeVisible({ timeout: 5000 });
  });

  test('user can view mood history', async ({ page }) => {
    // Navigate to mood tracker
    const moodTab = page.getByRole('tab', { name: /mood/i }).or(
      page.getByRole('button', { name: /mood/i })
    );
    if (await moodTab.isVisible()) {
      await moodTab.click();
    }

    // Look for history section or calendar
    const historySection = page.locator(
      '[data-testid="mood-history"], [data-testid="mood-calendar"], ' +
      'text=/history|calendar|past/i'
    );

    // History should be visible (may be empty but the section exists)
    await expect(historySection.first()).toBeVisible({ timeout: 5000 });
  });
});
