/**
 * P0 E2E: Scripture Reading - Session Flow
 *
 * Critical path: Users must be able to start and progress through sessions.
 * Uses testSession fixture for seeded data with automatic cleanup.
 */
import { test, expect } from '../../support/merged-fixtures';

test.describe('Scripture Session Flow', () => {
  test('[P0] should start a new scripture session', async ({ page }) => {
    // GIVEN: User is on scripture overview
    // WHEN: User clicks start session
    // THEN: Session begins at step 1 in reading phase
    test.skip();
  });

  test('[P0] should display current step content', async ({ page }) => {
    // GIVEN: User is in an active scripture session
    // WHEN: Session loads at current step
    // THEN: Step content (scripture text) is displayed
    test.skip();
  });

  test('[P0] should progress to next step', async ({ page }) => {
    // GIVEN: User is on a step in the reading phase
    // WHEN: User completes the step and clicks next
    // THEN: Next step loads with new content
    test.skip();
  });

  test('[P0] should complete a session', async ({ page }) => {
    // GIVEN: User is on the final step of a session
    // WHEN: User completes the final step
    // THEN: Session is marked as complete
    test.skip();
  });
});
