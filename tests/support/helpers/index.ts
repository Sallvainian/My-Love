/**
 * Test Helpers
 *
 * Pure functions that can be used across tests.
 * These are NOT fixtures - they are utility functions.
 *
 * For fixture-based utilities, use merged-fixtures.ts.
 */

import type { Page, Locator } from '@playwright/test';
import { faker } from '@faker-js/faker';

/**
 * Generate a unique test email
 */
export function generateTestEmail(prefix = 'test'): string {
  return faker.internet.email({ firstName: prefix });
}

/**
 * Format date for display assertions
 */
export function formatTestDate(date: Date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Build a data-testid selector
 * @param testId - The test ID value
 * @returns Selector string for data-testid attribute
 * @example getTestId('submit-button') // => '[data-testid="submit-button"]'
 */
export function getTestId(testId: string): string {
  return `[data-testid="${testId}"]`;
}

/**
 * Click an element and wait for navigation to complete
 * @param page - Playwright page object
 * @param selector - Element selector or locator
 * @param options - Click and navigation options
 * @example await clickAndNavigate(page, getTestId('login-button'))
 */
export async function clickAndNavigate(
  page: Page,
  selector: string | Locator,
  options: {
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
    timeout?: number;
  } = {}
): Promise<void> {
  const { waitUntil = 'domcontentloaded', timeout } = options;

  await Promise.all([
    page.waitForURL('**', { waitUntil, timeout }),
    typeof selector === 'string' ? page.click(selector) : selector.click(),
  ]);
}

/**
 * Fill multiple form fields at once
 * @param page - Playwright page object
 * @param fields - Object mapping selectors to values
 * @example
 * await fillForm(page, {
 *   '[data-testid="email"]': 'user@example.com',
 *   '[data-testid="password"]': 'password123'
 * })
 */
export async function fillForm(page: Page, fields: Record<string, string>): Promise<void> {
  for (const [selector, value] of Object.entries(fields)) {
    await page.fill(selector, value);
  }
}

/**
 * Wait for a toast/notification to appear with specific text
 * @param page - Playwright page object
 * @param message - Expected toast message (can be partial match)
 * @param options - Timeout and selector options
 * @returns The toast locator for further assertions
 * @example
 * const toast = await expectToast(page, 'Successfully saved');
 * await expect(toast).toBeVisible();
 */
export async function expectToast(
  page: Page,
  message: string,
  options: {
    timeout?: number;
    selector?: string;
    exact?: boolean;
  } = {}
): Promise<Locator> {
  const {
    timeout = 5000,
    selector = '[role="status"], [role="alert"], .toast',
    exact = false,
  } = options;

  const toast = page.locator(selector, { hasText: exact ? message : undefined });

  if (!exact) {
    // Wait for any toast matching the selector, then check text
    await toast.first().waitFor({ state: 'visible', timeout });
    const text = await toast.first().textContent();
    if (!text?.includes(message)) {
      throw new Error(`Toast visible but does not contain "${message}". Found: "${text}"`);
    }
  } else {
    await toast.first().waitFor({ state: 'visible', timeout });
  }

  return toast.first();
}

/**
 * Generate a random string for test data
 * @param length - Length of random string (default: 8)
 */
export function randomString(length = 8): string {
  return faker.string.alphanumeric(length);
}
