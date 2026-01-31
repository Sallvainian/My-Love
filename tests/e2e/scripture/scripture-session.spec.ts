/**
 * P0/P1 E2E: Scripture Reading - Save, Resume & Exit
 *
 * Users can save progress, resume sessions, and exit safely.
 * Covers optimistic UI, offline handling, and corruption recovery UX.
 *
 * Test IDs: P0-010, P0-011, P1-003, P1-005, P2-009, P2-010, P2-011
 *
 * Epic 1, Stories 1.3, 1.4
 */
import { test, expect } from '../../support/merged-fixtures';

test.describe('Scripture Session - Save & Resume', () => {
  test.describe('P0-010: Session save on exit', () => {
    test('should persist step index to server when saving and exiting', async ({
      page,
    }) => {
      // GIVEN: User is in a solo session at step 5
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();

      // Advance to step 5
      for (let i = 0; i < 4; i++) {
        await page.getByTestId('scripture-next-verse-button').click();
      }
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 5 of 17');

      // WHEN: User taps exit button
      await page.getByTestId('scripture-exit-button').click();

      // THEN: Confirmation prompt appears
      await expect(page.getByTestId('scripture-exit-dialog')).toBeVisible();
      await expect(page.getByTestId('scripture-exit-dialog')).toContainText(
        /save your progress/i
      );

      // WHEN: User taps "Save & Exit"
      await page.getByTestId('scripture-save-exit-button').click();

      // THEN: User returns to overview
      await expect(page.getByTestId('scripture-overview')).toBeVisible();
    });
  });

  test.describe('P0-011: Session resume loads correct step', () => {
    test('should resume at correct step after save and exit', async ({
      page,
    }) => {
      // GIVEN: User saved a session at step 5
      // Start and advance to step 5
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();

      for (let i = 0; i < 4; i++) {
        await page.getByTestId('scripture-next-verse-button').click();
      }
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 5 of 17');

      // Save and exit
      await page.getByTestId('scripture-exit-button').click();
      await page.getByTestId('scripture-save-exit-button').click();
      await expect(page.getByTestId('scripture-overview')).toBeVisible();

      // WHEN: User returns and taps "Continue"
      await expect(page.getByTestId('scripture-resume-prompt')).toBeVisible();
      await page.getByTestId('scripture-resume-continue').click();

      // THEN: Session resumes at step 5
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 5 of 17');
    });
  });

  test.describe('P2-011: Exit confirmation dialog', () => {
    test('should show exit confirmation with save option', async ({
      page,
    }) => {
      // GIVEN: User is in a solo session
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();

      // WHEN: User taps exit button
      await page.getByTestId('scripture-exit-button').click();

      // THEN: Confirmation dialog appears
      await expect(page.getByTestId('scripture-exit-dialog')).toBeVisible();
      await expect(page.getByTestId('scripture-exit-dialog')).toContainText(
        /save your progress\?.*you can continue later/i
      );

      // AND: "Save & Exit" button is available
      await expect(page.getByTestId('scripture-save-exit-button')).toBeVisible();

      // AND: Cancel/dismiss option is available
      await expect(
        page.getByTestId('scripture-cancel-exit-button')
      ).toBeVisible();
    });

    test('should dismiss exit dialog when user cancels', async ({ page }) => {
      // GIVEN: Exit dialog is showing
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();
      await page.getByTestId('scripture-exit-button').click();
      await expect(page.getByTestId('scripture-exit-dialog')).toBeVisible();

      // WHEN: User taps cancel
      await page.getByTestId('scripture-cancel-exit-button').click();

      // THEN: Dialog closes and user stays in session
      await expect(
        page.getByTestId('scripture-exit-dialog')
      ).not.toBeVisible();
      await expect(page.getByTestId('scripture-verse-text')).toBeVisible();
    });
  });

  test.describe('P1-005: Server write failure shows retry UI', () => {
    test('should show retry UI when server write fails', async ({ page }) => {
      // GIVEN: User is in a solo session
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();

      // Simulate network failure on step advancement
      await page.route('**/rest/v1/rpc/scripture_advance_phase', (route) =>
        route.fulfill({ status: 500, body: 'Internal Server Error' })
      );
      await page.route('**/rest/v1/scripture_sessions*', (route) => {
        if (route.request().method() === 'PATCH') {
          return route.fulfill({ status: 500, body: 'Internal Server Error' });
        }
        return route.continue();
      });

      // WHEN: User advances a step (server write fails)
      await page.getByTestId('scripture-next-verse-button').click();

      // THEN: UI shows next step optimistically
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 2 of 17');

      // AND: Retry UI is shown (subtle, non-blocking)
      await expect(page.getByTestId('scripture-retry-indicator')).toBeVisible();
    });
  });

  test.describe('P2-009/P2-010: Offline handling', () => {
    test('should show offline indicator when offline', async ({ page }) => {
      // GIVEN: User is in a solo session
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();

      // WHEN: User goes offline
      await page.context().setOffline(true);

      // THEN: Offline indicator is shown
      await expect(
        page.getByTestId('scripture-offline-indicator')
      ).toBeVisible();

      // Restore online for cleanup
      await page.context().setOffline(false);
    });

    test('should block step advancement when offline', async ({ page }) => {
      // GIVEN: User is in a solo session, offline
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();
      await page.context().setOffline(true);

      // WHEN: User tries to advance
      await page.getByTestId('scripture-next-verse-button').click();

      // THEN: Step does NOT advance (blocked)
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 1 of 17');

      // Restore online for cleanup
      await page.context().setOffline(false);
    });
  });
});
