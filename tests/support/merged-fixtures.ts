/**
 * Merged Fixtures for Playwright Tests
 *
 * Combines @seontechnologies/playwright-utils fixtures with custom project fixtures.
 * Import { test, expect } from this file in all test files.
 *
 * @see https://github.com/seontechnologies/playwright-utils
 * @see _bmad/bmm/testarch/knowledge/fixtures-composition.md
 */
import { test as base, mergeTests } from '@playwright/test';

// Playwright-utils fixtures (production-ready utilities)
import { test as apiRequestFixture } from '@seontechnologies/playwright-utils/api-request/fixtures';
import { test as recurseFixture } from '@seontechnologies/playwright-utils/recurse/fixtures';
import { test as logFixture } from '@seontechnologies/playwright-utils/log/fixtures';
import { createNetworkErrorMonitorFixture } from '@seontechnologies/playwright-utils/network-error-monitor/fixtures';

// Custom project fixtures (extend as needed)
import { test as customFixtures } from './fixtures';

/**
 * Create network error monitor with project-specific exclusions.
 * Exclude common non-critical endpoints from error monitoring.
 */
const networkMonitorFixture = base.extend(
  createNetworkErrorMonitorFixture({
    excludePatterns: [
      /sentry\.io/,
      /analytics/,
      /supabase\.co\/rest\/v1\/rpc\/log/, // Exclude Supabase logging RPC
      /\/rest\/v1\/users\?select=partner/, // Partner queries fail without partner data in test env
      /\/auth\/v1\/token/, // Background auth token refresh — 400 expected when refresh token is stale
    ],
    maxTestsPerError: 3, // Prevent domino failures
  }),
);

/**
 * Merged test object with all utilities:
 * - apiRequest: Typed HTTP client with schema validation
 * - recurse: Polling for async operations
 * - log: Playwright report-integrated logging
 * - networkErrorMonitor: Automatic HTTP 4xx/5xx detection
 * - Plus any custom fixtures from ./fixtures
 *
 * NOTE: Auth fixtures (authToken/authOptions) require a custom auth provider.
 * To add auth support, see:
 *   - @seontechnologies/playwright-utils/auth-session documentation
 *   - Create auth-provider.ts with setAuthProvider() call
 */
export const test = mergeTests(
  apiRequestFixture,
  recurseFixture,
  logFixture,
  networkMonitorFixture,
  customFixtures,
);

export { expect } from '@playwright/test';
