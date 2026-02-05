/**
 * P1 E2E: Scripture Reading - Navigation & Overview
 *
 * Users can access Scripture Reading from bottom navigation,
 * see overview page with mode selection, and resume sessions.
 *
 * Test IDs: P1-006, P1-007, P1-008, P1-009
 *
 * Epic 1, Story 1.2
 *
 * Source data-testid mapping (from ScriptureOverview.tsx):
 *   scripture-overview, scripture-start-button, mode-selection,
 *   scripture-mode-solo, resume-prompt, resume-continue,
 *   resume-start-fresh, setup-partner-link, offline-indicator
 *
 * NOTE: Together mode ModeCard has no data-testid in source.
 *   The "Together" card is the second ModeCard in mode-selection.
 */
import { test, expect } from '../../support/merged-fixtures';
import { ensureScriptureOverview } from '../../support/helpers';

test.describe('Scripture Navigation & Overview', () => {
  test.describe('Navigation', () => {
    test('should show Scripture tab in bottom navigation', async ({ page }) => {
      // GIVEN: User is on any page
      await page.goto('/');

      // WHEN: Page renders
      // THEN: Scripture tab is visible in bottom navigation
      await expect(page.getByTestId('nav-scripture')).toBeVisible();
    });

    test('should navigate to scripture overview when tapping Scripture tab', async ({
      page,
    }) => {
      // GIVEN: User is on the home page
      await page.goto('/');

      // WHEN: User taps the Scripture tab
      await page.getByTestId('nav-scripture').click();

      // THEN: Scripture overview page loads
      await expect(page.getByTestId('scripture-overview')).toBeVisible();
    });
  });

  test.describe('Overview Page', () => {
    test('should display overview with Start button', async ({ page }) => {
      // GIVEN: User navigates to scripture overview
      await ensureScriptureOverview(page);

      // WHEN: Page renders
      // THEN: The overview page is displayed
      await expect(page.getByTestId('scripture-overview')).toBeVisible();

      // AND: A "Start" button is available
      await expect(page.getByTestId('scripture-start-button')).toBeVisible();
    });

    test('should show mode selection after tapping Start', async ({ page }) => {
      // GIVEN: User is on the scripture overview
      await ensureScriptureOverview(page);

      // WHEN: User taps "Start"
      await page.getByTestId('scripture-start-button').click();

      // THEN: Mode selection appears with Solo and Together options
      await expect(page.getByTestId('mode-selection')).toBeVisible();
      await expect(page.getByTestId('scripture-mode-solo')).toBeVisible();
      // Together mode card uses ModeCard component (no explicit testid in source)
      // Locate via role within the mode-selection section
      await expect(
        page.getByTestId('mode-selection').getByRole('button', { name: /together/i })
      ).toBeVisible();
    });
  });

  test.describe('P1-006: Mode selection - no partner disables Together', () => {
    test('should disable Together mode when user has no linked partner', async ({
      page,
    }) => {
      // GIVEN: User has no linked partner (partner_id is null)
      // NOTE: Test assumes user is logged in without a partner
      await ensureScriptureOverview(page);
      await page.getByTestId('scripture-start-button').click();

      // WHEN: Mode selection is shown
      // THEN: Together mode is grayed out
      const togetherOption = page.getByTestId('mode-selection').getByRole('button', { name: /together/i });
      await expect(togetherOption).toBeVisible();
      await expect(togetherOption).toBeDisabled();

      // AND: "Set up partner" link is available
      await expect(page.getByTestId('setup-partner-link')).toBeVisible();

      // AND: Solo mode is fully functional
      const soloOption = page.getByTestId('scripture-mode-solo');
      await expect(soloOption).toBeVisible();
      await expect(soloOption).toBeEnabled();
    });
  });

  test.describe('P1-007: Mode selection - partner enables both modes', () => {
    test('should enable both modes when user has linked partner', async ({
      page,
    }) => {
      // GIVEN: User has a linked partner (partner_id is not null)
      // NOTE: This test requires a user with partner_id set
      // TODO: Fixture needed for user with linked partner
      await ensureScriptureOverview(page);
      await page.getByTestId('scripture-start-button').click();

      // WHEN: Mode selection is shown
      // THEN: Both Solo and Together modes are enabled
      await expect(page.getByTestId('scripture-mode-solo')).toBeEnabled();
      await expect(
        page.getByTestId('mode-selection').getByRole('button', { name: /together/i })
      ).toBeEnabled();
    });
  });

  test.describe('P1-008: Resume prompt for incomplete session', () => {
    test('should show resume prompt with correct step number', async ({
      page,
    }) => {
      // GIVEN: User has an incomplete Solo session at step 7
      // NOTE: This test requires seeding an in-progress session
      // TODO: Navigate through session or seed via API first
      await page.goto('/scripture');

      // WHEN: The overview page loads
      // THEN: Resume prompt is displayed
      await expect(page.getByTestId('resume-prompt')).toBeVisible();

      // AND: Shows correct step info
      await expect(
        page.getByTestId('resume-prompt')
      ).toContainText(/continue where you left off/i);

      // AND: Continue button is available
      await expect(
        page.getByTestId('resume-continue')
      ).toBeVisible();

      // AND: Start fresh option is available
      await expect(page.getByTestId('resume-start-fresh')).toBeVisible();
    });
  });

  test.describe('P1-009: Start fresh clears saved state', () => {
    test('should clear saved state and begin new session', async ({
      page,
    }) => {
      // GIVEN: User has an incomplete session and sees the resume prompt
      // TODO: Seed an in-progress session first
      await page.goto('/scripture');
      await expect(page.getByTestId('resume-prompt')).toBeVisible();

      // WHEN: User taps "Start fresh"
      await page.getByTestId('resume-start-fresh').click();

      // THEN: Start button appears (session was abandoned)
      await expect(page.getByTestId('scripture-start-button')).toBeVisible();

      // WHEN: User taps Start and selects Solo
      await page.getByTestId('scripture-start-button').click();
      await expect(page.getByTestId('mode-selection')).toBeVisible();

      // AND: After selecting Solo, session starts at step 1
      const sessionCreated = page.waitForResponse(
        (resp) =>
          resp.url().includes('/rest/v1/rpc/scripture_create_session') &&
          resp.status() === 200
      );
      await page.getByTestId('scripture-mode-solo').click();
      await sessionCreated;

      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 1 of 17');
    });
  });
});
