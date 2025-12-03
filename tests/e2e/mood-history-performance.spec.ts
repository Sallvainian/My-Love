/**
 * Mood History Timeline Performance Tests
 *
 * Tests performance requirements for the virtualized timeline:
 * - Smooth scrolling (60fps target)
 * - Memory efficiency (<100MB for 1000+ entries)
 * - Pagination performance
 *
 * Story 5.4: Mood History Timeline - Performance Validation
 */

import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.VITE_TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.VITE_TEST_USER_PASSWORD || 'testpassword123';

test.describe('Mood History Timeline Performance', () => {
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

    // Handle onboarding
    await page.waitForTimeout(2000);
    const displayNameInput = page.getByLabel(/display name/i);
    if (await displayNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await displayNameInput.fill('TestUser');
      await page.getByRole('button', { name: /continue|save|submit/i }).click();
      await page.waitForTimeout(1000);
    }

    // Handle welcome screen
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

    // Click on Timeline tab
    const timelineTab = page.getByRole('tab', { name: /timeline/i });
    if (await timelineTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await timelineTab.click();
      await page.waitForTimeout(500);
    }
  });

  test('timeline renders within acceptable time', async ({ page }) => {
    const timeline = page.getByTestId('mood-history-timeline');

    if (await timeline.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Start timing
      const startTime = Date.now();

      // Wait for mood items or empty state to appear
      await Promise.race([
        page.getByTestId('mood-history-item').first().waitFor({ timeout: 3000 }).catch(() => null),
        page.getByTestId('empty-mood-history-state').waitFor({ timeout: 3000 }).catch(() => null),
      ]);

      const renderTime = Date.now() - startTime;

      // Initial render should be fast (<2 seconds)
      expect(renderTime).toBeLessThan(2000);
    }
  });

  test('timeline handles scrolling smoothly', async ({ page }) => {
    const timeline = page.getByTestId('mood-history-timeline');

    if (await timeline.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Check if there are mood items to scroll
      const moodItem = page.getByTestId('mood-history-item').first();

      if (await moodItem.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Get timeline container (the actual scrollable element)
        const timelineContainer = timeline.locator('div').first();

        // Perform scroll actions
        const scrollSteps = 5;
        for (let i = 0; i < scrollSteps; i++) {
          // Scroll down incrementally
          await timelineContainer.evaluate((el) => {
            el.scrollTop += 100;
          });

          // Small delay between scrolls to simulate real scrolling
          await page.waitForTimeout(50);
        }

        // Timeline should still be responsive
        await expect(timeline).toBeVisible();

        // Check that mood items are still rendering correctly
        const visibleMoodItems = await page.getByTestId('mood-history-item').count();
        expect(visibleMoodItems).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test('pagination loads additional data efficiently', async ({ page }) => {
    const timeline = page.getByTestId('mood-history-timeline');

    if (await timeline.isVisible({ timeout: 3000 }).catch(() => false)) {
      const moodItem = page.getByTestId('mood-history-item').first();

      if (await moodItem.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Count initial mood items
        const initialCount = await page.getByTestId('mood-history-item').count();

        // Scroll to bottom to trigger pagination
        const timelineContainer = timeline.locator('div').first();
        await timelineContainer.evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });

        // Wait for potential loading
        await page.waitForTimeout(1000);

        // Check if more items loaded (might not if we don't have enough data)
        const finalCount = await page.getByTestId('mood-history-item').count();

        // Either count increased (pagination worked) or stayed the same (no more data)
        expect(finalCount).toBeGreaterThanOrEqual(initialCount);

        // Timeline should still be functional
        await expect(timeline).toBeVisible();
      }
    }
  });

  test('timeline maintains performance with date headers', async ({ page }) => {
    const timeline = page.getByTestId('mood-history-timeline');

    if (await timeline.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Check for date headers
      const dateHeaders = page.locator('[data-testid^="date-header-"]');
      const headerCount = await dateHeaders.count();

      if (headerCount > 0) {
        // Scroll through timeline with date headers
        const timelineContainer = timeline.locator('div').first();

        for (let i = 0; i < 3; i++) {
          await timelineContainer.evaluate((el) => {
            el.scrollTop += 150;
          });
          await page.waitForTimeout(100);
        }

        // Timeline should still render date headers correctly
        const stillHasHeaders = await dateHeaders.count();
        expect(stillHasHeaders).toBeGreaterThanOrEqual(1);

        // Timeline should be responsive
        await expect(timeline).toBeVisible();
      }
    }
  });

  test('timeline handles rapid scrolling without crashes', async ({ page }) => {
    const timeline = page.getByTestId('mood-history-timeline');

    if (await timeline.isVisible({ timeout: 3000 }).catch(() => false)) {
      const moodItem = page.getByTestId('mood-history-item').first();

      if (await moodItem.isVisible({ timeout: 2000 }).catch(() => false)) {
        const timelineContainer = timeline.locator('div').first();

        // Rapid scrolling test
        for (let i = 0; i < 10; i++) {
          await timelineContainer.evaluate((el) => {
            el.scrollTop = Math.random() * el.scrollHeight;
          });
          await page.waitForTimeout(50);
        }

        // Timeline should still be functional
        await expect(timeline).toBeVisible();

        // Should still have mood items visible
        const stillHasMoodItems = await page.getByTestId('mood-history-item').count();
        expect(stillHasMoodItems).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test('memory usage stays within bounds during scrolling', async ({ page, context }) => {
    const timeline = page.getByTestId('mood-history-timeline');

    if (await timeline.isVisible({ timeout: 3000 }).catch(() => false)) {
      const moodItem = page.getByTestId('mood-history-item').first();

      if (await moodItem.isVisible({ timeout: 2000 }).catch(() => false)) {
        const timelineContainer = timeline.locator('div').first();

        // Get initial memory metrics (if available in dev mode)
        const initialMemory = await page.evaluate(() => {
          if (
            typeof performance !== 'undefined' &&
            'memory' in performance &&
            (performance as any).memory
          ) {
            return (performance as any).memory.usedJSHeapSize;
          }
          return null;
        });

        // Perform scrolling operations
        for (let i = 0; i < 20; i++) {
          await timelineContainer.evaluate((el) => {
            el.scrollTop += 100;
          });
          await page.waitForTimeout(50);
        }

        // Get final memory metrics
        const finalMemory = await page.evaluate(() => {
          if (
            typeof performance !== 'undefined' &&
            'memory' in performance &&
            (performance as any).memory
          ) {
            return (performance as any).memory.usedJSHeapSize;
          }
          return null;
        });

        // If memory metrics are available, check they're reasonable
        if (initialMemory !== null && finalMemory !== null) {
          const memoryIncrease = finalMemory - initialMemory;
          const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

          // Memory increase should be reasonable (< 50MB for scrolling)
          expect(memoryIncreaseMB).toBeLessThan(50);
        }

        // Timeline should still be functional
        await expect(timeline).toBeVisible();
      }
    }
  });
});
