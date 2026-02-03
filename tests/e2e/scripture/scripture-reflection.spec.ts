/**
 * P0/P1 E2E: Scripture Reading - Per-Step Reflection System
 *
 * Story 2.1: Users bookmark verses during reading and submit
 * a reflection (rating + optional note) after each step.
 *
 * Test IDs: 2.1-E2E-001, 2.1-E2E-002, 2.1-E2E-003, 2.1-E2E-004
 * Risk Links: R2-001 (reflection write fails silently), R2-005 (bookmark toggle race)
 *
 * Epic 2, Story 2.1
 *
 * TDD Phase: RED — all tests skipped; components do not exist yet.
 */
import { test, expect } from '../../support/merged-fixtures';

test.describe('Per-Step Reflection System', () => {
  test.describe('2.1-E2E-001 [P0]: Submit per-step reflection with rating and note', () => {
    test('should persist reflection data to scripture_reflections after submission', async ({
      page,
      supabaseAdmin,
      testSession,
    }) => {
      test.skip();

      // GIVEN: User navigates to scripture and starts a solo session
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();

      // AND: User is on the first verse screen
      await expect(page.getByTestId('scripture-verse-reference')).toBeVisible();
      await expect(page.getByTestId('scripture-verse-text')).toBeVisible();

      // WHEN: User taps "Next Verse" to complete the step
      await page.getByTestId('scripture-next-verse-button').click();

      // THEN: Reflection screen appears with a fade-through-white transition
      await expect(page.getByTestId('scripture-reflection-screen')).toBeVisible();

      // AND: Prompt text is displayed
      await expect(page.getByTestId('scripture-reflection-prompt')).toHaveText(
        'How meaningful was this for you today?'
      );

      // AND: Rating group is visible as a radiogroup
      const ratingGroup = page.getByTestId('scripture-rating-group');
      await expect(ratingGroup).toBeVisible();
      await expect(ratingGroup).toHaveAttribute('role', 'radiogroup');

      // AND: End labels are displayed
      await expect(page.getByTestId('scripture-rating-label-low')).toHaveText('A little');
      await expect(page.getByTestId('scripture-rating-label-high')).toHaveText('A lot');

      // AND: All 5 rating buttons are visible
      for (let n = 1; n <= 5; n++) {
        await expect(page.getByTestId(`scripture-rating-${n}`)).toBeVisible();
      }

      // WHEN: User selects rating 4
      await page.getByTestId('scripture-rating-4').click();

      // THEN: Rating 4 is checked (aria-checked)
      await expect(page.getByTestId('scripture-rating-4')).toHaveAttribute(
        'aria-checked',
        'true'
      );

      // AND: Other ratings are unchecked
      for (const n of [1, 2, 3, 5]) {
        await expect(page.getByTestId(`scripture-rating-${n}`)).toHaveAttribute(
          'aria-checked',
          'false'
        );
      }

      // WHEN: User types an optional note
      const noteTextarea = page.getByTestId('scripture-reflection-note');
      await expect(noteTextarea).toBeVisible();
      await noteTextarea.fill('This verse really spoke to me today.');

      // WHEN: User taps Continue to submit reflection
      const continueButton = page.getByTestId('scripture-reflection-continue');
      await expect(continueButton).toBeEnabled();

      // Set up response listener before clicking to avoid race condition
      const reflectionResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/rest/v1/rpc/scripture_submit_reflection') &&
          response.status() === 200
      );
      await continueButton.click();
      await reflectionResponse;

      // THEN: Session advances to the next verse (step 2)
      await expect(page.getByTestId('scripture-verse-reference')).toBeVisible();
      await expect(
        page.getByTestId('scripture-progress-indicator')
      ).toHaveText('Verse 2 of 17');

      // AND: Reflection data is persisted to the database
      const { data: reflections, error } = await supabaseAdmin
        .from('scripture_reflections')
        .select('*')
        .eq('session_id', testSession.session_ids[0])
        .eq('step_index', 0);

      expect(error).toBeNull();
      expect(reflections).toHaveLength(1);
      expect(reflections![0].rating).toBe(4);
      expect(reflections![0].notes).toBe('This verse really spoke to me today.');
      expect(reflections![0].user_id).toBe(testSession.test_user1_id);
    });
  });

  test.describe('2.1-E2E-002 [P0]: Bookmark toggle persists with correct visual states', () => {
    test('should toggle bookmark to filled amber when active and persist to DB', async ({
      page,
      supabaseAdmin,
      testSession,
    }) => {
      test.skip();

      // GIVEN: User is on a verse screen in a solo session
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();
      await expect(page.getByTestId('scripture-verse-text')).toBeVisible();

      // AND: Bookmark button is visible with inactive state
      const bookmarkButton = page.getByTestId('scripture-bookmark-button');
      await expect(bookmarkButton).toBeVisible();
      await expect(bookmarkButton).toHaveAttribute(
        'aria-label',
        'Bookmark this verse'
      );
      await expect(bookmarkButton).toHaveAttribute('aria-pressed', 'false');

      // AND: Bookmark button meets 48x48px minimum touch target
      const box = await bookmarkButton.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.width).toBeGreaterThanOrEqual(48);
      expect(box!.height).toBeGreaterThanOrEqual(48);

      // WHEN: User taps the bookmark icon
      const bookmarkResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/rest/v1/scripture_bookmarks') &&
          response.ok()
      );
      await bookmarkButton.click();

      // THEN: BookmarkFlag toggles to filled amber instantly (optimistic)
      await expect(bookmarkButton).toHaveAttribute(
        'aria-label',
        'Remove bookmark'
      );
      await expect(bookmarkButton).toHaveAttribute('aria-pressed', 'true');

      // AND: Bookmark persists to server
      await bookmarkResponse;

      // AND: Bookmark exists in the database
      const { data: bookmarks, error } = await supabaseAdmin
        .from('scripture_bookmarks')
        .select('*')
        .eq('session_id', testSession.session_ids[0])
        .eq('step_index', 0)
        .eq('user_id', testSession.test_user1_id);

      expect(error).toBeNull();
      expect(bookmarks).toHaveLength(1);

      // WHEN: User taps the bookmark icon again to toggle off
      const deleteResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/rest/v1/scripture_bookmarks') &&
          response.ok()
      );
      await bookmarkButton.click();

      // THEN: BookmarkFlag toggles back to outlined inactive
      await expect(bookmarkButton).toHaveAttribute(
        'aria-label',
        'Bookmark this verse'
      );
      await expect(bookmarkButton).toHaveAttribute('aria-pressed', 'false');

      // AND: Bookmark is removed from the database
      await deleteResponse;

      const { data: afterDelete } = await supabaseAdmin
        .from('scripture_bookmarks')
        .select('*')
        .eq('session_id', testSession.session_ids[0])
        .eq('step_index', 0)
        .eq('user_id', testSession.test_user1_id);

      expect(afterDelete).toHaveLength(0);
    });
  });

  test.describe('2.1-E2E-003 [P1]: Rating validation prevents submission without rating', () => {
    test('should show helper text and keep Continue disabled until rating is selected', async ({
      page,
    }) => {
      test.skip();

      // GIVEN: User is on the reflection screen (after completing step 1)
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();
      await page.getByTestId('scripture-next-verse-button').click();

      // AND: Reflection screen is displayed
      await expect(page.getByTestId('scripture-reflection-screen')).toBeVisible();

      // THEN: Continue button is disabled before any rating is selected
      const continueButton = page.getByTestId('scripture-reflection-continue');
      await expect(continueButton).toBeDisabled();
      await expect(continueButton).toHaveAttribute('aria-disabled', 'true');

      // AND: No validation message is visible yet (quiet validation)
      await expect(
        page.getByTestId('scripture-reflection-validation')
      ).not.toBeVisible();

      // WHEN: User taps Continue without selecting a rating
      // Note: clicking a disabled button — use force to simulate user intent
      await continueButton.click({ force: true });

      // THEN: Quiet helper text appears below the rating group
      const validationText = page.getByTestId('scripture-reflection-validation');
      await expect(validationText).toBeVisible();
      await expect(validationText).toHaveText('Please select a rating');

      // AND: Continue button remains disabled
      await expect(continueButton).toBeDisabled();

      // AND: No red flashes or aggressive styling (quiet validation)
      // The validation text should use muted styling, not error red
      await expect(validationText).not.toHaveCSS('color', 'rgb(239, 68, 68)');

      // WHEN: User selects a rating (rating 3)
      await page.getByTestId('scripture-rating-3').click();

      // THEN: Helper text disappears
      await expect(validationText).not.toBeVisible();

      // AND: Continue button becomes enabled
      await expect(continueButton).toBeEnabled();
      await expect(continueButton).not.toHaveAttribute('aria-disabled', 'true');
    });
  });

  test.describe('2.1-E2E-004 [P1]: Reflection write failure shows retry UI', () => {
    test('should show non-blocking retry indicator when server returns 500', async ({
      page,
    }) => {
      test.skip();

      // GIVEN: User is in a solo session
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();

      // AND: The reflection write endpoint is intercepted to fail
      // Set up route BEFORE the action that triggers the request
      await page.route('**/rest/v1/rpc/scripture_submit_reflection', (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Internal Server Error' }),
        })
      );

      // WHEN: User completes a step and reaches reflection screen
      await page.getByTestId('scripture-next-verse-button').click();
      await expect(page.getByTestId('scripture-reflection-screen')).toBeVisible();

      // AND: User fills in a rating and taps Continue
      await page.getByTestId('scripture-rating-5').click();
      await page.getByTestId('scripture-reflection-continue').click();

      // THEN: Session still advances (optimistic UI, non-blocking)
      // The reflection write failure should NOT block session progression
      await expect(page.getByTestId('scripture-verse-reference')).toBeVisible();

      // AND: Retry indicator/toast is visible (non-blocking)
      await expect(
        page.getByTestId('scripture-reflection-retry')
      ).toBeVisible();

      // AND: The retry UI does not block interaction with the next verse
      await expect(
        page.getByTestId('scripture-next-verse-button')
      ).toBeEnabled();
    });
  });
});
