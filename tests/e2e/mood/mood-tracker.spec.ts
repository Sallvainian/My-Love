/**
 * P0 E2E: Mood Tracker
 *
 * Critical path: Users must be able to log and view moods.
 * Covers mood logging and history display.
 *
 * Test IDs: 4.1-E2E-001, 4.1-E2E-002, 4.1-E2E-003
 */
import { test, expect } from '../../support/merged-fixtures';

test.describe('Mood Tracker', () => {
  test('[P0] 4.1-E2E-001 should display mood tracker view', async ({
    page,
    interceptNetworkCall,
  }) => {
    // GIVEN: User navigates to /mood
    const moodCall = interceptNetworkCall({
      url: '**/rest/v1/moods**',
    });

    await page.goto('/mood');

    // WHEN: View loads
    await moodCall;

    // THEN: Mood tracker is visible with mood selection options
    await expect(page.getByTestId('mood-tracker')).toBeVisible();
    await expect(page.getByTestId('mood-tab-tracker')).toBeVisible();
    await expect(page.getByTestId('mood-submit-button')).toBeVisible();
    await expect(page.getByRole('heading', { name: /how are you feeling/i })).toBeVisible();
  });

  test('[P0] 4.1-E2E-002 should allow selecting a mood', async ({ page, interceptNetworkCall }) => {
    // GIVEN: User is on mood tracker
    const moodCall = interceptNetworkCall({
      url: '**/rest/v1/moods**',
    });

    await page.goto('/mood');
    await moodCall;
    await expect(page.getByTestId('mood-tracker')).toBeVisible();

    // WHEN: User taps a mood emoji/button
    const happyButton = page.getByRole('button', { name: /happy/i });
    await happyButton.click();

    // THEN: Mood is selected and visual feedback is shown
    await expect(page.getByText(/Selected:.*Happy/i)).toBeVisible();
    await expect(page.getByTestId('mood-submit-button')).toBeEnabled();
  });

  test('[P0] 4.1-E2E-003 should display mood history', async ({ page, interceptNetworkCall }) => {
    // GIVEN: User has logged moods previously
    const moodCall = interceptNetworkCall({
      url: '**/rest/v1/moods**',
    });

    await page.goto('/mood');
    await moodCall;
    await expect(page.getByTestId('mood-tracker')).toBeVisible();

    // WHEN: User switches to Timeline tab
    await page.getByTestId('mood-tab-timeline').click();

    // THEN: Mood history timeline section is visible
    await expect(page.getByTestId('mood-history-section')).toBeVisible();
    await expect(page.getByRole('heading', { name: /mood timeline/i })).toBeVisible();
  });
});
