/**
 * P0/P1 E2E: Together Mode — Reconnection & Graceful Degradation (Story 4.3)
 *
 * Test IDs: 4.3-E2E-001 (P0), 4.3-E2E-002 (P1), 4.3-E2E-003 (P1)
 *
 * Acceptance Criteria covered:
 *   AC#1 — Reconnecting indicator: partner offline → "Partner reconnecting..." overlay
 *   AC#2 — Timeout options: >30s → "Keep Waiting" / "End Session" buttons
 *   AC#3 — Keep waiting: overlay stays, session continues
 *   AC#4 — End session: scripture_end_session RPC → both clients exit cleanly
 *   AC#5 — Reconnection resync: partner returns → resync with server state
 *   AC#6 — Stale state handling: reconnecting client updates to canonical state
 */
import { test, expect } from '../../support/merged-fixtures';
import {
  SESSION_CREATE_TIMEOUT_MS,
  STEP_ADVANCE_TIMEOUT_MS,
} from '../../support/helpers/scripture-lobby';
import {
  startTogetherSessionForRole,
  setupBothUsersInReading,
  reconnectPartnerAndLoadSession,
} from '../../support/helpers/scripture-together';
import { cleanupTestSession } from '../../support/factories';

// ---------------------------------------------------------------------------
// Timeout constants
// ---------------------------------------------------------------------------

const DISCONNECTION_DETECT_TIMEOUT_MS = 25_000; // Heartbeat 10s + stale TTL 20s + buffer
const DISCONNECTION_PHASE_B_TIMEOUT_MS = 35_000; // Phase B starts at 30s elapsed

// ---------------------------------------------------------------------------
// Shared helper: create a partner browser context
// ---------------------------------------------------------------------------

async function createPartnerContext(
  browser: import('@playwright/test').Browser,
  originPage: import('@playwright/test').Page,
  partnerStorageStatePath: string
) {
  const baseURL = new URL(originPage.url()).origin;
  const context = await browser.newContext({ storageState: partnerStorageStatePath, baseURL });
  const page = await context.newPage();
  return { context, page };
}

// ---------------------------------------------------------------------------
// 4.3-E2E-001: End Session Flow (P0)
// ---------------------------------------------------------------------------

test.describe('[4.3-E2E-001] End Session on Partner Disconnect', () => {
  test('[P0] should show disconnect overlay, timeout, and end session cleanly', async ({
    page,
    browser,
    supabaseAdmin,
    partnerStorageStatePath,
  }) => {
    test.setTimeout(120_000);
    const sessionIdsToClean = new Set<string>();

    // GIVEN: User A starts Together mode, selecting Reader
    const primarySessionId = await startTogetherSessionForRole(page, 'lobby-role-reader');
    sessionIdsToClean.add(primarySessionId);

    // GIVEN: User B (partner) joins and selects Responder
    const partner = await createPartnerContext(browser, page, partnerStorageStatePath);

    try {
      const partnerSessionId = await startTogetherSessionForRole(
        partner.page,
        'lobby-role-responder'
      );
      sessionIdsToClean.add(partnerSessionId);

      // Both enter reading phase
      await setupBothUsersInReading(page, partner.page);

      // -----------------------------------------------------------------------
      // WHEN: Partner B goes offline (close their page to stop sending presence)
      // -----------------------------------------------------------------------
      await partner.page.close();

      // -----------------------------------------------------------------------
      // THEN: AC#1 — User A sees "Partner reconnecting..." overlay
      // -----------------------------------------------------------------------
      await expect(page.getByTestId('disconnection-overlay')).toBeVisible({
        timeout: DISCONNECTION_DETECT_TIMEOUT_MS,
      });
      await expect(page.getByTestId('disconnection-reconnecting')).toBeVisible();

      // AC#1 — Lock-in button shows "Holding your place"
      await expect(page.getByTestId('lock-in-disconnected')).toContainText(/holding your place/i);

      // -----------------------------------------------------------------------
      // WHEN: 30s timeout reached → Phase B
      // -----------------------------------------------------------------------
      await expect(page.getByTestId('disconnection-timeout')).toBeVisible({
        timeout: DISCONNECTION_PHASE_B_TIMEOUT_MS,
      });

      // AC#2 — Timeout options appear with neutral language
      await expect(page.getByTestId('disconnection-keep-waiting')).toBeVisible();
      await expect(page.getByTestId('disconnection-end-session')).toBeVisible();
      await expect(page.getByTestId('disconnection-timeout')).toContainText(
        /your partner seems to have stepped away/i
      );

      // -----------------------------------------------------------------------
      // WHEN: User A taps "End Session"
      // -----------------------------------------------------------------------
      const endSessionResponse = page
        .waitForResponse(
          (resp) =>
            resp.url().includes('/rest/v1/rpc/scripture_end_session') &&
            resp.status() >= 200 &&
            resp.status() < 300,
          { timeout: SESSION_CREATE_TIMEOUT_MS }
        )
        .catch((e: Error) => {
          throw new Error(`scripture_end_session RPC did not fire: ${e.message}`);
        });

      await page.getByTestId('disconnection-end-session').click();
      await expect(page.getByTestId('disconnection-confirmation')).toBeVisible();
      await page.getByTestId('disconnection-confirm-end-session').click();
      await endSessionResponse;

      // -----------------------------------------------------------------------
      // THEN: AC#4 — Session ends, user returns to scripture overview
      // -----------------------------------------------------------------------
      await expect(page.getByTestId('reading-container')).not.toBeVisible({
        timeout: SESSION_CREATE_TIMEOUT_MS,
      });
      await expect(page.getByTestId('scripture-mode-together')).toBeVisible({
        timeout: SESSION_CREATE_TIMEOUT_MS,
      });

      // Verify session status in DB: ended_early
      const { data: sessionData } = await supabaseAdmin
        .from('scripture_sessions')
        .select('status')
        .eq('id', primarySessionId)
        .single();
      expect(sessionData?.status).toBe('ended_early');
    } finally {
      await partner.context.close().catch(() => {});
      await cleanupTestSession(supabaseAdmin, [...sessionIdsToClean]);
    }
  });
});

// ---------------------------------------------------------------------------
// 4.3-E2E-002: Keep Waiting then Reconnect (P1)
// ---------------------------------------------------------------------------

test.describe('[4.3-E2E-002] Keep Waiting then Reconnect', () => {
  test('[P1] should show disconnect overlay, keep waiting, then reconnect and resume', async ({
    page,
    browser,
    supabaseAdmin,
    partnerStorageStatePath,
  }) => {
    test.setTimeout(120_000);
    const sessionIdsToClean = new Set<string>();

    // GIVEN: User A starts Together mode, selecting Reader
    const primarySessionId = await startTogetherSessionForRole(page, 'lobby-role-reader');
    sessionIdsToClean.add(primarySessionId);

    const partner = await createPartnerContext(browser, page, partnerStorageStatePath);

    try {
      const partnerSessionId = await startTogetherSessionForRole(
        partner.page,
        'lobby-role-responder'
      );
      sessionIdsToClean.add(partnerSessionId);

      await setupBothUsersInReading(page, partner.page);

      // -----------------------------------------------------------------------
      // WHEN: Partner B goes offline (close tab to stop presence heartbeat)
      // -----------------------------------------------------------------------
      await partner.page.close();

      // THEN: User A sees disconnect overlay
      await expect(page.getByTestId('disconnection-overlay')).toBeVisible({
        timeout: DISCONNECTION_DETECT_TIMEOUT_MS,
      });

      // Wait for Phase B timeout
      await expect(page.getByTestId('disconnection-timeout')).toBeVisible({
        timeout: DISCONNECTION_PHASE_B_TIMEOUT_MS,
      });

      // -----------------------------------------------------------------------
      // WHEN: User A taps "Keep Waiting"
      // -----------------------------------------------------------------------
      await page.getByTestId('disconnection-keep-waiting').click();

      // AC#3 — Overlay stays (returned to reconnecting state)
      await expect(page.getByTestId('disconnection-overlay')).toBeVisible();

      // -----------------------------------------------------------------------
      // WHEN: Partner B comes back online (new tab, navigate to scripture)
      // The app detects the active session and resumes it. The partner's
      // presence hook re-subscribes → heartbeats resume → User A's hook
      // detects partner online → overlay dismisses.
      // -----------------------------------------------------------------------

      // Ensure DB has current_phase='reading' so the app loads the correct phase
      await supabaseAdmin
        .from('scripture_sessions')
        .update({ current_phase: 'reading' })
        .eq('id', primarySessionId);

      // Open a new partner tab and reconnect to the existing together-mode session.
      const reconnectedPartnerPage = await partner.context.newPage();
      await reconnectPartnerAndLoadSession(reconnectedPartnerPage, primarySessionId);

      // -----------------------------------------------------------------------
      // THEN: AC#5 — Both resume reading, overlay dismisses
      // -----------------------------------------------------------------------
      await expect(page.getByTestId('disconnection-overlay')).not.toBeVisible({
        timeout: DISCONNECTION_DETECT_TIMEOUT_MS,
      });

      // Both users still see reading container (session intact)
      await expect(page.getByTestId('reading-container')).toBeVisible({
        timeout: STEP_ADVANCE_TIMEOUT_MS,
      });
      await expect(reconnectedPartnerPage.getByTestId('reading-container')).toBeVisible({
        timeout: STEP_ADVANCE_TIMEOUT_MS,
      });

      // Verify session is still in_progress (not ended)
      const { data: sessionData } = await supabaseAdmin
        .from('scripture_sessions')
        .select('status')
        .eq('id', primarySessionId)
        .single();
      expect(sessionData?.status).toBe('in_progress');
    } finally {
      await partner.context.close().catch(() => {});
      await cleanupTestSession(supabaseAdmin, [...sessionIdsToClean]);
    }
  });
});

// ---------------------------------------------------------------------------
// 4.3-E2E-003: Reconnect After Step Advance (P1)
// Traceability gap: 4.3-AC#6 — PARTIAL → FULL
// ---------------------------------------------------------------------------

test.describe('[4.3-E2E-003] Reconnect After Step Advance', () => {
  test('[P1] should resync reconnecting partner to canonical state after step advanced while offline', async ({
    page,
    browser,
    supabaseAdmin,
    partnerStorageStatePath,
  }) => {
    test.setTimeout(120_000);
    const sessionIdsToClean = new Set<string>();

    // GIVEN: User A starts Together mode, selecting Reader
    const primarySessionId = await startTogetherSessionForRole(page, 'lobby-role-reader');
    sessionIdsToClean.add(primarySessionId);

    const partner = await createPartnerContext(browser, page, partnerStorageStatePath);

    try {
      const partnerSessionId = await startTogetherSessionForRole(
        partner.page,
        'lobby-role-responder'
      );
      sessionIdsToClean.add(partnerSessionId);

      await setupBothUsersInReading(page, partner.page);

      // Both users start on step 1 (Verse 1 of 17)
      await expect(page.getByTestId('reading-step-progress')).toContainText(/verse 1 of 17/i, {
        timeout: STEP_ADVANCE_TIMEOUT_MS,
      });

      // -----------------------------------------------------------------------
      // WHEN: Partner B goes offline (close tab to stop presence heartbeat)
      // -----------------------------------------------------------------------
      await partner.page.close();

      // User A sees disconnect overlay
      await expect(page.getByTestId('disconnection-overlay')).toBeVisible({
        timeout: DISCONNECTION_DETECT_TIMEOUT_MS,
      });

      // -----------------------------------------------------------------------
      // WHILE PARTNER IS OFFLINE: Advance the session step via DB
      // This simulates the scenario where the session advanced (e.g., via
      // server-side action or race condition) while the partner was offline.
      // We bump current_step_index and version in the DB directly.
      // -----------------------------------------------------------------------
      const { data: currentSession } = await supabaseAdmin
        .from('scripture_sessions')
        .select('current_step_index, version')
        .eq('id', primarySessionId)
        .single();

      const newStepIndex = (currentSession?.current_step_index ?? 0) + 1;
      const newVersion = (currentSession?.version ?? 1) + 1;

      await supabaseAdmin
        .from('scripture_sessions')
        .update({
          current_step_index: newStepIndex,
          version: newVersion,
          current_phase: 'reading',
        })
        .eq('id', primarySessionId);

      // Also inject the new step into User A's Zustand store so their UI
      // reflects the advanced state
      await page.evaluate(
        ({ step }) => {
          const store = window.__APP_STORE__;
          if (!store) throw new Error('__APP_STORE__ not found');
          const session = store.getState().session;
          if (!session) throw new Error('session is null in store');
          store.setState({ session: { ...session, currentStepIndex: step } });
        },
        { step: newStepIndex }
      );

      // Dismiss the disconnect overlay so User A can continue
      // Wait for Phase B with timeout buttons
      await expect(page.getByTestId('disconnection-timeout')).toBeVisible({
        timeout: DISCONNECTION_PHASE_B_TIMEOUT_MS,
      });
      await page.getByTestId('disconnection-keep-waiting').click();

      // -----------------------------------------------------------------------
      // WHEN: Partner B comes back online and loads the session
      // The loadSession() call fetches server-authoritative state, which now
      // has a higher step index than the partner's last known state.
      // AC#6: Reconnecting client updates to canonical state (version check).
      // -----------------------------------------------------------------------
      const reconnectedPartnerPage = await partner.context.newPage();
      await reconnectPartnerAndLoadSession(reconnectedPartnerPage, primarySessionId);

      // -----------------------------------------------------------------------
      // THEN: AC#6 — Partner resyncs to the advanced step (step 2)
      // The loadSession resync overwrites the partner's stale local state
      // with the server-authoritative state (step 2, higher version).
      // -----------------------------------------------------------------------
      const advancedStepPattern = new RegExp(`verse ${newStepIndex + 1} of 17`, 'i');
      await expect(reconnectedPartnerPage.getByTestId('reading-step-progress')).toContainText(
        advancedStepPattern,
        { timeout: STEP_ADVANCE_TIMEOUT_MS }
      );

      // User A should also be on the advanced step
      await expect(page.getByTestId('reading-step-progress')).toContainText(advancedStepPattern, {
        timeout: STEP_ADVANCE_TIMEOUT_MS,
      });

      // Disconnect overlay should dismiss when partner comes back online
      await expect(page.getByTestId('disconnection-overlay')).not.toBeVisible({
        timeout: DISCONNECTION_DETECT_TIMEOUT_MS,
      });

      // Session is still in_progress (not ended)
      const { data: sessionData } = await supabaseAdmin
        .from('scripture_sessions')
        .select('status')
        .eq('id', primarySessionId)
        .single();
      expect(sessionData?.status).toBe('in_progress');
    } finally {
      await partner.context.close().catch(() => {});
      await cleanupTestSession(supabaseAdmin, [...sessionIdsToClean]);
    }
  });
});
