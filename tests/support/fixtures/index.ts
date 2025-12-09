/**
 * Merged Test Fixtures
 *
 * Composes all fixtures using Playwright's mergeTests pattern.
 * Import { test, expect } from this file for all E2E tests.
 *
 * Usage:
 * ```typescript
 * import { test, expect } from '@/tests/support/fixtures';
 *
 * test('user can send love note', async ({ page, consoleMonitor, networkMonitor }) => {
 *   // Test has access to all composed fixtures
 * });
 * ```
 */
import { mergeTests, expect } from '@playwright/test';
import { test as baseFixture } from './baseFixture';
import { test as monitoredFixture } from './monitoredTest';
import { test as dataFixture } from './dataFixture';

/**
 * Merged test fixture combining:
 * - baseFixture: cleanApp, appWithMessages, appWithFavorites
 * - monitoredFixture: consoleMonitor, networkMonitor
 * - dataFixture: loveNoteFactory
 *
 * All fixtures auto-cleanup after test execution.
 */
export const test = mergeTests(baseFixture, monitoredFixture, dataFixture);

export { expect };

/**
 * Re-export individual fixtures for granular usage
 */
export { test as baseTest } from './baseFixture';
export { test as monitoredTest } from './monitoredTest';
export { test as dataTest } from './dataFixture';

/**
 * Re-export factory types for convenience
 */
export type { LoveNote, CreateLoveNoteParams } from './factories/love-note-factory';
