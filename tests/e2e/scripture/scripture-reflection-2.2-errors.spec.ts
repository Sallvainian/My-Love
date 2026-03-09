/**
 * P2 E2E: Scripture Reading - Reflection Error Injection Tests
 *
 * Story 2.2: Error paths during session completion after reflection summary.
 * Extracted from scripture-reflection-2.2.spec.ts for maintainability.
 *
 * Epic 2, Story 2.2
 */
import { test, expect } from '../../support/merged-fixtures';
import { cleanupTestSession } from '../../support/factories';
import { seedAndResumeAtReflection } from '../../support/helpers/scripture-overview';
import { submitReflectionSummary } from '../../support/helpers';

test.describe(
  'Session completion 500 shows completion error screen',
  { annotation: [{ type: 'skipNetworkMonitoring' }] },
  () => {
    let seedSessionIds: string[] = [];

    test.afterEach(async ({ supabaseAdmin }) => {
      if (seedSessionIds.length > 0) {
        await cleanupTestSession(supabaseAdmin, seedSessionIds);
        seedSessionIds = [];
      }
    });

    test('should show completion error screen when session PATCH fails with 500', async ({
      page,
      supabaseAdmin,
      interceptNetworkCall,
    }) => {
      const { sessionIds } = await seedAndResumeAtReflection({
        supabaseAdmin,
        page,
        bookmarkSteps: [0],
      });
      seedSessionIds = sessionIds;
      await expect(page.getByTestId('scripture-reflection-summary-screen')).toBeVisible();

      await submitReflectionSummary(page);
      await expect(page.getByTestId('scripture-message-compose-screen')).toBeVisible();

      interceptNetworkCall({
        method: 'PATCH',
        url: '**/rest/v1/scripture_sessions*',
        fulfillResponse: { status: 500, body: 'Internal Server Error' },
      });

      await page.getByTestId('scripture-message-skip-btn').click();
      await expect(page.getByTestId('scripture-completion-error-screen')).toBeVisible();
      await expect(page.getByTestId('scripture-completion-retry-btn')).toBeVisible();
    });
  }
);
