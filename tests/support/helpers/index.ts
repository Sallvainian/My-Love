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
 * Wait for a condition with polling
 * @param condition - Function that returns true when condition is met
 * @param options - Timeout and interval options
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {},
): Promise<void> {
  const { timeout = 10000, interval = 100 } = options;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

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
  } = {},
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
export async function fillForm(
  page: Page,
  fields: Record<string, string>,
): Promise<void> {
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
  } = {},
): Promise<Locator> {
  const { timeout = 5000, selector = '[role="status"], [role="alert"], .toast', exact = false } = options;

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

/**
 * Sleep for a specified duration (use sparingly - prefer Playwright auto-waiting)
 * @param ms - Milliseconds to sleep
 */
export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff
 * @param fn - Async function to retry
 * @param options - Retry configuration
 * @returns Result of the function
 * @example
 * const data = await retry(
 *   () => fetchData(),
 *   { maxAttempts: 3, initialDelay: 1000 }
 * );
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    backoffMultiplier?: number;
    maxDelay?: number;
  } = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    backoffMultiplier = 2,
    maxDelay = 10000,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        throw new Error(
          `Failed after ${maxAttempts} attempts. Last error: ${lastError.message}`
        );
      }

      await sleep(Math.min(delay, maxDelay));
      delay *= backoffMultiplier;
    }
  }

  throw lastError; // TypeScript needs this, though unreachable
}
