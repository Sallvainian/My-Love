/**
 * P0/P1/P2 E2E: Scripture Reading - End-of-Session Reflection Summary
 *
 * Story 2.2: After completing all 17 verses, users see a summary screen
 * with bookmarked verses, can select one, rate it, and write a final note.
 *
 * Test IDs: 2.2-E2E-001, 2.2-E2E-002, 2.2-E2E-003, 2.2-E2E-004
 *
 * Epic 2, Story 2.2
 *
 * TDD Phase: GREEN — all tests activated
 */
import { test, expect } from '../../support/merged-fixtures';
import { completeAllStepsToReflectionSummary } from '../../support/helpers';

test.describe('End-of-Session Reflection Summary', () => {
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
    }) => {
      // GIVEN: User is on the reflection summary screen with bookmarks on steps 0, 5, and 12
      const bookmarkedStepIndices = new Set([0, 5, 12]);
      const sessionId = await completeAllStepsToReflectionSummary(page, bookmarkedStepIndices);
      const { data: sessionRow, error: sessionLookupError } = await supabaseAdmin
        .from('scripture_sessions')
        .select('user1_id')
        .eq('id', sessionId)
        .single();
      expect(sessionLookupError).toBeNull();
      const activeUserId = sessionRow!.user1_id;
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
        .eq('session_id', sessionId)
        .eq('step_index', 17);

      expect(error).toBeNull();
      expect(reflections).toHaveLength(1);
      expect(reflections![0].rating).toBe(5);
      expect(reflections![0].user_id).toBe(activeUserId);

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
        .eq('id', sessionId);

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
    }) => {
      // GIVEN: User has completed all 17 steps WITHOUT bookmarking any verses
      const sessionId = await completeAllStepsToReflectionSummary(page, new Set()); // empty bookmark set

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
        .eq('session_id', sessionId)
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
