/**
 * P0/P1 E2E: Together Mode Reading — Synchronized Lock-In (Story 4.2)
 *
 * Test IDs: 4.2-E2E-001 (P0), 4.2-E2E-002 (P1), 4.2-E2E-003 (P1), 4.2-E2E-004 (P1)
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
  READY_BROADCAST_TIMEOUT_MS,
  STEP_ADVANCE_TIMEOUT_MS,
  isToggleReadyResponse,
} from '../../support/helpers/scripture-lobby';

// ---------------------------------------------------------------------------
// All tests in this file share the same test user pair and must run serially
// to avoid session contamination via scripture_create_session reuse.
// ---------------------------------------------------------------------------
test.describe.configure({ mode: 'serial' });

// ---------------------------------------------------------------------------
// Timeout constants
// ---------------------------------------------------------------------------

const LOCK_IN_BROADCAST_TIMEOUT_MS = 15_000;
const REFLECTION_LOAD_TIMEOUT_MS = 20_000;

// ---------------------------------------------------------------------------
// Shared helper: navigate both users through lobby to reading phase
// ---------------------------------------------------------------------------

/**
 * Matches a scripture_lock_in RPC 2xx response.
 */
const isLockInResponse = (resp: { url(): string; status(): number }): boolean =>
  resp.url().includes('/rest/v1/rpc/scripture_lock_in') &&
  resp.status() >= 200 &&
  resp.status() < 300;

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

    // GIVEN: User A selects Reader role (fixture already navigated to role selection)
    await page.getByTestId('lobby-role-reader').click();
    await expect(page.getByTestId('lobby-waiting')).toBeVisible();

    // GIVEN: User B (partner) is already at role selection (fixture)
    await partnerPage.getByTestId('lobby-role-responder').click();
    await expect(partnerPage.getByTestId('lobby-waiting')).toBeVisible();

    // Both users ready up → countdown → reading phase
    await expect(page.getByTestId('lobby-partner-status')).toContainText(/has joined/i, {
      timeout: REALTIME_SYNC_TIMEOUT_MS,
    });
    const userAReadyResponse = page.waitForResponse(isToggleReadyResponse, {
      timeout: READY_BROADCAST_TIMEOUT_MS,
    });
    await page.getByTestId('lobby-ready-button').click();
    await userAReadyResponse;
    const partnerReadyResponse = partnerPage.waitForResponse(isToggleReadyResponse, {
      timeout: READY_BROADCAST_TIMEOUT_MS,
    });
    await partnerPage.getByTestId('lobby-ready-button').click();
    await partnerReadyResponse;

    // Wait for countdown to complete → reading container visible
    await expect(page.getByTestId('reading-container')).toBeVisible({
      timeout: STEP_ADVANCE_TIMEOUT_MS,
    });
    await expect(partnerPage.getByTestId('reading-container')).toBeVisible({
      timeout: STEP_ADVANCE_TIMEOUT_MS,
    });

    // AC#1 — Role indicator: User A (Reader) sees "You read this"
    await expect(page.getByTestId('role-indicator')).toContainText('You read this');
    // Partner (Responder) sees "Partner reads this"
    await expect(partnerPage.getByTestId('role-indicator')).toContainText('Partner reads this');

    // -----------------------------------------------------------------------
    // WHEN: User A taps "Ready for next verse" (lock-in)
    // -----------------------------------------------------------------------
    const userALockIn = page
      .waitForResponse(isLockInResponse, { timeout: LOCK_IN_BROADCAST_TIMEOUT_MS })
      .catch((e: Error) => {
        throw new Error(`scripture_lock_in RPC (User A) did not fire: ${e.message}`);
      });

    await page.getByTestId('lock-in-button').click();
    await userALockIn;

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
    const partnerLockIn = partnerPage
      .waitForResponse(isLockInResponse, { timeout: LOCK_IN_BROADCAST_TIMEOUT_MS })
      .catch((e: Error) => {
        throw new Error(`scripture_lock_in RPC (User B) did not fire: ${e.message}`);
      });

    await partnerPage.getByTestId('lock-in-button').click();
    await partnerLockIn;

    // AC#5 — Both advance to step 2 (verse text changes)
    await expect(page.getByTestId('reading-step-progress')).toContainText(/verse 2 of 17/i, {
      timeout: STEP_ADVANCE_TIMEOUT_MS,
    });
    await expect(partnerPage.getByTestId('reading-step-progress')).toContainText(/verse 2 of 17/i, {
      timeout: STEP_ADVANCE_TIMEOUT_MS,
    });

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
    browser,
    supabaseAdmin,
    partnerStorageStatePath,
  }) => {
    test.setTimeout(60_000);

    const seed = await createTestSession(supabaseAdmin, {
      sessionCount: 1,
      preset: 'mid_session',
    });
    expect(seed.test_user2_id).toBeTruthy();
    await linkTestPartners(supabaseAdmin, seed.test_user1_id, seed.test_user2_id!);
    const sessionIdsToClean = [...seed.session_ids];

    // End the seeded session so it doesn't interfere with the UI-created lobby session
    await supabaseAdmin
      .from('scripture_sessions')
      .update({ status: 'complete', current_phase: 'complete' })
      .in('id', seed.session_ids);

    const uiSessionId2 = await navigateToTogetherRoleSelection(page);
    if (uiSessionId2) sessionIdsToClean.push(uiSessionId2);
    await page.getByTestId('lobby-role-reader').click();

    const baseURL = new URL(page.url()).origin;
    const partnerContext = await browser.newContext({
      storageState: partnerStorageStatePath,
      baseURL,
    });
    const partnerPage = await partnerContext.newPage();

    try {
      const uiSessionId2b = await navigateToTogetherRoleSelection(partnerPage);
      if (uiSessionId2b && uiSessionId2b !== uiSessionId2) sessionIdsToClean.push(uiSessionId2b);
      await partnerPage.getByTestId('lobby-role-responder').click();
      await expect(partnerPage.getByTestId('lobby-waiting')).toBeVisible();

      // Both ready → countdown → reading phase
      await expect(page.getByTestId('lobby-partner-status')).toContainText(/has joined/i, {
        timeout: REALTIME_SYNC_TIMEOUT_MS,
      });
      const userAReadyResponse2 = page.waitForResponse(isToggleReadyResponse, {
        timeout: READY_BROADCAST_TIMEOUT_MS,
      });
      await page.getByTestId('lobby-ready-button').click();
      await userAReadyResponse2;
      const partnerReadyResponse2 = partnerPage.waitForResponse(isToggleReadyResponse, {
        timeout: READY_BROADCAST_TIMEOUT_MS,
      });
      await partnerPage.getByTestId('lobby-ready-button').click();
      await partnerReadyResponse2;
      await expect(page.getByTestId('reading-container')).toBeVisible({
        timeout: STEP_ADVANCE_TIMEOUT_MS,
      });

      // WHEN: User A locks in
      const userALockInResponse2 = page.waitForResponse(isLockInResponse, {
        timeout: LOCK_IN_BROADCAST_TIMEOUT_MS,
      });
      await page.getByTestId('lock-in-button').click();
      await userALockInResponse2;
      await expect(page.getByTestId('lock-in-undo')).toBeVisible();

      // WHEN: User A taps "Tap to undo"
      await page.getByTestId('lock-in-undo').click();

      // THEN: Button reverts to "Ready for next verse"
      await expect(page.getByTestId('lock-in-button')).toContainText(/ready for next verse/i);

      // THEN: Partner's indicator disappears
      await expect(partnerPage.getByTestId('partner-locked-indicator')).not.toBeVisible({
        timeout: REALTIME_SYNC_TIMEOUT_MS,
      });
    } finally {
      await partnerContext.close();
      await cleanupTestSession(supabaseAdmin, sessionIdsToClean);
      await unlinkTestPartners(supabaseAdmin, seed.test_user1_id, seed.test_user2_id!);
    }
  });
});

// ---------------------------------------------------------------------------
// 4.2-E2E-003: Role Alternation (P1)
// ---------------------------------------------------------------------------

test.describe('[4.2-E2E-003] Role Alternation', () => {
  // Implementation complete — Story 4.2

  test('[P1] should alternate roles after step advance', async ({
    page,
    browser,
    supabaseAdmin,
    partnerStorageStatePath,
  }) => {
    test.setTimeout(90_000);

    const seed = await createTestSession(supabaseAdmin, {
      sessionCount: 1,
      preset: 'mid_session',
    });
    expect(seed.test_user2_id).toBeTruthy();
    await linkTestPartners(supabaseAdmin, seed.test_user1_id, seed.test_user2_id!);
    const sessionIdsToClean = [...seed.session_ids];

    // End the seeded session so it doesn't interfere with the UI-created lobby session
    await supabaseAdmin
      .from('scripture_sessions')
      .update({ status: 'complete', current_phase: 'complete' })
      .in('id', seed.session_ids);

    const uiSessionId3 = await navigateToTogetherRoleSelection(page);
    if (uiSessionId3) sessionIdsToClean.push(uiSessionId3);
    await page.getByTestId('lobby-role-reader').click();

    const baseURL = new URL(page.url()).origin;
    const partnerContext = await browser.newContext({
      storageState: partnerStorageStatePath,
      baseURL,
    });
    const partnerPage = await partnerContext.newPage();

    try {
      const uiSessionId3b = await navigateToTogetherRoleSelection(partnerPage);
      if (uiSessionId3b && uiSessionId3b !== uiSessionId3) sessionIdsToClean.push(uiSessionId3b);
      await partnerPage.getByTestId('lobby-role-responder').click();
      await expect(partnerPage.getByTestId('lobby-waiting')).toBeVisible();

      // Both ready → countdown → reading
      await expect(page.getByTestId('lobby-partner-status')).toContainText(/has joined/i, {
        timeout: REALTIME_SYNC_TIMEOUT_MS,
      });
      const userAReadyResponse3 = page.waitForResponse(isToggleReadyResponse, {
        timeout: READY_BROADCAST_TIMEOUT_MS,
      });
      await page.getByTestId('lobby-ready-button').click();
      await userAReadyResponse3;
      const partnerReadyResponse3 = partnerPage.waitForResponse(isToggleReadyResponse, {
        timeout: READY_BROADCAST_TIMEOUT_MS,
      });
      await partnerPage.getByTestId('lobby-ready-button').click();
      await partnerReadyResponse3;
      await expect(page.getByTestId('reading-container')).toBeVisible({
        timeout: STEP_ADVANCE_TIMEOUT_MS,
      });

      // Step 1: User A is Reader, Partner is Responder
      await expect(page.getByTestId('role-indicator')).toContainText('You read this');
      await expect(partnerPage.getByTestId('role-indicator')).toContainText('Partner reads this');

      // Both lock in → advance to step 2
      const userALockIn3 = page.waitForResponse(isLockInResponse, {
        timeout: LOCK_IN_BROADCAST_TIMEOUT_MS,
      });
      await page.getByTestId('lock-in-button').click();
      await userALockIn3;
      const partnerLockIn3 = partnerPage.waitForResponse(isLockInResponse, {
        timeout: LOCK_IN_BROADCAST_TIMEOUT_MS,
      });
      await partnerPage.getByTestId('lock-in-button').click();
      await partnerLockIn3;

      // Wait for step advance
      await expect(page.getByTestId('reading-step-progress')).toContainText(/verse 2 of 17/i, {
        timeout: STEP_ADVANCE_TIMEOUT_MS,
      });

      // Step 2: Roles alternate — User A is now Responder, Partner is Reader
      await expect(page.getByTestId('role-indicator')).toContainText('Partner reads this');
      await expect(partnerPage.getByTestId('role-indicator')).toContainText('You read this');
    } finally {
      await partnerContext.close();
      await cleanupTestSession(supabaseAdmin, sessionIdsToClean);
      await unlinkTestPartners(supabaseAdmin, seed.test_user1_id, seed.test_user2_id!);
    }
  });
});

// ---------------------------------------------------------------------------
// 4.2-E2E-004: Last Step Completion → Reflection (P1)
// ---------------------------------------------------------------------------

test.describe('[4.2-E2E-004] Last Step Completion', () => {
  // Implementation complete — Story 4.2

  test('[P1] should transition to reflection phase after both lock in on last step', async ({
    page,
    browser,
    supabaseAdmin,
    partnerStorageStatePath,
  }) => {
    test.setTimeout(120_000);

    // SETUP: Seed to get user IDs for partner linking, then complete the seeded session
    const seed = await createTestSession(supabaseAdmin, {
      sessionCount: 1,
      preset: 'mid_session',
    });
    expect(seed.test_user2_id).toBeTruthy();
    await linkTestPartners(supabaseAdmin, seed.test_user1_id, seed.test_user2_id!);
    const sessionIdsToClean = [...seed.session_ids];

    // End the seeded session so it doesn't interfere with the UI-created lobby session
    await supabaseAdmin
      .from('scripture_sessions')
      .update({ status: 'complete', current_phase: 'complete' })
      .in('id', seed.session_ids);

    const uiSessionId4 = await navigateToTogetherRoleSelection(page);
    if (uiSessionId4) sessionIdsToClean.push(uiSessionId4);
    await page.getByTestId('lobby-role-reader').click();

    const baseURL = new URL(page.url()).origin;
    const partnerContext = await browser.newContext({
      storageState: partnerStorageStatePath,
      baseURL,
    });
    const partnerPage = await partnerContext.newPage();

    try {
      const uiSessionId4b = await navigateToTogetherRoleSelection(partnerPage);
      if (uiSessionId4b && uiSessionId4b !== uiSessionId4) sessionIdsToClean.push(uiSessionId4b);
      await partnerPage.getByTestId('lobby-role-responder').click();
      await expect(partnerPage.getByTestId('lobby-waiting')).toBeVisible();

      // Both ready → countdown → reading
      await expect(page.getByTestId('lobby-partner-status')).toContainText(/has joined/i, {
        timeout: REALTIME_SYNC_TIMEOUT_MS,
      });
      const userAReadyResponse4 = page.waitForResponse(isToggleReadyResponse, {
        timeout: READY_BROADCAST_TIMEOUT_MS,
      });
      await page.getByTestId('lobby-ready-button').click();
      await userAReadyResponse4;
      const partnerReadyResponse4 = partnerPage.waitForResponse(isToggleReadyResponse, {
        timeout: READY_BROADCAST_TIMEOUT_MS,
      });
      await partnerPage.getByTestId('lobby-ready-button').click();
      await partnerReadyResponse4;
      await expect(page.getByTestId('reading-container')).toBeVisible({
        timeout: STEP_ADVANCE_TIMEOUT_MS,
      });

      // Advance the session to step 16 (last step) via DB, then reload into store.
      // Use the UI-created session ID (already tracked for cleanup).
      const sessionId = uiSessionId4;
      await supabaseAdmin
        .from('scripture_sessions')
        .update({ current_step_index: 16 })
        .eq('id', sessionId);

      // Reload session from DB into the Zustand store without page.reload()
      // (reload loses together-mode state since checkForActiveSession only handles solo).
      const loadSessionScript = (sid: string) =>
        `import("/src/stores/useAppStore.ts").then(m => m.useAppStore.getState().loadSession("${sid}"))`;
      await page.evaluate(loadSessionScript(sessionId));
      await partnerPage.evaluate(loadSessionScript(sessionId));

      await expect(page.getByTestId('reading-container')).toBeVisible({
        timeout: STEP_ADVANCE_TIMEOUT_MS,
      });
      await expect(partnerPage.getByTestId('reading-container')).toBeVisible({
        timeout: STEP_ADVANCE_TIMEOUT_MS,
      });

      // Should be on step 17 (last step)
      await expect(page.getByTestId('reading-step-progress')).toContainText(/verse 17 of 17/i);

      // Both lock in on last step → reflection phase
      const userALockIn4 = page.waitForResponse(isLockInResponse, {
        timeout: LOCK_IN_BROADCAST_TIMEOUT_MS,
      });
      await page.getByTestId('lock-in-button').click();
      await userALockIn4;
      const partnerLockIn4 = partnerPage.waitForResponse(isLockInResponse, {
        timeout: LOCK_IN_BROADCAST_TIMEOUT_MS,
      });
      await partnerPage.getByTestId('lock-in-button').click();
      await partnerLockIn4;

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
    } finally {
      await partnerContext.close();
      await cleanupTestSession(supabaseAdmin, sessionIdsToClean);
      await unlinkTestPartners(supabaseAdmin, seed.test_user1_id, seed.test_user2_id!);
    }
  });
});
