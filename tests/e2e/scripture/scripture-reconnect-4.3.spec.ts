/**
 * P0/P1 E2E: Together Mode — Reconnection & Graceful Degradation (Story 4.3)
 *
 * Test IDs: 4.3-E2E-001 (P0), 4.3-E2E-002 (P1)
 *
 * Acceptance Criteria covered:
 *   AC#1 — Reconnecting indicator: partner offline → "Partner reconnecting..." overlay
 *   AC#2 — Timeout options: >30s → "Keep Waiting" / "End Session" buttons
 *   AC#3 — Keep waiting: overlay stays, session continues
 *   AC#4 — End session: scripture_end_session RPC → both clients exit cleanly
 *   AC#5 — Reconnection resync: partner returns → resync with server state
 */
import { test, expect } from '../../support/merged-fixtures';
import {
  SESSION_CREATE_TIMEOUT_MS,
  STEP_ADVANCE_TIMEOUT_MS,
} from '../../support/helpers/scripture-lobby';
import {
  startTogetherSessionForRole,
  setupBothUsersInReading,
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

      // Open a new partner tab and load the existing together-mode session.
      // NOTE: Together-mode sessions are not auto-detected on navigation
      // (checkForActiveSession only finds solo sessions). We call loadSession()
      // via page.evaluate() with Vite's dev-server ESM resolution. This
      // couples the test to the dev-server — if the bundler or base path
      // changes, update the import path below. See test-review-story-4.3.md
      // recommendation #3 for the app-level fix (add ?sessionId= support).
      const reconnectedPartnerPage = await partner.context.newPage();
      await reconnectedPartnerPage.goto('/scripture');
      await expect(reconnectedPartnerPage.getByTestId('scripture-overview')).toBeVisible({
        timeout: STEP_ADVANCE_TIMEOUT_MS,
      });
      await reconnectedPartnerPage.evaluate(
        (sid) =>
          import('/src/stores/useAppStore.ts').then((m) =>
            m.useAppStore.getState().loadSession(sid)
          ),
        primarySessionId
      );
      await expect(reconnectedPartnerPage.getByTestId('reading-container')).toBeVisible({
        timeout: STEP_ADVANCE_TIMEOUT_MS,
      });

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
