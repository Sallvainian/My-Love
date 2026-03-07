/**
 * Scripture Lobby Test Helpers
 *
 * Shared helpers for Together Mode lobby E2E tests (Story 4.1+).
 * Import these instead of re-defining synchronization logic in each spec.
 */
import { expect } from '@playwright/test';
import type { Page, Response } from '@playwright/test';
import { waitForScriptureRpc, waitForScriptureStore } from '../helpers';

type SuccessfulResponse = Pick<Response, 'url' | 'status' | 'request'>;

const DISCONNECT_DETECT_WINDOW_MS = 25_000;
const DISCONNECT_PHASE_B_WINDOW_MS = 35_000;

/** Matches a scripture_toggle_ready RPC 2xx response. */
export const isToggleReadyResponse = (resp: SuccessfulResponse): boolean =>
  resp.url().includes('/rest/v1/rpc/scripture_toggle_ready') &&
  resp.status() >= 200 &&
  resp.status() < 300;

/** Matches a scripture_select_role RPC 2xx response. */
export const isSelectRoleResponse = (resp: SuccessfulResponse): boolean =>
  resp.url().includes('/rest/v1/rpc/scripture_select_role') &&
  resp.status() >= 200 &&
  resp.status() < 300;

/** Matches a scripture_lock_in RPC 2xx response. */
export const isLockInResponse = (resp: SuccessfulResponse): boolean =>
  resp.url().includes('/rest/v1/rpc/scripture_lock_in') &&
  resp.status() >= 200 &&
  resp.status() < 300;

/** Matches a scripture_convert_to_solo RPC or a PATCH to scripture_sessions (2xx). */
export const isConvertToSoloResponse = (resp: SuccessfulResponse): boolean =>
  (resp.url().includes('/rest/v1/rpc/scripture_convert_to_solo') ||
    (resp.url().includes('/rest/v1/scripture_sessions') && resp.request().method() === 'PATCH')) &&
  resp.status() >= 200 &&
  resp.status() < 300;

async function waitForScriptureResponse(
  page: Page,
  label: string,
  matcher: (resp: SuccessfulResponse) => boolean
): Promise<Response> {
  try {
    return await page.waitForResponse((resp) => matcher(resp));
  } catch (error) {
    throw new Error(
      `[waitForScriptureResponse] ${label} did not resolve: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export async function waitForPartnerJoined(page: Page): Promise<void> {
  await waitForScriptureStore(page, 'partner to join the lobby', (snapshot) => snapshot.partnerJoined);
  await expect(page.getByTestId('lobby-partner-status')).toContainText(/has joined/i);
}

export async function waitForCountdownStarted(page: Page): Promise<void> {
  await waitForScriptureStore(
    page,
    'countdown phase to start',
    (snapshot) =>
      snapshot.session?.currentPhase === 'countdown' && snapshot.countdownStartedAt !== null
  );
  await expect(page.getByTestId('countdown-container')).toBeVisible();
}

export async function waitForReadingPhase(page: Page): Promise<void> {
  await waitForScriptureStore(
    page,
    'reading phase to be active',
    (snapshot) => snapshot.session?.currentPhase === 'reading'
  );
  await expect(page.getByTestId('reading-container')).toBeVisible();
}

export async function waitForReadingStep(
  page: Page,
  stepIndex: number,
  totalVerses: number
): Promise<void> {
  await waitForScriptureStore(
    page,
    `reading step ${stepIndex + 1}`,
    (snapshot) => snapshot.session?.currentStepIndex === stepIndex
  );
  await expect(page.getByTestId('reading-step-progress')).toContainText(
    new RegExp(`verse ${stepIndex + 1} of ${totalVerses}`, 'i')
  );
}

export async function waitForPartnerPosition(
  page: Page,
  expectedText?: string | RegExp
): Promise<void> {
  const partnerPosition = page.getByTestId('partner-position');
  await expect(partnerPosition).toBeVisible();

  if (expectedText) {
    await expect(partnerPosition).toContainText(expectedText);
  }
}

export async function waitForPartnerLocked(page: Page): Promise<void> {
  await waitForScriptureStore(
    page,
    'partner lock-in broadcast',
    (snapshot) => snapshot.partnerLocked
  );
  await expect(page.getByTestId('partner-locked-indicator')).toBeVisible();
}

export async function waitForReflectionPhase(page: Page): Promise<void> {
  await waitForScriptureStore(
    page,
    'reflection phase to be active',
    (snapshot) => snapshot.session?.currentPhase === 'reflection'
  );
  await expect(page.getByTestId('scripture-reflection-summary-screen')).toBeVisible();
}

export async function waitForPartnerDisconnected(page: Page): Promise<void> {
  await waitForScriptureStore(
    page,
    'partner disconnection overlay',
    (snapshot) => snapshot.partnerDisconnected && snapshot.partnerDisconnectedAt !== null,
    { timeout: DISCONNECT_DETECT_WINDOW_MS }
  );
  await expect(page.getByTestId('disconnection-overlay')).toBeVisible();
  await expect(page.getByTestId('disconnection-reconnecting')).toBeVisible();
}

export async function waitForDisconnectionTimeout(page: Page): Promise<void> {
  await expect(page.getByText(/your partner seems to have stepped away/i)).toBeVisible({
    timeout: DISCONNECT_PHASE_B_WINDOW_MS,
  });
  await expect(page.getByTestId('disconnection-keep-waiting')).toBeVisible();
  await expect(page.getByTestId('disconnection-end-session')).toBeVisible();
}

export async function waitForPartnerReconnected(page: Page): Promise<void> {
  await waitForScriptureStore(
    page,
    'partner reconnection cleanup',
    (snapshot) => !snapshot.partnerDisconnected,
    { timeout: DISCONNECT_DETECT_WINDOW_MS }
  );
  await expect(page.getByTestId('disconnection-overlay')).not.toBeVisible();
}

/**
 * Click the lock-in button and wait for the RPC response.
 * Enriches the error with the given `label` on failure.
 */
export async function lockInAndWait(page: Page, label: string): Promise<void> {
  const lockInResponse = waitForScriptureResponse(page, `scripture_lock_in RPC (${label})`, isLockInResponse);

  await page.getByTestId('lock-in-button').click();
  await lockInResponse;
}

/**
 * Navigate both users through lobby → role selection → ready → countdown → reading phase.
 * Returns when both users see the reading-container and presence indicator.
 */
export async function navigateBothToReadingPhase(
  page: Page,
  partnerPage: Page,
  roles: { userA: 'reader' | 'responder'; userB: 'reader' | 'responder' } = {
    userA: 'reader',
    userB: 'responder',
  }
): Promise<void> {
  const userASelectRole = waitForScriptureResponse(page, 'scripture_select_role RPC (User A)', isSelectRoleResponse);
  await page.getByTestId(`lobby-role-${roles.userA}`).click();
  await userASelectRole;
  await expect(page.getByTestId('lobby-waiting')).toBeVisible();

  const userBSelectRole = waitForScriptureResponse(
    partnerPage,
    'scripture_select_role RPC (User B)',
    isSelectRoleResponse
  );
  await partnerPage.getByTestId(`lobby-role-${roles.userB}`).click();
  await userBSelectRole;
  await expect(partnerPage.getByTestId('lobby-waiting')).toBeVisible();

  await waitForPartnerJoined(page);

  const userAReady = waitForScriptureResponse(page, 'scripture_toggle_ready RPC (User A)', isToggleReadyResponse);
  await page.getByTestId('lobby-ready-button').click();
  await userAReady;
  await waitForScriptureStore(page, 'current user ready state', (snapshot) => snapshot.myReady);

  const partnerReady = waitForScriptureResponse(
    partnerPage,
    'scripture_toggle_ready RPC (User B)',
    isToggleReadyResponse
  );
  await partnerPage.getByTestId('lobby-ready-button').click();
  await partnerReady;

  await waitForCountdownStarted(page);
  await waitForCountdownStarted(partnerPage);
  await waitForReadingPhase(page);
  await waitForReadingPhase(partnerPage);

  // Confirm the presence channel is live on both sides by waiting for the
  // presence-driven partner-position indicator. This is the primary realtime
  // fallback when no additional HTTP response exists for presence propagation.
  await waitForPartnerPosition(page);
  await waitForPartnerPosition(partnerPage);
}

/**
 * Navigate to /scripture and start Together mode.
 * Waits for the role selection screen to become visible.
 * Returns the session ID from the create-session RPC response,
 * or empty string if the user auto-joined an existing session.
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
  ).toBeVisible();

  if (await loginScreen.isVisible()) {
    throw new Error(
      '[navigateToTogetherRoleSelection] Page rendered login screen. Auth token may be expired or missing.'
    );
  }

  if (await lobbyRoleSelection.isVisible()) {
    return '';
  }

  const startButton = page.getByTestId('scripture-start-button');
  await expect(startButton).toBeVisible();
  await expect(startButton).toBeEnabled();
  await startButton.click();

  const togetherButton = page.getByTestId('scripture-mode-together');
  await expect(togetherButton).toBeVisible();
  await expect(togetherButton).toBeEnabled();

  // Wait for ALL re-render-triggering API calls to complete before interacting.
  // Best-effort: swallow rejections — these APIs may not fire if partner is
  // unlinked (no couple stats) or if the user has no partner row yet. This is
  // NOT flow control; we just need to give the render chain time to settle.
  await Promise.all([
    partnerLoaded.catch(() => {}),
    statsLoaded.catch(() => {}),
  ]);

  const sessionResponse = waitForScriptureRpc(page, 'scripture_create_session');
  await togetherButton.click();

  const response = await sessionResponse;
  const payload = (await response.json()) as { id?: string };

  // Network-first: RPC response above confirms server created the session.
  // UI assertion below confirms the lobby rendered.
  await expect(lobbyRoleSelection).toBeVisible();

  return payload.id ?? '';
}
