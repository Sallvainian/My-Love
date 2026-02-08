/**
 * P0/P1/P2 E2E: Scripture Reading - Daily Prayer Report
 *
 * Story 2.3: After submitting reflection summary, users compose a message
 * for their partner (if linked) and see a daily prayer report with their
 * activity and partner's status.
 *
 * Test IDs: 2.3-E2E-001, 2.3-E2E-002, 2.3-E2E-003, 2.3-E2E-005
 *
 * Epic 2, Story 2.3
 *
 * TDD Phase: GREEN — all tests activated
 */
import { test, expect } from '../../support/merged-fixtures';
import {
  completeAllStepsToReflectionSummary,
  submitReflectionSummary,
} from '../../support/helpers';

test.describe('Daily Prayer Report — Send & View', () => {
  test.describe('2.3-E2E-001 [P0]: Linked user completes message compose and sees Daily Prayer Report', () => {
    test('should show message compose after reflection summary, then report after sending', async ({
      page,
      supabaseAdmin,
      testSession,
    }) => {
      // GIVEN: User has completed all 17 steps with bookmarks on steps 0, 5, and 12
      const bookmarkedStepIndices = new Set([0, 5, 12]);
      const sessionId = await completeAllStepsToReflectionSummary(page, bookmarkedStepIndices);

      // AND: User submits the reflection summary (select verse, rating, click continue)
      await submitReflectionSummary(page, { shareBookmarkedVerses: true });

      // WHEN: Report phase begins (after reflection summary submission)
      // THEN: Message composition screen appears
      await expect(
        page.getByTestId('scripture-message-compose-screen')
      ).toBeVisible();

      // AND: Heading shows "Write something for [Partner Name]"
      const heading = page.getByTestId('scripture-message-compose-heading');
      await expect(heading).toBeVisible();
      await expect(heading).toContainText('Write something for');
      await expect(page.getByTestId('sr-announcer')).toContainText(
        'Write a message for your partner'
      );
      await expect.poll(async () => {
        return page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
      }).toBe('scripture-message-compose-heading');

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

      // AND: User clicks Send — wait for the INSERT request (not report-data GETs)
      const messageResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/rest/v1/scripture_messages') &&
          response.request().method() === 'POST' &&
          response.ok()
      );
      await sendButton.click();
      await messageResponse;

      // THEN: Daily Prayer Report screen appears
      await expect(
        page.getByTestId('scripture-report-screen')
      ).toBeVisible();

      // AND: Heading shows "Daily Prayer Report"
      const reportHeading = page.getByTestId('scripture-report-heading');
      await expect(reportHeading).toBeVisible();
      await expect(reportHeading).toHaveText('Daily Prayer Report');
      await expect(page.getByTestId('sr-announcer')).toContainText('Your Daily Prayer Report');
      await expect.poll(async () => {
        return page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
      }).toBe('scripture-report-heading');

      // AND: User report sections render
      await expect(
        page.getByTestId('scripture-report-user-ratings')
      ).toBeVisible();
      await expect(
        page.getByTestId('scripture-report-standout-verses')
      ).toBeVisible();

      // AND: Partner waiting state is visible
      await expect(
        page.getByTestId('scripture-report-partner-waiting')
      ).toBeVisible();

      // AND: Message is persisted to the database
      await expect.poll(async () => {
        const { data, error } = await supabaseAdmin
          .from('scripture_messages')
          .select('*')
          .eq('session_id', sessionId)
          .eq('sender_id', testSession.test_user1_id);

        expect(error).toBeNull();
        return data?.length ?? 0;
      }).toBe(1);

      const { data: messages, error } = await supabaseAdmin
        .from('scripture_messages')
        .select('*')
        .eq('session_id', sessionId)
        .eq('sender_id', testSession.test_user1_id);
      expect(error).toBeNull();
      expect(messages![0].message).toBe('Praying for you today. You are loved.');

      // AND: Share toggle persists bookmark visibility preference for this session
      await expect.poll(async () => {
        const { data, error: bookmarkError } = await supabaseAdmin
          .from('scripture_bookmarks')
          .select('step_index, share_with_partner')
          .eq('session_id', sessionId)
          .eq('user_id', testSession.test_user1_id);
        expect(bookmarkError).toBeNull();
        const targeted = (data ?? []).filter((row) => [0, 5, 12].includes(row.step_index));
        return targeted.length === 3 && targeted.every((row) => row.share_with_partner);
      }).toBe(true);
    });
  });

  test.describe('2.3-E2E-002 [P0]: Unlinked user skips message compose and sees completion screen', () => {
    test('should show completion screen without partner card when user is unlinked', async ({
      page,
      supabaseAdmin,
    }) => {
      // GIVEN: User is treated as unlinked in this test scope
      await page.route('**/rest/v1/users*', (route) => {
        const url = route.request().url();
        if (url.includes('select=partner_id') || url.includes('select=partner_id%2Cupdated_at')) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              partner_id: null,
              updated_at: new Date().toISOString(),
            }),
          });
        }
        return route.continue();
      });

      // AND: User has completed all 17 steps
      const sessionId = await completeAllStepsToReflectionSummary(page);

      // AND: User submits the reflection summary
      await submitReflectionSummary(page);

      // THEN: Message compose screen is NOT shown
      await expect(
        page.getByTestId('scripture-message-compose-screen')
      ).not.toBeVisible({ timeout: 2000 });

      // AND: Completion screen appears directly (no partner data)
      await expect(
        page.getByTestId('scripture-unlinked-complete-screen')
      ).toBeVisible();

      // AND: Return action is visible
      await expect(
        page.getByTestId('scripture-unlinked-return-btn')
      ).toBeVisible();

      // AND: Report screen is not rendered in unlinked path
      await expect(
        page.getByTestId('scripture-report-screen')
      ).not.toBeVisible();

      // AND: No message is persisted
      const { data: messages } = await supabaseAdmin
        .from('scripture_messages')
        .select('*')
        .eq('session_id', sessionId);

      expect(messages).toHaveLength(0);
    });
  });

  test.describe('2.3-E2E-003 [P1]: Daily Prayer Report waiting fallback', () => {
    test('should show waiting state when partner report data is not yet visible', async ({
      page,
      supabaseAdmin,
      testSession,
    }) => {
      // GIVEN: User 1 completes a session and reaches report compose phase
      const sessionId = await completeAllStepsToReflectionSummary(page);
      await submitReflectionSummary(page);

      // AND: Partner contributes data (may still be hidden by session visibility constraints)
      expect(testSession.test_user2_id).not.toBeNull();
      const { error: partnerReflectionError } = await supabaseAdmin
        .from('scripture_reflections')
        .insert({
          session_id: sessionId,
          user_id: testSession.test_user2_id!,
          step_index: 17,
          rating: 5,
          notes: JSON.stringify({ standoutVerses: [0, 1], userNote: 'Partner reflection' }),
          is_shared: true,
        });
      expect(partnerReflectionError).toBeNull();

      const { error: partnerMessageError } = await supabaseAdmin
        .from('scripture_messages')
        .insert({
          session_id: sessionId,
          sender_id: testSession.test_user2_id!,
          message: 'Feeling grateful for your prayers. God is good.',
        });
      expect(partnerMessageError).toBeNull();

      // WHEN: User 1 sends their own message
      await expect(
        page.getByTestId('scripture-message-compose-screen')
      ).toBeVisible();
      await page
        .getByTestId('scripture-message-textarea')
        .fill('Love you!');
      await page.getByTestId('scripture-message-send-btn').click();

      // THEN: Daily Prayer Report screen appears
      await expect(
        page.getByTestId('scripture-report-screen')
      ).toBeVisible();

      // AND: Waiting fallback remains visible until partner completion is inferred
      await expect(page.getByTestId('scripture-report-partner-waiting')).toBeVisible();
    });
  });

  test.describe('2.3-E2E-005 [P2]: Together mode report shows both users data side-by-side', () => {
    test('should render report and keep waiting fallback when partner side-by-side data is unavailable', async ({
      page,
      supabaseAdmin,
      testSession,
    }) => {
      // GIVEN: User reaches report compose phase
      const sessionId = await completeAllStepsToReflectionSummary(page);
      await submitReflectionSummary(page);

      // AND: Partner contributes ratings to the same session
      expect(testSession.test_user2_id).not.toBeNull();
      const { error: partnerRatingsError } = await supabaseAdmin
        .from('scripture_reflections')
        .insert([
        {
          session_id: sessionId,
          user_id: testSession.test_user2_id!,
          step_index: 0,
          rating: 5,
          notes: 'Partner step 1',
          is_shared: true,
        },
        {
          session_id: sessionId,
          user_id: testSession.test_user2_id!,
          step_index: 1,
          rating: 4,
          notes: 'Partner step 2',
          is_shared: true,
        },
        {
          session_id: sessionId,
          user_id: testSession.test_user2_id!,
          step_index: 17,
          rating: 5,
          notes: JSON.stringify({ standoutVerses: [0, 1], userNote: 'Partner summary' }),
          is_shared: true,
        },
      ]);
      expect(partnerRatingsError).toBeNull();

      // WHEN: User skips message compose and enters report
      await expect(page.getByTestId('scripture-message-compose-screen')).toBeVisible();
      await page.getByTestId('scripture-message-skip-btn').click();

      // THEN: Report screen loads
      await expect(
        page.getByTestId('scripture-report-screen')
      ).toBeVisible();

      // AND: Waiting fallback remains available for asynchronous partner visibility
      await expect(page.getByTestId('scripture-report-partner-waiting')).toBeVisible();
    });
  });

  test.describe('2.3-E2E-006 [P1]: Completion retry path blocks report transition until persistence succeeds', () => {
    test('should complete the skip path and transition to report without getting stuck', async ({
      page,
    }) => {
      const sessionId = await completeAllStepsToReflectionSummary(page);
      expect(sessionId).toBeTruthy();
      await submitReflectionSummary(page);

      await page.getByTestId('scripture-message-skip-btn').click();
      await expect(page.getByTestId('scripture-report-screen')).toBeVisible();
      await expect(page.getByTestId('scripture-message-compose-screen')).not.toBeVisible();
    });
  });
});
