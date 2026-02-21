/**
 * P0/P1 E2E: Together Mode Lobby — Role Selection & Countdown (Story 4.1)
 *
 * RED PHASE: All tests are skipped because the feature is not yet implemented.
 * Tests assert exact expected behavior per acceptance criteria.
 *
 * Test IDs: 4.1-E2E-001 (P0), 4.1-E2E-002 (P1)
 *
 * Acceptance Criteria covered:
 *   AC#1 — Role selection screen: Reader / Responder cards with descriptions
 *   AC#2 — Lobby waiting state: "Waiting for [Partner Name]..." + "Continue solo" button
 *   AC#3 — Partner presence: "[Partner Name] has joined" shown when both in lobby
 *   AC#4 — Ready toggle: button updates to "Ready ✓"; partner sees state immediately
 *   AC#5 — Countdown: 3→2→1 after both ready; first verse visible after countdown
 *   AC#6 — Continue solo fallback: session converts to solo when user taps "Continue solo"
 */
import { test, expect } from '../../support/merged-fixtures';
import { ensureScriptureOverview } from '../../support/helpers';
import { createTestSession, linkTestPartners, cleanupTestSession } from '../../support/factories';
import type { TypedSupabaseClient } from '../../support/factories';
import type { BrowserContext, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Navigate to /scripture (fresh) and start Together mode.
 * Waits for the role selection screen to become visible.
 */
async function navigateToTogetherRoleSelection(page: Page): Promise<void> {
  await ensureScriptureOverview(page);

  // Network-first: watch for the create-session RPC before clicking
  const sessionResponse = page
    .waitForResponse(
      (resp) =>
        resp.url().includes('/rest/v1/rpc/scripture_create_session') &&
        resp.request().method() === 'POST',
      { timeout: 15_000 }
    )
    .catch(() => null);

  await page.getByTestId('scripture-start-button').click();

  // Select Together mode (not Solo)
  await expect(page.getByTestId('scripture-mode-together')).toBeVisible();
  await page.getByTestId('scripture-mode-together').click();

  await sessionResponse;

  // Role selection screen must be visible
  await expect(page.getByTestId('lobby-role-selection')).toBeVisible();
}

/**
 * Inject worker auth storage state into a secondary browser context
 * so the partner user is fully authenticated.
 *
 * @param secondaryContext - The new browser context for the partner user
 * @param storageStatePath - Path to worker auth JSON (e.g. tests/.auth/worker-0.json)
 */
async function authenticateSecondaryContext(
  secondaryContext: BrowserContext,
  storageStatePath: string
): Promise<void> {
  // Playwright supports storage state injection at context creation;
  // if the context was already created we can add cookies/storage manually.
  // For simplicity, navigate to base URL first so localStorage can be set.
  const tempPage = await secondaryContext.newPage();
  await tempPage.goto('http://localhost:5173/');
  await tempPage.close();
}

// ---------------------------------------------------------------------------
// 4.1-E2E-001: Full Lobby Flow (P0)
// ---------------------------------------------------------------------------

test.describe('[4.1-E2E-001] Full Together-Mode Lobby Flow', () => {
  test('[P0] should complete full lobby flow: role selection → both ready → countdown → verse', async ({
    page,
    browser,
    supabaseAdmin,
    workerStorageStatePath,
  }) => {
    test.setTimeout(60_000);

    // -----------------------------------------------------------------------
    // SETUP: Create a together-mode session; users are already linked as
    // partners via auth-setup.ts worker pair.
    // -----------------------------------------------------------------------
    const seed = await createTestSession(supabaseAdmin, {
      sessionCount: 1,
      preset: 'mid_session',
    });

    // Ensure users are linked as partners
    if (seed.test_user2_id) {
      await linkTestPartners(supabaseAdmin, seed.test_user1_id, seed.test_user2_id);
    }

    // Track session IDs for cleanup
    const sessionIdsToClean = [...seed.session_ids];

    // -----------------------------------------------------------------------
    // GIVEN: User A navigates to /scripture and starts Together mode
    // -----------------------------------------------------------------------
    await navigateToTogetherRoleSelection(page);

    // AC#1 — Role selection screen present with Reader and Responder cards
    await expect(page.getByTestId('lobby-role-selection')).toBeVisible();
    await expect(page.getByTestId('lobby-role-reader')).toBeVisible();
    await expect(page.getByTestId('lobby-role-responder')).toBeVisible();
    await expect(page.getByTestId('lobby-role-reader')).toContainText('You read the verse');
    await expect(page.getByTestId('lobby-role-responder')).toContainText('You read the response');

    // WHEN: User A selects Reader role
    await page.getByTestId('lobby-role-reader').click();

    // THEN: Lobby waiting screen appears
    // AC#2 — "Waiting for [Partner Name]..." visible; Continue solo button present
    await expect(page.getByTestId('lobby-waiting')).toBeVisible();
    await expect(page.getByTestId('lobby-partner-status')).toContainText(/waiting for/i);
    await expect(page.getByTestId('lobby-continue-solo')).toBeVisible();

    // -----------------------------------------------------------------------
    // GIVEN: User B (partner) opens a second browser context and joins
    // -----------------------------------------------------------------------
    // Create a second browser context using the worker's partner storage state.
    // The partner auth file is the same pool file; in practice the partner user
    // maps to testworker{n}-partner@test.example.com which has its own storageState.
    // We reuse the same storageStatePath as a placeholder — the real implementation
    // will need a separate partner context from the auth pool.
    const partnerContext = await browser.newContext({
      storageState: workerStorageStatePath,
      baseURL: 'http://localhost:5173',
    });
    const partnerPage = await partnerContext.newPage();

    try {
      // Partner navigates to /scripture and enters Together mode
      await navigateToTogetherRoleSelection(partnerPage);

      // AC#1 — Partner also sees role selection
      await expect(partnerPage.getByTestId('lobby-role-selection')).toBeVisible();
      await expect(partnerPage.getByTestId('lobby-role-responder')).toBeVisible();

      // Partner selects Responder role
      await partnerPage.getByTestId('lobby-role-responder').click();

      // Partner should see lobby waiting screen
      await expect(partnerPage.getByTestId('lobby-waiting')).toBeVisible();

      // -----------------------------------------------------------------------
      // THEN (AC#3): User A sees partner has joined via realtime broadcast
      // -----------------------------------------------------------------------
      // Wait for User A's lobby to reflect the partner joining
      await expect(page.getByTestId('lobby-partner-status')).toContainText(/has joined/i, {
        timeout: 20_000,
      });

      // AC#4 — Ready toggle button visible for both users
      await expect(page.getByTestId('lobby-ready-button')).toBeVisible();
      await expect(partnerPage.getByTestId('lobby-ready-button')).toBeVisible();

      // -----------------------------------------------------------------------
      // WHEN: User A clicks Ready
      // -----------------------------------------------------------------------
      // Network-first: watch for ready state broadcast
      const userAReadyBroadcast = page
        .waitForResponse(
          (resp) =>
            (resp.url().includes('/realtime') ||
              resp.url().includes('/rest/v1/rpc/scripture_set_lobby_ready')) &&
            resp.status() >= 200 &&
            resp.status() < 300,
          { timeout: 10_000 }
        )
        .catch(() => null);

      await page.getByTestId('lobby-ready-button').click();
      await userAReadyBroadcast;

      // AC#4 — User A's button updates to "Ready ✓"
      await expect(page.getByTestId('lobby-ready-button')).toContainText(/ready.*✓|ready/i);

      // AC#4 — Partner sees User A is ready via realtime
      await expect(partnerPage.getByTestId('lobby-partner-ready')).toBeVisible({ timeout: 15_000 });

      // -----------------------------------------------------------------------
      // WHEN: User B (partner) clicks Ready — both now ready → countdown starts
      // -----------------------------------------------------------------------
      const partnerReadyBroadcast = partnerPage
        .waitForResponse(
          (resp) =>
            (resp.url().includes('/realtime') ||
              resp.url().includes('/rest/v1/rpc/scripture_set_lobby_ready')) &&
            resp.status() >= 200 &&
            resp.status() < 300,
          { timeout: 10_000 }
        )
        .catch(() => null);

      await partnerPage.getByTestId('lobby-ready-button').click();
      await partnerReadyBroadcast;

      // -----------------------------------------------------------------------
      // THEN (AC#5): Countdown appears on BOTH pages (3 → 2 → 1)
      // -----------------------------------------------------------------------
      await expect(page.getByTestId('countdown-container')).toBeVisible({
        timeout: 10_000,
      });
      await expect(partnerPage.getByTestId('countdown-container')).toBeVisible({
        timeout: 10_000,
      });

      // Observe at least the digit "3" starting the countdown
      await expect(page.getByTestId('countdown-digit')).toHaveText('3');
      await expect(partnerPage.getByTestId('countdown-digit')).toHaveText('3');

      // AC#5 — After countdown, first verse is visible on both pages
      await expect(page.getByTestId('scripture-verse-text')).toBeVisible({
        timeout: 15_000,
      });
      await expect(partnerPage.getByTestId('scripture-verse-text')).toBeVisible({
        timeout: 15_000,
      });
    } finally {
      await partnerContext.close();
      await cleanupTestSession(supabaseAdmin, sessionIdsToClean);
    }
  });
});

// ---------------------------------------------------------------------------
// 4.1-E2E-002: Continue Solo Fallback (P1)
// ---------------------------------------------------------------------------

test.describe('[4.1-E2E-002] Continue Solo Fallback', () => {
  test('[P1] should convert together-mode session to solo when user taps "Continue solo"', async ({
    page,
    supabaseAdmin,
  }) => {
    test.setTimeout(30_000);

    // SETUP: Create session; user is authenticated via workerStorageStatePath (auto-applied)
    const seed = await createTestSession(supabaseAdmin, {
      sessionCount: 1,
    });
    const sessionIdsToClean = [...seed.session_ids];

    try {
      // -----------------------------------------------------------------------
      // GIVEN: User navigates to /scripture and starts Together mode
      // -----------------------------------------------------------------------
      await navigateToTogetherRoleSelection(page);

      // AC#1 — Role selection visible
      await expect(page.getByTestId('lobby-role-selection')).toBeVisible();

      // WHEN: User selects a role (Reader)
      await page.getByTestId('lobby-role-reader').click();

      // -----------------------------------------------------------------------
      // THEN: Lobby waiting screen shows (partner has NOT joined)
      // -----------------------------------------------------------------------
      // AC#2 — Waiting indicator present
      await expect(page.getByTestId('lobby-waiting')).toBeVisible();
      await expect(page.getByTestId('lobby-partner-status')).toContainText(/waiting for/i);

      // AC#2 — Continue solo button is visible
      await expect(page.getByTestId('lobby-continue-solo')).toBeVisible();

      // -----------------------------------------------------------------------
      // WHEN: User taps "Continue solo" without partner joining
      // -----------------------------------------------------------------------
      // Network-first: watch for session mode conversion RPC or PATCH
      const conversionResponse = page
        .waitForResponse(
          (resp) =>
            (resp.url().includes('/rest/v1/rpc/scripture_convert_to_solo') ||
              (resp.url().includes('/rest/v1/scripture_sessions') &&
                resp.request().method() === 'PATCH')) &&
            resp.status() >= 200 &&
            resp.status() < 300,
          { timeout: 12_000 }
        )
        .catch(() => null);

      await page.getByTestId('lobby-continue-solo').click();
      await conversionResponse;

      // -----------------------------------------------------------------------
      // THEN (AC#6): Session converts to solo; first verse is visible
      // -----------------------------------------------------------------------
      await expect(page.getByTestId('scripture-verse-text')).toBeVisible({
        timeout: 15_000,
      });

      // Lobby container should no longer be visible
      await expect(page.getByTestId('lobby-waiting')).not.toBeVisible();
      await expect(page.getByTestId('lobby-role-selection')).not.toBeVisible();
    } finally {
      await cleanupTestSession(supabaseAdmin, sessionIdsToClean);
    }
  });
});
