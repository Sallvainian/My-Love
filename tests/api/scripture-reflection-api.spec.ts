/**
 * P0/P1 API: Scripture Reading - Reflection & Bookmark API Tests
 *
 * Story 2.1: Per-Step Reflection System
 * Tests reflection upsert idempotency, field persistence, and bookmark toggle.
 *
 * Test IDs: 2.1-API-001 (P0), plus supporting P0/P1 scenarios
 * Risk Links: R2-002 (idempotency constraint), R2-005 (bookmark toggle)
 *
 * TDD Phase: GREEN — all tests activated, implementation complete
 */
import { test, expect } from '../support/merged-fixtures';
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

// ============================================================
// Story 2.2: End-of-Session Reflection Summary — API Tests
// TDD Phase: GREEN — all tests activated
// ============================================================

test.describe('Scripture Reflection API - Story 2.2', () => {
  // ============================================
  // 2.2-API-001: Session-level reflection persistence
  // Risk: Reuses existing RPC with sentinel stepIndex
  // ============================================
  test.describe('2.2-API-001: Session-level reflection with stepIndex 17 sentinel', () => {
    test('[P0] session-level reflection persists with JSON standoutVerses in notes field', async ({
      supabaseAdmin,
    }) => {
      // GIVEN: A session exists with a member user
      const seedResult = await createTestSession(supabaseAdmin, {
        preset: 'mid_session',
      });
      const sessionId = seedResult.session_ids[0];
      const userId = seedResult.test_user1_id;
      const userClient = await createUserClient(supabaseAdmin, userId);

      const sessionStepIndex = 17; // MAX_STEPS sentinel for session-level reflection
      const sessionRating = generateRating();
      const standoutVerses = [0, 5, 12];
      const userNote = generateReflectionNote('session-summary');
      const jsonNotes = JSON.stringify({ standoutVerses, userNote });

      try {
        // WHEN: User submits a session-level reflection via RPC with p_step_index: 17
        const { data: rpcResult, error: rpcError } = await userClient.rpc(
          'scripture_submit_reflection',
          {
            p_session_id: sessionId,
            p_step_index: sessionStepIndex,
            p_rating: sessionRating,
            p_notes: jsonNotes,
            p_is_shared: false,
          }
        );

        // THEN: RPC returns success
        expect(rpcError).toBeNull();
        expect(rpcResult).toBeTruthy();
        const rpcData = rpcResult as Record<string, unknown>;
        expect(rpcData.step_index).toBe(sessionStepIndex);
        expect(rpcData.rating).toBe(sessionRating);

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
        expect(rpcData.id).toBe(dbRow!.id);
        expect(rpcData.session_id).toBe(dbRow!.session_id);
        expect(rpcData.notes).toBe(dbRow!.notes);
      } finally {
        // Cleanup
        await cleanupTestSession(supabaseAdmin, seedResult.session_ids);
      }
    });

    test('[P1] session-level reflection (stepIndex 17) coexists with per-step reflections under unique constraint', async ({
      supabaseAdmin,
    }) => {
      // GIVEN: A session exists with a member user
      const seedResult = await createTestSession(supabaseAdmin, {
        preset: 'mid_session',
      });
      const sessionId = seedResult.session_ids[0];
      const userId = seedResult.test_user1_id;
      const userClient = await createUserClient(supabaseAdmin, userId);

      const perStepIndex = 2;
      const perStepRating = generateRating();
      const perStepNote = generateReflectionNote('per-step');

      const sessionStepIndex = 17; // MAX_STEPS sentinel
      const sessionRating = generateRating();
      const standoutVerses = [3, 10];
      const sessionJsonNotes = JSON.stringify({
        standoutVerses,
        userNote: generateReflectionNote('session-coexist'),
      });

      try {
        // WHEN: User submits a per-step reflection for step 2
        const { data: perStepResult, error: perStepError } = await userClient.rpc(
          'scripture_submit_reflection',
          {
            p_session_id: sessionId,
            p_step_index: perStepIndex,
            p_rating: perStepRating,
            p_notes: perStepNote,
            p_is_shared: false,
          }
        );

        expect(perStepError).toBeNull();
        expect(perStepResult).toBeTruthy();

        // AND: User submits a session-level reflection with stepIndex 17
        const { data: sessionResult, error: sessionError } = await userClient.rpc(
          'scripture_submit_reflection',
          {
            p_session_id: sessionId,
            p_step_index: sessionStepIndex,
            p_rating: sessionRating,
            p_notes: sessionJsonNotes,
            p_is_shared: false,
          }
        );

        // THEN: Both submissions succeed
        expect(sessionError).toBeNull();
        expect(sessionResult).toBeTruthy();

        // AND: Both reflections exist in the database as separate rows
        const { data: allReflections, error: queryError } = await supabaseAdmin
          .from('scripture_reflections')
          .select('*')
          .eq('session_id', sessionId)
          .eq('user_id', userId)
          .order('step_index', { ascending: true });

        expect(queryError).toBeNull();
        expect(allReflections).toBeTruthy();

        // AND: Per-step reflection at step 2 is intact
        const perStepRow = allReflections!.find((r) => r.step_index === perStepIndex);
        expect(perStepRow).toBeTruthy();
        expect(perStepRow!.rating).toBe(perStepRating);
        expect(perStepRow!.notes).toBe(perStepNote);

        // AND: Session-level reflection at step 17 is intact
        const sessionRow = allReflections!.find((r) => r.step_index === sessionStepIndex);
        expect(sessionRow).toBeTruthy();
        expect(sessionRow!.step_index).toBe(17);
        expect(sessionRow!.rating).toBe(sessionRating);
        expect(sessionRow!.notes).toBe(sessionJsonNotes);

        // AND: The two reflections have different IDs (separate rows)
        expect(perStepRow!.id).not.toBe(sessionRow!.id);

        // AND: Unique constraint allows both because step_index differs (2 vs 17)
        const perStepData = perStepResult as Record<string, unknown>;
        const sessionData = sessionResult as Record<string, unknown>;
        expect(perStepData.step_index).toBe(2);
        expect(sessionData.step_index).toBe(17);
      } finally {
        // Cleanup
        await cleanupTestSession(supabaseAdmin, seedResult.session_ids);
      }
    });

    test('[P1] session-level reflection upsert overwrites previous submission (idempotent)', async ({
      supabaseAdmin,
    }) => {
      // GIVEN: A session exists with a member user
      const seedResult = await createTestSession(supabaseAdmin, {
        preset: 'mid_session',
      });
      const sessionId = seedResult.session_ids[0];
      const userId = seedResult.test_user1_id;
      const userClient = await createUserClient(supabaseAdmin, userId);

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
        const { error: firstError } = await userClient.rpc(
          'scripture_submit_reflection',
          {
            p_session_id: sessionId,
            p_step_index: sessionStepIndex,
            p_rating: firstRating,
            p_notes: firstNotes,
            p_is_shared: false,
          }
        );
        expect(firstError).toBeNull();

        // AND: User submits again with updated data (same session_id + step_index)
        const { data: secondResult, error: secondError } = await userClient.rpc(
          'scripture_submit_reflection',
          {
            p_session_id: sessionId,
            p_step_index: sessionStepIndex,
            p_rating: secondRating,
            p_notes: secondNotes,
            p_is_shared: false,
          }
        );

        // THEN: Second submission succeeds (upsert)
        expect(secondError).toBeNull();
        expect(secondResult).toBeTruthy();
        const rpcData = secondResult as Record<string, unknown>;
        expect(rpcData.rating).toBe(secondRating);

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

// ============================================================
// Story 2.3: Daily Prayer Report — Send & View — API Tests
// TDD Phase: RED — tests will fail until feature is implemented
// ============================================================

test.describe('Scripture Reflection API - Story 2.3', () => {
  // ============================================
  // 2.3-API-001: Message write persists to scripture_messages table
  // Validates: Direct table insert for partner messages
  // ============================================
  test.describe('2.3-API-001: Message write persists to scripture_messages table', () => {
    test('[P0] linked user can insert a message and all fields are correctly persisted', async ({
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

      const messageText = `Prayer for you today — ${generateReflectionNote('msg')}`;

      try {
        // WHEN: User inserts a message into scripture_messages via direct table insert
        const { data: insertData, error: insertError } = await userClient
          .from('scripture_messages')
          .insert({
            session_id: sessionId,
            sender_id: userId,
            message: messageText,
          })
          .select()
          .single();

        // THEN: Message is persisted successfully
        expect(insertError).toBeNull();
        expect(insertData).toBeTruthy();

        // AND: All fields are correct
        expect(insertData!.session_id).toBe(sessionId);
        expect(insertData!.sender_id).toBe(userId);
        expect(insertData!.message).toBe(messageText);

        // AND: id and created_at are auto-populated
        expect(insertData!.id).toBeTruthy();
        expect(typeof insertData!.id).toBe('string');
        expect(insertData!.created_at).toBeTruthy();

        // AND: Verify via admin query that the row exists in DB
        const { data: dbRow, error: queryError } = await supabaseAdmin
          .from('scripture_messages')
          .select('*')
          .eq('id', insertData!.id)
          .single();

        expect(queryError).toBeNull();
        expect(dbRow).toBeTruthy();
        expect(dbRow!.session_id).toBe(sessionId);
        expect(dbRow!.sender_id).toBe(userId);
        expect(dbRow!.message).toBe(messageText);
        expect(dbRow!.created_at).toBeTruthy();

        // AND: RLS allowed insert because user is session member AND sender
        // (if RLS blocked it, insertError would be non-null above)
      } finally {
        // Cleanup
        await cleanupTestSession(supabaseAdmin, seedResult.session_ids);
      }
    });
  });

  // ============================================
  // 2.3-API-002: Session completion sets status and completedAt
  // Validates: Session lifecycle from in_progress to complete
  // ============================================
  test.describe('2.3-API-002: Session completion sets status=complete and completedAt', () => {
    test('[P0] updating session to complete persists status and completedAt in database', async ({
      supabaseAdmin,
    }) => {
      test.skip();

      // GIVEN: A session exists in 'in_progress' status
      const seedResult = await createTestSession(supabaseAdmin, {
        preset: 'mid_session',
      });
      const sessionId = seedResult.session_ids[0];
      const userId = seedResult.test_user1_id;
      const userClient = await createUserClient(supabaseAdmin, userId);

      try {
        // Verify pre-condition: session is currently 'in_progress'
        const { data: beforeRow, error: beforeError } = await supabaseAdmin
          .from('scripture_sessions')
          .select('status, completed_at')
          .eq('id', sessionId)
          .single();

        expect(beforeError).toBeNull();
        expect(beforeRow).toBeTruthy();
        expect(beforeRow!.status).toBe('in_progress');
        expect(beforeRow!.completed_at).toBeNull();

        // WHEN: Session is updated with status='complete' and completed_at timestamp
        const completedAt = new Date().toISOString();
        const { data: updateData, error: updateError } = await userClient
          .from('scripture_sessions')
          .update({
            status: 'complete',
            completed_at: completedAt,
          })
          .eq('id', sessionId)
          .select()
          .single();

        // THEN: Update succeeds
        expect(updateError).toBeNull();
        expect(updateData).toBeTruthy();

        // AND: Database reflects status='complete' and completed_at is set
        const { data: afterRow, error: afterError } = await supabaseAdmin
          .from('scripture_sessions')
          .select('status, completed_at')
          .eq('id', sessionId)
          .single();

        expect(afterError).toBeNull();
        expect(afterRow).toBeTruthy();
        expect(afterRow!.status).toBe('complete');
        expect(afterRow!.completed_at).toBeTruthy();

        // AND: completed_at is a valid timestamp close to what we set
        const dbCompletedAt = new Date(afterRow!.completed_at as string);
        const expectedCompletedAt = new Date(completedAt);
        const timeDiffMs = Math.abs(dbCompletedAt.getTime() - expectedCompletedAt.getTime());
        expect(timeDiffMs).toBeLessThan(5000); // within 5 seconds
      } finally {
        // Cleanup
        await cleanupTestSession(supabaseAdmin, seedResult.session_ids);
      }
    });
  });
});
