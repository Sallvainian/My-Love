/**
 * Smoke Test - Basic App Loading
 *
 * Verifies the app loads and renders without crashing.
 * This is the most critical test - if this fails, nothing else matters.
 */

import { test, expect } from '@playwright/test';

test('app loads and shows login or main screen', async ({ page }) => {
  await page.goto('/');

  // Wait for page to be fully loaded (critical for CI)
  await page.waitForLoadState('domcontentloaded');

  // App should show either login screen (if not authenticated)
  // or main app content (if authenticated via storageState)
  // Login has class "login-screen" with h1 "Welcome Back"
  // Main app has data-testid="app-container" and "bottom-navigation"
  const loginScreen = page.locator('.login-screen');
  const mainApp = page.locator('[data-testid="bottom-navigation"]');

  // Wait for either to be visible (whichever appears first)
  await expect(loginScreen.or(mainApp)).toBeVisible({ timeout: 10000 });

  // Set up console error listener
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Wait for page to be fully interactive by polling for stable state
  await expect
    .poll(
      async () => {
        // Check that page is interactive and document is ready
        const readyState = await page.evaluate(() => document.readyState);
        return readyState === 'complete';
      },
      { timeout: 5000, intervals: [100, 200, 500] }
    )
    .toBe(true);

  // Filter out known non-critical errors (like favicon 404)
  const criticalErrors = consoleErrors.filter(
    (err) => !err.includes('favicon') && !err.includes('404')
  );

  expect(criticalErrors).toHaveLength(0);
});
