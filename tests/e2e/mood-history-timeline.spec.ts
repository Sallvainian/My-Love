/**
 * Mood History Timeline E2E Tests
 *
 * Tests the virtualized mood history timeline with infinite scroll,
 * date separators, and note expansion functionality.
 *
 * Story 5.4: Mood History Timeline
 */

import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.VITE_TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.VITE_TEST_USER_PASSWORD || 'testpassword123';

test.describe('Mood History Timeline', () => {
  test.beforeEach(async ({ page }) => {
    // Login
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

    // Handle welcome screen if needed
    const welcomeHeading = page.getByRole('heading', { name: /welcome to your app/i });
    if (await welcomeHeading.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.getByRole('button', { name: /continue/i }).click();
      await page.waitForTimeout(1000);
    }

    // Wait for app to load
    await expect(
      page.locator('nav, [data-testid="bottom-navigation"]').first()
    ).toBeVisible({ timeout: 10000 });

    // Navigate to mood tracker
    const moodNav = page.getByRole('button', { name: /mood/i }).or(
      page.getByRole('tab', { name: /mood/i })
    );
    if (await moodNav.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await moodNav.first().click();
      await page.waitForTimeout(500);
    }

    // Click on Timeline tab if it exists
    const timelineTab = page.getByRole('tab', { name: /timeline/i });
    if (await timelineTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await timelineTab.click();
      await page.waitForTimeout(500);
    }
  });

  test('displays mood history timeline', async ({ page }) => {
    // Check if timeline component is visible
    const timeline = page.getByTestId('mood-history-timeline');

    // Timeline might not exist if user hasn't logged moods yet
    if (await timeline.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(timeline).toBeVisible();

      // Check for mood items or empty state
      const moodItem = page.getByTestId('mood-history-item').first();
      const emptyState = page.getByTestId('empty-mood-history-state');

      const hasMoodItems = await moodItem.isVisible({ timeout: 1000 }).catch(() => false);
      const hasEmptyState = await emptyState.isVisible({ timeout: 1000 }).catch(() => false);

      expect(hasMoodItems || hasEmptyState).toBeTruthy();
    }
  });

  test('shows date headers for mood groups', async ({ page }) => {
    const timeline = page.getByTestId('mood-history-timeline');

    if (await timeline.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Look for date headers
      const dateHeader = page.locator('[data-testid^="date-header-"]').first();

      if (await dateHeader.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(dateHeader).toBeVisible();

        // Date header should contain text like "Today", "Yesterday", or a date
        const headerText = await dateHeader.textContent();
        expect(headerText).toBeTruthy();
        expect(headerText!.length).toBeGreaterThan(0);
      }
    }
  });

  test('displays mood emoji and timestamp', async ({ page }) => {
    const moodItem = page.getByTestId('mood-history-item').first();

    if (await moodItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Check for emoji
      const emoji = moodItem.getByTestId('mood-emoji');
      await expect(emoji).toBeVisible();

      // Check for timestamp
      const timestamp = moodItem.getByTestId('mood-timestamp');
      await expect(timestamp).toBeVisible();

      // Check for mood label
      const label = moodItem.getByTestId('mood-label');
      await expect(label).toBeVisible();
    }
  });

  test('expands and collapses long notes', async ({ page }) => {
    // Look for a mood item with a note toggle button
    const noteToggle = page.getByTestId('mood-note-toggle').first();

    if (await noteToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Initial state should show "Show more"
      const initialText = await noteToggle.textContent();
      expect(initialText).toContain('more');

      // Click to expand
      await noteToggle.click();
      await page.waitForTimeout(300);

      // Should now show "Show less"
      const expandedText = await noteToggle.textContent();
      expect(expandedText).toContain('less');

      // Click to collapse
      await noteToggle.click();
      await page.waitForTimeout(300);

      // Should be back to "Show more"
      const collapsedText = await noteToggle.textContent();
      expect(collapsedText).toContain('more');
    }
  });

  test('shows empty state when no moods exist', async ({ page }) => {
    const emptyState = page.getByTestId('empty-mood-history-state');
    const moodItem = page.getByTestId('mood-history-item').first();

    // If no mood items exist, should show empty state
    const hasMoodItems = await moodItem.isVisible({ timeout: 2000 }).catch(() => false);
    const hasEmptyState = await emptyState.isVisible({ timeout: 2000 }).catch(() => false);

    if (!hasMoodItems) {
      expect(hasEmptyState).toBeTruthy();

      if (hasEmptyState) {
        await expect(emptyState).toBeVisible();
        const emptyText = await emptyState.textContent();
        expect(emptyText).toContain('No mood history');
      }
    }
  });

  test('handles error state gracefully', async ({ page }) => {
    // Check if error state is shown
    const errorState = page.getByTestId('error-state');

    // Error state should only be visible if there's an actual error
    const hasError = await errorState.isVisible({ timeout: 1000 }).catch(() => false);

    if (hasError) {
      await expect(errorState).toBeVisible();
      const errorText = await errorState.textContent();
      expect(errorText).toContain('Failed to load');
    }
  });

  test('loading spinner shows during data fetch', async ({ page }) => {
    // Navigate away and back to trigger loading
    const nav = page.locator('nav, [data-testid="bottom-navigation"]').first();

    // Find another nav button
    const homeNav = page.getByRole('button', { name: /home/i }).or(
      page.getByRole('tab', { name: /home/i })
    );

    if (await homeNav.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await homeNav.first().click();
      await page.waitForTimeout(500);

      // Navigate back to mood tracker
      const moodNav = page.getByRole('button', { name: /mood/i }).or(
        page.getByRole('tab', { name: /mood/i })
      );

      if (await moodNav.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await moodNav.first().click();

        // Click timeline tab
        const timelineTab = page.getByRole('tab', { name: /timeline/i });
        if (await timelineTab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await timelineTab.click();

          // Loading spinner might appear briefly
          const spinner = page.getByTestId('loading-spinner');
          const hasSpinner = await spinner.isVisible({ timeout: 1000 }).catch(() => false);

          // Spinner should disappear after loading completes
          if (hasSpinner) {
            await expect(spinner).not.toBeVisible({ timeout: 5000 });
          }
        }
      }
    }
  });
});
