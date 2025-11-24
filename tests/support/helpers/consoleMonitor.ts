import { Page, ConsoleMessage } from '@playwright/test';

/**
 * Console Monitoring Helper for Playwright Tests
 *
 * Automatically captures and validates console messages during tests.
 * Addresses Epic 0 Finding: Manual DevTools console validation (AC-0.4.4)
 * created 2-day delay in Story 0.4.
 *
 * Usage:
 * ```typescript
 * import { setupConsoleMonitor } from '../support/helpers/consoleMonitor';
 *
 * test('should have no console errors', async ({ page }) => {
 *   const monitor = setupConsoleMonitor(page);
 *   await page.goto('/');
 *
 *   // Your test logic here
 *
 *   expect(monitor.getErrors()).toHaveLength(0);
 * });
 * ```
 */

export interface ConsoleEntry {
  type: 'log' | 'warn' | 'error' | 'info' | 'debug';
  text: string;
  timestamp: number;
  location?: string;
}

export class ConsoleMonitor {
  private messages: ConsoleEntry[] = [];
  private isActive = false;

  constructor(private page: Page) {}

  /**
   * Start monitoring console messages
   */
  start(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.page.on('console', this.handleConsoleMessage);
  }

  /**
   * Stop monitoring console messages
   */
  stop(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.page.off('console', this.handleConsoleMessage);
  }

  /**
   * Internal handler for console messages
   */
  private handleConsoleMessage = (msg: ConsoleMessage) => {
    const entry: ConsoleEntry = {
      type: msg.type() as ConsoleEntry['type'],
      text: msg.text(),
      timestamp: Date.now(),
      location: msg.location().url || undefined,
    };

    this.messages.push(entry);
  };

  /**
   * Get all captured messages
   */
  getAll(): ConsoleEntry[] {
    return [...this.messages];
  }

  /**
   * Get only error messages
   */
  getErrors(): ConsoleEntry[] {
    return this.messages.filter((m) => m.type === 'error');
  }

  /**
   * Get only warning messages
   */
  getWarnings(): ConsoleEntry[] {
    return this.messages.filter((m) => m.type === 'warn');
  }

  /**
   * Get logs of a specific type
   */
  getByType(type: ConsoleEntry['type']): ConsoleEntry[] {
    return this.messages.filter((m) => m.type === type);
  }

  /**
   * Filter messages by text pattern
   */
  findByPattern(pattern: string | RegExp): ConsoleEntry[] {
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
    return this.messages.filter((m) => regex.test(m.text));
  }

  /**
   * Check if there are any errors
   */
  hasErrors(): boolean {
    return this.getErrors().length > 0;
  }

  /**
   * Check if there are any warnings
   */
  hasWarnings(): boolean {
    return this.getWarnings().length > 0;
  }

  /**
   * Clear all captured messages
   */
  clear(): void {
    this.messages = [];
  }

  /**
   * Get formatted summary of console activity
   */
  getSummary(): string {
    const errors = this.getErrors().length;
    const warnings = this.getWarnings().length;
    const logs = this.getByType('log').length;
    const total = this.messages.length;

    return `Console Summary: ${total} messages (${errors} errors, ${warnings} warnings, ${logs} logs)`;
  }

  /**
   * Format error messages for assertion output
   */
  formatErrors(): string {
    const errors = this.getErrors();
    if (errors.length === 0) return 'No console errors';

    return errors
      .map((e, i) => `${i + 1}. [${e.type.toUpperCase()}] ${e.text}\n   Location: ${e.location || 'unknown'}`)
      .join('\n');
  }
}

/**
 * Setup console monitoring for a page
 *
 * @param page Playwright Page instance
 * @param autoStart Whether to start monitoring immediately (default: true)
 * @returns ConsoleMonitor instance
 *
 * @example
 * ```typescript
 * const monitor = setupConsoleMonitor(page);
 * await page.goto('/');
 *
 * // Assert no errors during page load
 * expect(monitor.getErrors()).toHaveLength(0);
 * ```
 */
export function setupConsoleMonitor(page: Page, autoStart = true): ConsoleMonitor {
  const monitor = new ConsoleMonitor(page);
  if (autoStart) {
    monitor.start();
  }
  return monitor;
}

/**
 * Common console error patterns to ignore (framework noise)
 * Use with filterIgnoredErrors() to reduce false positives
 */
export const IGNORED_ERROR_PATTERNS = [
  /Download the React DevTools/i,
  /React DevTools/i,
  /Failed to load resource: net::ERR_BLOCKED_BY_CLIENT/i, // Ad blockers
  /Uncaught Error: ResizeObserver loop/i, // Common benign error
  /\[Zustand Persist\] .* is not an array - resetting to empty Map/i, // Known Zustand migration issue
];

/**
 * Filter out known ignorable console errors
 *
 * @param errors Array of console entries
 * @param customIgnorePatterns Additional patterns to ignore
 * @returns Filtered array with only actionable errors
 */
export function filterIgnoredErrors(
  errors: ConsoleEntry[],
  customIgnorePatterns: RegExp[] = []
): ConsoleEntry[] {
  const allPatterns = [...IGNORED_ERROR_PATTERNS, ...customIgnorePatterns];

  return errors.filter((error) => {
    return !allPatterns.some((pattern) => pattern.test(error.text));
  });
}
