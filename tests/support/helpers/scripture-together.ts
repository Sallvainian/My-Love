/**
 * Scripture Together Mode Test Helpers
 *
 * Shared helpers for Together Mode E2E tests that need to start sessions
 * and navigate both users through the lobby to the reading phase.
 *
 * These build on scripture-lobby.ts helpers and eliminate duplication
 * across Together Mode spec files (Stories 4.2, 4.3+).
 */
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { TypedSupabaseClient } from '../factories';
import {
  REALTIME_SYNC_TIMEOUT_MS,
  READY_BROADCAST_TIMEOUT_MS,
  STEP_ADVANCE_TIMEOUT_MS,
  isToggleReadyResponse,
  navigateToTogetherRoleSelection,
} from './scripture-lobby';

/**
 * Start a Together Mode session and select a role.
 *
 * Navigates to /scripture, clicks Start → Together, waits for
 * scripture_create_session RPC, then selects the given role and
 * waits for the lobby to advance past role selection.
 *
 * @param page - Playwright page (authenticated user)
 * @param roleTestId - data-testid for the role button
 * @returns The session ID from the create-session RPC
 */
export async function startTogetherSessionForRole(
  page: Page,
  roleTestId: 'lobby-role-reader' | 'lobby-role-responder'
): Promise<string> {
  const sessionId = await navigateToTogetherRoleSelection(page);

  await page.getByTestId(roleTestId).click();

  // Wait for any post-role state: waiting for partner, ready button, or reading
  await expect
    .poll(
      async () => {
        const isWaiting = await page
          .getByText(/waiting for/i)
          .isVisible()
          .catch(() => false);
        const isReady = await page
          .getByRole('button', { name: /i'?m ready/i })
          .isVisible()
          .catch(() => false);
        const isReading = await page
          .getByTestId('reading-container')
          .isVisible()
          .catch(() => false);
        return isWaiting || isReady || isReading;
      },
      { timeout: STEP_ADVANCE_TIMEOUT_MS }
    )
    .toBe(true);

  return sessionId;
}

/**
 * Navigate both users through lobby ready-up to the reading phase.
 *
 * Assumes both users are already in the lobby (post-role-selection).
 * Waits for partner join, both users ready up (network-first), and
 * both see the reading container.
 *
 * @param page - User A's page
 * @param partnerPage - User B's page
 */
export async function setupBothUsersInReading(page: Page, partnerPage: Page): Promise<void> {
  // Wait for the ready button to appear on User A's page (lobby loaded)
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

/**
 * Jump both pages to a specific step by updating the DB row and
 * injecting the new step index into each page's live Zustand store.
 */
export async function jumpToStep(
  supabaseAdmin: TypedSupabaseClient,
  sessionId: string,
  page: Page,
  partnerPage: Page,
  stepIndex: number
): Promise<void> {
  await supabaseAdmin
    .from('scripture_sessions')
    .update({ current_step_index: stepIndex })
    .eq('id', sessionId);

  const injectStep = (step: number): void => {
    const store = window.__APP_STORE__;
    if (!store) throw new Error('__APP_STORE__ not found');
    const session = store.getState().session;
    if (!session) throw new Error('session is null in store');
    store.setState({ session: { ...session, currentStepIndex: step } });
  };

  await page.evaluate(injectStep, stepIndex);
  await partnerPage.evaluate(injectStep, stepIndex);
}

/**
 * Reconnect a partner to an existing together-mode session.
 *
 * Navigates to /scripture, waits for the app store to be available,
 * calls loadSession(), then deterministically waits for the store
 * state to settle before asserting the DOM.
 *
 * Together-mode sessions are not auto-detected on navigation
 * (checkForActiveSession only finds solo sessions), so we call
 * loadSession() via window.__APP_STORE__.
 */
export async function reconnectPartnerAndLoadSession(
  page: Page,
  sessionId: string,
  options: { timeout?: number } = {}
): Promise<void> {
  const timeout = options.timeout ?? STEP_ADVANCE_TIMEOUT_MS;

  // 1. Navigate and wait for app to load
  await page.goto('/scripture');
  await expect(page.getByTestId('scripture-overview')).toBeVisible({ timeout });

  // 2. Guard: wait for __APP_STORE__ on fresh page
  await page.waitForFunction(() => typeof window.__APP_STORE__ !== 'undefined', { timeout: 5_000 });

  // 3. Call loadSession
  await page.evaluate(async (sid) => {
    const store = window.__APP_STORE__;
    if (!store) throw new Error('__APP_STORE__ not found');
    await store.getState().loadSession(sid);
  }, sessionId);

  // 4. Deterministic wait: poll store until session is together-mode reading
  //    (matches ScriptureOverview routing condition)
  await page.waitForFunction(
    () => {
      const store = window.__APP_STORE__;
      if (!store) return false;
      const s = store.getState().session;
      return s !== null && s.mode === 'together' && s.currentPhase === 'reading';
    },
    { timeout, polling: 250 }
  );

  // 5. DOM confirmation (near-instant since store is already correct)
  await expect(page.getByTestId('reading-container')).toBeVisible({ timeout });
}
