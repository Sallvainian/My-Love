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
  navigateToTogetherRoleSelection,
  waitForCountdownStarted,
  waitForPartnerJoined,
  waitForReadingPhase,
} from '../../support/helpers/scripture-lobby';
import { createTestSession, cleanupTestSession } from '../../support/factories';
import { waitForScriptureRpc, waitForScriptureStore } from '../../support/helpers';

// ---------------------------------------------------------------------------
// 4.1-E2E-001: Full Lobby Flow (P0)
// ---------------------------------------------------------------------------

test.describe('[4.1-E2E-001] Full Together-Mode Lobby Flow', () => {
  test('[P0] should complete full lobby flow: role selection → both ready → countdown → verse', async ({
    page,
    togetherMode: { partnerPage },
  }) => {
    test.setTimeout(60_000);

    // AC#1 — Role selection screen present with Reader and Responder cards
    await expect(page.getByTestId('lobby-role-selection')).toBeVisible();
    await expect(page.getByTestId('lobby-role-reader')).toBeVisible();
    await expect(page.getByTestId('lobby-role-responder')).toBeVisible();
    await expect(page.getByTestId('lobby-role-reader')).toContainText('You read the verse');
    await expect(page.getByTestId('lobby-role-responder')).toContainText('You read the response');

    // WHEN: User A selects Reader role
    const userASelectRole = waitForScriptureRpc(page, 'scripture_select_role');
    await page.getByTestId('lobby-role-reader').click();
    await userASelectRole;

    // THEN: Lobby waiting screen appears
    // AC#2 — Partner status visible; Continue solo button present.
    // Note: The togetherMode fixture navigates both users before the test body,
    // so the partner broadcast may have already fired — accept either state.
    await expect(page.getByTestId('lobby-waiting')).toBeVisible();
    await expect(page.getByTestId('lobby-partner-status')).toContainText(/waiting for|has joined/i);
    await expect(page.getByTestId('lobby-continue-solo')).toBeVisible();

    // -----------------------------------------------------------------------
    // GIVEN: User B (partner) is already on the role selection screen (fixture)
    // -----------------------------------------------------------------------

    // AC#1 — Partner also sees role selection
    await expect(partnerPage.getByTestId('lobby-role-selection')).toBeVisible();
    await expect(partnerPage.getByTestId('lobby-role-responder')).toBeVisible();

    // Partner selects Responder role
    const partnerSelectRole = waitForScriptureRpc(partnerPage, 'scripture_select_role');
    await partnerPage.getByTestId('lobby-role-responder').click();
    await partnerSelectRole;

    // Partner should see lobby waiting screen
    await expect(partnerPage.getByTestId('lobby-waiting')).toBeVisible();

    // -----------------------------------------------------------------------
    // THEN (AC#3): User A sees partner has joined via realtime broadcast
    // -----------------------------------------------------------------------
    await waitForPartnerJoined(page);

    // AC#4 — Ready toggle button visible for both users
    await expect(page.getByTestId('lobby-ready-button')).toBeVisible();
    await expect(partnerPage.getByTestId('lobby-ready-button')).toBeVisible();

    // -----------------------------------------------------------------------
    // WHEN: User A clicks Ready
    // -----------------------------------------------------------------------
    // Network-first: watch for ready state RPC before clicking
    const userAReadyBroadcast = waitForScriptureRpc(page, 'scripture_toggle_ready');

    await page.getByTestId('lobby-ready-button').click();
    await userAReadyBroadcast;

    // AC#4 — User A's button updates to "Ready ✓" (requires checkmark — /ready.*✓|ready/i was too
    // loose and would match "I'm Ready" before the state transition)
    await expect(page.getByTestId('lobby-ready-button')).toContainText('Ready ✓');

    // AC#4 — Partner sees User A is ready via realtime (semantic text, not just visibility)
    await waitForScriptureStore(
      partnerPage,
      'partner ready indicator after User A toggles ready',
      (snapshot) => snapshot.partnerReady
    );
    await expect(partnerPage.getByTestId('lobby-partner-ready')).toContainText('is ready');

    // -----------------------------------------------------------------------
    // WHEN: User B (partner) clicks Ready — both now ready → countdown starts
    // -----------------------------------------------------------------------
    const partnerReadyBroadcast = waitForScriptureRpc(partnerPage, 'scripture_toggle_ready');

    await partnerPage.getByTestId('lobby-ready-button').click();
    await partnerReadyBroadcast;

    // -----------------------------------------------------------------------
    // THEN (AC#5): Countdown appears on BOTH pages concurrently
    // -----------------------------------------------------------------------
    await Promise.all([waitForCountdownStarted(page), waitForCountdownStarted(partnerPage)]);

    // AC#5 — After countdown completes, countdown container disappears on both pages.
    // Note: Together-mode reading view (scripture-verse-text) is Story 4.2 scope.
    // Story 4.1 delivers the session in currentPhase='reading' after countdown.
    await Promise.all([waitForReadingPhase(page), waitForReadingPhase(partnerPage)]);
    await expect(page.getByTestId('countdown-container')).not.toBeVisible();
    await expect(partnerPage.getByTestId('countdown-container')).not.toBeVisible();
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
      await supabaseAdmin
        .from('scripture_sessions')
        .update({ status: 'complete', current_phase: 'complete' })
        .in('id', seed.session_ids);

      // -----------------------------------------------------------------------
      // GIVEN: User navigates to /scripture and starts Together mode
      // -----------------------------------------------------------------------
      const uiSession2 = await navigateToTogetherRoleSelection(page);
      if (uiSession2) sessionIdsToClean.push(uiSession2);

      // AC#1 — Role selection visible
      await expect(page.getByTestId('lobby-role-selection')).toBeVisible();

      // WHEN: User selects a role (Reader)
      const soloSelectRole = waitForScriptureRpc(page, 'scripture_select_role');
      await page.getByTestId('lobby-role-reader').click();
      await soloSelectRole;

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
      const conversionResponse = waitForScriptureRpc(page, 'scripture_convert_to_solo');

      await page.getByTestId('lobby-continue-solo').click();
      await conversionResponse;

      // -----------------------------------------------------------------------
      // THEN (AC#6): Session converts to solo; first verse is visible
      // -----------------------------------------------------------------------
      // Network-first: RPC response above confirms server converted the session.
      // UI assertion below confirms the reading view rendered.
      await expect(page.getByTestId('scripture-verse-text')).toBeVisible();

      // Lobby container should no longer be visible
      await expect(page.getByTestId('lobby-waiting')).not.toBeVisible();
      await expect(page.getByTestId('lobby-role-selection')).not.toBeVisible();
    } finally {
      await cleanupTestSession(supabaseAdmin, sessionIdsToClean);
    }
  });
});
