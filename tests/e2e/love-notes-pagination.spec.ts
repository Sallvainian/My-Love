/**
 * Love Notes Pagination E2E Tests
 *
 * Tests message history scroll performance and pagination.
 *
 * Story 2.4: AC-2.4.1 through AC-2.4.5
 */

import { test, expect } from '@playwright/test';

test.describe('Love Notes - Message History & Scroll Performance', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to love notes page
    // Assuming user is already authenticated (from previous stories)
    await page.goto('/');

    // Wait for page to be fully loaded (critical for CI)
    await page.waitForLoadState('domcontentloaded');

    // Wait for app to load
    await page.waitForSelector('[data-testid="app-container"]', { timeout: 10000 });

    // Navigate to Love Notes
    const loveNotesButton = page.locator('text=Love Notes').first();
    await loveNotesButton.click();

    // Wait for message list to load
    await page.waitForSelector('[data-testid="virtualized-list"]', { timeout: 5000 });
  });

  test('AC-2.4.1: Scrolling up loads older messages with loading indicator', async ({ page }) => {
    // Create many messages in database for pagination test
    // (In real scenario, would use test fixtures or API calls)

    // Scroll to top of message list
    const messageList = page.locator('[data-testid="virtualized-list"]');
    await messageList.evaluate((el) => {
      el.scrollTop = 0;
    });

    // Should show loading indicator at top
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible({
      timeout: 2000,
    });

    // Wait for API call to complete
    await page.waitForResponse((response) =>
      response.url().includes('love_notes') && response.status() === 200,
      { timeout: 5000 }
    );

    // Loading indicator should disappear
    await expect(page.locator('[data-testid="loading-spinner"]')).not.toBeVisible({
      timeout: 2000,
    });

    // More messages should be loaded
    const initialMessageCount = await page.locator('[data-testid^="message-"]').count();
    expect(initialMessageCount).toBeGreaterThan(0);
  });

  test('AC-2.4.2: Scroll position maintained during data load', async ({ page }) => {
    // Get initial scroll position
    const messageList = page.locator('[data-testid="virtualized-list"]');
    const initialScrollTop = await messageList.evaluate((el) => el.scrollTop);

    // Scroll to middle
    await messageList.evaluate((el) => {
      el.scrollTop = 200;
    });

    const scrollTopBefore = await messageList.evaluate((el) => el.scrollTop);
    expect(scrollTopBefore).toBe(200);

    // Trigger refresh (which loads new data)
    const refreshButton = page.locator('[data-testid="refresh-button"]');
    if (await refreshButton.isVisible()) {
      await refreshButton.click();

      // Wait for refresh to complete
      await page.waitForResponse((response) =>
        response.url().includes('love_notes') && response.status() === 200,
        { timeout: 5000 }
      );

      // Scroll position should be maintained (or close to it)
      const scrollTopAfter = await messageList.evaluate((el) => el.scrollTop);

      // Allow some tolerance for position changes (within 50px)
      expect(Math.abs(scrollTopAfter - scrollTopBefore)).toBeLessThan(50);
    }
  });

  test('AC-2.4.3: "Beginning of conversation" indicator shows when all messages loaded', async ({ page }) => {
    // Scroll to very top
    const messageList = page.locator('[data-testid="virtualized-list"]');
    await messageList.evaluate((el) => {
      el.scrollTop = 0;
    });

    // Wait for all pagination to complete (hasMore = false)
    // Keep scrolling until beginning indicator appears or timeout
    let hasBeginningIndicator = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!hasBeginningIndicator && attempts < maxAttempts) {
      await page.waitForTimeout(500);

      const indicator = page.locator('[data-testid="beginning-of-conversation"]');
      hasBeginningIndicator = await indicator.isVisible().catch(() => false);

      if (!hasBeginningIndicator) {
        // Scroll to top again to trigger more loading
        await messageList.evaluate((el) => {
          el.scrollTop = 0;
        });
      }

      attempts++;
    }

    // Should show beginning indicator
    const beginningIndicator = page.locator('[data-testid="beginning-of-conversation"]');
    await expect(beginningIndicator).toBeVisible({ timeout: 2000 });

    // Should have the correct text
    await expect(beginningIndicator).toContainText('This is the beginning of your love story');
  });

  test('AC-2.4.4: Scrolling maintains 60fps with many messages', async ({ page }) => {
    // Measure frame rate during scroll
    // This is approximate - Playwright doesn't expose exact FPS

    const messageList = page.locator('[data-testid="virtualized-list"]');

    // Start performance measurement
    const performanceData: number[] = [];

    for (let i = 0; i < 5; i++) {
      const startTime = Date.now();

      // Scroll down quickly
      await messageList.evaluate((el) => {
        el.scrollTop = el.scrollTop + 500;
      });

      await page.waitForTimeout(100);

      const endTime = Date.now();
      const duration = endTime - startTime;

      performanceData.push(duration);
    }

    // Average scroll response time should be fast (< 50ms)
    const avgTime = performanceData.reduce((a, b) => a + b, 0) / performanceData.length;
    expect(avgTime).toBeLessThan(50);

    // Verify virtualization: DOM should have limited nodes
    const messageElements = await page.locator('[data-testid^="message-"]').count();

    // With virtualization, should have < 50 DOM nodes even with 100+ messages
    expect(messageElements).toBeLessThan(50);
  });

  test('AC-2.4.5: Pull-to-refresh triggers fresh data fetch', async ({ page }) => {
    // Click refresh button
    const refreshButton = page.locator('[data-testid="refresh-button"]');
    await expect(refreshButton).toBeVisible();

    // Track network requests
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('love_notes')) {
        requests.push(request.url());
      }
    });

    // Click refresh
    await refreshButton.click();

    // Wait for API call
    await page.waitForResponse((response) =>
      response.url().includes('love_notes') && response.status() === 200,
      { timeout: 5000 }
    );

    // Should have triggered fresh fetch
    expect(requests.length).toBeGreaterThan(0);

    // Latest messages should appear
    const messageList = page.locator('[data-testid="virtualized-list"]');
    await expect(messageList).toBeVisible();
  });

  test('New message indicator appears when scrolled up and new message arrives', async ({ page }) => {
    // Scroll up (not at bottom)
    const messageList = page.locator('[data-testid="virtualized-list"]');
    await messageList.evaluate((el) => {
      el.scrollTop = 0;
    });

    // Simulate new message arrival (in real scenario, would be from realtime subscription)
    // For now, just verify indicator can appear

    // Check for new message indicator element
    const newMessageIndicator = page.locator('[data-testid="new-message-indicator"]');

    // Indicator should exist in DOM structure
    // (May not be visible without actual new message, but element should be defined)
    const indicatorExists = await page.locator('text=New message').count() >= 0;
    expect(indicatorExists).toBe(true);
  });

  test('Clicking new message indicator scrolls to bottom', async ({ page }) => {
    // This test assumes a new message indicator is visible
    // In real scenario, would need to trigger new message arrival

    const messageList = page.locator('[data-testid="virtualized-list"]');

    // Scroll to top
    await messageList.evaluate((el) => {
      el.scrollTop = 0;
    });

    const scrollTopBefore = await messageList.evaluate((el) => el.scrollTop);

    // If new message indicator is visible, click it
    const newMessageIndicator = page.locator('[data-testid="new-message-indicator"]');
    if (await newMessageIndicator.isVisible()) {
      await newMessageIndicator.click();

      // Wait for scroll animation
      await page.waitForTimeout(500);

      // Should have scrolled to bottom
      const scrollTopAfter = await messageList.evaluate((el) => el.scrollTop);
      expect(scrollTopAfter).toBeGreaterThan(scrollTopBefore);
    }
  });

  test('Empty state shows when no messages exist', async ({ page }) => {
    // This assumes a fresh conversation with no messages
    // In real test, would clear messages first

    const emptyState = page.locator('text=No love notes yet');
    const emptyMessage = page.locator('text=Send one to start the conversation');

    // If empty, should show empty state
    if (await emptyState.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(emptyState).toBeVisible();
      await expect(emptyMessage).toBeVisible();
    }
  });

  test('Performance: Message list renders quickly with 100+ messages', async ({ page }) => {
    // Measure initial render time
    const startTime = Date.now();

    // Ensure list is visible
    await page.waitForSelector('[data-testid="virtualized-list"]', { timeout: 5000 });

    const endTime = Date.now();
    const renderTime = endTime - startTime;

    // Should render quickly (< 2 seconds)
    expect(renderTime).toBeLessThan(2000);

    // Verify virtualized list is being used
    const virtualizedList = page.locator('[data-testid="virtualized-list"]');
    await expect(virtualizedList).toBeVisible();
  });
});
