/**
 * P0/P1 E2E: Together Mode Lobby — Role Selection & Countdown (Story 4.1)
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
import {
  REALTIME_SYNC_TIMEOUT_MS,
  READY_BROADCAST_TIMEOUT_MS,
  COUNTDOWN_APPEAR_TIMEOUT_MS,
  isToggleReadyResponse,
  navigateToTogetherRoleSelection,
} from '../../support/helpers/scripture-lobby';
import {
  createTestSession,
  linkTestPartners,
  unlinkTestPartners,
  cleanupTestSession,
} from '../../support/factories';

// ---------------------------------------------------------------------------
// Timeout constants (spec-local — not shared with P2 spec)
// ---------------------------------------------------------------------------

const CONVERSION_TIMEOUT_MS = 12_000;
const VERSE_LOAD_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// 4.1-E2E-001: Full Lobby Flow (P0)
// ---------------------------------------------------------------------------

test.describe('[4.1-E2E-001] Full Together-Mode Lobby Flow', () => {
  test('[P0] should complete full lobby flow: role selection → both ready → countdown → verse', async ({
    page,
    browser,
    supabaseAdmin,
    partnerStorageStatePath,
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

    // Fail fast if the seed didn't return a partner user ID
    expect(
      seed.test_user2_id,
      'createTestSession must return a partner user ID for lobby test'
    ).toBeTruthy();
    await linkTestPartners(supabaseAdmin, seed.test_user1_id, seed.test_user2_id!);

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
    // GIVEN: User B (partner) opens a second browser context and joins.
    // Uses partnerStorageStatePath — a distinct auth state for the partner
    // user (testworker{n}-partner@test.example.com) so both contexts have
    // genuinely different Supabase auth.uid() values.
    // -----------------------------------------------------------------------
    const baseURL = new URL(page.url()).origin;
    const partnerContext = await browser.newContext({
      storageState: partnerStorageStatePath,
      baseURL,
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
      await expect(page.getByTestId('lobby-partner-status')).toContainText(/has joined/i, {
        timeout: REALTIME_SYNC_TIMEOUT_MS,
      });

      // AC#4 — Ready toggle button visible for both users
      await expect(page.getByTestId('lobby-ready-button')).toBeVisible();
      await expect(partnerPage.getByTestId('lobby-ready-button')).toBeVisible();

      // -----------------------------------------------------------------------
      // WHEN: User A clicks Ready
      // -----------------------------------------------------------------------
      // Network-first: watch for ready state RPC before clicking
      const userAReadyBroadcast = page
        .waitForResponse(isToggleReadyResponse, { timeout: READY_BROADCAST_TIMEOUT_MS })
        .catch((e: Error) => {
          throw new Error(`scripture_toggle_ready RPC (User A) did not fire: ${e.message}`);
        });

      await page.getByTestId('lobby-ready-button').click();
      await userAReadyBroadcast;

      // AC#4 — User A's button updates to "Ready ✓" (requires checkmark — /ready.*✓|ready/i was too
      // loose and would match "I'm Ready" before the state transition)
      await expect(page.getByTestId('lobby-ready-button')).toContainText('Ready ✓');

      // AC#4 — Partner sees User A is ready via realtime (semantic text, not just visibility)
      await expect(partnerPage.getByTestId('lobby-partner-ready')).toContainText('is ready', {
        timeout: REALTIME_SYNC_TIMEOUT_MS,
      });

      // -----------------------------------------------------------------------
      // WHEN: User B (partner) clicks Ready — both now ready → countdown starts
      // -----------------------------------------------------------------------
      const partnerReadyBroadcast = partnerPage
        .waitForResponse(isToggleReadyResponse, { timeout: READY_BROADCAST_TIMEOUT_MS })
        .catch((e: Error) => {
          throw new Error(`scripture_toggle_ready RPC (User B) did not fire: ${e.message}`);
        });

      await partnerPage.getByTestId('lobby-ready-button').click();
      await partnerReadyBroadcast;

      // -----------------------------------------------------------------------
      // THEN (AC#5): Countdown appears on BOTH pages concurrently
      // -----------------------------------------------------------------------
      await Promise.all([
        expect(page.getByTestId('countdown-container')).toBeVisible({
          timeout: COUNTDOWN_APPEAR_TIMEOUT_MS,
        }),
        expect(partnerPage.getByTestId('countdown-container')).toBeVisible({
          timeout: COUNTDOWN_APPEAR_TIMEOUT_MS,
        }),
      ]);

      // AC#5 — After countdown completes, countdown container disappears on both pages.
      // Note: Together-mode reading view (scripture-verse-text) is Story 4.2 scope.
      // Story 4.1 delivers the session in currentPhase='reading' after countdown.
      await Promise.all([
        expect(page.getByTestId('countdown-container')).not.toBeVisible({
          timeout: VERSE_LOAD_TIMEOUT_MS,
        }),
        expect(partnerPage.getByTestId('countdown-container')).not.toBeVisible({
          timeout: VERSE_LOAD_TIMEOUT_MS,
        }),
      ]);
    } finally {
      await partnerContext.close();
      await cleanupTestSession(supabaseAdmin, sessionIdsToClean);
      await unlinkTestPartners(supabaseAdmin, seed.test_user1_id, seed.test_user2_id!);
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
      // Network-first: watch for session mode conversion RPC
      const conversionResponse = page
        .waitForResponse(
          (resp) =>
            (resp.url().includes('/rest/v1/rpc/scripture_convert_to_solo') ||
              (resp.url().includes('/rest/v1/scripture_sessions') &&
                resp.request().method() === 'PATCH')) &&
            resp.status() >= 200 &&
            resp.status() < 300,
          { timeout: CONVERSION_TIMEOUT_MS }
        )
        .catch((e: Error) => {
          throw new Error(`scripture_convert_to_solo RPC did not fire: ${e.message}`);
        });

      await page.getByTestId('lobby-continue-solo').click();
      await conversionResponse;

      // -----------------------------------------------------------------------
      // THEN (AC#6): Session converts to solo; first verse is visible
      // -----------------------------------------------------------------------
      await expect(page.getByTestId('scripture-verse-text')).toBeVisible({
        timeout: VERSE_LOAD_TIMEOUT_MS,
      });

      // Lobby container should no longer be visible
      await expect(page.getByTestId('lobby-waiting')).not.toBeVisible();
      await expect(page.getByTestId('lobby-role-selection')).not.toBeVisible();
    } finally {
      await cleanupTestSession(supabaseAdmin, sessionIdsToClean);
    }
  });
});
