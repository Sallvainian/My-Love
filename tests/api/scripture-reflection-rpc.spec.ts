/**
 * P0/P1 API: Scripture Reading - Reflection RPC Validation
 *
 * Tests reflection RPC upsert idempotency, field persistence, and bookmark toggle.
 *
 * Risk Links: R2-002 (idempotency constraint), R2-005 (bookmark toggle)
 */
import { test, expect } from '../support/merged-fixtures';
import { createTestSession, cleanupTestSession } from '../support/factories';
import { getUserAccessToken } from '../support/helpers/supabase';
import { generateReflectionNote, generateRating } from '../support/helpers/reflection';
import { z } from 'zod';
import { SupabaseReflectionSchema, SupabaseBookmarkSchema } from '../../src/validation/schemas';

test.describe('Scripture Reflection API - RPC Validation', () => {
  // ============================================
  // Reflection Upsert Idempotency
  // Risk: R2-002 (Score: 6)
  // ============================================
  test.describe('Reflection upsert idempotency', () => {
    test('[P0] duplicate reflection submit returns success with updated data', async ({
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

      const stepIndex = 2;
      const firstNote = generateReflectionNote('first');
      const firstRating = 3;
      const secondNote = generateReflectionNote('second');
      const secondRating = 5;

      try {
        // WHEN: User submits a reflection for a specific step
        const firstResponse = await apiRequest({
          method: 'POST',
          path: '/rest/v1/rpc/scripture_submit_reflection',
          headers: { Authorization: `Bearer ${userToken}` },
          body: {
            p_session_id: sessionId,
            p_step_index: stepIndex,
            p_rating: firstRating,
            p_notes: firstNote,
            p_is_shared: false,
          },
        });

        // Validate response with Zod schema
        const firstData = SupabaseReflectionSchema.parse(firstResponse.body);

        // THEN: First submission succeeds
        expect(firstResponse.status).toBe(200);
        expect(firstData).toBeTruthy();
        expect(firstData.rating).toBe(firstRating);
        expect(firstData.notes).toBe(firstNote);

        // WHEN: User submits again for the SAME (session_id, step_index)
        const secondResponse = await apiRequest({
          method: 'POST',
          path: '/rest/v1/rpc/scripture_submit_reflection',
          headers: { Authorization: `Bearer ${userToken}` },
          body: {
            p_session_id: sessionId,
            p_step_index: stepIndex,
            p_rating: secondRating,
            p_notes: secondNote,
            p_is_shared: true,
          },
        });

        // Validate response with Zod schema
        const secondData = SupabaseReflectionSchema.parse(secondResponse.body);

        // THEN: Second submission also succeeds (upsert, not rejection)
        expect(secondResponse.status).toBe(200);
        expect(secondData).toBeTruthy();
        expect(secondData.rating).toBe(secondRating);
        expect(secondData.notes).toBe(secondNote);
        expect(secondData.is_shared).toBe(true);

        // AND: Only ONE reflection exists in the database (upsert, not duplicate)
        const { data: dbRows, error: queryError } = await supabaseAdmin
          .from('scripture_reflections')
          .select('*')
          .eq('session_id', sessionId)
          .eq('step_index', stepIndex)
          .eq('user_id', userId);

        expect(queryError).toBeNull();
        expect(dbRows).toHaveLength(1);
        expect(dbRows![0].rating).toBe(secondRating);
        expect(dbRows![0].notes).toBe(secondNote);
        expect(dbRows![0].is_shared).toBe(true);

        // AND: The reflection ID is stable across upserts
        expect(firstData.id).toBe(secondData.id);
      } finally {
        // Cleanup
        await cleanupTestSession(supabaseAdmin, seedResult.session_ids);
      }
    });
  });

  // ============================================
  // Reflection field persistence verification
  // ============================================
  test.describe('Reflection write persists correct fields', () => {
    test('[P0] submitted reflection stores all fields accurately in database', async ({
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

      const stepIndex = 4;
      const rating = generateRating();
      const notes = generateReflectionNote('persist');
      const isShared = true;

      try {
        // WHEN: User submits a reflection with all fields populated
        const response = await apiRequest({
          method: 'POST',
          path: '/rest/v1/rpc/scripture_submit_reflection',
          headers: { Authorization: `Bearer ${userToken}` },
          body: {
            p_session_id: sessionId,
            p_step_index: stepIndex,
            p_rating: rating,
            p_notes: notes,
            p_is_shared: isShared,
          },
        }).validateSchema<z.infer<typeof SupabaseReflectionSchema>>(SupabaseReflectionSchema);

        expect(response.status).toBe(200);
        expect(response.body).toBeTruthy();

        // THEN: Query DB directly via admin to verify persisted fields
        const { data: dbRow, error: queryError } = await supabaseAdmin
          .from('scripture_reflections')
          .select('*')
          .eq('session_id', sessionId)
          .eq('step_index', stepIndex)
          .eq('user_id', userId)
          .single();

        expect(queryError).toBeNull();
        expect(dbRow).toBeTruthy();

        // Verify each field individually (atomic assertions)
        expect(dbRow!.session_id).toBe(sessionId);
        expect(dbRow!.step_index).toBe(stepIndex);
        expect(dbRow!.user_id).toBe(userId);
        expect(dbRow!.rating).toBe(rating);
        expect(dbRow!.notes).toBe(notes);
        expect(dbRow!.is_shared).toBe(isShared);

        // AND: id and created_at are auto-populated
        expect(dbRow!.id).toBeTruthy();
        expect(typeof dbRow!.id).toBe('string');
        expect(dbRow!.created_at).toBeTruthy();

        // AND: RPC return value matches DB state
        expect(response.body.id).toBe(dbRow!.id);
        expect(response.body.session_id).toBe(dbRow!.session_id);
        expect(response.body.step_index).toBe(dbRow!.step_index);
        expect(response.body.user_id).toBe(dbRow!.user_id);
        expect(response.body.rating).toBe(dbRow!.rating);
        expect(response.body.notes).toBe(dbRow!.notes);
        expect(response.body.is_shared).toBe(dbRow!.is_shared);
      } finally {
        // Cleanup
        await cleanupTestSession(supabaseAdmin, seedResult.session_ids);
      }
    });
  });

  // ============================================
  // Bookmark toggle: create and remove
  // Risk: R2-005 (Score: 4)
  // ============================================
  test.describe('Bookmark toggle creates and removes', () => {
    test('[P1] bookmark insert creates row, delete removes it', async ({
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

      const stepIndex = 6;

      try {
        // WHEN: User creates a bookmark (insert)
        const insertResponse = await apiRequest({
          method: 'POST',
          path: '/rest/v1/scripture_bookmarks',
          headers: {
            Authorization: `Bearer ${userToken}`,
            Prefer: 'return=representation',
          },
          body: {
            session_id: sessionId,
            step_index: stepIndex,
            user_id: userId,
            share_with_partner: false,
          },
        }).validateSchema<z.infer<typeof SupabaseBookmarkSchema>[]>(
          z.array(SupabaseBookmarkSchema)
        );

        // THEN: Bookmark is created successfully
        expect(insertResponse.status).toBe(201);
        expect(insertResponse.body).toBeTruthy();
        expect(insertResponse.body[0].session_id).toBe(sessionId);
        expect(insertResponse.body[0].step_index).toBe(stepIndex);
        expect(insertResponse.body[0].user_id).toBe(userId);
        expect(insertResponse.body[0].share_with_partner).toBe(false);
        expect(insertResponse.body[0].id).toBeTruthy();

        // AND: Bookmark exists in DB (verified via admin)
        const { data: verifyRow, error: verifyError } = await supabaseAdmin
          .from('scripture_bookmarks')
          .select('*')
          .eq('session_id', sessionId)
          .eq('step_index', stepIndex)
          .eq('user_id', userId);

        expect(verifyError).toBeNull();
        expect(verifyRow).toHaveLength(1);
        expect(verifyRow![0].id).toBe(insertResponse.body[0].id);

        // WHEN: User removes the bookmark (delete)
        const deleteResponse = await apiRequest({
          method: 'DELETE',
          path: `/rest/v1/scripture_bookmarks?id=eq.${insertResponse.body[0].id}`,
          headers: { Authorization: `Bearer ${userToken}` },
        });

        // THEN: Delete succeeds
        expect(deleteResponse.status).toBe(204);

        // AND: Bookmark no longer exists in DB
        const { data: afterDelete, error: afterDeleteError } = await supabaseAdmin
          .from('scripture_bookmarks')
          .select('*')
          .eq('session_id', sessionId)
          .eq('step_index', stepIndex)
          .eq('user_id', userId);

        expect(afterDeleteError).toBeNull();
        expect(afterDelete).toHaveLength(0);
      } finally {
        // Cleanup
        await cleanupTestSession(supabaseAdmin, seedResult.session_ids);
      }
    });
  });
});
