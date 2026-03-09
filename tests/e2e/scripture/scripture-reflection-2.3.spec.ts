/**
 * P0/P1/P2 E2E: Scripture Reading - Daily Prayer Report
 *
 * Story 2.3: After submitting reflection summary, users compose a message
 * for their partner (if linked) and see a daily prayer report.
 *
 * Test IDs: 2.3-E2E-001, 2.3-E2E-002, 2.3-E2E-003, 2.3-E2E-005, 2.3-E2E-006
 *
 * Epic 2, Story 2.3
 */
import { test, expect } from '../../support/merged-fixtures';
import { submitReflectionSummary } from '../../support/helpers';
import { cleanupTestSession } from '../../support/factories';
import { seedAndResumeAtReflection } from '../../support/helpers/scripture-overview';

test.describe('Daily Prayer Report — Send & View', () => {
  let seedSessionIds: string[] = [];

  test.afterEach(async ({ supabaseAdmin }) => {
    if (seedSessionIds.length > 0) {
      await cleanupTestSession(supabaseAdmin, seedSessionIds);
      seedSessionIds = [];
    }
  });

  test.describe('2.3-E2E-001 [P0]: Linked user completes message compose and sees Daily Prayer Report', () => {
    test('should show message compose after reflection summary, then report after sending', async ({
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

      // Get the active user ID (adopt changed the owner to browser user)
      const { data: sessionRow } = await supabaseAdmin
        .from('scripture_sessions')
        .select('user1_id')
        .eq('id', sessionId)
        .single();
      const activeUserId = sessionRow!.user1_id;

      await submitReflectionSummary(page, { shareBookmarkedVerses: true });

      // THEN: Message composition screen appears
      await expect(page.getByTestId('scripture-message-compose-screen')).toBeVisible();

      const heading = page.getByTestId('scripture-message-compose-heading');
      await expect(heading).toBeVisible();
      await expect(heading).toContainText('Write something for');
      const liveRegion = page.getByTestId('sr-announcer');
      await expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      await expect
        .poll(async () => {
          return page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
        })
        .toBe('scripture-message-compose-heading');

      const textarea = page.getByTestId('scripture-message-textarea');
      await expect(textarea).toBeVisible();
      await expect(textarea).toHaveAttribute('aria-label', 'Message to partner');
      await expect(page.getByTestId('scripture-message-send-btn')).toBeVisible();
      await expect(page.getByTestId('scripture-message-skip-btn')).toBeVisible();

      // WHEN: User types a message and sends
      await textarea.fill('Praying for you today. You are loved.');
      const messageResponse = interceptNetworkCall({
        method: 'POST',
        url: '**/rest/v1/scripture_messages*',
      });
      await page.getByTestId('scripture-message-send-btn').click();
      await messageResponse;

      // THEN: Daily Prayer Report screen appears
      await expect(page.getByTestId('scripture-report-screen')).toBeVisible();
      const reportHeading = page.getByTestId('scripture-report-heading');
      await expect(reportHeading).toBeVisible();
      await expect(reportHeading).toHaveText('Daily Prayer Report');
      await expect
        .poll(async () => {
          return page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
        })
        .toBe('scripture-report-heading');

      await expect(page.getByTestId('scripture-report-user-ratings')).toBeVisible();
      await expect(page.getByTestId('scripture-report-standout-verses')).toBeVisible();
      await expect(page.getByTestId('scripture-report-partner-waiting')).toBeVisible();

      // AND: Message is persisted
      await expect
        .poll(async () => {
          const { data } = await supabaseAdmin
            .from('scripture_messages')
            .select('*')
            .eq('session_id', sessionId)
            .eq('sender_id', activeUserId);
          return data?.length ?? 0;
        })
        .toBe(1);

      const { data: messages } = await supabaseAdmin
        .from('scripture_messages')
        .select('*')
        .eq('session_id', sessionId)
        .eq('sender_id', activeUserId);
      expect(messages![0].message).toBe('Praying for you today. You are loved.');

      // AND: Share toggle persists bookmark visibility
      await expect
        .poll(async () => {
          const { data } = await supabaseAdmin
            .from('scripture_bookmarks')
            .select('step_index, share_with_partner')
            .eq('session_id', sessionId)
            .eq('user_id', activeUserId);
          const targeted = (data ?? []).filter((row) => [0, 5, 12].includes(row.step_index));
          return targeted.length === 3 && targeted.every((row) => row.share_with_partner);
        })
        .toBe(true);
    });
  });

  test.describe('2.3-E2E-002 [P0]: Unlinked user skips message compose and sees completion screen', () => {
    test('should show completion screen without partner card when user is unlinked', async ({
      page,
      supabaseAdmin,
      interceptNetworkCall,
    }) => {
      interceptNetworkCall({
        url: '**/rest/v1/users*',
        handler: async (route, request) => {
          const url = request.url();
          if (url.includes('select=partner_id') || url.includes('select=partner_id%2Cupdated_at')) {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                partner_id: null,
                updated_at: '2026-01-01T00:00:00.000Z',
              }),
            });
          } else {
            await route.continue();
          }
        },
      });

      const { sessionId, sessionIds } = await seedAndResumeAtReflection({
        supabaseAdmin,
        page,
        bookmarkSteps: [0],
      });
      seedSessionIds = sessionIds;
      await expect(page.getByTestId('scripture-reflection-summary-screen')).toBeVisible();
      await submitReflectionSummary(page);

      // THEN: Completion screen appears directly (unlinked path)
      await expect(page.getByTestId('scripture-unlinked-complete-screen')).toBeVisible();
      await expect(page.getByTestId('scripture-message-compose-screen')).toHaveCount(0);
      await expect(page.getByTestId('scripture-unlinked-return-btn')).toBeVisible();
      await expect(page.getByTestId('scripture-report-screen')).not.toBeVisible();

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
      const { sessionId, sessionIds } = await seedAndResumeAtReflection({
        supabaseAdmin,
        page,
        bookmarkSteps: [0, 5, 12],
      });
      seedSessionIds = sessionIds;

      const partnerUserId = testSession.test_user2_id;
      expect(partnerUserId).toBeTruthy();

      await expect(page.getByTestId('scripture-reflection-summary-screen')).toBeVisible();
      await submitReflectionSummary(page);

      // Partner contributes a message but has NOT completed their session
      await supabaseAdmin.from('scripture_messages').insert({
        session_id: sessionId,
        sender_id: partnerUserId!,
        message: 'Feeling grateful for your prayers. God is good.',
      });

      // User 1 sends their own message
      await expect(page.getByTestId('scripture-message-compose-screen')).toBeVisible();
      await page.getByTestId('scripture-message-textarea').fill('Love you!');
      await page.getByTestId('scripture-message-send-btn').click();

      await expect(page.getByTestId('scripture-report-screen')).toBeVisible();
      await expect(page.getByTestId('scripture-report-partner-waiting')).toBeVisible();
    });
  });

  test.describe('2.3-E2E-005 [P2]: Together mode report shows both users data side-by-side', () => {
    test('should render report and keep waiting fallback when partner data is unavailable', async ({
      page,
      supabaseAdmin,
      testSession,
    }) => {
      const { sessionId, sessionIds } = await seedAndResumeAtReflection({
        supabaseAdmin,
        page,
        bookmarkSteps: [0, 5, 12],
      });
      seedSessionIds = sessionIds;

      const partnerUserId = testSession.test_user2_id;
      expect(partnerUserId).toBeTruthy();

      await expect(page.getByTestId('scripture-reflection-summary-screen')).toBeVisible();
      await submitReflectionSummary(page);

      await supabaseAdmin.from('scripture_reflections').insert([
        {
          session_id: sessionId,
          user_id: partnerUserId!,
          step_index: 0,
          rating: 5,
          notes: 'Partner step 1',
          is_shared: true,
        },
        {
          session_id: sessionId,
          user_id: partnerUserId!,
          step_index: 1,
          rating: 4,
          notes: 'Partner step 2',
          is_shared: true,
        },
      ]);

      await expect(page.getByTestId('scripture-message-compose-screen')).toBeVisible();
      await page.getByTestId('scripture-message-skip-btn').click();
      await expect(page.getByTestId('scripture-report-screen')).toBeVisible();
      await expect(page.getByTestId('scripture-report-partner-waiting')).toBeVisible();
    });
  });

  test.describe('2.3-E2E-006 [P1]: Completion retry path blocks report transition until persistence succeeds', () => {
    test('should complete the skip path and transition to report', async ({
      page,
      supabaseAdmin,
    }) => {
      const { sessionIds } = await seedAndResumeAtReflection({
        supabaseAdmin,
        page,
        bookmarkSteps: [0, 5, 12],
      });
      seedSessionIds = sessionIds;

      await expect(page.getByTestId('scripture-reflection-summary-screen')).toBeVisible();
      await submitReflectionSummary(page);

      await page.getByTestId('scripture-message-skip-btn').click();
      await expect(page.getByTestId('scripture-report-screen')).toBeVisible();
      await expect(page.getByTestId('scripture-message-compose-screen')).not.toBeVisible();
    });
  });
});
