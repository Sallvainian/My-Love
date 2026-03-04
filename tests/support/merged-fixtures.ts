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
import { test as interceptFixture } from '@seontechnologies/playwright-utils/intercept-network-call/fixtures';
import { createNetworkErrorMonitorFixture } from '@seontechnologies/playwright-utils/network-error-monitor/fixtures';

// Custom project fixtures (extend as needed)
import { test as customFixtures } from './fixtures';
import { test as scriptureNavFixture } from './fixtures/scripture-navigation';
import { test as authFixture } from './fixtures/auth';
import { test as togetherModeFixture } from './fixtures/together-mode';

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
      /\/auth\/v1\/user(?:\?|$)/, // Transient auth user probe failures (e.g. local 504) can be non-functional noise in E2E
    ],
    maxTestsPerError: 3, // Prevent domino failures
  })
);

/**
 * Merged test object with all utilities:
 * - apiRequest: Typed HTTP client with schema validation
 * - recurse: Polling for async operations
 * - log: Playwright report-integrated logging
 * - networkErrorMonitor: Automatic HTTP 4xx/5xx detection
 * - Plus any custom fixtures from ./fixtures
 *
 * Auth: Uses SupabaseAuthProvider via @seontechnologies/playwright-utils auth-session.
 * Each worker gets a unique user identity via authOptions (worker-scoped).
 */
export const test = mergeTests(
  apiRequestFixture,
  recurseFixture,
  logFixture,
  interceptFixture,
  networkMonitorFixture,
  customFixtures,
  scriptureNavFixture,
  authFixture,
  togetherModeFixture
);

export { expect } from '@playwright/test';
