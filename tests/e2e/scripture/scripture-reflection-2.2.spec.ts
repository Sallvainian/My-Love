/**
 * P0/P1/P2 E2E: Scripture Reading - End-of-Session Reflection Summary
 *
 * Story 2.2: After completing all 17 verses, users see a summary screen
 * with bookmarked verses, can select one, rate it, and write a final note.
 *
 * Test IDs: 2.2-E2E-001, 2.2-E2E-002, 2.2-E2E-003, 2.2-E2E-004
 *
 * Epic 2, Story 2.2
 */
import { test, expect } from '../../support/merged-fixtures';
import { cleanupTestSession } from '../../support/factories';
import { seedAndResumeAtReflection } from '../../support/helpers/scripture-overview';

test.describe('End-of-Session Reflection Summary', () => {
  let seedSessionIds: string[] = [];

  test.afterEach(async ({ supabaseAdmin }) => {
    if (seedSessionIds.length > 0) {
      await cleanupTestSession(supabaseAdmin, seedSessionIds);
      seedSessionIds = [];
    }
  });

  test.describe('2.2-E2E-001 [P0]: Reflection summary screen appears after step 17 with bookmarked verses', () => {
    test('should display reflection summary with bookmarked verse chips', async ({
      page,
      supabaseAdmin,
    }) => {
      const { sessionIds } = await seedAndResumeAtReflection({
        supabaseAdmin,
        page,
        bookmarkSteps: [0, 5, 12],
      });
      seedSessionIds = sessionIds;

      // THEN: Reflection summary screen is visible
      await expect(page.getByTestId('scripture-reflection-summary-screen')).toBeVisible();

      // AND: Section heading "Your Session" is visible
      const heading = page.getByTestId('scripture-reflection-summary-heading');
      await expect(heading).toBeVisible();
      await expect(heading).toHaveText('Your Session');

      // AND: Bookmarked verse chips are displayed for steps 0, 5, and 12
      await expect(page.getByTestId('scripture-standout-verse-0')).toBeVisible();
      await expect(page.getByTestId('scripture-standout-verse-0')).toHaveText('Psalm 147:3');
      await expect(page.getByTestId('scripture-standout-verse-5')).toBeVisible();
      await expect(page.getByTestId('scripture-standout-verse-5')).toHaveText('Matthew 6:14-15');
      await expect(page.getByTestId('scripture-standout-verse-12')).toBeVisible();
      await expect(page.getByTestId('scripture-standout-verse-12')).toHaveText('Proverbs 18:21');

      // AND: Non-bookmarked verse chips are NOT displayed
      await expect(page.getByTestId('scripture-standout-verse-1')).not.toBeVisible();
      await expect(page.getByTestId('scripture-standout-verse-3')).not.toBeVisible();
      await expect(page.getByTestId('scripture-standout-verse-16')).not.toBeVisible();

      // AND: No-bookmarks fallback message is NOT visible
      await expect(page.getByTestId('scripture-no-bookmarks-message')).not.toBeVisible();

      // AND: Session rating group is visible with radiogroup role
      const ratingGroup = page.getByTestId('scripture-session-rating-group');
      await expect(ratingGroup).toBeVisible();
      await expect(ratingGroup).toHaveAttribute('role', 'radiogroup');

      // AND: All 5 session rating buttons are visible
      for (let n = 1; n <= 5; n++) {
        await expect(page.getByTestId(`scripture-session-rating-${n}`)).toBeVisible();
      }

      // AND: Optional note textarea is visible
      await expect(page.getByTestId('scripture-session-note')).toBeVisible();

      // AND: Continue button is visible but disabled (no selections yet)
      const continueButton = page.getByTestId('scripture-reflection-summary-continue');
      await expect(continueButton).toBeVisible();
      await expect(continueButton).toHaveAttribute('aria-disabled', 'true');
    });
  });

  test.describe('2.2-E2E-002 [P1]: Verse selection, rating, and note form interaction', () => {
    test('should allow selecting standout verses, rating, and note with validation', async ({
      page,
      supabaseAdmin,
    }) => {
      const { sessionIds } = await seedAndResumeAtReflection({
        supabaseAdmin,
        page,
        bookmarkSteps: [0, 12],
      });
      seedSessionIds = sessionIds;
      await expect(page.getByTestId('scripture-reflection-summary-screen')).toBeVisible();

      const continueButton = page.getByTestId('scripture-reflection-summary-continue');
      await expect(continueButton).toHaveAttribute('aria-disabled', 'true');

      // WHEN: User taps Continue without selecting a verse or rating
      await continueButton.click({ force: true });

      // THEN: Validation messages appear
      const validation = page.getByTestId('scripture-reflection-summary-validation');
      await expect(validation).toBeVisible();
      await expect(validation).toContainText('Please select a standout verse');
      await expect(validation).toContainText('Please select a rating');
      await expect(validation).not.toHaveCSS('color', 'rgb(239, 68, 68)');

      // WHEN: User selects a standout verse chip (step 0)
      const verseChip0 = page.getByTestId('scripture-standout-verse-0');
      await verseChip0.click();
      await expect(verseChip0).toHaveAttribute('aria-pressed', 'true');

      // AND: Verse chip meets 48x48px minimum touch target
      const chipBox = await verseChip0.boundingBox();
      expect(chipBox).toBeTruthy();
      expect(chipBox!.width).toBeGreaterThanOrEqual(48);
      expect(chipBox!.height).toBeGreaterThanOrEqual(48);

      // AND: Other verse chip remains unselected
      await expect(page.getByTestId('scripture-standout-verse-12')).toHaveAttribute(
        'aria-pressed',
        'false'
      );

      // WHEN: User also selects the second verse chip (multi-select)
      await page.getByTestId('scripture-standout-verse-12').click();
      await expect(verseChip0).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('scripture-standout-verse-12')).toHaveAttribute(
        'aria-pressed',
        'true'
      );

      // AND: Continue button is still disabled (rating not yet selected)
      await expect(continueButton).toHaveAttribute('aria-disabled', 'true');
      await expect(validation).not.toContainText('Please select a standout verse');
      await expect(validation).toContainText('Please select a rating');

      // WHEN: User selects session rating 4
      await page.getByTestId('scripture-session-rating-4').click();
      await expect(page.getByTestId('scripture-session-rating-4')).toHaveAttribute(
        'aria-checked',
        'true'
      );

      for (const n of [1, 2, 3, 5]) {
        await expect(page.getByTestId(`scripture-session-rating-${n}`)).toHaveAttribute(
          'aria-checked',
          'false'
        );
      }

      // AND: Validation disappears, Continue enables
      await expect(validation).not.toBeVisible();
      await expect(continueButton).not.toHaveAttribute('aria-disabled', 'true');

      // WHEN: User types a note in the textarea
      const noteTextarea = page.getByTestId('scripture-session-note');
      await expect(noteTextarea).toBeVisible();
      await expect(noteTextarea).toHaveAttribute('aria-label', 'Optional session reflection note');
      await noteTextarea.fill('This session brought us closer together.');
      await expect(page.getByTestId('scripture-session-note-char-count')).not.toBeVisible();

      // WHEN: User types a note exceeding 150 characters
      await noteTextarea.fill('A'.repeat(155));
      const charCount = page.getByTestId('scripture-session-note-char-count');
      await expect(charCount).toBeVisible();
      await expect(charCount).toContainText('155');
      await expect(continueButton).not.toHaveAttribute('aria-disabled', 'true');

      // WHEN: User deselects a verse chip
      await verseChip0.click();
      await expect(verseChip0).toHaveAttribute('aria-pressed', 'false');
      await expect(page.getByTestId('scripture-standout-verse-12')).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      await expect(continueButton).not.toHaveAttribute('aria-disabled', 'true');
    });
  });

  test.describe('2.2-E2E-003 [P0]: Submitting reflection summary advances phase to report', () => {
    test('should save session-level reflection and advance to report phase', async ({
      page,
      supabaseAdmin,
      interceptNetworkCall,
    }) => {
      const { sessionId, sessionIds } = await seedAndResumeAtReflection({
        supabaseAdmin,
        page,
        bookmarkSteps: [0, 5, 12],
      });
      seedSessionIds = sessionIds;
      await expect(page.getByTestId('scripture-reflection-summary-screen')).toBeVisible();

      // Get browser user ID (adopt changed the owner)
      const { data: sessionRow } = await supabaseAdmin
        .from('scripture_sessions')
        .select('user1_id')
        .eq('id', sessionId)
        .single();
      const activeUserId = sessionRow!.user1_id;

      // WHEN: User selects standout verses (steps 0 and 12)
      await page.getByTestId('scripture-standout-verse-0').click();
      await expect(page.getByTestId('scripture-standout-verse-0')).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      await page.getByTestId('scripture-standout-verse-12').click();
      await expect(page.getByTestId('scripture-standout-verse-12')).toHaveAttribute(
        'aria-pressed',
        'true'
      );

      // AND: User selects session rating 5 and types a note
      await page.getByTestId('scripture-session-rating-5').click();
      await page
        .getByTestId('scripture-session-note')
        .fill('This prayer time was transformative for us.');

      // WHEN: User taps Continue to submit
      const continueButton = page.getByTestId('scripture-reflection-summary-continue');
      await expect(continueButton).not.toHaveAttribute('aria-disabled', 'true');
      const summaryResponse = interceptNetworkCall({
        method: 'POST',
        url: '**/rest/v1/rpc/scripture_submit_reflection',
      });
      await continueButton.click();
      await summaryResponse;

      // THEN: Message compose screen appears (linked user)
      await expect(page.getByTestId('scripture-message-compose-screen')).toBeVisible();
      await expect(page.getByTestId('scripture-reflection-summary-screen')).not.toBeVisible();

      // AND: Session-level reflection is persisted with step_index = 17
      const { data: reflections, error } = await supabaseAdmin
        .from('scripture_reflections')
        .select('*')
        .eq('session_id', sessionId)
        .eq('step_index', 17);
      expect(error).toBeNull();
      expect(reflections).toHaveLength(1);
      expect(reflections![0].rating).toBe(5);
      expect(reflections![0].user_id).toBe(activeUserId);

      const notesData = JSON.parse(reflections![0].notes!);
      expect(notesData.standoutVerses).toEqual(expect.arrayContaining([0, 12]));
      expect(notesData.standoutVerses).toHaveLength(2);
      expect(notesData.userNote).toBe('This prayer time was transformative for us.');

      // AND: Session phase is now 'report', status still 'in_progress'
      const { data: sessions } = await supabaseAdmin
        .from('scripture_sessions')
        .select('current_phase, status')
        .eq('id', sessionId);
      expect(sessions).toHaveLength(1);
      expect(sessions![0].current_phase).toBe('report');
      expect(sessions![0].status).toBe('in_progress');
    });
  });

  test.describe('2.2-E2E-004 [P2]: No-bookmarks reflection flow shows fallback message', () => {
    test('should show no-bookmarks message and enable Continue with just rating', async ({
      page,
      supabaseAdmin,
      interceptNetworkCall,
    }) => {
      const { sessionId, sessionIds } = await seedAndResumeAtReflection({
        supabaseAdmin,
        page,
        bookmarkSteps: [],
      });
      seedSessionIds = sessionIds;

      await expect(page.getByTestId('scripture-reflection-summary-screen')).toBeVisible();
      await expect(page.getByTestId('scripture-no-bookmarks-message')).toBeVisible();
      await expect(page.getByTestId('scripture-no-bookmarks-message')).toHaveText(
        "You didn't mark any verses — that's okay"
      );
      await expect(page.getByTestId('scripture-standout-verse-0')).not.toBeVisible();

      const continueButton = page.getByTestId('scripture-reflection-summary-continue');
      await expect(continueButton).toHaveAttribute('aria-disabled', 'true');

      // WHEN: User selects a session rating only
      await page.getByTestId('scripture-session-rating-4').click();
      await expect(continueButton).not.toHaveAttribute('aria-disabled', 'true');

      // WHEN: User submits
      const summaryResponse = interceptNetworkCall({
        method: 'POST',
        url: '**/rest/v1/rpc/scripture_submit_reflection',
      });
      await continueButton.click();
      await summaryResponse;

      await expect(page.getByTestId('scripture-message-compose-screen')).toBeVisible();

      // AND: Reflection persisted with empty standoutVerses
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
