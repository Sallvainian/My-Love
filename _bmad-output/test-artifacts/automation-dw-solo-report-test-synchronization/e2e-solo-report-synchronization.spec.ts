/**
 * DW40-E2E-001: Supplemental report-load boundary coverage.
 * The RTL regression remains the direct proof of the waitFor assertion change.
 */
import { log } from '@seontechnologies/playwright-utils';
import { SCRIPTURE_STEPS } from '../../../src/data/scriptureSteps';
import { SupabaseReflectionSchema } from '../../../src/validation/schemas';
import { test, expect } from '../../support/merged-fixtures';
import { createTestSession, cleanupTestSession } from '../../support/factories';
import { createPartnerSessionReflection } from '../../support/factories/solo-report';
import { resumeApiSeededSession } from '../../support/helpers/scripture-overview';

test.describe('Solo report synchronization', () => {
  test('[P1] DW40-E2E-001 replaces partner waiting after report reflections resolve', async ({
    page,
    supabaseAdmin,
    apiRequest,
    interceptNetworkCall,
    recurse,
  }) => {
    const baseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!baseUrl || !serviceRoleKey) throw new Error('Local Supabase fixture configuration missing');

    let releaseReportResponse!: () => void;
    const reportResponseGate = new Promise<void>((resolve) => {
      releaseReportResponse = resolve;
    });
    let sessionIds: string[] = [];

    try {
      // GIVEN: a linked session has a shared partner completion summary.
      await log.step('Seed this worker’s solo session and a shared partner summary');
      // playwright-utils deviation: reuse the worker-scoped Supabase SDK factory and owned-row cleanup.
      const seed = await createTestSession(supabaseAdmin, {
        preset: 'at_reflection',
        bookmarkSteps: [],
        includeReflections: false,
        includeMessages: false,
      });
      sessionIds = seed.session_ids;
      expect(sessionIds).toHaveLength(1);
      const sessionId = sessionIds[0];
      const partnerId = seed.test_user2_id;
      if (!partnerId) throw new Error('The worker pool must provide an already linked partner');
      const partnerReflection = createPartnerSessionReflection(sessionId, partnerId);
      const { status: seedStatus } = await apiRequest({
        method: 'POST',
        baseUrl,
        path: '/rest/v1/scripture_reflections',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Prefer: 'return=minimal',
        },
        body: partnerReflection,
        retryConfig: { maxRetries: 0 },
      });
      expect(seedStatus).toBe(201);

      // playwright-utils deviation: the existing resume helper owns cache clearing and worker isolation via the SDK.
      await resumeApiSeededSession({ supabaseAdmin, sessionId, page });
      const partner = await recurse(
        () => page.evaluate(() => window.__APP_STORE__?.getState().partner ?? null),
        (value) => value?.id === partnerId
      );
      expect(partner?.displayName).toBeTruthy();
      const partnerName = partner!.displayName;
      await expect(page.getByTestId('scripture-reflection-summary-screen')).toBeVisible();
      await page.getByRole('radio', { name: 'Rating 4 of 5', exact: true }).click();

      const summarySaved = interceptNetworkCall({
        method: 'POST',
        url: '**/rest/v1/rpc/scripture_submit_reflection',
      });
      const reportPhaseSaved = interceptNetworkCall({
        method: 'PATCH',
        url: `**/rest/v1/scripture_sessions?*id=eq.${sessionId}*`,
      });
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      expect((await summarySaved).status).toBe(200);
      expect((await reportPhaseSaved).status).toBe(204);
      await recurse(
        () => page.evaluate(() => window.__APP_STORE__?.getState().session ?? null),
        (session) => session?.id === sessionId && session.currentPhase === 'report'
      );
      await expect(page.getByTestId('scripture-message-compose-screen')).toBeVisible();

      // WHEN: report navigation completes while its reflections response is held.
      await log.step('Hold the real report response while the waiting state is visible');
      const reflectionsUrl =
        `**/rest/v1/scripture_reflections?*session_id=eq.${sessionId}*`;
      // Handler mode resolves at request arrival. A separate observer waits for the response.
      const reflectionsResponse = interceptNetworkCall({ method: 'GET', url: reflectionsUrl });
      const reflectionsRequested = interceptNetworkCall({
        method: 'GET',
        url: reflectionsUrl,
        handler: async (route) => {
          const response = await route.fetch();
          await reportResponseGate;
          await route.fulfill({ response });
        },
      });
      const sessionCompleted = interceptNetworkCall({
        method: 'PATCH',
        url: `**/rest/v1/scripture_sessions?*id=eq.${sessionId}*`,
      });

      await page.getByRole('button', { name: 'Skip for now', exact: true }).click();
      const completion = await sessionCompleted;
      expect(completion.status).toBe(204);
      expect(completion.requestJson).toMatchObject({
        current_phase: 'complete',
        status: 'complete',
      });
      await recurse(
        () => page.evaluate(() => window.__APP_STORE__?.getState().session ?? null),
        (session) => session?.id === sessionId && session.currentPhase === 'complete'
      );
      await reflectionsRequested;
      const report = page.getByTestId('scripture-report-screen');
      const waiting = report.getByTestId('scripture-report-partner-waiting');
      await expect(report).toBeVisible();
      await expect(waiting).toHaveText(`Waiting for ${partnerName}'s reflections`);
      await expect(waiting).toBeVisible();

      // THEN: releasing the response replaces waiting with the partner's standout verse.
      await log.step('Release reflections and verify the settled partner report');
      releaseReportResponse();
      const loaded = await reflectionsResponse;
      expect(loaded.status).toBe(200);
      const reflections = SupabaseReflectionSchema.array().parse(loaded.responseJson);
      expect(reflections).toEqual(expect.arrayContaining([expect.objectContaining(partnerReflection)]));
      // Report data lives in useReportPhase, so the loaded UI is the final state signal.
      await expect(report).toBeVisible();
      await expect(waiting).toHaveCount(0);
      const partnerStandouts = report.getByTestId('scripture-report-partner-standout-verses');
      await expect(partnerStandouts).toBeVisible();
      await expect(partnerStandouts).toContainText(`${partnerName}'s Standout Verses`);
      await expect(partnerStandouts.getByText(SCRIPTURE_STEPS[0].verseReference, { exact: true }))
        .toBeVisible();
    } finally {
      releaseReportResponse();
      // playwright-utils deviation: established SDK cleanup deletes only this test’s session IDs.
      await cleanupTestSession(supabaseAdmin, sessionIds);
    }
  });
});
