/**
 * Smoke Test - Basic App Loading
 *
 * Verifies the app loads and renders without crashing.
 * This is the most critical test - if this fails, nothing else matters.
 */

import { test, expect } from '@playwright/test';

test('app loads and shows login or main screen', async ({ page }) => {
  await page.goto('/');

  // App should show either login screen (if not authenticated)
  // or main app content (if authenticated)
  const loginHeading = page.getByRole('heading', { name: /welcome back|sign in|login/i });
  const mainContent = page.locator('[data-testid="main-content"], main, [role="main"]');

  // Wait for either to be visible (whichever appears first)
  await expect(loginHeading.or(mainContent)).toBeVisible({ timeout: 10000 });

  // No console errors should be present
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Give a moment for any async errors to surface
  await page.waitForTimeout(1000);

  // Filter out known non-critical errors (like favicon 404)
  const criticalErrors = consoleErrors.filter(
    err => !err.includes('favicon') && !err.includes('404')
  );

  expect(criticalErrors).toHaveLength(0);
});
