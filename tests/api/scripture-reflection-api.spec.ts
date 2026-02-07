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
import { getUserAccessToken } from '../support/helpers/supabase';
import { faker } from '@faker-js/faker';
import {
  SupabaseSessionSchema,
  SupabaseReflectionSchema,
  SupabaseBookmarkSchema,
  SupabaseMessageSchema,
} from '../../src/validation/schemas';

/** Generate a dynamic reflection note for test isolation. */
function generateReflectionNote(prefix = 'test'): string {
  return `${prefix}-${faker.lorem.sentence()}`;
}

/** Generate a dynamic rating (1-5) for test isolation. */
function generateRating(): number {
  return faker.number.int({ min: 1, max: 5 });
}

test.describe('Scripture Reflection API - Story 2.1', () => {
  // ============================================
  // 2.1-API-001: Reflection Upsert Idempotency
  // Risk: R2-002 (Score: 6)
  // ============================================
  test.describe('2.1-API-001: Reflection upsert idempotency', () => {
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

      const baseURL = process.env.SUPABASE_URL!;
      const anonKey = process.env.SUPABASE_ANON_KEY!;

      try {
        // WHEN: User submits a reflection for a specific step
        const firstResponse = await apiRequest({
          method: 'POST',
          path: '/rest/v1/rpc/scripture_submit_reflection',
          baseUrl: baseURL,
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${userToken}`,
            'Content-Type': 'application/json',
          },
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
          baseUrl: baseURL,
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${userToken}`,
            'Content-Type': 'application/json',
          },
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

      const baseURL = process.env.SUPABASE_URL!;
      const anonKey = process.env.SUPABASE_ANON_KEY!;

      try {
        // WHEN: User submits a reflection with all fields populated
        const response = await apiRequest({
          method: 'POST',
          path: '/rest/v1/rpc/scripture_submit_reflection',
          baseUrl: baseURL,
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${userToken}`,
            'Content-Type': 'application/json',
          },
          body: {
            p_session_id: sessionId,
            p_step_index: stepIndex,
            p_rating: rating,
            p_notes: notes,
            p_is_shared: isShared,
          },
          responseSchema: SupabaseReflectionSchema,
        });

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

      const baseURL = process.env.SUPABASE_URL!;
      const anonKey = process.env.SUPABASE_ANON_KEY!;

      try {
        // WHEN: User creates a bookmark (insert)
        const insertResponse = await apiRequest({
          method: 'POST',
          path: '/rest/v1/scripture_bookmarks',
          baseUrl: baseURL,
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${userToken}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: {
            session_id: sessionId,
            step_index: stepIndex,
            user_id: userId,
            share_with_partner: false,
          },
          responseSchema: SupabaseBookmarkSchema,
        });

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
          baseUrl: baseURL,
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${userToken}`,
          },
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

      const baseURL = process.env.SUPABASE_URL!;
      const anonKey = process.env.SUPABASE_ANON_KEY!;

      try {
        // WHEN: User submits a session-level reflection via RPC with p_step_index: 17
        const response = await apiRequest({
          method: 'POST',
          path: '/rest/v1/rpc/scripture_submit_reflection',
          baseUrl: baseURL,
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${userToken}`,
            'Content-Type': 'application/json',
          },
          body: {
            p_session_id: sessionId,
            p_step_index: sessionStepIndex,
            p_rating: sessionRating,
            p_notes: jsonNotes,
            p_is_shared: false,
          },
          responseSchema: SupabaseReflectionSchema,
        });

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

    test('[P1] session-level reflection (stepIndex 17) coexists with per-step reflections under unique constraint', async ({
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

      const baseURL = process.env.SUPABASE_URL!;
      const anonKey = process.env.SUPABASE_ANON_KEY!;

      try {
        // WHEN: User submits a per-step reflection for step 2
        const perStepResponse = await apiRequest({
          method: 'POST',
          path: '/rest/v1/rpc/scripture_submit_reflection',
          baseUrl: baseURL,
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${userToken}`,
            'Content-Type': 'application/json',
          },
          body: {
            p_session_id: sessionId,
            p_step_index: perStepIndex,
            p_rating: perStepRating,
            p_notes: perStepNote,
            p_is_shared: false,
          },
          responseSchema: SupabaseReflectionSchema,
        });

        expect(perStepResponse.status).toBe(200);
        expect(perStepResponse.body).toBeTruthy();

        // AND: User submits a session-level reflection with stepIndex 17
        const sessionResponse = await apiRequest({
          method: 'POST',
          path: '/rest/v1/rpc/scripture_submit_reflection',
          baseUrl: baseURL,
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${userToken}`,
            'Content-Type': 'application/json',
          },
          body: {
            p_session_id: sessionId,
            p_step_index: sessionStepIndex,
            p_rating: sessionRating,
            p_notes: sessionJsonNotes,
            p_is_shared: false,
          },
          responseSchema: SupabaseReflectionSchema,
        });

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
        expect(perStepResponse.body.step_index).toBe(2);
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

      const baseURL = process.env.SUPABASE_URL!;
      const anonKey = process.env.SUPABASE_ANON_KEY!;

      try {
        // WHEN: User submits session-level reflection first time
        const firstResponse = await apiRequest({
          method: 'POST',
          path: '/rest/v1/rpc/scripture_submit_reflection',
          baseUrl: baseURL,
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${userToken}`,
            'Content-Type': 'application/json',
          },
          body: {
            p_session_id: sessionId,
            p_step_index: sessionStepIndex,
            p_rating: firstRating,
            p_notes: firstNotes,
            p_is_shared: false,
          },
          responseSchema: SupabaseReflectionSchema,
        });
        expect(firstResponse.status).toBe(200);

        // AND: User submits again with updated data (same session_id + step_index)
        const secondResponse = await apiRequest({
          method: 'POST',
          path: '/rest/v1/rpc/scripture_submit_reflection',
          baseUrl: baseURL,
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${userToken}`,
            'Content-Type': 'application/json',
          },
          body: {
            p_session_id: sessionId,
            p_step_index: sessionStepIndex,
            p_rating: secondRating,
            p_notes: secondNotes,
            p_is_shared: false,
          },
          responseSchema: SupabaseReflectionSchema,
        });

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

// ============================================================
// Story 2.3: Daily Prayer Report — Send & View — API Tests
// TDD Phase: GREEN — implementation complete, tests activated
// ============================================================

test.describe('Scripture Reflection API - Story 2.3', () => {
  // ============================================
  // 2.3-API-001: Message write persists to scripture_messages table
  // Validates: Direct table insert for partner messages
  // ============================================
  test.describe('2.3-API-001: Message write persists to scripture_messages table', () => {
    test('[P0] linked user can insert a message and all fields are correctly persisted', async ({
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

      const messageText = `Prayer for you today — ${generateReflectionNote('msg')}`;

      const baseURL = process.env.SUPABASE_URL!;
      const anonKey = process.env.SUPABASE_ANON_KEY!;

      try {
        // WHEN: User inserts a message into scripture_messages via direct table insert
        const insertResponse = await apiRequest({
          method: 'POST',
          path: '/rest/v1/scripture_messages',
          baseUrl: baseURL,
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${userToken}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: {
            session_id: sessionId,
            sender_id: userId,
            message: messageText,
          },
          responseSchema: SupabaseMessageSchema,
        });

        // THEN: Message is persisted successfully
        expect(insertResponse.status).toBe(201);
        expect(insertResponse.body).toBeTruthy();

        // AND: All fields are correct
        expect(insertResponse.body[0].session_id).toBe(sessionId);
        expect(insertResponse.body[0].sender_id).toBe(userId);
        expect(insertResponse.body[0].message).toBe(messageText);

        // AND: id and created_at are auto-populated
        expect(insertResponse.body[0].id).toBeTruthy();
        expect(typeof insertResponse.body[0].id).toBe('string');
        expect(insertResponse.body[0].created_at).toBeTruthy();

        // AND: Verify via admin query that the row exists in DB
        const { data: dbRow, error: queryError } = await supabaseAdmin
          .from('scripture_messages')
          .select('*')
          .eq('id', insertResponse.body[0].id)
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
      apiRequest,
    }) => {

      // GIVEN: A session exists in 'in_progress' status
      const seedResult = await createTestSession(supabaseAdmin, {
        preset: 'mid_session',
      });
      const sessionId = seedResult.session_ids[0];
      const userId = seedResult.test_user1_id;
      const userToken = await getUserAccessToken(supabaseAdmin, userId);

      const baseURL = process.env.SUPABASE_URL!;
      const anonKey = process.env.SUPABASE_ANON_KEY!;

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
        const updateResponse = await apiRequest({
          method: 'PATCH',
          path: `/rest/v1/scripture_sessions?id=eq.${sessionId}`,
          baseUrl: baseURL,
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${userToken}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: {
            status: 'complete',
            completed_at: completedAt,
          },
          responseSchema: SupabaseSessionSchema,
        });

        // THEN: Update succeeds
        expect(updateResponse.status).toBe(200);
        expect(updateResponse.body).toBeTruthy();

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

  // ============================================
  // 2.3-API-003: Asynchronous Report Viewing
  // Validates: AC-4 — partner can query completed session data asynchronously
  // ============================================
  test.describe('2.3-API-003: Partner can view completed session data asynchronously', () => {
    test('[P1] after User A completes a session, User B can query the session and messages asynchronously', async ({
      supabaseAdmin,
      apiRequest,
    }) => {

      // GIVEN: A session exists with two linked users (User A and User B)
      const seedResult = await createTestSession(supabaseAdmin, {
        preset: 'mid_session',
      });
      const sessionId = seedResult.session_ids[0];
      const userAId = seedResult.test_user1_id;
      const userBId = seedResult.test_user2_id;

      // Pre-condition: mid_session preset creates both users
      expect(userBId).toBeTruthy();

      const userAToken = await getUserAccessToken(supabaseAdmin, userAId);
      const userBToken = await getUserAccessToken(supabaseAdmin, userBId!);

      const messageText = `Praying for you today — ${generateReflectionNote('async-msg')}`;

      const baseURL = process.env.SUPABASE_URL!;
      const anonKey = process.env.SUPABASE_ANON_KEY!;

      try {
        // WHEN: User A writes a message to the session
        const messageResponse = await apiRequest({
          method: 'POST',
          path: '/rest/v1/scripture_messages',
          baseUrl: baseURL,
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${userAToken}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: {
            session_id: sessionId,
            sender_id: userAId,
            message: messageText,
          },
          responseSchema: SupabaseMessageSchema,
        });

        // THEN: Message insert succeeds
        expect(messageResponse.status).toBe(201);
        expect(messageResponse.body).toBeTruthy();
        expect(messageResponse.body[0].id).toBeTruthy();

        // WHEN: User A marks the session as complete
        const completedAt = new Date().toISOString();
        const updateResponse = await apiRequest({
          method: 'PATCH',
          path: `/rest/v1/scripture_sessions?id=eq.${sessionId}`,
          baseUrl: baseURL,
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${userAToken}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: {
            status: 'complete',
            completed_at: completedAt,
          },
          responseSchema: SupabaseSessionSchema,
        });

        // THEN: Session update succeeds
        expect(updateResponse.status).toBe(200);

        // WHEN: User B queries the session asynchronously (later)
        const { data: sessionRow, error: sessionQueryError } = await supabaseAdmin
          .from('scripture_sessions')
          .select('id, status, completed_at')
          .eq('id', sessionId)
          .single();

        // THEN: User B can see the session with status='complete'
        expect(sessionQueryError).toBeNull();
        expect(sessionRow).toBeTruthy();
        expect(sessionRow!.status).toBe('complete');

        // AND: completed_at is set and close to the timestamp User A wrote
        expect(sessionRow!.completed_at).toBeTruthy();
        const dbCompletedAt = new Date(sessionRow!.completed_at as string);
        const expectedCompletedAt = new Date(completedAt);
        const timeDiffMs = Math.abs(dbCompletedAt.getTime() - expectedCompletedAt.getTime());
        expect(timeDiffMs).toBeLessThan(5000); // within 5 seconds

        // WHEN: User B queries scripture_messages for this session
        const { data: messages, error: messagesQueryError } = await supabaseAdmin
          .from('scripture_messages')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        // THEN: User B can see User A's message
        expect(messagesQueryError).toBeNull();
        expect(messages).toBeTruthy();
        expect(messages!.length).toBeGreaterThanOrEqual(1);

        // AND: The message content matches what User A wrote
        const partnerMessage = messages!.find((m) => m.sender_id === userAId);
        expect(partnerMessage).toBeTruthy();
        expect(partnerMessage!.message).toBe(messageText);
        expect(partnerMessage!.session_id).toBe(sessionId);
        expect(partnerMessage!.sender_id).toBe(userAId);
        expect(partnerMessage!.created_at).toBeTruthy();

        // AND: The message ID matches the one originally inserted
        expect(partnerMessage!.id).toBe(messageResponse.body[0].id);
      } finally {
        // Cleanup
        await cleanupTestSession(supabaseAdmin, seedResult.session_ids);
      }
    });
  });
});
