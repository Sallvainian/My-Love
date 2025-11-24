import { test as base, expect } from '@playwright/test';
import { ConsoleMonitor, setupConsoleMonitor } from '../helpers/consoleMonitor';
import { NetworkMonitor, setupNetworkMonitor } from '../helpers/networkMonitor';

/**
 * Enhanced Test Fixture with Automatic Console & Network Monitoring
 *
 * This fixture extends Playwright's base test with automatic monitoring capabilities.
 * Addresses Epic 0 retrospective findings: Manual DevTools validation created 2-day delays.
 *
 * Features:
 * - Automatic console error detection
 * - Network request validation
 * - Supabase API health checking
 * - Built-in assertions for common validation scenarios
 *
 * Usage:
 * ```typescript
 * import { test, expect } from '../support/fixtures/monitoredTest';
 *
 * test('loads without console errors', async ({ page, consoleMonitor }) => {
 *   await page.goto('/');
 *   expect(consoleMonitor.getErrors()).toHaveLength(0);
 * });
 *
 * test('connects to Supabase', async ({ page, networkMonitor }) => {
 *   await page.goto('/');
 *   const supabase = networkMonitor.getByDomain('supabase.co');
 *   expect(supabase.length).toBeGreaterThan(0);
 * });
 * ```
 */

interface MonitoredTestFixtures {
  consoleMonitor: ConsoleMonitor;
  networkMonitor: NetworkMonitor;
}

/**
 * Monitored test fixture with automatic console and network monitoring
 */
export const test = base.extend<MonitoredTestFixtures>({
  consoleMonitor: async ({ page }, use) => {
    const monitor = setupConsoleMonitor(page, true);
    await use(monitor);
    monitor.stop();
  },

  networkMonitor: async ({ page }, use) => {
    const monitor = setupNetworkMonitor(page, true);
    await use(monitor);
    monitor.stop();
  },
});

export { expect };

/**
 * Custom matchers for common validation scenarios
 */

/**
 * Assert no console errors occurred during test
 * Usage: expect(consoleMonitor).toHaveNoErrors()
 */
expect.extend({
  toHaveNoErrors(received: ConsoleMonitor) {
    const errors = received.getErrors();
    const pass = errors.length === 0;

    return {
      pass,
      message: () =>
        pass
          ? `Expected console errors, but none were found`
          : `Expected no console errors, but found ${errors.length}:\n${received.formatErrors()}`,
    };
  },

  toHaveNoFailedRequests(received: NetworkMonitor) {
    const failures = received.getFailed();
    const pass = failures.length === 0;

    return {
      pass,
      message: () =>
        pass
          ? `Expected failed network requests, but none were found`
          : `Expected no failed requests, but found ${failures.length}:\n${received.formatFailures()}`,
    };
  },

  toHaveSupabaseConnection(received: NetworkMonitor) {
    const supabase = received.getByDomain('supabase.co');
    const pass = supabase.length > 0 && supabase.every((r) => (r.status || 0) < 400);

    return {
      pass,
      message: () =>
        pass
          ? `Expected no Supabase connection, but ${supabase.length} requests were successful`
          : supabase.length === 0
            ? `Expected Supabase connection, but no requests to supabase.co were found`
            : `Expected successful Supabase connection, but some requests failed:\n${received.formatFailures()}`,
    };
  },
});

// TypeScript declaration merging for custom matchers
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Required for Playwright custom matcher type declarations
  namespace PlaywrightTest {
    interface Matchers<R> {
      toHaveNoErrors(): R;
      toHaveNoFailedRequests(): R;
      toHaveSupabaseConnection(): R;
    }
  }
}
