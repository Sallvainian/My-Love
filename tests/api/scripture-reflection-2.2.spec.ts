/**
 * P0/P1 API: Scripture Reading - Story 2.2 End-of-Session Reflection
 *
 * Tests session-level reflection persistence with JSON standoutVerses,
 * coexistence of step-level and session-level reflections, and upsert idempotency.
 *
 * TDD Phase: GREEN — all tests activated
 */
import { test, expect } from '../support/merged-fixtures';
import { createTestSession, cleanupTestSession } from '../support/factories';
import { getUserAccessToken } from '../support/helpers/supabase';
import { faker } from '@faker-js/faker';
import { z } from 'zod';
import { SupabaseReflectionSchema } from '../../src/validation/schemas';

/** Generate a dynamic reflection note for test isolation. */
function generateReflectionNote(prefix = 'test'): string {
  return `${prefix}-${faker.lorem.sentence()}`;
}

/** Generate a dynamic rating (1-5) for test isolation. */
function generateRating(): number {
  return faker.number.int({ min: 1, max: 5 });
}

test.describe('Scripture Reflection API - Story 2.2', () => {
  // ============================================
  // 2.2-API-001: Session-level reflection persistence
  // Risk: Reuses existing RPC with sentinel stepIndex
  // ============================================
  test.describe('2.2-API-001: Session-level reflection with stepIndex 17 sentinel', () => {
    test('[P0] session-level reflection persists with JSON standoutVerses in notes field', async ({
      supabaseAdmin,
      apiRequest,
    }) => {
      // GIVEN: A session exists with a member user
      const seedResult = await createTestSession(supabaseAdmin, {
        preset: 'mid_session',
      });
      const sessionId = seedResult.session_ids[0];
      const userId = seedResult.test_user1_id;
      const userToken = await getUserAccessToken(supabaseAdmin, userId);

      const sessionStepIndex = 17; // MAX_STEPS sentinel for session-level reflection
      const sessionRating = generateRating();
      const standoutVerses = [0, 5, 12];
      const userNote = generateReflectionNote('session-summary');
      const jsonNotes = JSON.stringify({ standoutVerses, userNote });

      try {
        // WHEN: User submits a session-level reflection via RPC with p_step_index: 17
        const response = await apiRequest({
          method: 'POST',
          path: '/rest/v1/rpc/scripture_submit_reflection',
          headers: { Authorization: `Bearer ${userToken}` },
          body: {
            p_session_id: sessionId,
            p_step_index: sessionStepIndex,
            p_rating: sessionRating,
            p_notes: jsonNotes,
            p_is_shared: false,
          },
        }).validateSchema<z.infer<typeof SupabaseReflectionSchema>>(SupabaseReflectionSchema);

        // THEN: RPC returns success
        expect(response.status).toBe(200);
        expect(response.body).toBeTruthy();
        expect(response.body.step_index).toBe(sessionStepIndex);
        expect(response.body.rating).toBe(sessionRating);

        // AND: Query DB directly via admin to verify persisted fields
        const { data: dbRow, error: queryError } = await supabaseAdmin
          .from('scripture_reflections')
          .select('*')
          .eq('session_id', sessionId)
          .eq('step_index', sessionStepIndex)
          .eq('user_id', userId)
          .single();

        expect(queryError).toBeNull();
        expect(dbRow).toBeTruthy();

        // AND: step_index is 17 (MAX_STEPS sentinel)
        expect(dbRow!.step_index).toBe(17);

        // AND: rating is persisted
        expect(dbRow!.rating).toBe(sessionRating);

        // AND: notes field contains valid JSON with standoutVerses array
        expect(dbRow!.notes).toBe(jsonNotes);
        const parsedNotes = JSON.parse(dbRow!.notes as string);
        expect(parsedNotes.standoutVerses).toEqual([0, 5, 12]);
        expect(parsedNotes.userNote).toBe(userNote);

        // AND: is_shared is false (session-level reflections are private)
        expect(dbRow!.is_shared).toBe(false);

        // AND: id and created_at are auto-populated
        expect(dbRow!.id).toBeTruthy();
        expect(typeof dbRow!.id).toBe('string');
        expect(dbRow!.created_at).toBeTruthy();

        // AND: RPC return value matches DB state
        expect(response.body.id).toBe(dbRow!.id);
        expect(response.body.session_id).toBe(dbRow!.session_id);
        expect(response.body.notes).toBe(dbRow!.notes);
      } finally {
        // Cleanup
        await cleanupTestSession(supabaseAdmin, seedResult.session_ids);
      }
    });

    test('[P1] reflections at different step indices coexist under unique constraint', async ({
      supabaseAdmin,
      apiRequest,
    }) => {
      // GIVEN: A session exists with a member user
      const seedResult = await createTestSession(supabaseAdmin, {
        preset: 'mid_session',
      });
      const sessionId = seedResult.session_ids[0];
      const userId = seedResult.test_user1_id;
      const userToken = await getUserAccessToken(supabaseAdmin, userId);

      const firstStepIndex = 2;
      const firstStepRating = generateRating();
      const firstStepNote = generateReflectionNote('step-2');

      const sessionStepIndex = 17; // MAX_STEPS sentinel
      const sessionRating = generateRating();
      const standoutVerses = [3, 10];
      const sessionJsonNotes = JSON.stringify({
        standoutVerses,
        userNote: generateReflectionNote('session-coexist'),
      });

      try {
        // WHEN: User submits a reflection for step 2
        const firstStepResponse = await apiRequest({
          method: 'POST',
          path: '/rest/v1/rpc/scripture_submit_reflection',
          headers: { Authorization: `Bearer ${userToken}` },
          body: {
            p_session_id: sessionId,
            p_step_index: firstStepIndex,
            p_rating: firstStepRating,
            p_notes: firstStepNote,
            p_is_shared: false,
          },
        }).validateSchema<z.infer<typeof SupabaseReflectionSchema>>(SupabaseReflectionSchema);

        expect(firstStepResponse.status).toBe(200);
        expect(firstStepResponse.body).toBeTruthy();

        // AND: User submits a session-level reflection with stepIndex 17
        const sessionResponse = await apiRequest({
          method: 'POST',
          path: '/rest/v1/rpc/scripture_submit_reflection',
          headers: { Authorization: `Bearer ${userToken}` },
          body: {
            p_session_id: sessionId,
            p_step_index: sessionStepIndex,
            p_rating: sessionRating,
            p_notes: sessionJsonNotes,
            p_is_shared: false,
          },
        }).validateSchema<z.infer<typeof SupabaseReflectionSchema>>(SupabaseReflectionSchema);

        // THEN: Both submissions succeed
        expect(sessionResponse.status).toBe(200);
        expect(sessionResponse.body).toBeTruthy();

        // AND: Both reflections exist in the database as separate rows
        const { data: allReflections, error: queryError } = await supabaseAdmin
          .from('scripture_reflections')
          .select('*')
          .eq('session_id', sessionId)
          .eq('user_id', userId)
          .order('step_index', { ascending: true });

        expect(queryError).toBeNull();
        expect(allReflections).toBeTruthy();

        // AND: Reflection at step 2 is intact
        const firstStepRow = allReflections!.find((r) => r.step_index === firstStepIndex);
        expect(firstStepRow).toBeTruthy();
        expect(firstStepRow!.rating).toBe(firstStepRating);
        expect(firstStepRow!.notes).toBe(firstStepNote);

        // AND: Session-level reflection at step 17 is intact
        const sessionRow = allReflections!.find((r) => r.step_index === sessionStepIndex);
        expect(sessionRow).toBeTruthy();
        expect(sessionRow!.step_index).toBe(17);
        expect(sessionRow!.rating).toBe(sessionRating);
        expect(sessionRow!.notes).toBe(sessionJsonNotes);

        // AND: The two reflections have different IDs (separate rows)
        expect(firstStepRow!.id).not.toBe(sessionRow!.id);

        // AND: Unique constraint allows both because step_index differs (2 vs 17)
        expect(firstStepResponse.body.step_index).toBe(2);
        expect(sessionResponse.body.step_index).toBe(17);
      } finally {
        // Cleanup
        await cleanupTestSession(supabaseAdmin, seedResult.session_ids);
      }
    });

    test('[P1] session-level reflection upsert overwrites previous submission (idempotent)', async ({
      supabaseAdmin,
      apiRequest,
    }) => {
      // GIVEN: A session exists with a member user
      const seedResult = await createTestSession(supabaseAdmin, {
        preset: 'mid_session',
      });
      const sessionId = seedResult.session_ids[0];
      const userId = seedResult.test_user1_id;
      const userToken = await getUserAccessToken(supabaseAdmin, userId);

      const sessionStepIndex = 17;
      const firstRating = 3;
      const firstNotes = JSON.stringify({
        standoutVerses: [0, 5],
        userNote: generateReflectionNote('first-session'),
      });
      const secondRating = 5;
      const secondNotes = JSON.stringify({
        standoutVerses: [0, 5, 12],
        userNote: generateReflectionNote('second-session'),
      });

      try {
        // WHEN: User submits session-level reflection first time
        const firstResponse = await apiRequest({
          method: 'POST',
          path: '/rest/v1/rpc/scripture_submit_reflection',
          headers: { Authorization: `Bearer ${userToken}` },
          body: {
            p_session_id: sessionId,
            p_step_index: sessionStepIndex,
            p_rating: firstRating,
            p_notes: firstNotes,
            p_is_shared: false,
          },
        }).validateSchema<z.infer<typeof SupabaseReflectionSchema>>(SupabaseReflectionSchema);
        expect(firstResponse.status).toBe(200);

        // AND: User submits again with updated data (same session_id + step_index)
        const secondResponse = await apiRequest({
          method: 'POST',
          path: '/rest/v1/rpc/scripture_submit_reflection',
          headers: { Authorization: `Bearer ${userToken}` },
          body: {
            p_session_id: sessionId,
            p_step_index: sessionStepIndex,
            p_rating: secondRating,
            p_notes: secondNotes,
            p_is_shared: false,
          },
        }).validateSchema<z.infer<typeof SupabaseReflectionSchema>>(SupabaseReflectionSchema);

        // THEN: Second submission succeeds (upsert)
        expect(secondResponse.status).toBe(200);
        expect(secondResponse.body).toBeTruthy();
        expect(secondResponse.body.rating).toBe(secondRating);

        // AND: Only ONE session-level reflection exists (not duplicated)
        const { data: dbRows, error: queryError } = await supabaseAdmin
          .from('scripture_reflections')
          .select('*')
          .eq('session_id', sessionId)
          .eq('step_index', sessionStepIndex)
          .eq('user_id', userId);

        expect(queryError).toBeNull();
        expect(dbRows).toHaveLength(1);
        expect(dbRows![0].rating).toBe(secondRating);
        expect(dbRows![0].notes).toBe(secondNotes);
      } finally {
        await cleanupTestSession(supabaseAdmin, seedResult.session_ids);
      }
    });
  });
});
