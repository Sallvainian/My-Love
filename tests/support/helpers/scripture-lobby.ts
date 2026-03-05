/**
 * Scripture Lobby Test Helpers
 *
 * Shared helpers for Together Mode lobby E2E tests (Story 4.1+).
 * Import these instead of re-defining them in each lobby spec file.
 */
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { ensureScriptureOverview } from '../helpers';

// ---------------------------------------------------------------------------
// Shared timeout constants
// ---------------------------------------------------------------------------

export const SESSION_CREATE_TIMEOUT_MS = 15_000;
export const STEP_ADVANCE_TIMEOUT_MS = 15_000;
export const REALTIME_SYNC_TIMEOUT_MS = 20_000;
export const READY_BROADCAST_TIMEOUT_MS = 10_000;
export const COUNTDOWN_APPEAR_TIMEOUT_MS = 10_000;
export const LOCK_IN_BROADCAST_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Shared predicates
// ---------------------------------------------------------------------------

/** Matches a scripture_toggle_ready RPC 2xx response. */
export const isToggleReadyResponse = (resp: { url(): string; status(): number }): boolean =>
  resp.url().includes('/rest/v1/rpc/scripture_toggle_ready') &&
  resp.status() >= 200 &&
  resp.status() < 300;

/** Matches a scripture_select_role RPC 2xx response. */
export const isSelectRoleResponse = (resp: { url(): string; status(): number }): boolean =>
  resp.url().includes('/rest/v1/rpc/scripture_select_role') &&
  resp.status() >= 200 &&
  resp.status() < 300;

/** Matches a scripture_lock_in RPC 2xx response. */
export const isLockInResponse = (resp: { url(): string; status(): number }): boolean =>
  resp.url().includes('/rest/v1/rpc/scripture_lock_in') &&
  resp.status() >= 200 &&
  resp.status() < 300;

/** Matches a scripture_convert_to_solo RPC or a PATCH to scripture_sessions (2xx). */
export const isConvertToSoloResponse = (resp: {
  url(): string;
  status(): number;
  request(): { method(): string };
}): boolean =>
  (resp.url().includes('/rest/v1/rpc/scripture_convert_to_solo') ||
    (resp.url().includes('/rest/v1/scripture_sessions') && resp.request().method() === 'PATCH')) &&
  resp.status() >= 200 &&
  resp.status() < 300;

// ---------------------------------------------------------------------------
// Shared lock-in helper
// ---------------------------------------------------------------------------

/**
 * Click the lock-in button and wait for the RPC response.
 * Enriches the error with the given `label` on timeout.
 */
export async function lockInAndWait(page: Page, label: string): Promise<void> {
  const lockInResponse = page
    .waitForResponse(isLockInResponse, { timeout: LOCK_IN_BROADCAST_TIMEOUT_MS })
    .catch((e: Error) => {
      throw new Error(`scripture_lock_in RPC (${label}) did not fire: ${e.message}`);
    });

  await page.getByTestId('lock-in-button').click();
  await lockInResponse;
}

// ---------------------------------------------------------------------------
// Shared navigation helpers
// ---------------------------------------------------------------------------

/**
 * Navigate both users through lobby → role selection → ready → countdown → reading phase.
 * Returns when both users see the reading-container.
 */
export async function navigateBothToReadingPhase(
  page: Page,
  partnerPage: Page,
  roles: { userA: 'reader' | 'responder'; userB: 'reader' | 'responder' } = {
    userA: 'reader',
    userB: 'responder',
  }
): Promise<void> {
  await page.getByTestId(`lobby-role-${roles.userA}`).click();
  await partnerPage.getByTestId(`lobby-role-${roles.userB}`).click();
  await expect(partnerPage.getByTestId('lobby-waiting')).toBeVisible();

  await expect(page.getByTestId('lobby-partner-status')).toContainText(/has joined/i, {
    timeout: REALTIME_SYNC_TIMEOUT_MS,
  });
  const userAReady = page.waitForResponse(isToggleReadyResponse, {
    timeout: READY_BROADCAST_TIMEOUT_MS,
  });
  await page.getByTestId('lobby-ready-button').click();
  await userAReady;
  const partnerReady = partnerPage.waitForResponse(isToggleReadyResponse, {
    timeout: READY_BROADCAST_TIMEOUT_MS,
  });
  await partnerPage.getByTestId('lobby-ready-button').click();
  await partnerReady;

  await expect(page.getByTestId('reading-container')).toBeVisible({
    timeout: STEP_ADVANCE_TIMEOUT_MS,
  });
  await expect(partnerPage.getByTestId('reading-container')).toBeVisible({
    timeout: STEP_ADVANCE_TIMEOUT_MS,
  });

  // Confirm realtime broadcast channel is live on both sides by waiting for the
  // presence-driven partner-position indicator. This element only renders when
  // the partner's presence channel has subscribed and broadcast — guaranteeing
  // the broadcast channel (same async setAuth → subscribe flow) is also ready.
  await expect(page.getByTestId('partner-position')).toBeVisible({
    timeout: REALTIME_SYNC_TIMEOUT_MS,
  });
  await expect(partnerPage.getByTestId('partner-position')).toBeVisible({
    timeout: REALTIME_SYNC_TIMEOUT_MS,
  });
}

/**
 * Navigate to /scripture and start Together mode.
 * Waits for the role selection screen to become visible.
 * Returns the session ID from the create-session RPC response.
 */
export async function navigateToTogetherRoleSelection(page: Page): Promise<string> {
  await ensureScriptureOverview(page);

  // Network-first: watch for the create-session RPC before clicking
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

  // Select Together mode (not Solo)
  await expect(page.getByTestId('scripture-mode-together')).toBeVisible();
  await page.getByTestId('scripture-mode-together').click();

  const response = await sessionResponse;
  const payload = (await response.json()) as { id?: string };

  // Role selection screen must be visible
  await expect(page.getByTestId('lobby-role-selection')).toBeVisible();

  return payload.id ?? '';
}
