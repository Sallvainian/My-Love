/**
 * P0/P1 E2E: Together Mode Reading — Synchronized Lock-In (Story 4.2)
 *
 * Test IDs: 4.2-E2E-001 (P0), 4.2-E2E-002 (P1), 4.2-E2E-003 (P1), 4.2-E2E-004 (P1),
 *           4.2-E2E-005 (P1)
 *
 * Acceptance Criteria covered:
 *   AC#1 — Role indicator: Reader/Responder pill badge with alternation
 *   AC#2 — Partner position: PartnerPosition indicator via presence channel
 *   AC#3 — Lock-in: "Ready for next verse" → optimistic isPendingLockIn → RPC
 *   AC#4 — Waiting/undo: "Waiting for [Partner]..." + "Tap to undo"
 *   AC#5 — Both lock advance: both lock → server bumps version + step → clients advance
 *   AC#6 — 409 rollback: version mismatch → rollback + "Session updated" toast
 *   AC#7 — Last step reflection: step 17 lock → phase='reflection'
 */
import { test, expect } from '../../support/merged-fixtures';
import {
  lockInAndWait,
  navigateBothToReadingPhase,
  waitForPartnerLocked,
  waitForPartnerPosition,
  waitForReadingPhase,
  waitForReadingStep,
  waitForReflectionPhase,
} from '../../support/helpers/scripture-lobby';
import { jumpToStep } from '../../support/helpers/scripture-together';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LAST_STEP_INDEX = 16;
const TOTAL_VERSES = 17;

// ---------------------------------------------------------------------------
// 4.2-E2E-001: Full Lock-In Flow (P0)
// ---------------------------------------------------------------------------

test.describe('[4.2-E2E-001] Full Together-Mode Lock-In Flow', () => {
  // Implementation complete — Story 4.2

  test('[P0] should complete full lock-in flow: both ready → advance to step 2 with role alternation', async ({
    page,
    togetherMode: { partnerPage },
  }) => {
    test.setTimeout(60_000);

    // GIVEN: Both users navigate through lobby to reading phase
    await navigateBothToReadingPhase(page, partnerPage);

    // AC#1 — Role indicator: User A (Reader) sees "You read this"
    await expect(page.getByTestId('role-indicator')).toContainText('You read this');
    // Partner (Responder) sees "Partner reads this"
    await expect(partnerPage.getByTestId('role-indicator')).toContainText('Partner reads this');

    // -----------------------------------------------------------------------
    // WHEN: User A taps "Ready for next verse" (lock-in)
    // -----------------------------------------------------------------------
    await lockInAndWait(page, 'User A');

    // AC#3 — User A sees waiting state
    await expect(page.getByTestId('lock-in-button')).toContainText(/waiting for/i);
    await expect(page.getByTestId('lock-in-undo')).toBeVisible();

    // AC#4 — Partner sees "[PartnerName] is ready" indicator
    await waitForPartnerLocked(partnerPage);

    // -----------------------------------------------------------------------
    // WHEN: User B taps "Ready for next verse" (both locked → advance)
    // -----------------------------------------------------------------------
    await lockInAndWait(partnerPage, 'User B');

    // AC#5 — Both advance to step 2 (verse text changes)
    await waitForReadingStep(page, 1, TOTAL_VERSES);
    await waitForReadingStep(partnerPage, 1, TOTAL_VERSES);

    // AC#1 — Role alternation: User A (Reader on step 1) is now Responder on step 2
    await expect(page.getByTestId('role-indicator')).toContainText('Partner reads this');
    await expect(partnerPage.getByTestId('role-indicator')).toContainText('You read this');
  });
});

// ---------------------------------------------------------------------------
// 4.2-E2E-002: Undo Lock-In (P1)
// ---------------------------------------------------------------------------

test.describe('[4.2-E2E-002] Undo Lock-In', () => {
  // Implementation complete — Story 4.2

  test('[P1] should revert lock-in when user taps "Tap to undo"', async ({
    page,
    togetherMode: { partnerPage },
  }) => {
    test.setTimeout(60_000);

    // GIVEN: Both users navigate through lobby to reading phase
    await navigateBothToReadingPhase(page, partnerPage);

    // WHEN: User A locks in
    await lockInAndWait(page, 'User A');
    await expect(page.getByTestId('lock-in-undo')).toBeVisible();

    // WHEN: User A taps "Tap to undo"
    await page.getByTestId('lock-in-undo').click();

    // THEN: Button reverts to "Ready for next verse"
    await expect(page.getByTestId('lock-in-button')).toContainText(/ready for next verse/i);

    // THEN: Partner's indicator disappears
    await expect(partnerPage.getByTestId('partner-locked-indicator')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 4.2-E2E-003: Role Alternation (P1)
// ---------------------------------------------------------------------------

test.describe('[4.2-E2E-003] Role Alternation', () => {
  // Implementation complete — Story 4.2

  test('[P1] should alternate roles after step advance', async ({
    page,
    togetherMode: { partnerPage },
  }) => {
    test.setTimeout(60_000);

    // GIVEN: Both users navigate through lobby to reading phase
    await navigateBothToReadingPhase(page, partnerPage);

    // Step 1: User A is Reader, Partner is Responder
    await expect(page.getByTestId('role-indicator')).toContainText('You read this');
    await expect(partnerPage.getByTestId('role-indicator')).toContainText('Partner reads this');

    // Both lock in → advance to step 2
    await lockInAndWait(page, 'User A');
    await lockInAndWait(partnerPage, 'User B');

    // Wait for step advance
    await waitForReadingStep(page, 1, TOTAL_VERSES);

    // Step 2: Roles alternate — User A is now Responder, Partner is Reader
    await expect(page.getByTestId('role-indicator')).toContainText('Partner reads this');
    await expect(partnerPage.getByTestId('role-indicator')).toContainText('You read this');
  });
});

// ---------------------------------------------------------------------------
// 4.2-E2E-004: Last Step Completion → Reflection (P1)
// ---------------------------------------------------------------------------

test.describe('[4.2-E2E-004] Last Step Completion', () => {
  // Implementation complete — Story 4.2

  test('[P1] should transition to reflection phase after both lock in on last step', async ({
    page,
    supabaseAdmin,
    togetherMode: { partnerPage, uiSessionId },
  }) => {
    test.setTimeout(60_000);

    // GIVEN: Both users navigate through lobby to reading phase
    await navigateBothToReadingPhase(page, partnerPage);

    // Advance the session to the last step via DB + Zustand store.
    await jumpToStep(supabaseAdmin, uiSessionId, page, partnerPage, LAST_STEP_INDEX);

    await waitForReadingPhase(page);
    await waitForReadingPhase(partnerPage);

    // Should be on the last step
    await waitForReadingStep(page, LAST_STEP_INDEX, TOTAL_VERSES);

    // Both lock in on last step → reflection phase
    await lockInAndWait(page, 'User A');
    await lockInAndWait(partnerPage, 'User B');

    // THEN: Both users see reflection phase UI
    // Together-mode reflection routes to SoloReadingFlow → ReflectionSummary
    await waitForReflectionPhase(page);
    await waitForReflectionPhase(partnerPage);
    await expect(page.getByTestId('reading-container')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 4.2-E2E-005: PartnerPosition Indicator Visibility (P1)
// Traceability gap: 4.2-AC#2 — PARTIAL → FULL
// ---------------------------------------------------------------------------

test.describe('[4.2-E2E-005] PartnerPosition Indicator Visibility', () => {
  test('[P1] should show partner position indicator with view text during reading phase', async ({
    page,
    togetherMode: { partnerPage },
  }) => {
    test.setTimeout(60_000);

    // GIVEN: Both users navigate through lobby to reading phase
    await navigateBothToReadingPhase(page, partnerPage);

    // Both users start on the verse tab. The useScripturePresence hook
    // broadcasts presence on channel subscribe and every 10s heartbeat.
    // After the partner's presence arrives (view='verse'), the
    // PartnerPosition indicator should render on User A's page.

    // -----------------------------------------------------------------------
    // THEN: AC#2 — User A sees partner's position indicator
    // The presence channel broadcasts partner's current view. The
    // PartnerPosition component renders "[Name] is reading the verse".
    // We wait on the shared presence helper to account for the initial
    // presence broadcast arriving via the ephemeral presence channel.
    // -----------------------------------------------------------------------
    await waitForPartnerPosition(page, /is reading the verse/i);

    // Verify the indicator also appears on the partner's page for User A
    await waitForPartnerPosition(partnerPage, /is reading the verse/i);

    // -----------------------------------------------------------------------
    // WHEN: Partner switches to the response tab
    // -----------------------------------------------------------------------
    await partnerPage.getByTestId('reading-tab-response').click();

    // THEN: User A's indicator updates to show "is reading the response"
    await waitForPartnerPosition(page, /is reading the response/i);

    // -----------------------------------------------------------------------
    // WHEN: Partner switches back to the verse tab
    // -----------------------------------------------------------------------
    await partnerPage.getByTestId('reading-tab-verse').click();

    // THEN: User A's indicator reverts to "is reading the verse"
    await waitForPartnerPosition(page, /is reading the verse/i);
  });
});

// ---------------------------------------------------------------------------
// Error Injection: Lock-In 500 → Error Toast
// ---------------------------------------------------------------------------

test.describe(
  '[4.2-ERR-001] Lock-In 500 Error Toast',
  { annotation: [{ type: 'skipNetworkMonitoring' }] },
  () => {
    test('should show error toast when lock-in RPC fails with 500', async ({
      page,
      interceptNetworkCall,
      togetherMode: { partnerPage },
    }) => {
      test.setTimeout(60_000);

      // GIVEN: Both users navigate through lobby to reading phase
      await navigateBothToReadingPhase(page, partnerPage);

      // WHEN: Inject 500 on lock-in RPC and click lock-in
      interceptNetworkCall({
        method: 'POST',
        url: '**/rest/v1/rpc/scripture_lock_in',
        fulfillResponse: { status: 500, body: 'Internal Server Error' },
      });

      await page.getByTestId('lock-in-button').click();

      // THEN: Error toast appears in the reading container
      await expect(page.getByTestId('session-error-toast')).toBeVisible();
    });
  }
);
