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
import { ensureScriptureOverview } from '../helpers';
import {
  REALTIME_SYNC_TIMEOUT_MS,
  READY_BROADCAST_TIMEOUT_MS,
  SESSION_CREATE_TIMEOUT_MS,
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
