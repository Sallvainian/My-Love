/**
 * P0/P1/P2 E2E: Scripture Reading - Per-Step Reflection System
 *
 * Story 2.1: Users bookmark verses during reading and submit
 * a reflection (rating + optional note) after each step.
 *
 * Test IDs: 2.1-E2E-001, 2.1-E2E-002, 2.1-E2E-003, 2.1-E2E-004, 2.1-E2E-005, 2.1-E2E-006
 * Risk Links: R2-001 (reflection write fails silently), R2-005 (bookmark toggle race)
 *
 * Epic 2, Story 2.1
 *
 * TDD Phase: GREEN — all tests activated
 */
import { test, expect } from '../../support/merged-fixtures';

test.describe('Per-Step Reflection System', () => {
  test.describe('2.1-E2E-001 [P0]: Submit per-step reflection with rating and note', () => {
    test('should persist reflection data to scripture_reflections after submission', async ({
      page,
      supabaseAdmin,
      testSession,
    }) => {
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

  test.describe('2.1-E2E-005 [P2]: Bookmark aria-labels toggle correctly', () => {
    test('should toggle aria-label between "Bookmark this verse" and "Remove bookmark"', async ({
      page,
    }) => {
      // GIVEN: User is on a verse screen in a solo session
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();
      await expect(page.getByTestId('scripture-verse-text')).toBeVisible();

      const bookmarkButton = page.getByTestId('scripture-bookmark-button');

      // THEN: Initial state has "Bookmark this verse" aria-label
      await expect(bookmarkButton).toHaveAttribute('aria-label', 'Bookmark this verse');
      await expect(bookmarkButton).toHaveAttribute('aria-pressed', 'false');

      // WHEN: User taps bookmark
      await bookmarkButton.click();

      // THEN: aria-label changes to "Remove bookmark" and aria-pressed is true
      await expect(bookmarkButton).toHaveAttribute('aria-label', 'Remove bookmark');
      await expect(bookmarkButton).toHaveAttribute('aria-pressed', 'true');

      // WHEN: User taps bookmark again
      await bookmarkButton.click();

      // THEN: aria-label reverts to "Bookmark this verse"
      await expect(bookmarkButton).toHaveAttribute('aria-label', 'Bookmark this verse');
      await expect(bookmarkButton).toHaveAttribute('aria-pressed', 'false');
    });
  });

  test.describe('2.1-E2E-006 [P2]: Rating radiogroup has correct aria-labels', () => {
    test('should have accessible labels "Rating N of 5" with A little/A lot descriptors', async ({
      page,
    }) => {
      // GIVEN: User is on the reflection screen
      await page.goto('/scripture');
      await page.getByTestId('scripture-start-button').click();
      await page.getByTestId('scripture-mode-solo').click();
      await page.getByTestId('scripture-next-verse-button').click();
      await expect(page.getByTestId('scripture-reflection-screen')).toBeVisible();

      // THEN: Rating group has radiogroup role with accessible label
      const ratingGroup = page.getByTestId('scripture-rating-group');
      await expect(ratingGroup).toHaveAttribute('role', 'radiogroup');

      // AND: Each rating button has the correct aria-label pattern
      const expectedLabels = [
        'Rating 1 of 5: A little',
        'Rating 2 of 5',
        'Rating 3 of 5',
        'Rating 4 of 5',
        'Rating 5 of 5: A lot',
      ];

      for (let i = 0; i < expectedLabels.length; i++) {
        await expect(page.getByTestId(`scripture-rating-${i + 1}`)).toHaveAttribute(
          'aria-label',
          expectedLabels[i]
        );
      }

      // AND: Each rating button has role="radio"
      for (let n = 1; n <= 5; n++) {
        await expect(page.getByTestId(`scripture-rating-${n}`)).toHaveAttribute('role', 'radio');
      }
    });
  });
});

// ============================================================
// Story 2.2: End-of-Session Reflection Summary — E2E Tests
// TDD Phase: GREEN — all tests activated
// ============================================================

test.describe('End-of-Session Reflection Summary', () => {
  /**
   * Helper: Complete all 17 scripture steps to reach the reflection summary screen.
   *
   * Navigates through start -> solo -> 17 verse/reflection cycles.
   * Optionally bookmarks specific steps along the way.
   *
   * @param page - Playwright page
   * @param bookmarkSteps - Set of step indices (0-16) to bookmark during navigation
   */
  async function completeAllStepsToReflectionSummary(
    page: import('@playwright/test').Page,
    bookmarkSteps: Set<number> = new Set([0, 5, 12])
  ): Promise<void> {
    // Start solo session
    await page.goto('/scripture');
    await page.getByTestId('scripture-start-button').click();
    await page.getByTestId('scripture-mode-solo').click();

    // Complete all 17 steps (indices 0-16)
    for (let step = 0; step < 17; step++) {
      // Wait for verse screen
      await expect(page.getByTestId('scripture-verse-text')).toBeVisible();

      // Optionally bookmark this verse
      if (bookmarkSteps.has(step)) {
        await page.getByTestId('scripture-bookmark-button').click();
        await expect(page.getByTestId('scripture-bookmark-button')).toHaveAttribute(
          'aria-pressed',
          'true'
        );
      }

      // Advance to reflection screen
      await page.getByTestId('scripture-next-verse-button').click();
      await expect(page.getByTestId('scripture-reflection-screen')).toBeVisible();

      // Select a rating and submit reflection
      await page.getByTestId('scripture-rating-3').click();

      // Wait for server response before clicking Continue
      const reflectionResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/rest/v1/rpc/scripture_submit_reflection') &&
          response.status() === 200
      );
      await page.getByTestId('scripture-reflection-continue').click();
      await reflectionResponse;
    }

    // After step 17 (index 16) reflection, the reflection summary should appear
  }

  test.describe('2.2-E2E-001 [P0]: Reflection summary screen appears after step 17 with bookmarked verses', () => {
    test('should display reflection summary with bookmarked verse chips after completing all 17 steps', async ({
      page,
    }) => {
      // GIVEN: User has completed all 17 steps with bookmarks on steps 0, 5, and 12
      const bookmarkedStepIndices = new Set([0, 5, 12]);
      await completeAllStepsToReflectionSummary(page, bookmarkedStepIndices);

      // THEN: Reflection summary screen is visible
      await expect(
        page.getByTestId('scripture-reflection-summary-screen')
      ).toBeVisible();

      // AND: Section heading "Your Session" is visible
      const heading = page.getByTestId('scripture-reflection-summary-heading');
      await expect(heading).toBeVisible();
      await expect(heading).toHaveText('Your Session');

      // AND: Heading has focus (programmatic focus on transition)
      await expect(heading).toBeFocused();

      // AND: Bookmarked verse chips are displayed for steps 0, 5, and 12
      await expect(
        page.getByTestId('scripture-standout-verse-0')
      ).toBeVisible();
      await expect(
        page.getByTestId('scripture-standout-verse-0')
      ).toHaveText('Psalm 147:3');

      await expect(
        page.getByTestId('scripture-standout-verse-5')
      ).toBeVisible();
      await expect(
        page.getByTestId('scripture-standout-verse-5')
      ).toHaveText('Matthew 6:14-15');

      await expect(
        page.getByTestId('scripture-standout-verse-12')
      ).toBeVisible();
      await expect(
        page.getByTestId('scripture-standout-verse-12')
      ).toHaveText('Proverbs 18:21');

      // AND: Non-bookmarked verse chips are NOT displayed
      await expect(
        page.getByTestId('scripture-standout-verse-1')
      ).not.toBeVisible();
      await expect(
        page.getByTestId('scripture-standout-verse-3')
      ).not.toBeVisible();
      await expect(
        page.getByTestId('scripture-standout-verse-16')
      ).not.toBeVisible();

      // AND: No-bookmarks fallback message is NOT visible (since bookmarks exist)
      await expect(
        page.getByTestId('scripture-no-bookmarks-message')
      ).not.toBeVisible();

      // AND: Session rating group is visible
      const ratingGroup = page.getByTestId('scripture-session-rating-group');
      await expect(ratingGroup).toBeVisible();
      await expect(ratingGroup).toHaveAttribute('role', 'radiogroup');

      // AND: All 5 session rating buttons are visible
      for (let n = 1; n <= 5; n++) {
        await expect(
          page.getByTestId(`scripture-session-rating-${n}`)
        ).toBeVisible();
      }

      // AND: Optional note textarea is visible
      await expect(
        page.getByTestId('scripture-session-note')
      ).toBeVisible();

      // AND: Continue button is visible but disabled (no selections yet)
      const continueButton = page.getByTestId('scripture-reflection-summary-continue');
      await expect(continueButton).toBeVisible();
      await expect(continueButton).toHaveAttribute('aria-disabled', 'true');
    });
  });

  test.describe('2.2-E2E-002 [P1]: Verse selection, rating, and note form interaction', () => {
    test('should allow selecting standout verses, rating, and note with validation', async ({
      page,
    }) => {
      // GIVEN: User is on the reflection summary screen with bookmarks on steps 0 and 12
      const bookmarkedStepIndices = new Set([0, 12]);
      await completeAllStepsToReflectionSummary(page, bookmarkedStepIndices);
      await expect(
        page.getByTestId('scripture-reflection-summary-screen')
      ).toBeVisible();

      // AND: Continue button is disabled before any selections
      const continueButton = page.getByTestId('scripture-reflection-summary-continue');
      await expect(continueButton).toHaveAttribute('aria-disabled', 'true');

      // WHEN: User taps Continue without selecting a verse or rating
      await continueButton.click({ force: true });

      // THEN: Validation messages appear (quiet, non-aggressive)
      const validation = page.getByTestId('scripture-reflection-summary-validation');
      await expect(validation).toBeVisible();
      await expect(validation).toContainText('Please select a standout verse');
      await expect(validation).toContainText('Please select a rating');

      // AND: Validation uses muted styling (not error red)
      await expect(validation).not.toHaveCSS('color', 'rgb(239, 68, 68)');

      // WHEN: User selects a standout verse chip (step 0 - Psalm 147:3)
      const verseChip0 = page.getByTestId('scripture-standout-verse-0');
      await verseChip0.click();

      // THEN: Verse chip toggles to selected state (aria-pressed true)
      await expect(verseChip0).toHaveAttribute('aria-pressed', 'true');

      // AND: Verse chip meets 48x48px minimum touch target
      const chipBox = await verseChip0.boundingBox();
      expect(chipBox).toBeTruthy();
      expect(chipBox!.width).toBeGreaterThanOrEqual(48);
      expect(chipBox!.height).toBeGreaterThanOrEqual(48);

      // AND: Other verse chip remains unselected
      await expect(
        page.getByTestId('scripture-standout-verse-12')
      ).toHaveAttribute('aria-pressed', 'false');

      // WHEN: User also selects the second verse chip (multi-select)
      await page.getByTestId('scripture-standout-verse-12').click();

      // THEN: Both verse chips are now selected
      await expect(verseChip0).toHaveAttribute('aria-pressed', 'true');
      await expect(
        page.getByTestId('scripture-standout-verse-12')
      ).toHaveAttribute('aria-pressed', 'true');

      // AND: Continue button is still disabled (rating not yet selected)
      await expect(continueButton).toHaveAttribute('aria-disabled', 'true');

      // AND: Verse validation cleared but rating validation still present
      await expect(validation).not.toContainText('Please select a standout verse');
      await expect(validation).toContainText('Please select a rating');

      // WHEN: User selects session rating 4
      await page.getByTestId('scripture-session-rating-4').click();

      // THEN: Rating 4 is checked
      await expect(
        page.getByTestId('scripture-session-rating-4')
      ).toHaveAttribute('aria-checked', 'true');

      // AND: Other ratings are unchecked
      for (const n of [1, 2, 3, 5]) {
        await expect(
          page.getByTestId(`scripture-session-rating-${n}`)
        ).toHaveAttribute('aria-checked', 'false');
      }

      // AND: Validation messages disappear
      await expect(validation).not.toBeVisible();

      // AND: Continue button becomes enabled
      await expect(continueButton).not.toHaveAttribute('aria-disabled', 'true');

      // WHEN: User types a note in the textarea
      const noteTextarea = page.getByTestId('scripture-session-note');
      await expect(noteTextarea).toBeVisible();
      await expect(noteTextarea).toHaveAttribute(
        'aria-label',
        'Optional session reflection note'
      );
      await noteTextarea.fill('This session brought us closer together.');

      // THEN: Character counter is NOT visible (under 150 chars)
      await expect(
        page.getByTestId('scripture-session-note-char-count')
      ).not.toBeVisible();

      // WHEN: User types a note exceeding 150 characters
      const longNote = 'A'.repeat(155);
      await noteTextarea.fill(longNote);

      // THEN: Character counter becomes visible showing remaining chars
      const charCount = page.getByTestId('scripture-session-note-char-count');
      await expect(charCount).toBeVisible();
      await expect(charCount).toContainText('155');

      // AND: Continue button remains enabled (note is optional)
      await expect(continueButton).not.toHaveAttribute('aria-disabled', 'true');

      // WHEN: User deselects a verse chip
      await verseChip0.click();

      // THEN: Verse chip toggles back to unselected
      await expect(verseChip0).toHaveAttribute('aria-pressed', 'false');

      // AND: The other verse chip remains selected (at least one still selected)
      await expect(
        page.getByTestId('scripture-standout-verse-12')
      ).toHaveAttribute('aria-pressed', 'true');

      // AND: Continue button stays enabled (one verse + rating selected)
      await expect(continueButton).not.toHaveAttribute('aria-disabled', 'true');
    });
  });

  test.describe('2.2-E2E-003 [P0]: Submitting reflection summary advances phase to report', () => {
    test('should save session-level reflection and advance to report phase', async ({
      page,
      supabaseAdmin,
      testSession,
    }) => {
      // GIVEN: User is on the reflection summary screen with bookmarks on steps 0, 5, and 12
      const bookmarkedStepIndices = new Set([0, 5, 12]);
      await completeAllStepsToReflectionSummary(page, bookmarkedStepIndices);
      await expect(
        page.getByTestId('scripture-reflection-summary-screen')
      ).toBeVisible();

      // WHEN: User selects standout verses (steps 0 and 12)
      await page.getByTestId('scripture-standout-verse-0').click();
      await expect(
        page.getByTestId('scripture-standout-verse-0')
      ).toHaveAttribute('aria-pressed', 'true');

      await page.getByTestId('scripture-standout-verse-12').click();
      await expect(
        page.getByTestId('scripture-standout-verse-12')
      ).toHaveAttribute('aria-pressed', 'true');

      // AND: User selects session rating 5
      await page.getByTestId('scripture-session-rating-5').click();
      await expect(
        page.getByTestId('scripture-session-rating-5')
      ).toHaveAttribute('aria-checked', 'true');

      // AND: User types an optional note
      await page.getByTestId('scripture-session-note').fill(
        'This prayer time was transformative for us.'
      );

      // AND: Continue button is now enabled
      const continueButton = page.getByTestId('scripture-reflection-summary-continue');
      await expect(continueButton).not.toHaveAttribute('aria-disabled', 'true');

      // WHEN: User taps Continue to submit the reflection summary
      // Set up response listener BEFORE clicking to avoid race condition
      const summaryResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/rest/v1/rpc/scripture_submit_reflection') &&
          response.status() === 200
      );
      await continueButton.click();
      await summaryResponse;

      // THEN: Session advances to report phase — message compose screen appears (linked user)
      await expect(
        page.getByTestId('scripture-message-compose-screen')
      ).toBeVisible();

      // AND: Reflection summary screen is no longer visible
      await expect(
        page.getByTestId('scripture-reflection-summary-screen')
      ).not.toBeVisible();

      // AND: Session-level reflection is persisted with step_index = 17 (MAX_STEPS sentinel)
      const { data: reflections, error } = await supabaseAdmin
        .from('scripture_reflections')
        .select('*')
        .eq('session_id', testSession.session_ids[0])
        .eq('step_index', 17);

      expect(error).toBeNull();
      expect(reflections).toHaveLength(1);
      expect(reflections![0].rating).toBe(5);
      expect(reflections![0].user_id).toBe(testSession.test_user1_id);

      // AND: Notes contain standout verses and user note as JSON
      const notesData = JSON.parse(reflections![0].notes!);
      expect(notesData.standoutVerses).toEqual(expect.arrayContaining([0, 12]));
      expect(notesData.standoutVerses).toHaveLength(2);
      expect(notesData.userNote).toBe(
        'This prayer time was transformative for us.'
      );

      // AND: Session phase is now 'report' in the database
      const { data: sessions, error: sessionError } = await supabaseAdmin
        .from('scripture_sessions')
        .select('current_phase, status')
        .eq('id', testSession.session_ids[0]);

      expect(sessionError).toBeNull();
      expect(sessions).toHaveLength(1);
      expect(sessions![0].current_phase).toBe('report');

      // AND: Session status is still 'in_progress' (NOT 'complete' — that's Story 2.3)
      expect(sessions![0].status).toBe('in_progress');
    });
  });

  test.describe('2.2-E2E-004 [P2]: No-bookmarks reflection flow shows fallback message', () => {
    test('should show no-bookmarks message and enable Continue with just rating', async ({
      page,
      supabaseAdmin,
      testSession,
    }) => {
      // GIVEN: User has completed all 17 steps WITHOUT bookmarking any verses
      await completeAllStepsToReflectionSummary(page, new Set()); // empty bookmark set

      // THEN: Reflection summary screen is visible
      await expect(
        page.getByTestId('scripture-reflection-summary-screen')
      ).toBeVisible();

      // AND: No-bookmarks fallback message is displayed
      await expect(
        page.getByTestId('scripture-no-bookmarks-message')
      ).toBeVisible();
      await expect(
        page.getByTestId('scripture-no-bookmarks-message')
      ).toHaveText("You didn't mark any verses — that's okay");

      // AND: No verse chips are rendered
      await expect(
        page.getByTestId('scripture-standout-verse-0')
      ).not.toBeVisible();

      // AND: Continue button is disabled (no rating yet)
      const continueButton = page.getByTestId('scripture-reflection-summary-continue');
      await expect(continueButton).toHaveAttribute('aria-disabled', 'true');

      // WHEN: User selects a session rating only (no verse selection needed)
      await page.getByTestId('scripture-session-rating-4').click();

      // THEN: Continue button becomes enabled (only rating required when no bookmarks)
      await expect(continueButton).not.toHaveAttribute('aria-disabled', 'true');

      // WHEN: User submits
      const summaryResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/rest/v1/rpc/scripture_submit_reflection') &&
          response.status() === 200
      );
      await continueButton.click();
      await summaryResponse;

      // THEN: Session advances to report phase — message compose screen appears (linked user)
      await expect(
        page.getByTestId('scripture-message-compose-screen')
      ).toBeVisible();

      // AND: Session-level reflection is persisted with empty standoutVerses
      const { data: reflections, error } = await supabaseAdmin
        .from('scripture_reflections')
        .select('*')
        .eq('session_id', testSession.session_ids[0])
        .eq('step_index', 17);

      expect(error).toBeNull();
      expect(reflections).toHaveLength(1);
      expect(reflections![0].rating).toBe(4);

      const notesData = JSON.parse(reflections![0].notes!);
      expect(notesData.standoutVerses).toEqual([]);
    });
  });
});

// ============================================================
// Story 2.3: Daily Prayer Report — Send & View — E2E Tests
// TDD Phase: GREEN — implementation complete, tests activated
// ============================================================

test.describe('Daily Prayer Report — Send & View', () => {
  /**
   * Helper: Complete all 17 scripture steps to reach the reflection summary screen.
   *
   * Replicates the helper from Story 2.2 describe block since Playwright
   * test.describe scopes are isolated.
   *
   * @param page - Playwright page
   * @param bookmarkSteps - Set of step indices (0-16) to bookmark during navigation
   */
  async function completeAllStepsToReflectionSummary(
    page: import('@playwright/test').Page,
    bookmarkSteps: Set<number> = new Set([0, 5, 12])
  ): Promise<void> {
    // Start solo session
    await page.goto('/scripture');
    await page.getByTestId('scripture-start-button').click();
    await page.getByTestId('scripture-mode-solo').click();

    // Complete all 17 steps (indices 0-16)
    for (let step = 0; step < 17; step++) {
      // Wait for verse screen
      await expect(page.getByTestId('scripture-verse-text')).toBeVisible();

      // Optionally bookmark this verse
      if (bookmarkSteps.has(step)) {
        await page.getByTestId('scripture-bookmark-button').click();
        await expect(page.getByTestId('scripture-bookmark-button')).toHaveAttribute(
          'aria-pressed',
          'true'
        );
      }

      // Advance to reflection screen
      await page.getByTestId('scripture-next-verse-button').click();
      await expect(page.getByTestId('scripture-reflection-screen')).toBeVisible();

      // Select a rating and submit reflection
      await page.getByTestId('scripture-rating-3').click();

      // Wait for server response before clicking Continue
      const reflectionResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/rest/v1/rpc/scripture_submit_reflection') &&
          response.status() === 200
      );
      await page.getByTestId('scripture-reflection-continue').click();
      await reflectionResponse;
    }

    // After step 17 (index 16) reflection, the reflection summary should appear
  }

  /**
   * Helper: Submit the reflection summary form to advance past it.
   *
   * Selects a standout verse, a session rating, and clicks Continue
   * with a network-first wait pattern. Used by Story 2.3 tests that
   * need to reach the report phase (post-reflection-summary).
   *
   * @param page - Playwright page
   */
  async function submitReflectionSummary(
    page: import('@playwright/test').Page
  ): Promise<void> {
    await expect(
      page.getByTestId('scripture-reflection-summary-screen')
    ).toBeVisible();

    // Select a standout verse (step 0)
    await page.getByTestId('scripture-standout-verse-0').click();
    await expect(
      page.getByTestId('scripture-standout-verse-0')
    ).toHaveAttribute('aria-pressed', 'true');

    // Select session rating 4
    await page.getByTestId('scripture-session-rating-4').click();
    await expect(
      page.getByTestId('scripture-session-rating-4')
    ).toHaveAttribute('aria-checked', 'true');

    // Submit the reflection summary — wait for server response before clicking
    const summaryResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/rest/v1/rpc/scripture_submit_reflection') &&
        response.status() === 200
    );
    await page.getByTestId('scripture-reflection-summary-continue').click();
    await summaryResponse;
  }

  test.describe('2.3-E2E-001 [P0]: Linked user completes message compose and sees Daily Prayer Report', () => {
    test('should show message compose after reflection summary, then report after sending', async ({
      page,
      supabaseAdmin,
      testSession,
    }) => {

      // GIVEN: User has completed all 17 steps with bookmarks on steps 0, 5, and 12
      const bookmarkedStepIndices = new Set([0, 5, 12]);
      await completeAllStepsToReflectionSummary(page, bookmarkedStepIndices);

      // AND: User submits the reflection summary (select verse, rating, click continue)
      await submitReflectionSummary(page);

      // WHEN: Report phase begins (after reflection summary submission)
      // THEN: Message composition screen appears
      await expect(
        page.getByTestId('scripture-message-compose-screen')
      ).toBeVisible();

      // AND: Heading shows "Write something for [Partner Name]"
      const heading = page.getByTestId('scripture-message-compose-heading');
      await expect(heading).toBeVisible();
      await expect(heading).toContainText('Write something for');

      // AND: Textarea is visible with correct aria-label
      const textarea = page.getByTestId('scripture-message-textarea');
      await expect(textarea).toBeVisible();
      await expect(textarea).toHaveAttribute('aria-label', 'Message to partner');

      // AND: Send button is visible
      const sendButton = page.getByTestId('scripture-message-send-btn');
      await expect(sendButton).toBeVisible();

      // AND: Skip button is visible
      const skipButton = page.getByTestId('scripture-message-skip-btn');
      await expect(skipButton).toBeVisible();

      // WHEN: User types a message
      await textarea.fill('Praying for you today. You are loved.');

      // AND: User clicks Send — wait for message persistence
      const messageResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/rest/v1/scripture_messages') &&
          response.ok()
      );
      await sendButton.click();
      await messageResponse;

      // THEN: Daily Prayer Report screen appears
      await expect(
        page.getByTestId('scripture-report-screen')
      ).toBeVisible();

      // AND: Message composition screen is no longer visible
      await expect(
        page.getByTestId('scripture-message-compose-screen')
      ).not.toBeVisible();

      // AND: Report heading is visible
      await expect(
        page.getByTestId('scripture-report-heading')
      ).toBeVisible();

      // AND: User ratings section is visible
      await expect(
        page.getByTestId('scripture-report-user-ratings')
      ).toBeVisible();

      // AND: Return to Overview button is visible
      await expect(
        page.getByTestId('scripture-report-return-btn')
      ).toBeVisible();

      // AND: Session is marked as complete in the database
      const { data: sessions, error: sessionError } = await supabaseAdmin
        .from('scripture_sessions')
        .select('status, completed_at')
        .eq('id', testSession.session_ids[0]);

      expect(sessionError).toBeNull();
      expect(sessions).toHaveLength(1);
      expect(sessions![0].status).toBe('complete');
      expect(sessions![0].completed_at).not.toBeNull();

      // AND: The message is persisted in the database
      const { data: messages, error: msgError } = await supabaseAdmin
        .from('scripture_messages')
        .select('*')
        .eq('session_id', testSession.session_ids[0])
        .eq('sender_id', testSession.test_user1_id);

      expect(msgError).toBeNull();
      expect(messages).toHaveLength(1);
      expect(messages![0].message).toBe('Praying for you today. You are loved.');
    });
  });

  test.describe('2.3-E2E-002 [P0]: Unlinked user skips message compose and sees completion screen', () => {
    test('should skip message compose for unlinked user and show completion screen', async ({
      page,
      supabaseAdmin,
    }) => {
      // Seed an unlinked (solo, no partner) session inline instead of using the
      // testSession fixture, which always creates a linked pair.
      const { createTestSession, cleanupTestSession } = await import(
        '../../support/factories'
      );
      const seedResult = await createTestSession(supabaseAdmin, {
        preset: 'unlinked',
      });

      try {
        // GIVEN: User has completed all 17 steps (no bookmarks needed for this test)
        await completeAllStepsToReflectionSummary(page, new Set([0]));

        // AND: User submits the reflection summary
        await submitReflectionSummary(page);

        // WHEN: Report phase begins for an unlinked user (no partner_id)
        // THEN: Message composition screen is NOT shown
        await expect(
          page.getByTestId('scripture-message-compose-screen')
        ).not.toBeVisible();

        // AND: Unlinked completion screen appears
        await expect(
          page.getByTestId('scripture-unlinked-complete-screen')
        ).toBeVisible();

        // AND: Heading shows "Session complete"
        const heading = page.getByTestId('scripture-unlinked-complete-heading');
        await expect(heading).toBeVisible();
        await expect(heading).toHaveText('Session complete');

        // AND: "Return to Overview" button is visible
        await expect(
          page.getByTestId('scripture-unlinked-return-btn')
        ).toBeVisible();

        // AND: Session is marked as complete in the database
        const { data: sessions, error: sessionError } = await supabaseAdmin
          .from('scripture_sessions')
          .select('status, completed_at')
          .eq('id', seedResult.session_ids[0]);

        expect(sessionError).toBeNull();
        expect(sessions).toHaveLength(1);
        expect(sessions![0].status).toBe('complete');
        expect(sessions![0].completed_at).not.toBeNull();
      } finally {
        await cleanupTestSession(supabaseAdmin, seedResult.session_ids);
      }
    });
  });

  test.describe('2.3-E2E-003 [P1]: Daily Prayer Report displays partner message and waiting state', () => {
    test('should display partner message in Dancing Script font when partner has sent a message', async ({
      page,
      supabaseAdmin,
      testSession,
    }) => {
      // Partner message is pre-seeded via supabaseAdmin below (line ~1056)

      // GIVEN: User has completed all 17 steps and the reflection summary
      await completeAllStepsToReflectionSummary(page, new Set([0, 5, 12]));
      await submitReflectionSummary(page);

      // AND: Partner has already sent a message for this session
      // (Pre-seed partner message via supabaseAdmin for test setup)
      await supabaseAdmin.from('scripture_messages').insert({
        session_id: testSession.session_ids[0],
        sender_id: testSession.test_user2_id!,
        message: 'I am so grateful for you. Keep shining.',
      });

      // AND: User sends their own message (or skips) to reach the report
      await expect(
        page.getByTestId('scripture-message-compose-screen')
      ).toBeVisible();
      await page.getByTestId('scripture-message-skip-btn').click();

      // WHEN: Daily Prayer Report screen loads
      await expect(
        page.getByTestId('scripture-report-screen')
      ).toBeVisible();

      // THEN: Partner message card is visible
      const partnerMessage = page.getByTestId('scripture-report-partner-message');
      await expect(partnerMessage).toBeVisible();

      // AND: Message is displayed with Dancing Script font (font-cursive class)
      await expect(partnerMessage).toHaveClass(/font-cursive/);
      await expect(partnerMessage).toContainText(
        'I am so grateful for you. Keep shining.'
      );
    });

    test('should display waiting state when partner has not completed their session', async ({
      page,
    }) => {
      // Default state: linked testSession fixture creates a partner who has not
      // completed their session, so the waiting state is the expected default.

      // GIVEN: User has completed all 17 steps and the reflection summary
      await completeAllStepsToReflectionSummary(page, new Set([0, 5, 12]));
      await submitReflectionSummary(page);

      // AND: User sends a message (or skips) to reach the report
      await expect(
        page.getByTestId('scripture-message-compose-screen')
      ).toBeVisible();
      await page.getByTestId('scripture-message-skip-btn').click();

      // WHEN: Daily Prayer Report screen loads and partner has NOT completed
      await expect(
        page.getByTestId('scripture-report-screen')
      ).toBeVisible();

      // THEN: Waiting text is visible
      const waitingText = page.getByTestId('scripture-report-partner-waiting');
      await expect(waitingText).toBeVisible();

      // AND: Text contains partner name and waiting message
      await expect(waitingText).toContainText('Waiting for');
      await expect(waitingText).toContainText('reflections');

      // AND: Partner message card is NOT visible (partner hasn't sent one)
      await expect(
        page.getByTestId('scripture-report-partner-message')
      ).not.toBeVisible();
    });
  });

  test.describe('2.3-E2E-005 [P2]: Together mode report shows both users data side-by-side', () => {
    test('should display partner ratings side-by-side and both messages when partner data is pre-seeded', async ({
      page,
      supabaseAdmin,
      testSession,
    }) => {
      // The default testSession fixture creates a together-mode session with
      // user1 and user2. We pre-seed partner (user2) reflections and message
      // so the report can display side-by-side data after user1 completes.

      const sessionId = testSession.session_ids[0];
      const partnerId = testSession.test_user2_id!;

      // Pre-condition: testSession has a partner (together mode)
      expect(partnerId).toBeTruthy();

      // GIVEN: Partner (user2) has already submitted reflections for steps 0-16
      const partnerReflections = Array.from({ length: 17 }, (_, stepIndex) => ({
        session_id: sessionId,
        step_index: stepIndex,
        user_id: partnerId,
        rating: ((stepIndex + 2) % 5) + 1, // Rotating rating 1-5, offset from user's
        notes: `Partner reflection step ${stepIndex}`,
        is_shared: true,
      }));

      const { error: reflError } = await supabaseAdmin
        .from('scripture_reflections')
        .insert(partnerReflections);
      expect(reflError).toBeNull();

      // AND: Partner has submitted a session-level reflection (step 17) with standout verses
      const { error: summaryError } = await supabaseAdmin
        .from('scripture_reflections')
        .insert({
          session_id: sessionId,
          step_index: 17,
          user_id: partnerId,
          rating: 5,
          notes: JSON.stringify({ standoutVerses: [2, 8, 14] }),
          is_shared: true,
        });
      expect(summaryError).toBeNull();

      // AND: Partner has sent a message
      const { error: msgError } = await supabaseAdmin
        .from('scripture_messages')
        .insert({
          session_id: sessionId,
          sender_id: partnerId,
          message: 'You are my sunshine. Thank you for reading with me today.',
        });
      expect(msgError).toBeNull();

      // AND: Partner has bookmarked some verses
      const partnerBookmarks = [3, 7, 11].map((stepIndex) => ({
        session_id: sessionId,
        step_index: stepIndex,
        user_id: partnerId,
      }));

      const { error: bookmarkError } = await supabaseAdmin
        .from('scripture_bookmarks')
        .insert(partnerBookmarks);
      expect(bookmarkError).toBeNull();

      // WHEN: User1 completes all 17 steps with bookmarks on steps 0, 5, 12
      const bookmarkedStepIndices = new Set([0, 5, 12]);
      await completeAllStepsToReflectionSummary(page, bookmarkedStepIndices);

      // AND: User1 submits the reflection summary
      await submitReflectionSummary(page);

      // AND: User1 sends a message to reach the report
      await expect(
        page.getByTestId('scripture-message-compose-screen')
      ).toBeVisible();
      const textarea = page.getByTestId('scripture-message-textarea');
      await textarea.fill('Together in prayer, always.');

      const messageResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/rest/v1/scripture_messages') &&
          response.ok()
      );
      await page.getByTestId('scripture-message-send-btn').click();
      await messageResponse;

      // THEN: Daily Prayer Report screen appears
      await expect(
        page.getByTestId('scripture-report-screen')
      ).toBeVisible();

      // AND: User ratings section is visible
      await expect(
        page.getByTestId('scripture-report-user-ratings')
      ).toBeVisible();

      // AND: Partner ratings are displayed side-by-side (partner rating circles visible)
      // Check a few steps where partner has known ratings
      // Step 0: partner rating = ((0+2) % 5) + 1 = 3
      const step0Row = page.getByTestId('scripture-report-rating-step-0');
      await expect(step0Row).toBeVisible();
      // The row should contain TWO rating circles (user + partner)
      const step0Circles = step0Row.locator('span.rounded-full');
      await expect(step0Circles).toHaveCount(2);

      // AND: Partner message is revealed
      const partnerMessage = page.getByTestId('scripture-report-partner-message');
      await expect(partnerMessage).toBeVisible();
      await expect(partnerMessage).toContainText(
        'You are my sunshine. Thank you for reading with me today.'
      );

      // AND: Partner message uses Dancing Script font (font-cursive class)
      await expect(partnerMessage).toHaveClass(/font-cursive/);

      // AND: Report heading is visible
      await expect(
        page.getByTestId('scripture-report-heading')
      ).toBeVisible();

      // AND: Return to Overview button is present
      await expect(
        page.getByTestId('scripture-report-return-btn')
      ).toBeVisible();
    });
  });
});
