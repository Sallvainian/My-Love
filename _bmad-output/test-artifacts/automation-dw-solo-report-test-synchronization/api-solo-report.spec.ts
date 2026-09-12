/**
 * DW40 supporting API contract: shared partner summaries remain visible to
 * the authenticated solo-session owner. Component waiting remains covered
 * by SoloReadingFlow.test.tsx; this test does not prove Vitest scheduling.
 *
 * Source: scripture_reflections_select in 20260128000001_scripture_reading.sql;
 * is_scripture_session_member in 20260221000001_fix_function_search_paths.sql.
 */
import { log } from '@seontechnologies/playwright-utils';
import { z } from 'zod';
import { MAX_STEPS } from '../../src/data/scriptureSteps';
import { SupabaseReflectionSchema } from '../../src/validation/schemas';
import { test, expect } from '../support/merged-fixtures';
import { createTestSession, cleanupTestSession } from '../support/factories';
import { createPartnerSessionReflection } from '../support/factories/solo-report';

test.describe('Solo report partner completion contract', () => {
  test('[P2] DW40-API-001: session owner reads shared partner summary with a null rating', async ({
    supabaseAdmin,
    apiRequest,
    authToken,
  }) => {
    // GIVEN: a shared partner summary belongs to this worker's solo session.
    await log.step('Seed a solo session owned by this authenticated worker');
    // playwright-utils deviation: reuse worker-scoped admin seed/cleanup helpers for fixture setup.
    const seed = await createTestSession(supabaseAdmin, { preset: 'at_reflection' });
    try {
      const sessionId = seed.session_ids[0];
      const partnerId = seed.test_user2_id;
      if (!partnerId) throw new Error('The worker pool must provide a linked partner');
      expect(partnerId).not.toBe(seed.test_user1_id);
      const partnerReflection = createPartnerSessionReflection(sessionId, partnerId);

      // playwright-utils deviation: admin insert arranges the report payload; the asserted read uses authToken.
      const { error } = await supabaseAdmin
        .from('scripture_reflections')
        .insert(partnerReflection);
      expect(error).toBeNull();

      // authToken and createTestSession both use the normalized TEST_WORKER_INDEX identity.
      // WHEN: the authenticated owner reads report reflections.
      await log.step('Read the shared summary with the session owner token');
      const { status, body } = await apiRequest({
        method: 'GET',
        path: `/rest/v1/scripture_reflections?session_id=eq.${sessionId}&select=*`,
        headers: { Authorization: `Bearer ${authToken}` },
      }).validateSchema<z.infer<typeof SupabaseReflectionSchema>[]>(
        z.array(SupabaseReflectionSchema)
      );

      // THEN: the completion sentinel and unrated summary survive the member read.
      expect(status).toBe(200);
      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({
        id: partnerReflection.id,
        session_id: sessionId,
        user_id: partnerId,
        step_index: MAX_STEPS,
        rating: null,
        is_shared: true,
        notes: JSON.stringify({ standoutVerses: [0] }),
      });
    } finally {
      await cleanupTestSession(supabaseAdmin, seed.session_ids);
    }
  });
});
