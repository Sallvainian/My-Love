/**
 * E2E: Scripture Reading - Couple-Aggregate Stats Dashboard
 *
 * Stats section on the Scripture Reading overview page showing 5 couple-aggregate
 * metrics (totalSessions, totalSteps, lastCompleted, avgRating, bookmarkCount)
 * from a SECURITY DEFINER RPC.
 *
 * Test IDs: 3.1-E2E-001
 *
 * Epic 3, Story 3.1
 *
 * Note: 3.1-E2E-002 (zero-state) was removed — duplicate coverage.
 * Zero-state rendering is fully covered by unit tests (3.1-UNIT-004 in
 * StatsSection.test.tsx) and RPC correctness by pgTAP (09_scripture_couple_stats.sql).
 * The E2E zero-state test could not be made parallel-safe without mocking,
 * which would make it semantically identical to the unit tests.
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
