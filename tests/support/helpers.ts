/**
 * Shared Test Helpers
 *
 * Reusable helpers for E2E tests. Import from this file
 * to avoid duplicating navigation and session setup logic.
 *
 * IMPORTANT: The scripture reading flow per-step is:
 *   verse screen → (click "Next Verse") → reflection screen → (rate + click Continue) → next verse screen
 * "Next Verse" does NOT advance the step directly — it transitions to the reflection sub-view.
 * Only submitting the reflection (rating + Continue) advances the step.
 */
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Navigate to /scripture and handle stale sessions from previous test runs.
 *
 * If an in-progress session exists, ScriptureOverview shows a resume prompt
 * instead of the Start button. This helper clicks "Start fresh" to dismiss
 * the resume prompt so the Start button becomes available.
 *
 * @param page - Playwright page
 */
export async function ensureScriptureOverview(page: Page) {
  await page.goto('/scripture');

  const startFresh = page.getByTestId('resume-start-fresh');
  const startButton = page.getByTestId('scripture-start-button');

  // Wait for either the start button or the resume prompt
  await expect(startButton.or(startFresh)).toBeVisible();

  if (await startFresh.isVisible()) {
    await startFresh.click();
    await expect(startButton).toBeVisible();
  }
}

/**
 * Start a solo scripture session from the overview.
 *
 * Navigates to /scripture, handles stale sessions, clicks Start → Solo,
 * and waits for the session creation API to complete.
 *
 * @param page - Playwright page
 */
export async function startSoloSession(page: Page): Promise<string> {
  await ensureScriptureOverview(page);

  // Set up waitForResponse BEFORE the click that triggers the API call
  const sessionCreated = page.waitForResponse(
    (resp) =>
      resp.url().includes('/rest/v1/rpc/scripture_create_session') &&
      resp.status() === 200
  );

  await page.getByTestId('scripture-start-button').click();
  await page.getByTestId('scripture-mode-solo').click();

  const response = await sessionCreated;

  // Wait for the reading flow to render
  await expect(page.getByTestId('solo-reading-flow')).toBeVisible();

  // Parse session ID from creation response
  const data = await response.json();
  return data.id;
}

/**
 * Advance one full step in the scripture reading flow.
 *
 * The flow is: verse → (click Next Verse) → reflection → (rate + Continue) → next verse.
 * This helper completes one full cycle: clicks Next Verse, rates, and submits.
 *
 * @param page - Playwright page
 * @param rating - Rating to select (1-5), defaults to 3
 */
export async function advanceOneStep(page: Page, rating: number = 3) {
  // Click Next Verse → transitions to reflection sub-view
  await page.getByTestId('scripture-next-verse-button').click();

  // Wait for reflection screen
  await expect(page.getByTestId('scripture-reflection-screen')).toBeVisible();

  // Select rating
  await page.getByTestId(`scripture-rating-${rating}`).click();

  // Set up response listener before clicking Continue
  const reflectionResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/rest/v1/rpc/scripture_submit_reflection') &&
      response.status() === 200
  );
  await page.getByTestId('scripture-reflection-continue').click();
  await reflectionResponse;

  // Wait for next verse screen to appear
  await expect(page.getByTestId('scripture-verse-text')).toBeVisible();
}
