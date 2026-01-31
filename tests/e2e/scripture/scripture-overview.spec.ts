/**
 * P1 E2E: Scripture Reading - Navigation & Overview
 *
 * Users can access Scripture Reading from bottom navigation,
 * see overview page with mode selection, and resume sessions.
 *
 * Test IDs: P1-006, P1-007, P1-008, P1-009
 *
 * Epic 1, Story 1.2
 */
import { test, expect } from '../../support/merged-fixtures';

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
      await page.goto('/scripture');

      // WHEN: Page renders
      // THEN: The overview page is displayed
      await expect(page.getByTestId('scripture-overview')).toBeVisible();

      // AND: A "Start" button is available
      await expect(page.getByTestId('scripture-start-button')).toBeVisible();
    });

    test('should show mode selection after tapping Start', async ({ page }) => {
      // GIVEN: User is on the scripture overview
      await page.goto('/scripture');

      // WHEN: User taps "Start"
      await page.getByTestId('scripture-start-button').click();

      // THEN: Mode selection appears with Solo and Together options
      await expect(page.getByTestId('scripture-mode-select')).toBeVisible();
      await expect(page.getByTestId('scripture-mode-solo')).toBeVisible();
      await expect(page.getByTestId('scripture-mode-together')).toBeVisible();
    });
  });

  test.describe('P1-006: Mode selection - no partner disables Together', () => {
    test('should disable Together mode when user has no linked partner', async ({
      page,
    }) => {
      // GIVEN: User has no linked partner (partner_id is null)
      // NOTE: Test assumes user is logged in without a partner
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();

      // WHEN: Mode selection is shown
      // THEN: Together mode is grayed out
      const togetherOption = page.getByTestId('scripture-mode-together');
      await expect(togetherOption).toBeVisible();
      await expect(togetherOption).toBeDisabled();

      // AND: Disabled message is shown
      await expect(
        page.getByTestId('scripture-together-disabled-message')
      ).toHaveText(/link your partner/i);

      // AND: "Set up partner" link is available
      await expect(page.getByTestId('scripture-partner-link')).toBeVisible();

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
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();

      // WHEN: Mode selection is shown
      // THEN: Both Solo and Together modes are enabled
      await expect(page.getByTestId('scripture-mode-solo')).toBeEnabled();
      await expect(page.getByTestId('scripture-mode-together')).toBeEnabled();
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
      await expect(page.getByTestId('scripture-resume-prompt')).toBeVisible();

      // AND: Shows correct step: "Continue where you left off? (Step 7 of 17)"
      await expect(
        page.getByTestId('scripture-resume-prompt')
      ).toContainText(/continue where you left off/i);
      await expect(
        page.getByTestId('scripture-resume-step')
      ).toContainText(/step \d+ of 17/i);

      // AND: Continue button is available
      await expect(
        page.getByTestId('scripture-resume-continue')
      ).toBeVisible();

      // AND: Start fresh option is available
      await expect(page.getByTestId('scripture-start-fresh')).toBeVisible();
    });
  });

  test.describe('P1-009: Start fresh clears saved state', () => {
    test('should clear saved state and begin new session', async ({
      page,
    }) => {
      // GIVEN: User has an incomplete session and sees the resume prompt
      // TODO: Seed an in-progress session first
      await page.goto('/scripture');
      await expect(page.getByTestId('scripture-resume-prompt')).toBeVisible();

      // WHEN: User taps "Start fresh"
      await page.getByTestId('scripture-start-fresh').click();

      // THEN: Mode selection appears (new session flow)
      await expect(page.getByTestId('scripture-mode-select')).toBeVisible();

      // AND: After selecting Solo, session starts at step 1
      await page.getByTestId('scripture-mode-solo').click();
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 1 of 17');
    });
  });
});
