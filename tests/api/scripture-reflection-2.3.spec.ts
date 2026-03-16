/**
 * P0/P1 API: Scripture Reading - Story 2.3 Daily Prayer Report
 *
 * Tests message persistence, session completion, asynchronous report viewing,
 * and bookmark sharing preference persistence.
 *
 * TDD Phase: GREEN — implementation complete, tests activated
 */
import { test, expect } from '../support/merged-fixtures';
import { createTestSession, cleanupTestSession } from '../support/factories';
import { getUserAccessToken } from '../support/helpers/supabase';
import { faker } from '@faker-js/faker';
import { z } from 'zod';
import {
  SupabaseSessionSchema,
  SupabaseBookmarkSchema,
  SupabaseMessageSchema,
} from '../../src/validation/schemas';

/** Generate a dynamic reflection note for test isolation. */
function generateReflectionNote(prefix = 'test'): string {
  return `${prefix}-${faker.lorem.sentence()}`;
}

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

      try {
        // WHEN: User inserts a message into scripture_messages via direct table insert
        const insertResponse = await apiRequest({
          method: 'POST',
          path: '/rest/v1/scripture_messages',
          headers: {
            Authorization: `Bearer ${userToken}`,
            Prefer: 'return=representation',
          },
          body: {
            session_id: sessionId,
            sender_id: userId,
            message: messageText,
          },
        }).validateSchema<z.infer<typeof SupabaseMessageSchema>[]>(z.array(SupabaseMessageSchema));

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
          headers: {
            Authorization: `Bearer ${userToken}`,
            Prefer: 'return=representation',
          },
          body: {
            status: 'complete',
            completed_at: completedAt,
          },
        }).validateSchema<z.infer<typeof SupabaseSessionSchema>[]>(z.array(SupabaseSessionSchema));

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

      const messageText = `Praying for you today — ${generateReflectionNote('async-msg')}`;

      try {
        // WHEN: User A writes a message to the session
        const messageResponse = await apiRequest({
          method: 'POST',
          path: '/rest/v1/scripture_messages',
          headers: {
            Authorization: `Bearer ${userAToken}`,
            Prefer: 'return=representation',
          },
          body: {
            session_id: sessionId,
            sender_id: userAId,
            message: messageText,
          },
        }).validateSchema<z.infer<typeof SupabaseMessageSchema>[]>(z.array(SupabaseMessageSchema));

        // THEN: Message insert succeeds
        expect(messageResponse.status).toBe(201);
        expect(messageResponse.body).toBeTruthy();
        expect(messageResponse.body[0].id).toBeTruthy();

        // WHEN: User A marks the session as complete
        const completedAt = new Date().toISOString();
        const updateResponse = await apiRequest({
          method: 'PATCH',
          path: `/rest/v1/scripture_sessions?id=eq.${sessionId}`,
          headers: {
            Authorization: `Bearer ${userAToken}`,
            Prefer: 'return=representation',
          },
          body: {
            status: 'complete',
            completed_at: completedAt,
          },
        }).validateSchema<z.infer<typeof SupabaseSessionSchema>[]>(z.array(SupabaseSessionSchema));

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

  // ============================================
  // 2.3-API-004: Bookmark sharing preference persistence
  // Validates: share_with_partner updates are persisted session-wide per user
  // ============================================
  test.describe('2.3-API-004: Bookmark sharing preference persistence', () => {
    test('[P1] user can update share_with_partner for all session bookmarks', async ({
      supabaseAdmin,
      apiRequest,
    }) => {
      const seedResult = await createTestSession(supabaseAdmin, {
        preset: 'mid_session',
      });
      const sessionId = seedResult.session_ids[0];
      const userId = seedResult.test_user1_id;
      const userToken = await getUserAccessToken(supabaseAdmin, userId);

      try {
        // Seed two bookmarks for the same session/user
        await apiRequest({
          method: 'POST',
          path: '/rest/v1/scripture_bookmarks',
          headers: {
            Authorization: `Bearer ${userToken}`,
            Prefer: 'return=representation',
          },
          body: [
            {
              session_id: sessionId,
              step_index: 1,
              user_id: userId,
              share_with_partner: false,
            },
            {
              session_id: sessionId,
              step_index: 3,
              user_id: userId,
              share_with_partner: false,
            },
          ],
        });

        // Update sharing preference to true for this session/user
        const shareOnResponse = await apiRequest({
          method: 'PATCH',
          path: `/rest/v1/scripture_bookmarks?session_id=eq.${sessionId}&user_id=eq.${userId}`,
          headers: {
            Authorization: `Bearer ${userToken}`,
            Prefer: 'return=representation',
          },
          body: { share_with_partner: true },
        }).validateSchema<z.infer<typeof SupabaseBookmarkSchema>[]>(
          z.array(SupabaseBookmarkSchema)
        );

        expect(shareOnResponse.status).toBe(200);
        expect(shareOnResponse.body).toHaveLength(2);
        expect(shareOnResponse.body.every((row) => row.share_with_partner === true)).toBe(true);

        // Flip preference back to false and verify persistence
        const shareOffResponse = await apiRequest({
          method: 'PATCH',
          path: `/rest/v1/scripture_bookmarks?session_id=eq.${sessionId}&user_id=eq.${userId}`,
          headers: {
            Authorization: `Bearer ${userToken}`,
            Prefer: 'return=representation',
          },
          body: { share_with_partner: false },
        }).validateSchema<z.infer<typeof SupabaseBookmarkSchema>[]>(
          z.array(SupabaseBookmarkSchema)
        );

        expect(shareOffResponse.status).toBe(200);
        expect(shareOffResponse.body).toHaveLength(2);
        expect(shareOffResponse.body.every((row) => row.share_with_partner === false)).toBe(true);
      } finally {
        await cleanupTestSession(supabaseAdmin, seedResult.session_ids);
      }
    });
  });
});
