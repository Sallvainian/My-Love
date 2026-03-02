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
  REALTIME_SYNC_TIMEOUT_MS,
  STEP_ADVANCE_TIMEOUT_MS,
  lockInAndWait,
  navigateBothToReadingPhase,
} from '../../support/helpers/scripture-lobby';
import { jumpToStep } from '../../support/helpers/scripture-together';

// ---------------------------------------------------------------------------
// All tests in this file share the same test user pair and must run serially
// to avoid session contamination via scripture_create_session reuse.
// ---------------------------------------------------------------------------
test.describe.configure({ mode: 'serial' });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REFLECTION_LOAD_TIMEOUT_MS = 20_000;
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
    test.setTimeout(90_000);

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
    await expect(partnerPage.getByTestId('partner-locked-indicator')).toBeVisible({
      timeout: REALTIME_SYNC_TIMEOUT_MS,
    });

    // -----------------------------------------------------------------------
    // WHEN: User B taps "Ready for next verse" (both locked → advance)
    // -----------------------------------------------------------------------
    await lockInAndWait(partnerPage, 'User B');

    // AC#5 — Both advance to step 2 (verse text changes)
    const verseStep2Pattern = new RegExp(`verse 2 of ${TOTAL_VERSES}`, 'i');
    await expect(page.getByTestId('reading-step-progress')).toContainText(verseStep2Pattern, {
      timeout: STEP_ADVANCE_TIMEOUT_MS,
    });
    await expect(partnerPage.getByTestId('reading-step-progress')).toContainText(
      verseStep2Pattern,
      { timeout: STEP_ADVANCE_TIMEOUT_MS }
    );

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
    await expect(partnerPage.getByTestId('partner-locked-indicator')).not.toBeVisible({
      timeout: REALTIME_SYNC_TIMEOUT_MS,
    });
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
    test.setTimeout(90_000);

    // GIVEN: Both users navigate through lobby to reading phase
    await navigateBothToReadingPhase(page, partnerPage);

    // Step 1: User A is Reader, Partner is Responder
    await expect(page.getByTestId('role-indicator')).toContainText('You read this');
    await expect(partnerPage.getByTestId('role-indicator')).toContainText('Partner reads this');

    // Both lock in → advance to step 2
    await lockInAndWait(page, 'User A');
    await lockInAndWait(partnerPage, 'User B');

    // Wait for step advance
    await expect(page.getByTestId('reading-step-progress')).toContainText(
      new RegExp(`verse 2 of ${TOTAL_VERSES}`, 'i'),
      { timeout: STEP_ADVANCE_TIMEOUT_MS }
    );

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
    test.setTimeout(90_000);

    // GIVEN: Both users navigate through lobby to reading phase
    await navigateBothToReadingPhase(page, partnerPage);

    // Advance the session to the last step via DB + Zustand store.
    await jumpToStep(supabaseAdmin, uiSessionId, page, partnerPage, LAST_STEP_INDEX);

    await expect(page.getByTestId('reading-container')).toBeVisible({
      timeout: STEP_ADVANCE_TIMEOUT_MS,
    });
    await expect(partnerPage.getByTestId('reading-container')).toBeVisible({
      timeout: STEP_ADVANCE_TIMEOUT_MS,
    });

    // Should be on the last step
    await expect(page.getByTestId('reading-step-progress')).toContainText(
      new RegExp(`verse ${TOTAL_VERSES} of ${TOTAL_VERSES}`, 'i'),
      { timeout: STEP_ADVANCE_TIMEOUT_MS }
    );

    // Both lock in on last step → reflection phase
    await lockInAndWait(page, 'User A');
    await lockInAndWait(partnerPage, 'User B');

    // THEN: Both users see reflection phase UI
    // Together-mode reflection routes to SoloReadingFlow → ReflectionSummary
    await expect(page.getByTestId('reading-container')).not.toBeVisible({
      timeout: REFLECTION_LOAD_TIMEOUT_MS,
    });
    await expect(page.getByTestId('scripture-reflection-summary-screen')).toBeVisible({
      timeout: REFLECTION_LOAD_TIMEOUT_MS,
    });
    await expect(partnerPage.getByTestId('scripture-reflection-summary-screen')).toBeVisible({
      timeout: REFLECTION_LOAD_TIMEOUT_MS,
    });
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
    test.setTimeout(90_000);

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
    // We wait with REALTIME_SYNC_TIMEOUT_MS to account for the initial
    // presence broadcast arriving via the ephemeral presence channel.
    // -----------------------------------------------------------------------
    await expect(page.getByTestId('partner-position')).toBeVisible({
      timeout: REALTIME_SYNC_TIMEOUT_MS,
    });
    await expect(page.getByTestId('partner-position')).toContainText(/is reading the verse/i, {
      timeout: REALTIME_SYNC_TIMEOUT_MS,
    });

    // Verify the indicator also appears on the partner's page for User A
    await expect(partnerPage.getByTestId('partner-position')).toBeVisible({
      timeout: REALTIME_SYNC_TIMEOUT_MS,
    });
    await expect(partnerPage.getByTestId('partner-position')).toContainText(
      /is reading the verse/i,
      { timeout: REALTIME_SYNC_TIMEOUT_MS }
    );

    // -----------------------------------------------------------------------
    // WHEN: Partner switches to the response tab
    // -----------------------------------------------------------------------
    await partnerPage.getByTestId('reading-tab-response').click();

    // THEN: User A's indicator updates to show "is reading the response"
    await expect(page.getByTestId('partner-position')).toContainText(/is reading the response/i, {
      timeout: REALTIME_SYNC_TIMEOUT_MS,
    });

    // -----------------------------------------------------------------------
    // WHEN: Partner switches back to the verse tab
    // -----------------------------------------------------------------------
    await partnerPage.getByTestId('reading-tab-verse').click();

    // THEN: User A's indicator reverts to "is reading the verse"
    await expect(page.getByTestId('partner-position')).toContainText(/is reading the verse/i, {
      timeout: REALTIME_SYNC_TIMEOUT_MS,
    });
  });
});
