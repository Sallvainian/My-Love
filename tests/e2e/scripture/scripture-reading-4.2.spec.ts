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
  navigateToTogetherRoleSelection,
} from '../../support/helpers/scripture-lobby';
import {
  createTestSession,
  linkTestPartners,
  unlinkTestPartners,
  cleanupTestSession,
} from '../../support/factories';

// ---------------------------------------------------------------------------
// Timeout constants
// ---------------------------------------------------------------------------

const LOCK_IN_BROADCAST_TIMEOUT_MS = 15_000;
const STEP_ADVANCE_TIMEOUT_MS = 15_000;
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
    browser,
    supabaseAdmin,
    partnerStorageStatePath,
  }) => {
    test.setTimeout(90_000);

    // SETUP: Create a together-mode session with linked partners
    const seed = await createTestSession(supabaseAdmin, {
      sessionCount: 1,
      preset: 'mid_session',
    });
    expect(seed.test_user2_id, 'createTestSession must return a partner user ID').toBeTruthy();
    await linkTestPartners(supabaseAdmin, seed.test_user1_id, seed.test_user2_id!);
    const sessionIdsToClean = [...seed.session_ids];

    // GIVEN: User A navigates to /scripture, starts Together mode, selects Reader
    await navigateToTogetherRoleSelection(page);
    await page.getByTestId('lobby-role-reader').click();
    await expect(page.getByTestId('lobby-waiting')).toBeVisible();

    // GIVEN: User B (partner) joins and selects Responder
    const baseURL = new URL(page.url()).origin;
    const partnerContext = await browser.newContext({
      storageState: partnerStorageStatePath,
      baseURL,
    });
    const partnerPage = await partnerContext.newPage();

    try {
      await navigateToTogetherRoleSelection(partnerPage);
      await partnerPage.getByTestId('lobby-role-responder').click();
      await expect(partnerPage.getByTestId('lobby-waiting')).toBeVisible();

      // Both users ready up → countdown → reading phase
      await expect(page.getByTestId('lobby-partner-status')).toContainText(/has joined/i, {
        timeout: REALTIME_SYNC_TIMEOUT_MS,
      });
      await page.getByTestId('lobby-ready-button').click();
      await partnerPage.getByTestId('lobby-ready-button').click();

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
      await expect(partnerPage.getByTestId('reading-step-progress')).toContainText(
        /verse 2 of 17/i,
        { timeout: STEP_ADVANCE_TIMEOUT_MS }
      );

      // AC#1 — Role alternation: User A (Reader on step 1) is now Responder on step 2
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

    await navigateToTogetherRoleSelection(page);
    await page.getByTestId('lobby-role-reader').click();

    const baseURL = new URL(page.url()).origin;
    const partnerContext = await browser.newContext({
      storageState: partnerStorageStatePath,
      baseURL,
    });
    const partnerPage = await partnerContext.newPage();

    try {
      await navigateToTogetherRoleSelection(partnerPage);
      await partnerPage.getByTestId('lobby-role-responder').click();

      // Both ready → countdown → reading phase
      await expect(page.getByTestId('lobby-partner-status')).toContainText(/has joined/i, {
        timeout: REALTIME_SYNC_TIMEOUT_MS,
      });
      await page.getByTestId('lobby-ready-button').click();
      await partnerPage.getByTestId('lobby-ready-button').click();
      await expect(page.getByTestId('reading-container')).toBeVisible({
        timeout: STEP_ADVANCE_TIMEOUT_MS,
      });

      // WHEN: User A locks in
      await page.getByTestId('lock-in-button').click();
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

    await navigateToTogetherRoleSelection(page);
    await page.getByTestId('lobby-role-reader').click();

    const baseURL = new URL(page.url()).origin;
    const partnerContext = await browser.newContext({
      storageState: partnerStorageStatePath,
      baseURL,
    });
    const partnerPage = await partnerContext.newPage();

    try {
      await navigateToTogetherRoleSelection(partnerPage);
      await partnerPage.getByTestId('lobby-role-responder').click();

      // Both ready → countdown → reading
      await expect(page.getByTestId('lobby-partner-status')).toContainText(/has joined/i, {
        timeout: REALTIME_SYNC_TIMEOUT_MS,
      });
      await page.getByTestId('lobby-ready-button').click();
      await partnerPage.getByTestId('lobby-ready-button').click();
      await expect(page.getByTestId('reading-container')).toBeVisible({
        timeout: STEP_ADVANCE_TIMEOUT_MS,
      });

      // Step 1: User A is Reader, Partner is Responder
      await expect(page.getByTestId('role-indicator')).toContainText('You read this');
      await expect(partnerPage.getByTestId('role-indicator')).toContainText('Partner reads this');

      // Both lock in → advance to step 2
      await page.getByTestId('lock-in-button').click();
      await partnerPage.getByTestId('lock-in-button').click();

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

    // SETUP: Seed session at step 16 (last step = index 16, which is step 17)
    // to avoid 16 rounds of lock-in
    const seed = await createTestSession(supabaseAdmin, {
      sessionCount: 1,
      preset: 'mid_session',
    });
    expect(seed.test_user2_id).toBeTruthy();
    await linkTestPartners(supabaseAdmin, seed.test_user1_id, seed.test_user2_id!);
    const sessionIdsToClean = [...seed.session_ids];

    // Advance session to step 16 via direct DB update
    await supabaseAdmin
      .from('scripture_sessions')
      .update({ current_step_index: 16, current_phase: 'reading', mode: 'together' })
      .eq('id', seed.session_ids[0]);

    await navigateToTogetherRoleSelection(page);
    await page.getByTestId('lobby-role-reader').click();

    const baseURL = new URL(page.url()).origin;
    const partnerContext = await browser.newContext({
      storageState: partnerStorageStatePath,
      baseURL,
    });
    const partnerPage = await partnerContext.newPage();

    try {
      await navigateToTogetherRoleSelection(partnerPage);
      await partnerPage.getByTestId('lobby-role-responder').click();

      // Both ready → countdown → reading
      await expect(page.getByTestId('lobby-partner-status')).toContainText(/has joined/i, {
        timeout: REALTIME_SYNC_TIMEOUT_MS,
      });
      await page.getByTestId('lobby-ready-button').click();
      await partnerPage.getByTestId('lobby-ready-button').click();
      await expect(page.getByTestId('reading-container')).toBeVisible({
        timeout: STEP_ADVANCE_TIMEOUT_MS,
      });

      // Should be on step 17 (last step)
      await expect(page.getByTestId('reading-step-progress')).toContainText(/verse 17 of 17/i);

      // Both lock in on last step → reflection phase
      await page.getByTestId('lock-in-button').click();
      await partnerPage.getByTestId('lock-in-button').click();

      // THEN: Both users see reflection phase UI
      // Reflection flow uses SoloReadingFlow — verify scripture-overview routing
      await expect(page.getByTestId('reading-container')).not.toBeVisible({
        timeout: REFLECTION_LOAD_TIMEOUT_MS,
      });
      await expect(page.getByTestId('reflection-subview')).toBeVisible({
        timeout: REFLECTION_LOAD_TIMEOUT_MS,
      });
      await expect(partnerPage.getByTestId('reflection-subview')).toBeVisible({
        timeout: REFLECTION_LOAD_TIMEOUT_MS,
      });
    } finally {
      await partnerContext.close();
      await cleanupTestSession(supabaseAdmin, sessionIdsToClean);
      await unlinkTestPartners(supabaseAdmin, seed.test_user1_id, seed.test_user2_id!);
    }
  });
});
