/**
 * Test Helpers
 *
 * Pure functions that can be used across tests.
 * These are NOT fixtures - they are utility functions.
 *
 * For fixture-based utilities, use merged-fixtures.ts.
 */

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
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${prefix}-${timestamp}-${random}@test.example.com`;
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
