/**
 * P0 API: Scripture Reading - RLS Security Tests
 *
 * Tests RLS policies enforce session-based access control.
 * Non-member users cannot read or write session data.
 *
 * Risk: R-001 (Score: 6) - RLS policy bypass
 * Test IDs: P0-001 through P0-005, P0-008, P0-012
 *
 * Epic 1, Stories 1.1
 */
import { test, expect } from '../../support/merged-fixtures';
import type { SeedResult } from '../../support/factories';
import { createTestSession, cleanupTestSession } from '../../support/factories';

test.describe('Scripture RLS Security', () => {
  /**
   * Helper: Create a Supabase client authenticated as a specific user.
   * Uses service role to generate a user token, then creates a client.
   */
  async function createUserClient(
    supabaseAdmin: Parameters<typeof createTestSession>[0],
    userId: string
  ) {
    // Generate a session token for the specified user via admin API
    const { data: sessionData, error: sessionError } =
      await supabaseAdmin.auth.admin.getUserById(userId);

    if (sessionError || !sessionData?.user) {
      throw new Error(`Failed to get user ${userId}: ${sessionError?.message}`);
    }

    // Use admin to generate a link/token for this user
    // This will be used to create an authenticated client
    const { createClient } = await import('@supabase/supabase-js');
    const url = process.env.SUPABASE_URL!;
    const anonKey = process.env.SUPABASE_ANON_KEY!;

    const userClient = createClient(url, anonKey);

    // Sign in as this user (test users have known passwords from seed)
    // The seeding RPC creates users with predictable credentials
    const { error: signInError } = await userClient.auth.signInWithPassword({
      email: sessionData.user.email!,
      password: 'test-password-123',
    });

    if (signInError) {
      throw new Error(`Failed to sign in as ${userId}: ${signInError.message}`);
    }

    return userClient;
  }

  test.describe('P0-001: SELECT scripture_sessions - members only', () => {
    test('should return session data for session member', async ({
      supabaseAdmin,
      testSession,
    }) => {
      // GIVEN: A scripture session exists with user1 as member
      const sessionId = testSession.session_ids[0];
      const userId = testSession.test_user1_id;

      // WHEN: The session member queries the session
      const userClient = await createUserClient(supabaseAdmin, userId);
      const { data, error } = await userClient
        .from('scripture_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      // THEN: Session data is returned
      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data!.id).toBe(sessionId);
    });

    test('should return empty result for non-member user', async ({
      supabaseAdmin,
      testSession,
    }) => {
      // GIVEN: A scripture session exists with user1 as member
      const sessionId = testSession.session_ids[0];

      // Create a third user who is NOT a session member
      const { data: newUser } = await supabaseAdmin.auth.admin.createUser({
        email: `outsider-${Date.now()}@test.example.com`,
        password: 'test-password-123',
        email_confirm: true,
      });

      // WHEN: A non-member queries the session
      const outsiderClient = await createUserClient(
        supabaseAdmin,
        newUser!.user!.id
      );
      const { data, error } = await outsiderClient
        .from('scripture_sessions')
        .select('*')
        .eq('id', sessionId);

      // THEN: No data is returned (RLS blocks access)
      expect(error).toBeNull();
      expect(data).toEqual([]);

      // Cleanup outsider user
      await supabaseAdmin.auth.admin.deleteUser(newUser!.user!.id);
    });
  });

  test.describe('P0-002: SELECT scripture_reflections - members only', () => {
    test('should return reflections for session member', async ({
      supabaseAdmin,
    }) => {
      // GIVEN: A session with reflections exists
      const seedResult = await createTestSession(supabaseAdmin, {
        includeReflections: true,
        preset: 'mid_session',
      });
      const userId = seedResult.test_user1_id;

      // WHEN: The session member queries reflections
      const userClient = await createUserClient(supabaseAdmin, userId);
      const { data, error } = await userClient
        .from('scripture_reflections')
        .select('*')
        .eq('session_id', seedResult.session_ids[0]);

      // THEN: Reflections are returned
      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data!.length).toBeGreaterThan(0);

      // Cleanup
      await cleanupTestSession(supabaseAdmin, seedResult.session_ids);
    });

    test('should return empty for non-member querying reflections', async ({
      supabaseAdmin,
    }) => {
      // GIVEN: A session with reflections exists
      const seedResult = await createTestSession(supabaseAdmin, {
        includeReflections: true,
        preset: 'mid_session',
      });

      // Create outsider
      const { data: newUser } = await supabaseAdmin.auth.admin.createUser({
        email: `outsider-refl-${Date.now()}@test.example.com`,
        password: 'test-password-123',
        email_confirm: true,
      });

      // WHEN: Non-member queries reflections
      const outsiderClient = await createUserClient(
        supabaseAdmin,
        newUser!.user!.id
      );
      const { data, error } = await outsiderClient
        .from('scripture_reflections')
        .select('*')
        .eq('session_id', seedResult.session_ids[0]);

      // THEN: No reflections returned
      expect(error).toBeNull();
      expect(data).toEqual([]);

      // Cleanup
      await cleanupTestSession(supabaseAdmin, seedResult.session_ids);
      await supabaseAdmin.auth.admin.deleteUser(newUser!.user!.id);
    });
  });

  test.describe('P0-003: INSERT reflections/bookmarks - members only', () => {
    test('should reject non-member INSERT into scripture_reflections', async ({
      supabaseAdmin,
      testSession,
    }) => {
      // GIVEN: A session exists and a non-member user
      const sessionId = testSession.session_ids[0];
      const { data: newUser } = await supabaseAdmin.auth.admin.createUser({
        email: `outsider-ins-${Date.now()}@test.example.com`,
        password: 'test-password-123',
        email_confirm: true,
      });

      // WHEN: Non-member tries to INSERT a reflection
      const outsiderClient = await createUserClient(
        supabaseAdmin,
        newUser!.user!.id
      );
      const { error } = await outsiderClient
        .from('scripture_reflections')
        .insert({
          session_id: sessionId,
          step_index: 0,
          user_id: newUser!.user!.id,
          rating: 5,
          notes: 'Unauthorized reflection',
          is_shared: false,
        });

      // THEN: Insert is rejected by RLS
      expect(error).toBeTruthy();

      // Cleanup
      await supabaseAdmin.auth.admin.deleteUser(newUser!.user!.id);
    });

    test('should reject non-member INSERT into scripture_bookmarks', async ({
      supabaseAdmin,
      testSession,
    }) => {
      // GIVEN: A session exists and a non-member user
      const sessionId = testSession.session_ids[0];
      const { data: newUser } = await supabaseAdmin.auth.admin.createUser({
        email: `outsider-bm-${Date.now()}@test.example.com`,
        password: 'test-password-123',
        email_confirm: true,
      });

      // WHEN: Non-member tries to INSERT a bookmark
      const outsiderClient = await createUserClient(
        supabaseAdmin,
        newUser!.user!.id
      );
      const { error } = await outsiderClient
        .from('scripture_bookmarks')
        .insert({
          session_id: sessionId,
          step_index: 0,
          user_id: newUser!.user!.id,
          share_with_partner: false,
        });

      // THEN: Insert is rejected by RLS
      expect(error).toBeTruthy();

      // Cleanup
      await supabaseAdmin.auth.admin.deleteUser(newUser!.user!.id);
    });
  });

  test.describe('P0-004: user_id = auth.uid() enforced on INSERT', () => {
    test('should reject INSERT where user_id does not match auth.uid()', async ({
      supabaseAdmin,
      testSession,
    }) => {
      // GIVEN: A session member tries to impersonate another user
      const sessionId = testSession.session_ids[0];
      const userId = testSession.test_user1_id;
      const fakeUserId = 'fake-user-id-that-does-not-match-auth';

      // WHEN: Member inserts reflection with mismatched user_id
      const userClient = await createUserClient(supabaseAdmin, userId);
      const { error } = await userClient.from('scripture_reflections').insert({
        session_id: sessionId,
        step_index: 0,
        user_id: fakeUserId, // Impersonation attempt
        rating: 5,
        notes: 'Impersonated reflection',
        is_shared: false,
      });

      // THEN: Insert is rejected (user_id must match auth.uid())
      expect(error).toBeTruthy();
    });
  });

  test.describe('P0-005: is_shared visibility - unshared reflections hidden', () => {
    test('should hide unshared reflections from partner', async ({
      supabaseAdmin,
    }) => {
      // GIVEN: A together session with both users having reflections
      const seedResult = await createTestSession(supabaseAdmin, {
        includeReflections: true,
        preset: 'mid_session',
      });

      // User1 creates a private reflection (is_shared=false)
      const user1Client = await createUserClient(
        supabaseAdmin,
        seedResult.test_user1_id
      );
      await user1Client.from('scripture_reflections').insert({
        session_id: seedResult.session_ids[0],
        step_index: 15,
        user_id: seedResult.test_user1_id,
        rating: 3,
        notes: 'Private reflection - should not be visible to partner',
        is_shared: false,
      });

      // WHEN: Partner (user2) queries reflections
      // Note: test_user2_id may be null for solo sessions
      if (seedResult.test_user2_id) {
        const user2Client = await createUserClient(
          supabaseAdmin,
          seedResult.test_user2_id
        );
        const { data } = await user2Client
          .from('scripture_reflections')
          .select('*')
          .eq('session_id', seedResult.session_ids[0])
          .eq('is_shared', false)
          .eq('user_id', seedResult.test_user1_id);

        // THEN: Private reflections are NOT visible to partner
        expect(data).toEqual([]);
      }

      // Cleanup
      await cleanupTestSession(supabaseAdmin, seedResult.session_ids);
    });
  });

  test.describe('P0-008: Solo session creation via RPC', () => {
    test('should create a valid solo session via scripture_create_session RPC', async ({
      supabaseAdmin,
      testSession,
    }) => {
      // GIVEN: The scripture_create_session RPC exists
      const userId = testSession.test_user1_id;
      const userClient = await createUserClient(supabaseAdmin, userId);

      // WHEN: User calls the create session RPC
      const { data, error } = await userClient.rpc(
        'scripture_create_session',
        {
          p_mode: 'solo',
        }
      );

      // THEN: A valid session is returned
      expect(error).toBeNull();
      expect(data).toBeTruthy();

      // Session has correct shape
      const session = data as Record<string, unknown>;
      expect(session.id).toBeTruthy();
      expect(session.mode).toBe('solo');
      expect(session.status).toBe('in_progress');
      expect(session.current_step_index).toBe(0);
      expect(session.current_phase).toBe('reading');

      // Cleanup the created session
      if (session.id) {
        await cleanupTestSession(supabaseAdmin, [session.id as string]);
      }
    });
  });

  test.describe('P0-012: Idempotent reflection write', () => {
    test('should upsert reflection for same (session_id, step_index, user_id)', async ({
      supabaseAdmin,
      testSession,
    }) => {
      // GIVEN: A session member
      const sessionId = testSession.session_ids[0];
      const userId = testSession.test_user1_id;
      const userClient = await createUserClient(supabaseAdmin, userId);

      // WHEN: User submits reflection twice for same step
      const reflectionData = {
        p_session_id: sessionId,
        p_step_index: 0,
        p_rating: 4,
        p_notes: 'First submission',
        p_is_shared: false,
      };

      const { error: firstError } = await userClient.rpc(
        'scripture_submit_reflection',
        reflectionData
      );
      expect(firstError).toBeNull();

      // Submit again with different content (should upsert, not duplicate)
      const { error: secondError } = await userClient.rpc(
        'scripture_submit_reflection',
        {
          ...reflectionData,
          p_rating: 5,
          p_notes: 'Updated submission',
        }
      );
      expect(secondError).toBeNull();

      // THEN: Only one reflection exists (upsert, not duplicate)
      const { data: reflections } = await supabaseAdmin
        .from('scripture_reflections')
        .select('*')
        .eq('session_id', sessionId)
        .eq('step_index', 0)
        .eq('user_id', userId);

      expect(reflections).toHaveLength(1);
      expect(reflections![0].rating).toBe(5);
      expect(reflections![0].notes).toBe('Updated submission');
    });
  });
});
