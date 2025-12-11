/**
 * Merged Test Fixtures
 *
 * Single entry point for all test fixtures using Playwright's mergeTests.
 * Combines playwright-utils fixtures with app-specific fixtures.
 *
 * Usage:
 * ```typescript
 * import { test, expect } from '../support/fixtures';
 *
 * test('example', async ({ $, loveNotes, navigateToLoveNotes, log }) => {
 *   await log.step('Navigate to Love Notes');
 *   await navigateToLoveNotes();
 *   await loveNotes.messageInput.fill('Hello!');
 * });
 * ```
 *
 * @see .bmad/bmm/testarch/knowledge/fixtures-composition.md
 */

import { mergeTests, expect } from '@playwright/test';

// Playwright-utils fixtures
import { test as networkErrorMonitorFixture } from '@seontechnologies/playwright-utils/network-error-monitor/fixtures';
import { test as logFixture } from '@seontechnologies/playwright-utils/log/fixtures';

// Legacy fixtures (backward compatibility)
import { test as baseFixture } from './baseFixture';
import { test as monitoredFixture } from './monitoredTest';
import { test as dataFixture } from './dataFixture';

// New app-specific fixtures
import { test as appFixtures, type AppFixtures, type AppSection } from './app-fixtures';

/**
 * Merged test object with all fixtures.
 *
 * Available fixtures:
 *
 * NEW (TEA-compliant):
 * - `$` - Strict selector interface (accessibility-first)
 * - `loveNotes` - Love Notes domain selectors
 * - `navigateToLoveNotes` - Navigate to Love Notes with network-first pattern
 * - `navigateToSection` - Navigate to any app section
 * - `waitForAppReady` - Wait for app to be ready
 * - `clearAppState` - Clear localStorage/IndexedDB
 * - `log` - Playwright report logging (from playwright-utils)
 * - Network error monitoring (auto-enabled, opt-out with skipNetworkMonitoring annotation)
 *
 * LEGACY (for backward compatibility):
 * - `cleanApp` - Fresh application state
 * - `appWithMessages` - App with default messages
 * - `appWithFavorites` - App with pre-favorited messages
 * - `consoleMonitor` - Console error detection
 * - `networkMonitor` - Network request validation
 * - `loveNoteFactory` - Data factory for love notes
 *
 * @example
 * ```typescript
 * import { test, expect } from '../support/fixtures';
 *
 * // NEW pattern (recommended)
 * test('send message', async ({ loveNotes, navigateToLoveNotes, log }) => {
 *   await log.step('Navigate to Love Notes');
 *   await navigateToLoveNotes();
 *
 *   await log.step('Send message');
 *   await loveNotes.messageInput.fill('Hello!');
 *   await loveNotes.sendButton.click();
 *
 *   await expect(loveNotes.getMessageByText('Hello!')).toBeVisible();
 * });
 *
 * // LEGACY pattern (still works)
 * test('with legacy fixtures', async ({ cleanApp, consoleMonitor }) => {
 *   // Legacy fixtures still available
 * });
 * ```
 */
export const test = mergeTests(
  // Network error monitoring: auto-fail on 4xx/5xx errors
  networkErrorMonitorFixture,

  // Logging: structured logs in Playwright report
  logFixture,

  // Legacy fixtures (backward compatibility)
  baseFixture,
  monitoredFixture,
  dataFixture,

  // New app-specific fixtures: $, loveNotes, navigation, etc.
  appFixtures
);

// Re-export expect for convenience
export { expect };

// Re-export types for type annotations
export type { AppFixtures, AppSection };

// Re-export helpers from app-fixtures
export { describeLoveNotes, skipNetworkMonitoringAnnotation } from './app-fixtures';

// Re-export selectors for direct use
export {
  createSelectors,
  createScopedSelectors,
  filterByText,
  filterByChild,
  assertVisible,
  assertHidden,
} from '../selectors';
export type { StrictPage, StrictSelectors, RoleType } from '../selectors';

// Re-export love notes utilities
export {
  loveNotesSelectors,
  createMockMessage,
  createMockMessages,
  setupMockApi,
  waitForMessagesLoaded,
  LOVE_NOTES_API,
} from '../selectors/love-notes';
export type { LoveNotesSelectors } from '../selectors/love-notes';

/**
 * Annotations for test configuration
 */
export const annotations = {
  /**
   * Skip network error monitoring for this test.
   * Use for tests that intentionally trigger errors.
   */
  skipNetworkMonitoring: { type: 'skipNetworkMonitoring' },
} as const;

/**
 * Test configuration helpers
 */
export const testConfig = {
  /**
   * Configure test to skip network monitoring.
   *
   * @example
   * ```typescript
   * test('handles 500 error', testConfig.skipNetworkMonitoring, async ({ page }) => {
   *   // Test won't fail on 500 errors
   * });
   * ```
   */
  skipNetworkMonitoring: {
    annotation: [annotations.skipNetworkMonitoring],
  },
} as const;

/**
 * Re-export individual fixtures for granular usage (legacy)
 */
export { test as baseTest } from './baseFixture';
export { test as monitoredTest } from './monitoredTest';
export { test as dataTest } from './dataFixture';

/**
 * Re-export factory types for convenience (legacy)
 */
export type { LoveNote, CreateLoveNoteParams } from './factories/love-note-factory';
