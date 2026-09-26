/**
 * Merged Fixtures for Playwright Tests
 *
 * Combines @seontechnologies/playwright-utils fixtures with custom project fixtures.
 * Import { test, expect } from this file in all test files.
 *
 * @see https://github.com/seontechnologies/playwright-utils
 * @see _bmad/bmm/testarch/knowledge/fixtures-composition.md
 */
import { test as base, mergeTests, type TestType } from '@playwright/test';

// Playwright-utils fixtures (production-ready utilities)
import { test as apiRequestFixture } from '@seontechnologies/playwright-utils/api-request/fixtures';
import { test as recurseFixture } from '@seontechnologies/playwright-utils/recurse/fixtures';
import { test as logFixture } from '@seontechnologies/playwright-utils/log/fixtures';
import { test as interceptFixture } from '@seontechnologies/playwright-utils/intercept-network-call/fixtures';
import { createNetworkErrorMonitorFixture } from '@seontechnologies/playwright-utils/network-error-monitor/fixtures';

// Custom project fixtures (extend as needed)
import { test as customFixtures } from './fixtures';
import { test as authFixture } from './fixtures/auth';
import { test as interactionRealtimeFixture } from './fixtures/interaction-realtime-control';
import { test as interactionOwnershipFixture } from './fixtures/interaction-record-ownership';
import { test as authBootstrapFixture } from './fixtures/auth-bootstrap-notification-order';
import { test as eventsRefreshFixture } from './fixtures/events-refresh-control';
import { CLEANUP_TIMEOUT_MS, provideCleanup, type Cleanup } from './fixtures/cleanup';

/**
 * Create network error monitor with project-specific exclusions.
 * Exclude common non-critical endpoints from error monitoring.
 */
const networkMonitorFixture = base.extend(
  createNetworkErrorMonitorFixture({
    excludePatterns: [
      /analytics/,
      /supabase\.co\/rest\/v1\/rpc\/log/, // Exclude Supabase logging RPC
      /\/auth\/v1\/token/, // Background auth token refresh — 400 expected when refresh token is stale
      /\/auth\/v1\/user(?:\?|$)/, // Transient auth user probe failures (e.g. local 504) can be non-functional noise in E2E
    ],
    maxTestsPerError: 3, // Prevent domino failures
  })
);

type MergedTest = ReturnType<
  typeof mergeTests<
    [
      typeof apiRequestFixture,
      typeof recurseFixture,
      typeof logFixture,
      typeof interceptFixture,
      typeof networkMonitorFixture,
      typeof customFixtures,
      typeof authFixture,
      typeof interactionRealtimeFixture,
      typeof interactionOwnershipFixture,
      typeof authBootstrapFixture,
      typeof eventsRefreshFixture,
    ]
  >
>;

type WithCleanup<T> =
  T extends TestType<infer TestArgs, infer WorkerArgs>
    ? TestType<TestArgs & { cleanup: Cleanup }, WorkerArgs>
    : never;

const merged: MergedTest = mergeTests(
  apiRequestFixture,
  recurseFixture,
  logFixture,
  interceptFixture,
  networkMonitorFixture,
  customFixtures,
  authFixture,
  interactionRealtimeFixture,
  interactionOwnershipFixture,
  authBootstrapFixture,
  eventsRefreshFixture
);

/**
 * Merged test object with all utilities:
 * - apiRequest: Typed HTTP client with schema validation
 * - recurse: Polling for async operations
 * - log: Playwright report-integrated logging
 * - networkErrorMonitor: Automatic HTTP 4xx/5xx detection
 * - cleanup: teardown registered mid-test that still runs on a timeout
 * - Plus any custom fixtures from ./fixtures
 *
 * Auth: Uses SupabaseAuthProvider via @seontechnologies/playwright-utils auth-session.
 * Each worker gets a unique user identity via authOptions (worker-scoped).
 *
 * `cleanup` is declared here, after the merge, because it names the fixtures
 * its deferred functions use: Playwright tears a fixture down before the
 * fixtures it depends on, so `page` (and its context), `apiRequest` (and
 * `request`) and `supabaseAdmin` are still open while the deferred functions
 * run, whatever order a test lists its fixtures in. `page` costs nothing extra:
 * the auto `networkErrorMonitor` already sets it up in every test. Its
 * `timeout` gives it a teardown slot of its own; see `./fixtures/cleanup.ts`.
 */
export const test: WithCleanup<MergedTest> = merged.extend<{ cleanup: Cleanup }>({
  cleanup: [
    async ({ page, apiRequest, supabaseAdmin }, use) => provideCleanup(use),
    { timeout: CLEANUP_TIMEOUT_MS },
  ],
});

export { expect } from '@playwright/test';
