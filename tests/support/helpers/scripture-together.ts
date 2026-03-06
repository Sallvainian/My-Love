/**
 * Scripture Together Mode Test Helpers
 *
 * Shared helpers for Together Mode E2E tests that need to start sessions
 * and navigate both users through the lobby to the reading phase.
 */
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { TypedSupabaseClient } from '../factories';
import { waitForScriptureRpc, waitForScriptureStore } from '../helpers';
import {
  navigateToTogetherRoleSelection,
  waitForCountdownStarted,
  waitForPartnerJoined,
  waitForReadingPhase,
} from './scripture-lobby';

/**
 * Start a Together Mode session and select a role.
 *
 * Navigates to /scripture, clicks Start → Together, waits for
 * scripture_create_session RPC, then selects the given role and
 * waits for the lobby to advance past role selection.
 */
export async function startTogetherSessionForRole(
  page: Page,
  roleTestId: 'lobby-role-reader' | 'lobby-role-responder'
): Promise<string> {
  const sessionId = await navigateToTogetherRoleSelection(page);

  const selectRole = waitForScriptureRpc(page, 'scripture_select_role');
  await page.getByTestId(roleTestId).click();
  await selectRole;

  const anyPostRoleState = page
    .getByText(/waiting for/i)
    .or(page.getByRole('button', { name: /i'?m ready/i }))
    .or(page.getByTestId('reading-container'));
  await expect(anyPostRoleState).toBeVisible();

  return sessionId;
}

/**
 * Navigate both users through lobby ready-up to the reading phase.
 *
 * Assumes both users are already in the lobby (post-role-selection).
 */
export async function setupBothUsersInReading(page: Page, partnerPage: Page): Promise<void> {
  await expect(page.getByTestId('lobby-ready-button')).toBeVisible();
  await waitForPartnerJoined(page);

  const pageReadyResponse = waitForScriptureRpc(page, 'scripture_toggle_ready');
  await page.getByTestId('lobby-ready-button').click();
  await pageReadyResponse;
  await waitForScriptureStore(page, 'current user ready state', (snapshot) => snapshot.myReady);

  await expect(partnerPage.getByTestId('lobby-ready-button')).toBeVisible();
  const partnerReadyResponse = waitForScriptureRpc(partnerPage, 'scripture_toggle_ready');
  await partnerPage.getByTestId('lobby-ready-button').click();
  await partnerReadyResponse;

  await waitForCountdownStarted(page);
  await waitForCountdownStarted(partnerPage);
  await waitForReadingPhase(page);
  await waitForReadingPhase(partnerPage);
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

  await waitForScriptureStore(page, `page step ${stepIndex}`, (snapshot) => {
    return snapshot.session?.currentStepIndex === stepIndex;
  });
  await waitForScriptureStore(partnerPage, `partner page step ${stepIndex}`, (snapshot) => {
    return snapshot.session?.currentStepIndex === stepIndex;
  });
}

/**
 * Reconnect a partner to an existing together-mode session.
 *
 * Together-mode sessions are not auto-detected on navigation
 * (checkForActiveSession only finds solo sessions), so we call
 * loadSession() via window.__APP_STORE__.
 */
export async function reconnectPartnerAndLoadSession(page: Page, sessionId: string): Promise<void> {
  await page.goto('/scripture');
  await expect(page.getByTestId('scripture-overview')).toBeVisible();

  await waitForScriptureStore(page, 'scripture store availability', (snapshot) => snapshot.hasStore);

  await page.evaluate(async (sid) => {
    const store = window.__APP_STORE__;
    if (!store) throw new Error('__APP_STORE__ not found');
    await store.getState().loadSession(sid);
  }, sessionId);

  await waitForScriptureStore(
    page,
    'reconnected partner reading session',
    (snapshot) => snapshot.session?.mode === 'together' && snapshot.session.currentPhase === 'reading'
  );
  await expect(page.getByTestId('reading-container')).toBeVisible();
}
