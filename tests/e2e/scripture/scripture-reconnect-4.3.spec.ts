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
import { ensureScriptureOverview } from '../../support/helpers';
import {
  REALTIME_SYNC_TIMEOUT_MS,
  READY_BROADCAST_TIMEOUT_MS,
  SESSION_CREATE_TIMEOUT_MS,
  STEP_ADVANCE_TIMEOUT_MS,
  isToggleReadyResponse,
} from '../../support/helpers/scripture-lobby';
import { cleanupTestSession } from '../../support/factories';

// ---------------------------------------------------------------------------
// Timeout constants
// ---------------------------------------------------------------------------

const DISCONNECTION_DETECT_TIMEOUT_MS = 25_000; // Heartbeat 10s + stale TTL 20s + buffer
const DISCONNECTION_PHASE_B_TIMEOUT_MS = 35_000; // Phase B starts at 30s elapsed

// ---------------------------------------------------------------------------
// Shared helper: navigate both users through lobby to reading phase
// ---------------------------------------------------------------------------

async function setupBothUsersInReading(
  page: import('@playwright/test').Page,
  partnerPage: import('@playwright/test').Page
) {
  const bothAlreadyInReading =
    (await page
      .getByTestId('reading-container')
      .isVisible()
      .catch(() => false)) &&
    (await partnerPage
      .getByTestId('reading-container')
      .isVisible()
      .catch(() => false));

  if (bothAlreadyInReading) return;

  // Wait for the ready button to appear on at least User A's page (lobby loaded)
  await expect(page.getByTestId('lobby-ready-button')).toBeVisible({
    timeout: STEP_ADVANCE_TIMEOUT_MS,
  });

  // Wait for partner to see that User A has joined before readying up
  await expect(page.getByTestId('lobby-partner-status')).toContainText(/has joined/i, {
    timeout: REALTIME_SYNC_TIMEOUT_MS,
  });

  // Both users ready up → countdown → reading phase (network-first)
  const pageReadyResponse = page.waitForResponse(isToggleReadyResponse, {
    timeout: READY_BROADCAST_TIMEOUT_MS,
  });
  await page.getByTestId('lobby-ready-button').click();
  await pageReadyResponse;

  await expect(partnerPage.getByTestId('lobby-ready-button')).toBeVisible({
    timeout: STEP_ADVANCE_TIMEOUT_MS,
  });
  const partnerReadyResponse = partnerPage.waitForResponse(isToggleReadyResponse, {
    timeout: READY_BROADCAST_TIMEOUT_MS,
  });
  await partnerPage.getByTestId('lobby-ready-button').click();
  await partnerReadyResponse;

  // Wait for reading container on both pages (countdown completes → reading)
  await expect(page.getByTestId('reading-container')).toBeVisible({
    timeout: STEP_ADVANCE_TIMEOUT_MS,
  });
  await expect(partnerPage.getByTestId('reading-container')).toBeVisible({
    timeout: STEP_ADVANCE_TIMEOUT_MS,
  });
}

async function startTogetherSessionForRole(
  page: import('@playwright/test').Page,
  roleTestId: 'lobby-role-reader' | 'lobby-role-responder',
  options?: { assertPostState?: boolean }
): Promise<string> {
  const assertPostState = options?.assertPostState ?? true;

  await ensureScriptureOverview(page);

  const sessionResponse = page
    .waitForResponse(
      (resp) =>
        resp.url().includes('/rest/v1/rpc/scripture_create_session') &&
        resp.request().method() === 'POST' &&
        resp.status() >= 200 &&
        resp.status() < 300,
      { timeout: SESSION_CREATE_TIMEOUT_MS }
    )
    .catch((e: Error) => {
      throw new Error(`scripture_create_session RPC did not fire: ${e.message}`);
    });

  await page.getByTestId('scripture-start-button').click();
  await expect(page.getByTestId('scripture-mode-together')).toBeVisible();
  await page.getByTestId('scripture-mode-together').click();

  const response = await sessionResponse;
  const payload = (await response.json()) as { id?: string };
  const sessionId = payload.id;
  expect(sessionId, 'scripture_create_session must return session id').toBeTruthy();

  const hasLobbyRoleSelection = await page
    .getByTestId('lobby-role-selection')
    .isVisible({ timeout: 2_000 })
    .catch(() => false);

  if (assertPostState) {
    if (hasLobbyRoleSelection) {
      await page.getByTestId(roleTestId).click();
      await expect
        .poll(
          async () => {
            const isWaitingVisible = await page
              .getByText(/waiting for/i)
              .isVisible()
              .catch(() => false);
            const isReadyVisible = await page
              .getByRole('button', { name: /i'?m ready/i })
              .isVisible()
              .catch(() => false);
            const isReadingVisible = await page
              .getByTestId('reading-container')
              .isVisible()
              .catch(() => false);
            return isWaitingVisible || isReadyVisible || isReadingVisible;
          },
          { timeout: STEP_ADVANCE_TIMEOUT_MS }
        )
        .toBe(true);
    } else {
      await expect(page.getByTestId('reading-container')).toBeVisible({
        timeout: STEP_ADVANCE_TIMEOUT_MS,
      });
    }
  } else if (hasLobbyRoleSelection) {
    await page.getByTestId(roleTestId).click();
  }

  return sessionId!;
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

    // GIVEN: User A starts Together mode, selecting Reader when lobby is available
    const primarySessionId = await startTogetherSessionForRole(page, 'lobby-role-reader');
    sessionIdsToClean.add(primarySessionId);

    // GIVEN: User B (partner) joins and selects Responder
    const baseURL = new URL(page.url()).origin;
    const partnerContext = await browser.newContext({
      storageState: partnerStorageStatePath,
      baseURL,
    });
    const partnerPage = await partnerContext.newPage();

    try {
      const partnerSessionId = await startTogetherSessionForRole(
        partnerPage,
        'lobby-role-responder'
      );
      sessionIdsToClean.add(partnerSessionId);

      // Both enter reading phase
      await setupBothUsersInReading(page, partnerPage);

      // -----------------------------------------------------------------------
      // WHEN: Partner B goes offline (close their page to stop sending presence)
      // -----------------------------------------------------------------------
      await partnerPage.close();

      // -----------------------------------------------------------------------
      // THEN: AC#1 — User A sees "Partner reconnecting..." overlay
      // -----------------------------------------------------------------------
      await expect(page.getByTestId('disconnection-overlay')).toBeVisible({
        timeout: DISCONNECTION_DETECT_TIMEOUT_MS,
      });
      await expect(page.getByTestId('disconnection-reconnecting')).toBeVisible();

      // AC#1 — Lock-in button shows "Holding your place"
      await expect(page.getByTestId('lock-in-disconnected')).toBeVisible();
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
      // Scripture overview mode selection is visible after session ends.
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
      await partnerContext.close().catch(() => {});
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

    // GIVEN: User A starts Together mode, selecting Reader when lobby is available
    const primarySessionId = await startTogetherSessionForRole(page, 'lobby-role-reader');
    sessionIdsToClean.add(primarySessionId);

    const baseURL = new URL(page.url()).origin;
    const partnerContext = await browser.newContext({
      storageState: partnerStorageStatePath,
      baseURL,
    });
    let partnerPage = await partnerContext.newPage();

    try {
      const partnerSessionId = await startTogetherSessionForRole(
        partnerPage,
        'lobby-role-responder'
      );
      sessionIdsToClean.add(partnerSessionId);

      await setupBothUsersInReading(page, partnerPage);

      // -----------------------------------------------------------------------
      // WHEN: Partner B goes offline (close tab to stop presence heartbeat)
      // -----------------------------------------------------------------------
      await partnerPage.close();

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
      // WHEN: Partner B comes back online (new tab in same authenticated context)
      // scripture_create_session only reuses lobby-phase sessions, so we load
      // the existing reading-phase session directly into the partner's store.
      // This triggers ReadingContainer mount → useScripturePresence subscribes
      // → heartbeats resume → User A's presence hook detects partner online.
      // -----------------------------------------------------------------------

      // Ensure DB has current_phase='reading' so loadSession gets the correct phase.
      // The countdown→reading transition is normally client-side only, so the DB
      // may still show 'countdown' at this point.
      await supabaseAdmin
        .from('scripture_sessions')
        .update({ current_phase: 'reading' })
        .eq('id', primarySessionId);

      partnerPage = await partnerContext.newPage();
      await partnerPage.goto('/scripture');
      // Wait for the app to hydrate (any data-testid means React has rendered)
      await partnerPage.waitForFunction(() => !!document.querySelector('[data-testid]'), null, {
        timeout: STEP_ADVANCE_TIMEOUT_MS,
      });
      // Load the existing reading-phase session into the Zustand store
      await partnerPage.evaluate(
        `import("/src/stores/useAppStore.ts").then(m => m.useAppStore.getState().loadSession("${primarySessionId}"))`
      );
      await expect(partnerPage.getByTestId('reading-container')).toBeVisible({
        timeout: STEP_ADVANCE_TIMEOUT_MS,
      });

      // -----------------------------------------------------------------------
      // THEN: AC#5 — Both resume reading, overlay dismisses
      // Partner's ReadingContainer mounts → useScripturePresence subscribes
      // → sends heartbeat → User A's presence hook receives it → overlay dismisses.
      // Allow extra time for channel subscription + first heartbeat delivery.
      // -----------------------------------------------------------------------
      await expect(page.getByTestId('disconnection-overlay')).not.toBeVisible({
        timeout: DISCONNECTION_DETECT_TIMEOUT_MS,
      });

      // Both users still see reading container (session intact)
      await expect(page.getByTestId('reading-container')).toBeVisible();
      await expect(partnerPage.getByTestId('reading-container')).toBeVisible();

      // Verify session is still in_progress (not ended)
      const { data: sessionData } = await supabaseAdmin
        .from('scripture_sessions')
        .select('status')
        .eq('id', primarySessionId)
        .single();
      expect(sessionData?.status).toBe('in_progress');
    } finally {
      await partnerContext.close().catch(() => {});
      await cleanupTestSession(supabaseAdmin, [...sessionIdsToClean]);
    }
  });
});
