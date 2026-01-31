/**
 * P0/P1 E2E: Scripture Reading - Solo Reading Flow
 *
 * Core user journey: Navigate to scripture, start solo session,
 * read through 17 steps (verse + response screens), complete session.
 *
 * Test IDs: P0-009, P1-001, P1-010, P1-011, P1-012, P2-012
 *
 * Epic 1, Stories 1.2, 1.3
 */
import { test, expect } from '../../support/merged-fixtures';

test.describe('Solo Reading Flow', () => {
  test.describe('P0-009: Advance through 17 steps sequentially', () => {
    test('should complete full solo reading flow from step 1 to 17', async ({
      page,
    }) => {
      // GIVEN: User navigates to scripture and starts a solo session
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();

      // WHEN: User advances through all 17 steps
      for (let step = 1; step <= 17; step++) {
        // THEN: Each step displays verse reference and text
        await expect(page.getByTestId('scripture-verse-reference')).toBeVisible();
        await expect(page.getByTestId('scripture-verse-text')).toBeVisible();

        // AND: Progress indicator shows current step
        await expect(page.getByTestId('scripture-progress-indicator')).toHaveText(
          `Verse ${step} of 17`
        );

        // AND: Next Verse button is available
        const nextButton = page.getByTestId('scripture-next-verse-button');
        await expect(nextButton).toBeVisible();

        // Advance to next step (except on last step)
        if (step < 17) {
          await nextButton.click();
        }
      }

      // WHEN: User taps Next Verse on step 17
      await page.getByTestId('scripture-next-verse-button').click();

      // THEN: Session transitions to reflection phase
      await expect(page.getByTestId('scripture-completion-screen')).toBeVisible();
    });
  });

  test.describe('Verse and Response Screens', () => {
    test('should display verse screen with correct elements', async ({
      page,
    }) => {
      // GIVEN: User starts a solo session
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();

      // WHEN: First verse screen loads
      // THEN: Verse reference is displayed
      await expect(page.getByTestId('scripture-verse-reference')).toBeVisible();

      // AND: Verse text is displayed prominently
      await expect(page.getByTestId('scripture-verse-text')).toBeVisible();

      // AND: "View Response" secondary button is available
      await expect(
        page.getByTestId('scripture-view-response-button')
      ).toBeVisible();

      // AND: "Next Verse" primary button is available (full-width, bottom-anchored)
      await expect(
        page.getByTestId('scripture-next-verse-button')
      ).toBeVisible();

      // AND: Progress indicator shows "Verse 1 of 17"
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 1 of 17');
    });

    test('should navigate to response screen and back', async ({ page }) => {
      // GIVEN: User is on a verse screen
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();

      // WHEN: User taps "View Response"
      await page.getByTestId('scripture-view-response-button').click();

      // THEN: Response prayer text is displayed
      await expect(page.getByTestId('scripture-response-text')).toBeVisible();

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
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();
      await page.getByTestId('scripture-view-response-button').click();

      // WHEN: User taps "Next Verse" from response screen
      await page.getByTestId('scripture-next-verse-button').click();

      // THEN: Progress advances to step 2
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 2 of 17');

      // AND: New verse content is displayed
      await expect(page.getByTestId('scripture-verse-text')).toBeVisible();
    });
  });

  test.describe('P1-001: Optimistic step advance', () => {
    test('should show next step immediately before server confirms', async ({
      page,
    }) => {
      // GIVEN: User is in a solo session at step 1
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();

      // Verify starting at step 1
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 1 of 17');

      // WHEN: User taps "Next Verse"
      await page.getByTestId('scripture-next-verse-button').click();

      // THEN: UI shows step 2 immediately (optimistic)
      // This assertion should pass even before server response arrives
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 2 of 17');
    });
  });

  test.describe('P1-012: Progress indicator updates', () => {
    test('should update progress text on each step advance', async ({
      page,
    }) => {
      // GIVEN: User starts a solo session
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();

      // WHEN/THEN: Progress updates with each advance
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 1 of 17');

      await page.getByTestId('scripture-next-verse-button').click();
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 2 of 17');

      await page.getByTestId('scripture-next-verse-button').click();
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 3 of 17');
    });
  });

  test.describe('P2-012: Session completion boundary', () => {
    test('should transition to reflection phase after step 17', async ({
      page,
    }) => {
      // GIVEN: User is on step 17 (final step) of a solo session
      // Navigate through all 17 steps
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();

      // Advance to step 17
      for (let i = 0; i < 16; i++) {
        await page.getByTestId('scripture-next-verse-button').click();
      }

      // Verify we're at step 17
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 17 of 17');

      // WHEN: User taps "Next Verse" on the final step
      await page.getByTestId('scripture-next-verse-button').click();

      // THEN: Session transitions to reflection/completion phase
      await expect(page.getByTestId('scripture-completion-screen')).toBeVisible();
    });
  });
});
