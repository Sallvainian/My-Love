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
export const REALTIME_SYNC_TIMEOUT_MS = 20_000;
export const READY_BROADCAST_TIMEOUT_MS = 10_000;
export const COUNTDOWN_APPEAR_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Shared predicates
// ---------------------------------------------------------------------------

/** Matches a scripture_toggle_ready RPC 2xx response. */
export const isToggleReadyResponse = (resp: { url(): string; status(): number }): boolean =>
  resp.url().includes('/rest/v1/rpc/scripture_toggle_ready') &&
  resp.status() >= 200 &&
  resp.status() < 300;

// ---------------------------------------------------------------------------
// Shared navigation helpers
// ---------------------------------------------------------------------------

/**
 * Navigate to /scripture and start Together mode.
 * Waits for the role selection screen to become visible.
 */
export async function navigateToTogetherRoleSelection(page: Page): Promise<void> {
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

  await sessionResponse;

  // Role selection screen must be visible
  await expect(page.getByTestId('lobby-role-selection')).toBeVisible();
}
