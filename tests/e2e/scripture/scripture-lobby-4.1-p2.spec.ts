/**
 * P2 E2E: Together Mode Lobby — Aria-Live Announcements & Language Compliance (Story 4.1)
 *
 * Test IDs: 4.1-E2E-003 (P2), 4.1-E2E-004 (P2), 4.1-E2E-005 (P2)
 *
 * Acceptance Criteria covered:
 *   AC#3 — Partner status aria-live region announces partner ready state
 *   AC#5 — Countdown aria-live announces "Session starting in 3 seconds"
 *   AC#2 — Language compliance: "Continue solo" exact text; non-accusatory waiting language
 */
import { test, expect } from '../../support/merged-fixtures';
import {
  navigateToTogetherRoleSelection,
  waitForCountdownStarted,
  waitForPartnerJoined,
} from '../../support/helpers/scripture-lobby';
import { createTestSession, cleanupTestSession } from '../../support/factories';
import { waitForScriptureRpc, waitForScriptureStore } from '../../support/helpers';

// ---------------------------------------------------------------------------
// 4.1-E2E-003: Countdown aria-live announcements (P2)
// Risk: E4-R10
// ---------------------------------------------------------------------------

test.describe('[4.1-E2E-003] Countdown Aria-Live Announcements', () => {
  test.use({ timeout: 60_000 });

  test('[P2] should announce "Session starting in 3 seconds" via aria-live assertive when countdown begins', async ({
    page,
    togetherMode: { partnerPage },
  }) => {
    // GIVEN: User A navigates to Together mode and selects Reader role
    const userASelectRole = waitForScriptureRpc(page, 'scripture_select_role');
    await page.getByTestId('lobby-role-reader').click();
    await userASelectRole;
    await expect(page.getByTestId('lobby-waiting')).toBeVisible();

    // GIVEN: User B (partner) is already on the role selection screen (fixture)
    const partnerSelectRole = waitForScriptureRpc(partnerPage, 'scripture_select_role');
    await partnerPage.getByTestId('lobby-role-responder').click();
    await partnerSelectRole;
    await expect(partnerPage.getByTestId('lobby-waiting')).toBeVisible();

    // THEN: User A sees partner has joined
    await waitForPartnerJoined(page);

    // WHEN: User A clicks Ready
    const userAReadyBroadcast = waitForScriptureRpc(page, 'scripture_toggle_ready');

    await page.getByTestId('lobby-ready-button').click();
    await userAReadyBroadcast;

    // WHEN: User B (partner) clicks Ready — both ready triggers countdown
    const partnerReadyBroadcast = waitForScriptureRpc(partnerPage, 'scripture_toggle_ready');

    await partnerPage.getByTestId('lobby-ready-button').click();
    await partnerReadyBroadcast;

    // THEN (AC#5): countdown-container appears
    const countdownContainer = page.getByTestId('countdown-container');
    await waitForCountdownStarted(page);
    await expect(countdownContainer).toBeVisible();

    // AC#5 — The sr-only assertive region is a CHILD of countdown-container
    // (countdown-container itself has aria-label="Countdown", not aria-live)
    const ariaLiveRegion = page.locator(
      '[data-testid="countdown-container"] [aria-live="assertive"]'
    );
    await expect(ariaLiveRegion).toBeAttached();
    await expect(ariaLiveRegion).toHaveAttribute('aria-live', 'assertive');
    await expect(ariaLiveRegion).toHaveAttribute('aria-atomic', 'true');

    // AC#5 — Initial announcement: "Session starting in 3 seconds"
    await expect(ariaLiveRegion).toContainText('Session starting in 3 seconds');
  });
});

// ---------------------------------------------------------------------------
// 4.1-E2E-004: Ready state aria-live announcement (P2)
// ---------------------------------------------------------------------------

test.describe('[4.1-E2E-004] Ready State Aria-Live Announcement', () => {
  test.use({ timeout: 60_000 });

  test('[P2] should announce partner ready state via aria-live polite region when partner toggles ready', async ({
    page,
    togetherMode: { partnerPage },
  }) => {
    // GIVEN: User A navigates to Together mode and selects Reader role
    const userASelectRole = waitForScriptureRpc(page, 'scripture_select_role');
    await page.getByTestId('lobby-role-reader').click();
    await userASelectRole;
    await expect(page.getByTestId('lobby-waiting')).toBeVisible();

    // GIVEN: User B (partner) is already on the role selection screen (fixture)
    const partnerSelectRole = waitForScriptureRpc(partnerPage, 'scripture_select_role');
    await partnerPage.getByTestId('lobby-role-responder').click();
    await partnerSelectRole;
    await expect(partnerPage.getByTestId('lobby-waiting')).toBeVisible();

    // THEN: User A sees that partner has joined
    await waitForPartnerJoined(page);

    // AC#3 — The partner-status region must be wrapped in aria-live="polite"
    const ariaLiveWrapper = page.locator('[aria-live="polite"]').filter({
      has: page.getByTestId('lobby-partner-status'),
    });
    await expect(ariaLiveWrapper).toBeAttached();
    await expect(ariaLiveWrapper).toHaveAttribute('aria-live', 'polite');

    // WHEN: User B (partner) toggles ready
    const partnerReadyBroadcast = waitForScriptureRpc(partnerPage, 'scripture_toggle_ready');

    await partnerPage.getByTestId('lobby-ready-button').click();
    await partnerReadyBroadcast;

    // THEN (AC#3): lobby-partner-ready shows partner's ready state
    const partnerReadyIndicator = page.getByTestId('lobby-partner-ready');
    await waitForScriptureStore(
      page,
      'partner ready indicator after partner toggles ready',
      (snapshot) => snapshot.partnerReady
    );
    await expect(partnerReadyIndicator).toBeVisible();

    // AC#3 — "is ready" text must be present for screen readers to announce it
    await expect(partnerReadyIndicator).toContainText(/is ready/i);
  });
});

// ---------------------------------------------------------------------------
// 4.1-E2E-005: Language compliance — exact strings (P2)
// Risk: E4-R11
// ---------------------------------------------------------------------------

test.describe('[4.1-E2E-005] Language Compliance', () => {
  test.use({ timeout: 30_000 });

  test('[P2] should display "Continue solo" button and non-accusatory waiting language in lobby', async ({
    page,
    supabaseAdmin,
  }) => {
    // SETUP: Create session (single user — no partner needed for language check)
    const seed = await createTestSession(supabaseAdmin, { sessionCount: 1 });
    const sessionIdsToClean = [...seed.session_ids];

    // End the seeded session so it doesn't interfere with the UI-created lobby session
    await supabaseAdmin
      .from('scripture_sessions')
      .update({ status: 'complete', current_phase: 'complete' })
      .in('id', seed.session_ids);

    try {
      // GIVEN: User navigates to Together mode and reaches role selection
      const uiSessionP2e = await navigateToTogetherRoleSelection(page);
      if (uiSessionP2e) sessionIdsToClean.push(uiSessionP2e);
      await expect(page.getByTestId('lobby-role-selection')).toBeVisible();

      // AC#2 — "Continue solo" button on role selection screen
      // Must use exact case-sensitive text "Continue solo" (no shame language)
      const continueSoloOnRoleSelection = page.getByTestId('lobby-continue-solo');
      await expect(continueSoloOnRoleSelection).toBeVisible();
      await expect(continueSoloOnRoleSelection).toHaveText('Continue solo');

      // WHEN: User selects Reader role — transitions to lobby waiting screen
      const langSelectRole = waitForScriptureRpc(page, 'scripture_select_role');
      await page.getByTestId('lobby-role-reader').click();
      await langSelectRole;
      await expect(page.getByTestId('lobby-waiting')).toBeVisible();

      // THEN (AC#2): Language compliance in lobby waiting state

      // "Continue solo" button must be present with exact text
      const continueSoloOnWaiting = page.getByTestId('lobby-continue-solo');
      await expect(continueSoloOnWaiting).toBeVisible();
      await expect(continueSoloOnWaiting).toHaveText('Continue solo');

      // AC#2 — Partner status uses non-accusatory "Waiting for" language
      const partnerStatus = page.getByTestId('lobby-partner-status');
      await expect(partnerStatus).toBeVisible();
      await expect(partnerStatus).toContainText(/Waiting for/i);

      // Verify absence of blame language
      const partnerStatusText = await partnerStatus.textContent();
      expect(partnerStatusText, 'lobby-partner-status must not contain blame language').not.toMatch(
        /abandoned|missing|waiting alone/i
      );
    } finally {
      await cleanupTestSession(supabaseAdmin, sessionIdsToClean);
    }
  });
});
