/**
 * E2E: Scripture Reading - Couple-Aggregate Stats Dashboard
 *
 * Stats section on the Scripture Reading overview page showing 5 couple-aggregate
 * metrics (totalSessions, totalSteps, lastCompleted, avgRating, bookmarkCount)
 * from a SECURITY DEFINER RPC.
 *
 * Test IDs: 3.1-E2E-001, 3.1-E2E-002
 *
 * Epic 3, Story 3.1
 *
 * Source data-testid mapping:
 *   scripture-stats-section, scripture-stats-skeleton,
 *   scripture-stats-sessions, scripture-stats-steps,
 *   scripture-stats-last-completed, scripture-stats-avg-rating,
 *   scripture-stats-bookmarks, scripture-stats-zero-state,
 *   scripture-overview (existing)
 */
import { test, expect } from '../../support/merged-fixtures';

test.describe('Scripture Stats Dashboard', () => {
  test.describe('3.1-E2E-002: Zero-state for new user', () => {
    test('[P1] should show dashes and "Begin your first reading" when no completed sessions exist', async ({
      page,
      scriptureNav,
    }) => {
      // GIVEN: User has no completed scripture sessions (default test user state)
      // WHEN: User navigates to scripture overview
      await scriptureNav.ensureOverview();

      // THEN: The stats section shows zero-state OR skeleton briefly then stats
      // Wait for either the stats section or a brief period
      const statsSection = page.getByTestId('scripture-stats-section');
      const statsSkeleton = page.getByTestId('scripture-stats-skeleton');

      // Wait for loading to complete (either skeleton disappears or section appears)
      await expect(statsSection.or(statsSkeleton)).toBeVisible({ timeout: 10_000 });

      // If skeleton is showing, wait for it to resolve
      if (await statsSkeleton.isVisible()) {
        await expect(statsSection).toBeVisible({ timeout: 10_000 });
      }

      // AND: All stat cards show dashes (em dash) instead of numbers
      await expect(page.getByTestId('scripture-stats-sessions')).toContainText('\u2014');
      await expect(page.getByTestId('scripture-stats-steps')).toContainText('\u2014');
      await expect(page.getByTestId('scripture-stats-last-completed')).toContainText('\u2014');
      await expect(page.getByTestId('scripture-stats-avg-rating')).toContainText('\u2014');
      await expect(page.getByTestId('scripture-stats-bookmarks')).toContainText('\u2014');

      // AND: Zero-state message is visible
      const zeroState = page.getByTestId('scripture-stats-zero-state');
      await expect(zeroState).toBeVisible();
      await expect(zeroState).toContainText('Begin your first reading');
    });
  });

  test.describe('3.1-E2E-001: Stats visible after session completion', () => {
    test('[P0] should display stats section with non-zero values after completing a session', async ({
      page,
      scriptureNav,
    }) => {
      // GIVEN: User completes a full solo reading session through the UI
      await scriptureNav.completeAllSteps();
      await scriptureNav.submitSummary();

      // WHEN: User returns to the scripture overview
      await scriptureNav.ensureOverview();

      // THEN: The stats section renders with real data
      const statsSection = page.getByTestId('scripture-stats-section');
      await expect(statsSection).toBeVisible({ timeout: 10_000 });

      // AND: Sessions completed card shows at least 1
      const sessionsCard = page.getByTestId('scripture-stats-sessions');
      await expect(sessionsCard).toBeVisible();
      await expect(sessionsCard).not.toContainText('\u2014');

      // AND: Steps completed card shows a non-zero value
      const stepsCard = page.getByTestId('scripture-stats-steps');
      await expect(stepsCard).toBeVisible();
      await expect(stepsCard).not.toContainText('\u2014');

      // AND: Last completed card shows a relative date (not em dash)
      const lastCompletedCard = page.getByTestId('scripture-stats-last-completed');
      await expect(lastCompletedCard).toBeVisible();
      await expect(lastCompletedCard).not.toContainText('\u2014');

      // AND: Zero-state message is NOT shown
      await expect(page.getByTestId('scripture-stats-zero-state')).not.toBeVisible();
    });
  });
});
