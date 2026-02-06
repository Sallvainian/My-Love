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
 * Navigate to /scripture and ensure Start button is visible.
 *
 * Always navigates with ?fresh=true to bypass resume prompts and show
 * the Start button directly, avoiding conditional logic.
 *
 * @param page - Playwright page
 */
export async function ensureScriptureOverview(page: Page) {
  // Navigate with fresh parameter to always show Start button
  await page.goto('/scripture?fresh=true');

  const startButton = page.getByTestId('scripture-start-button');
  await expect(startButton).toBeVisible();
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

  const responsePromise = page.waitForResponse(
    (resp) => resp.url().includes('/rest/v1/rpc/scripture_create_session') && resp.status() === 200
  );

  await page.getByTestId('scripture-start-button').click();
  await page.getByTestId('scripture-mode-solo').click();

  const response = await responsePromise;

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

  // Wait for reflection submission to complete
  const responsePromise = page.waitForResponse(
    (resp) => resp.url().includes('/rest/v1/rpc/scripture_submit_reflection') && resp.status() === 200
  );

  await page.getByTestId('scripture-reflection-continue').click();

  await responsePromise;

  // Wait for next verse screen to appear
  await expect(page.getByTestId('scripture-verse-text')).toBeVisible();
}

/**
 * Complete all 17 scripture steps to reach the reflection summary screen.
 *
 * Navigates through start → solo → 17 verse/reflection cycles.
 * Optionally bookmarks specific steps along the way.
 *
 * @param page - Playwright page
 * @param bookmarkSteps - Set of step indices (0-16) to bookmark during navigation
 * @returns Session ID
 */
export async function completeAllStepsToReflectionSummary(
  page: Page,
  bookmarkSteps: Set<number> = new Set([0, 5, 12])
): Promise<string> {
  // Start solo session (handles stale sessions from previous runs)
  const sessionId = await startSoloSession(page);

  // Complete all 17 steps (indices 0-16)
  for (let step = 0; step < 17; step++) {
    // Wait for verse screen
    await expect(page.getByTestId('scripture-verse-text')).toBeVisible();

    // Optionally bookmark this verse
    if (bookmarkSteps.has(step)) {
      await page.getByTestId('scripture-bookmark-button').click();
      await expect(page.getByTestId('scripture-bookmark-button')).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    }

    // Advance to reflection screen
    await page.getByTestId('scripture-next-verse-button').click();
    await expect(page.getByTestId('scripture-reflection-screen')).toBeVisible();

    // Select a rating and submit reflection
    await page.getByTestId('scripture-rating-3').click();

    // Wait for reflection submission to complete
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/rest/v1/rpc/scripture_submit_reflection') && resp.status() === 200
    );

    await page.getByTestId('scripture-reflection-continue').click();

    await responsePromise;
  }

  // After step 17 (index 16) reflection, the reflection summary should appear
  return sessionId;
}

/**
 * Submit the reflection summary form to advance past it.
 *
 * Selects a standout verse, a session rating, and clicks Continue
 * with a network-first wait pattern. Used by Story 2.3 tests that
 * need to reach the report phase (post-reflection-summary).
 *
 * @param page - Playwright page
 */
export async function submitReflectionSummary(page: Page): Promise<void> {
  await expect(page.getByTestId('scripture-reflection-summary-screen')).toBeVisible();

  // Select a standout verse (step 0)
  await page.getByTestId('scripture-standout-verse-0').click();
  await expect(page.getByTestId('scripture-standout-verse-0')).toHaveAttribute(
    'aria-pressed',
    'true'
  );

  // Select session rating 4
  await page.getByTestId('scripture-session-rating-4').click();
  await expect(page.getByTestId('scripture-session-rating-4')).toHaveAttribute(
    'aria-checked',
    'true'
  );

  // Submit the reflection summary — wait for server response
  const responsePromise = page.waitForResponse(
    (resp) => resp.url().includes('/rest/v1/rpc/scripture_submit_reflection') && resp.status() === 200
  );

  await page.getByTestId('scripture-reflection-summary-continue').click();

  await responsePromise;
}
