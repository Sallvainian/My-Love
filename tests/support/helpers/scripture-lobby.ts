/**
 * Scripture Lobby Test Helpers
 *
 * Shared helpers for Together Mode lobby E2E tests (Story 4.1+).
 * Import these instead of re-defining them in each lobby spec file.
 */
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';


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
 * Returns the session ID from the create-session RPC response,
 * or empty string if the user auto-joined an existing session
 * (partner navigating after User A already created a session).
 */
export async function navigateToTogetherRoleSelection(page: Page): Promise<string> {
  // Network-first: intercept ALL API calls that trigger re-renders BEFORE
  // navigating. On mount, ScriptureOverview fires loadPartner (2x GET /users)
  // then loadCoupleStats (POST /rpc/scripture_get_couple_stats). Each response
  // causes a re-render that can detach the start button mid-click.
  // We must wait for the LAST response (couple stats) to guarantee stability.
  const partnerLoaded = page.waitForResponse(
    (resp) =>
      resp.url().includes('/rest/v1/users') && resp.status() >= 200 && resp.status() < 300,
    { timeout: 20_000 }
  );
  const statsLoaded = page.waitForResponse(
    (resp) =>
      resp.url().includes('/rest/v1/rpc/scripture_get_couple_stats') &&
      resp.status() >= 200 &&
      resp.status() < 300,
    { timeout: 20_000 }
  );

  await page.goto('/scripture?fresh=true');

  const lobbyRoleSelection = page.getByTestId('lobby-role-selection');
  const scriptureOverview = page.getByTestId('scripture-overview');
  const readingFlow = page.getByTestId('solo-reading-flow');
  const loginScreen = page.getByTestId('login-screen');

  await expect(
    lobbyRoleSelection.or(scriptureOverview).or(readingFlow).or(loginScreen)
  ).toBeVisible({ timeout: 20_000 });

  // Fail fast on login screen (auth token missing or expired)
  if (await loginScreen.isVisible()) {
    throw new Error(
      '[navigateToTogetherRoleSelection] Page rendered login screen. Auth token may be expired or missing.'
    );
  }

  // Partner auto-joined an active together session — already at role selection.
  // No new session was created; return empty string.
  if (await lobbyRoleSelection.isVisible()) {
    return '';
  }

  // Wait for ALL re-render-triggering API calls to complete before interacting.
  // Swallow rejections — stats may not fire if partner is unlinked, but the
  // important thing is we gave the full chain time to settle.
  await Promise.all([
    partnerLoaded.catch(() => {}),
    statsLoaded.catch(() => {}),
  ]);

  // Normal flow: overview → Start → Together → create session
  const startButton = page.getByTestId('scripture-start-button');
  await expect(startButton).toBeEnabled();
  await startButton.click({ timeout: 10_000 });

  // Wait for Together mode button to be visible AND enabled.
  // The button is disabled while partner data is loading (partnerStatus !== 'linked').
  // Without this wait, clicking the disabled button silently does nothing — no RPC fires.
  const togetherButton = page.getByTestId('scripture-mode-together');
  await expect(togetherButton).toBeVisible();
  await expect(togetherButton).toBeEnabled({ timeout: SESSION_CREATE_TIMEOUT_MS });

  // Network-first: watch for the create-session RPC before clicking Together
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

  await togetherButton.click();

  const response = await sessionResponse;
  const payload = (await response.json()) as { id?: string };

  // Role selection screen must be visible
  await expect(lobbyRoleSelection).toBeVisible();

  return payload.id ?? '';
}
