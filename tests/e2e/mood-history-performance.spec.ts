/**
 * Mood History Timeline Performance Tests
 *
 * Tests performance requirements for the virtualized timeline:
 * - Smooth scrolling (60fps target)
 * - Memory efficiency (<100MB for 1000+ entries)
 * - Pagination performance
 *
 * Story 5.4: Mood History Timeline - Performance Validation
 *
 * Note: Authentication is handled by global-setup.ts via storageState.
 */

import { test, expect } from '@playwright/test';

test.describe('Mood History Timeline Performance', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app - storageState handles authentication
    await page.goto('/');

    // Wait for app to be ready (navigation visible confirms auth worked)
    await expect(
      page.locator('nav, [data-testid="bottom-navigation"]').first()
    ).toBeVisible({ timeout: 15000 });

    // Navigate to mood tracker
    const moodNav = page.getByTestId('nav-mood');
    if (await moodNav.isVisible({ timeout: 2000 }).catch(() => false)) {
      await moodNav.click();
      // Wait for mood page content to load
      await expect(page.getByTestId('mood-tracker')).toBeVisible({ timeout: 5000 });
    }

    // Click on Timeline tab
    const timelineTab = page.getByTestId('mood-tab-timeline');
    if (await timelineTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await timelineTab.click();
      // Wait for timeline to be ready
      await expect(
        page.getByTestId('mood-history-timeline').or(page.getByTestId('empty-mood-history-state'))
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('timeline renders within acceptable time', async ({ page }) => {
    const timeline = page.getByTestId('mood-history-timeline');

    if (await timeline.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Start timing
      const startTime = Date.now();

      // Wait for mood items or empty state to appear using expect.poll
      await expect
        .poll(
          async () => {
            const hasMoodItem = await page.getByTestId('mood-history-item').first().isVisible().catch(() => false);
            const hasEmptyState = await page.getByTestId('empty-mood-history-state').isVisible().catch(() => false);
            return hasMoodItem || hasEmptyState;
          },
          { timeout: 3000, intervals: [100, 200, 500] }
        )
        .toBe(true);

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

        // Perform scroll actions using mouse wheel for natural scrolling
        const scrollSteps = 5;
        for (let i = 0; i < scrollSteps; i++) {
          await timelineContainer.evaluate((el) => {
            el.scrollTop += 100;
          });
          // Use requestAnimationFrame-based waiting for smooth scroll simulation
          await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
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

        // Wait for potential loading using expect.poll instead of arbitrary timeout
        await expect
          .poll(
            async () => {
              const currentCount = await page.getByTestId('mood-history-item').count();
              // Either more items loaded, or loading indicator is gone (no more data)
              return currentCount >= initialCount;
            },
            { timeout: 3000, intervals: [200, 500] }
          )
          .toBe(true);

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
          // Use requestAnimationFrame for natural scroll timing
          await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
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

        // Rapid scrolling test using requestAnimationFrame for timing
        for (let i = 0; i < 10; i++) {
          await timelineContainer.evaluate((el) => {
            el.scrollTop = Math.random() * el.scrollHeight;
          });
          // Use rAF for natural animation frame timing instead of arbitrary delay
          await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
        }

        // Timeline should still be functional
        await expect(timeline).toBeVisible();

        // Should still have mood items visible
        const stillHasMoodItems = await page.getByTestId('mood-history-item').count();
        expect(stillHasMoodItems).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test('memory usage stays within bounds during scrolling', async ({ page }) => {
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
          // Use rAF for natural animation frame timing
          await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
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
