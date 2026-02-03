/**
 * P0/P1 API: Scripture Reading - Reflection & Bookmark API Tests
 *
 * Story 2.1: Per-Step Reflection System
 * Tests reflection upsert idempotency, field persistence, and bookmark toggle.
 *
 * Test IDs: 2.1-API-001 (P0), plus supporting P0/P1 scenarios
 * Risk Links: R2-002 (idempotency constraint), R2-005 (bookmark toggle)
 *
 * TDD Phase: RED — all tests use test.skip() pending implementation
 */
import { test, expect } from '../support/merged-fixtures';
import type { SeedResult } from '../support/factories';
import { createTestSession, cleanupTestSession } from '../support/factories';
import { createClient } from '@supabase/supabase-js';

/**
 * Helper: Create a Supabase client authenticated as a specific user.
 * Uses service role to look up user, then signs in with test credentials.
 */
async function createUserClient(
  supabaseAdmin: Parameters<typeof createTestSession>[0],
  userId: string
) {
  const { data: sessionData, error: sessionError } =
    await supabaseAdmin.auth.admin.getUserById(userId);

  if (sessionError || !sessionData?.user) {
    throw new Error(`Failed to get user ${userId}: ${sessionError?.message}`);
  }

  const url = process.env.SUPABASE_URL!;
  const anonKey = process.env.SUPABASE_ANON_KEY!;
  const userClient = createClient(url, anonKey);

  const { error: signInError } = await userClient.auth.signInWithPassword({
    email: sessionData.user.email!,
    password: 'test-password-123',
  });

  if (signInError) {
    throw new Error(`Failed to sign in as ${userId}: ${signInError.message}`);
  }

  return userClient;
}

/** Generate a dynamic reflection note for test isolation. */
function generateReflectionNote(prefix = 'test'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-reflection-${timestamp}-${random}`;
}

/** Generate a dynamic rating (1-5) for test isolation. */
function generateRating(): number {
  return Math.floor(Math.random() * 5) + 1;
}

test.describe('Scripture Reflection API - Story 2.1', () => {
  // ============================================
  // 2.1-API-001: Reflection Upsert Idempotency
  // Risk: R2-002 (Score: 6)
  // ============================================
  test.describe('2.1-API-001: Reflection upsert idempotency', () => {
    test('[P0] duplicate reflection submit returns success with updated data', async ({
      supabaseAdmin,
    }) => {
      test.skip();

      // GIVEN: A session exists with a member user
      const seedResult = await createTestSession(supabaseAdmin, {
        preset: 'mid_session',
      });
      const sessionId = seedResult.session_ids[0];
      const userId = seedResult.test_user1_id;
      const userClient = await createUserClient(supabaseAdmin, userId);

      const stepIndex = 2;
      const firstNote = generateReflectionNote('first');
      const firstRating = 3;
      const secondNote = generateReflectionNote('second');
      const secondRating = 5;

      try {
        // WHEN: User submits a reflection for a specific step
        const { data: firstResult, error: firstError } = await userClient.rpc(
          'scripture_submit_reflection',
          {
            p_session_id: sessionId,
            p_step_index: stepIndex,
            p_rating: firstRating,
            p_notes: firstNote,
            p_is_shared: false,
          }
        );

        // THEN: First submission succeeds
        expect(firstError).toBeNull();
        expect(firstResult).toBeTruthy();
        const firstData = firstResult as Record<string, unknown>;
        expect(firstData.rating).toBe(firstRating);
        expect(firstData.notes).toBe(firstNote);

        // WHEN: User submits again for the SAME (session_id, step_index)
        const { data: secondResult, error: secondError } = await userClient.rpc(
          'scripture_submit_reflection',
          {
            p_session_id: sessionId,
            p_step_index: stepIndex,
            p_rating: secondRating,
            p_notes: secondNote,
            p_is_shared: true,
          }
        );

        // THEN: Second submission also succeeds (upsert, not rejection)
        expect(secondError).toBeNull();
        expect(secondResult).toBeTruthy();
        const secondData = secondResult as Record<string, unknown>;
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
    }) => {
      test.skip();

      // GIVEN: A session exists with a member user
      const seedResult = await createTestSession(supabaseAdmin, {
        preset: 'mid_session',
      });
      const sessionId = seedResult.session_ids[0];
      const userId = seedResult.test_user1_id;
      const userClient = await createUserClient(supabaseAdmin, userId);

      const stepIndex = 4;
      const rating = generateRating();
      const notes = generateReflectionNote('persist');
      const isShared = true;

      try {
        // WHEN: User submits a reflection with all fields populated
        const { data: rpcResult, error: rpcError } = await userClient.rpc(
          'scripture_submit_reflection',
          {
            p_session_id: sessionId,
            p_step_index: stepIndex,
            p_rating: rating,
            p_notes: notes,
            p_is_shared: isShared,
          }
        );

        expect(rpcError).toBeNull();
        expect(rpcResult).toBeTruthy();

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
        const rpcData = rpcResult as Record<string, unknown>;
        expect(rpcData.id).toBe(dbRow!.id);
        expect(rpcData.session_id).toBe(dbRow!.session_id);
        expect(rpcData.step_index).toBe(dbRow!.step_index);
        expect(rpcData.user_id).toBe(dbRow!.user_id);
        expect(rpcData.rating).toBe(dbRow!.rating);
        expect(rpcData.notes).toBe(dbRow!.notes);
        expect(rpcData.is_shared).toBe(dbRow!.is_shared);
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
    }) => {
      test.skip();

      // GIVEN: A session exists with a member user
      const seedResult = await createTestSession(supabaseAdmin, {
        preset: 'mid_session',
      });
      const sessionId = seedResult.session_ids[0];
      const userId = seedResult.test_user1_id;
      const userClient = await createUserClient(supabaseAdmin, userId);

      const stepIndex = 6;

      try {
        // WHEN: User creates a bookmark (insert)
        const { data: insertData, error: insertError } = await userClient
          .from('scripture_bookmarks')
          .insert({
            session_id: sessionId,
            step_index: stepIndex,
            user_id: userId,
            share_with_partner: false,
          })
          .select()
          .single();

        // THEN: Bookmark is created successfully
        expect(insertError).toBeNull();
        expect(insertData).toBeTruthy();
        expect(insertData!.session_id).toBe(sessionId);
        expect(insertData!.step_index).toBe(stepIndex);
        expect(insertData!.user_id).toBe(userId);
        expect(insertData!.share_with_partner).toBe(false);
        expect(insertData!.id).toBeTruthy();

        // AND: Bookmark exists in DB (verified via admin)
        const { data: verifyRow, error: verifyError } = await supabaseAdmin
          .from('scripture_bookmarks')
          .select('*')
          .eq('session_id', sessionId)
          .eq('step_index', stepIndex)
          .eq('user_id', userId);

        expect(verifyError).toBeNull();
        expect(verifyRow).toHaveLength(1);
        expect(verifyRow![0].id).toBe(insertData!.id);

        // WHEN: User removes the bookmark (delete)
        const { error: deleteError } = await userClient
          .from('scripture_bookmarks')
          .delete()
          .eq('id', insertData!.id);

        // THEN: Delete succeeds
        expect(deleteError).toBeNull();

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
