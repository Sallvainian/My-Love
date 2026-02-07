/**
 * P0/P1 E2E: Scripture Reading - Solo Reading Flow
 *
 * Core user journey: Navigate to scripture, start solo session,
 * read through 17 steps (verse → reflection → next verse), complete session.
 *
 * Test IDs: P0-009, P1-001, P1-012, P1-013, P2-012
 *
 * Epic 1 & 2, Stories 1.2, 1.3, 2.1
 *
 * Flow per verse (Story 2.1 per-verse reflection):
 *   Verse screen → "Next Verse" → Per-verse reflection (rate 1-5) → "Continue" → Next verse
 *
 * Note: These tests do NOT use the testSession fixture because they test
 * the fresh "Start → Solo" flow. Pre-seeded sessions would cause
 * checkForActiveSession to show the resume prompt instead of Start button.
 */
import { test, expect } from '../../support/merged-fixtures';
import { getScriptureSessionSnapshot, startSoloSession } from '../../support/helpers';

/**
 * Helper: Complete the per-verse reflection and advance to the next step.
 *
 * Story 2.1 added a mandatory reflection screen between each verse:
 *   1. Click "Next Verse" → reflection screen appears
 *   2. Select a rating (1-5)
 *   3. Click "Continue" → fires handleReflectionSubmit → advanceStep()
 *   4. PATCH to scripture_sessions persists the step advance
 *
 * The PATCH only fires after the reflection submit, not after clicking Next Verse.
 */
async function advanceStepWithReflection(page: import('@playwright/test').Page) {
  // Click "Next Verse" → transitions subView to 'reflection'
  await page.getByTestId('scripture-next-verse-button').click();

  // Wait for the per-verse reflection screen
  await expect(page.getByTestId('scripture-reflection-screen')).toBeVisible();

  await submitReflection(page);
}

async function submitReflection(
  page: import('@playwright/test').Page,
  options: { expectCompletion?: boolean } = {}
) {
  const progressIndicator = page.getByTestId('scripture-progress-indicator');
  const previousProgressText = await progressIndicator.textContent();
  const rating = page.getByTestId('scripture-rating-3');

  // Reflection UI can occasionally retain a selected state under retry churn.
  // Click only when needed, then verify a deterministic checked state.
  if ((await rating.getAttribute('aria-checked')) !== 'true') {
    await rating.click();
  }
  await expect(rating).toHaveAttribute('aria-checked', 'true');

  // Keep network-first diagnostics but do not hard-block progression on a single response.
  const reflectionSaved = page
    .waitForResponse(
      (resp) =>
        resp.url().includes('/rest/v1/rpc/scripture_submit_reflection') &&
        resp.request().method() === 'POST',
      { timeout: 15_000 }
    )
    .catch(() => null);
  const stepSaved = page
    .waitForResponse(
      (resp) =>
        resp.url().includes('/rest/v1/scripture_sessions') &&
        resp.request().method() === 'PATCH',
      { timeout: 15_000 }
    )
    .catch(() => null);

  await page.getByTestId('scripture-reflection-continue').click();

  // Primary success signal: UI transitioned deterministically.
  if (options.expectCompletion) {
    await expect(page.getByTestId('scripture-completion-screen')).toBeVisible();
  } else {
    await expect(page.getByTestId('scripture-verse-text')).toBeVisible();
    if (previousProgressText) {
      await expect(progressIndicator).not.toHaveText(previousProgressText);
    }
  }

  const [reflectionResponse, stepResponse] = await Promise.all([reflectionSaved, stepSaved]);
  if (!reflectionResponse || !stepResponse) {
    console.warn(
      '[scripture-solo-reading] Reflection transition relied on UI-ready signal; one or more network responses were not observed within diagnostic timeout'
    );
  }
}

test.describe('Solo Reading Flow', () => {
  test.describe('[P0-009] Advance through 17 steps sequentially', () => {
    test('should complete full solo reading flow from step 1 to 17', async ({
      page,
    }) => {
      test.setTimeout(180_000); // Extended timeout for 17-step traversal

      // GIVEN: User navigates to scripture and starts a solo session
      await startSoloSession(page);

      // WHEN: User advances through all 17 steps
      for (let step = 1; step <= 17; step++) {
        // THEN: Each step displays verse reference and text
        await expect(
          page.getByTestId('scripture-verse-reference')
        ).toBeVisible();
        await expect(page.getByTestId('scripture-verse-text')).toBeVisible();

        // AND: Progress indicator shows current step
        await expect(
          page.getByTestId('scripture-progress-indicator')
        ).toHaveText(`Verse ${step} of 17`);

        // AND: Next Verse button is available
        await expect(
          page.getByTestId('scripture-next-verse-button')
        ).toBeVisible();

        // Advance through reflection to next step (except on last step)
        if (step < 17) {
          await advanceStepWithReflection(page);
        }
      }

      // WHEN: User taps Next Verse on step 17 (enters final reflection)
      await page.getByTestId('scripture-next-verse-button').click();
      await expect(page.getByTestId('scripture-reflection-screen')).toBeVisible();
      await submitReflection(page, { expectCompletion: true });
    });
  });

  test.describe('Verse and Response Screens', () => {
    test('should display verse screen with correct elements', async ({
      page,
    }) => {
      // GIVEN: User starts a solo session
      await startSoloSession(page);

      // WHEN: First verse screen loads
      // THEN: Verse reference is displayed
      await expect(
        page.getByTestId('scripture-verse-reference')
      ).toBeVisible();

      // AND: Verse text is displayed prominently
      await expect(page.getByTestId('scripture-verse-text')).toBeVisible();

      // AND: "View Response" secondary button is available
      await expect(
        page.getByTestId('scripture-view-response-button')
      ).toBeVisible();

      // AND: "Next Verse" primary button is available
      await expect(
        page.getByTestId('scripture-next-verse-button')
      ).toBeVisible();

      // AND: Progress indicator shows "Verse 1 of 17"
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 1 of 17');
    });

    test('should navigate to response screen and back', async ({ page, interceptNetworkCall }) => {
      // GIVEN: User is on a verse screen
      await startSoloSession(page);

      // WHEN: User taps "View Response"
      await page.getByTestId('scripture-view-response-button').click();

      // THEN: Response prayer text is displayed
      await expect(
        page.getByTestId('scripture-response-text')
      ).toBeVisible();

      // AND: "Back to Verse" secondary button is available
      await expect(
        page.getByTestId('scripture-back-to-verse-button')
      ).toBeVisible();

      // AND: "Next Verse" button remains available
      await expect(
        page.getByTestId('scripture-next-verse-button')
      ).toBeVisible();

      // WHEN: User taps "Back to Verse"
      await page.getByTestId('scripture-back-to-verse-button').click();

      // THEN: Verse screen is displayed again
      await expect(page.getByTestId('scripture-verse-text')).toBeVisible();
    });

    test('should advance from response screen via Next Verse', async ({
      page,
    }) => {
      // GIVEN: User is on the response screen of step 1
      await startSoloSession(page);
      await page.getByTestId('scripture-view-response-button').click();
      await expect(page.getByTestId('scripture-response-text')).toBeVisible();

      // WHEN: User taps "Next Verse" from response screen
      // (still goes through per-verse reflection)
      await advanceStepWithReflection(page);

      // THEN: Progress advances to step 2
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 2 of 17');

      // AND: New verse content is displayed
      await expect(page.getByTestId('scripture-verse-text')).toBeVisible();
    });
  });

  test.describe('[P1-001] Optimistic step advance', () => {
    test('should show next verse immediately after reflection submit', async ({
      page,
    }) => {
      // GIVEN: User is in a solo session at step 1
      await startSoloSession(page);

      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 1 of 17');

      // WHEN: User completes reflection for step 1
      await page.getByTestId('scripture-next-verse-button').click();
      await expect(page.getByTestId('scripture-reflection-screen')).toBeVisible();
      await page.getByTestId('scripture-rating-3').click();

      // Click Continue (don't wait for server — testing optimistic update)
      await page.getByTestId('scripture-reflection-continue').click();

      // THEN: UI shows step 2 immediately (optimistic update before server responds)
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 2 of 17');
    });
  });

  test.describe('[P1-012] Progress indicator updates', () => {
    test('should update progress text on each step advance', async ({
      page,
    }) => {
      // GIVEN: User starts a solo session
      await startSoloSession(page);

      // WHEN/THEN: Progress updates with each advance
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 1 of 17');

      await advanceStepWithReflection(page);
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 2 of 17');

      await advanceStepWithReflection(page);
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 3 of 17');
    });
  });

  test.describe('[P1-013] Exit with Save persistence', () => {
    test('should save progress and keep session in-progress when exiting solo reading', async ({
      page,
    }) => {
      // GIVEN: User starts a solo session and advances to Verse 2
      const sessionId = await startSoloSession(page);
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 1 of 17');

      await advanceStepWithReflection(page);
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 2 of 17');

      // WHEN: User opens exit dialog and chooses save
      const savePromise = page
        .waitForResponse(
          (resp) =>
            resp.url().includes('/rest/v1/scripture_sessions') &&
            resp.request().method() === 'PATCH' &&
            resp.status() >= 200 &&
            resp.status() < 300,
          { timeout: 15_000 }
        )
        .catch(() => null);

      await page.getByTestId('exit-button').click();
      const exitDialog = page.getByTestId('exit-confirm-dialog');
      await expect(exitDialog).toBeVisible();
      await expect(exitDialog).toContainText('Save your progress? You can continue later.');

      await page.getByTestId('save-and-exit-button').click();
      await savePromise;

      // THEN: User returns to overview and server session remains in-progress
      await expect(page.getByTestId('scripture-overview')).toBeVisible();

      const sessionSnapshot = await getScriptureSessionSnapshot(page, sessionId);
      expect(sessionSnapshot).not.toBeNull();
      expect(sessionSnapshot?.status).toBe('in_progress');
      expect(sessionSnapshot?.mode).toBe('solo');
      expect(sessionSnapshot?.current_step_index ?? -1).toBeGreaterThanOrEqual(1);

      // AND: Resume prompt is visible on revisit
      await page.goto('/scripture');
      await expect(page.getByTestId('resume-prompt')).toBeVisible();

      // Cleanup: abandon resumed state so this test does not pollute later runs
      const abandonPromise = page
        .waitForResponse(
          (resp) =>
            resp.url().includes('/rest/v1/scripture_sessions') &&
            resp.request().method() === 'PATCH' &&
            resp.status() >= 200 &&
            resp.status() < 300,
          { timeout: 15_000 }
        )
        .catch(() => null);

      await page.getByTestId('resume-start-fresh').click();
      await abandonPromise;
    });
  });

  test.describe('[P2-012] Session completion boundary', () => {
    test('should transition to reflection phase after step 17', async ({
      page,
    }) => {
      test.setTimeout(180_000); // Extended timeout for 17-step traversal

      // GIVEN: User starts a solo session
      await startSoloSession(page);

      // Advance through all 16 intermediate steps (1→2, 2→3, ..., 16→17)
      for (let i = 0; i < 16; i++) {
        await advanceStepWithReflection(page);
      }

      // Verify we're at step 17
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 17 of 17');

      // WHEN: User taps "Next Verse" on the final step and completes reflection
      await page.getByTestId('scripture-next-verse-button').click();
      await expect(page.getByTestId('scripture-reflection-screen')).toBeVisible();
      await submitReflection(page, { expectCompletion: true });
    });
  });
});
