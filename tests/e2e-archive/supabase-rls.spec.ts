/**
 * End-to-End Test: Supabase Row Level Security (RLS) Behavioral Validation
 *
 * Tests RLS policy behavior with actual authenticated sessions to verify:
 * - Users can INSERT their own moods
 * - Users cannot UPDATE/DELETE other users' moods
 * - Users can SELECT other users' moods (simplified policy for 2-user MVP)
 * - Interaction RLS policies work correctly
 *
 * Prerequisites:
 * - Supabase project with schema created (users, moods, interactions tables)
 * - RLS policies enabled and created per migration script
 * - Two test users in Supabase Auth (or use anonymous auth)
 * - Environment variables set: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY
 *
 * @story 6-0-supabase-schema-rls-foundation
 * @acceptance-criteria AC-10
 */

import { test, expect } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables for Supabase connection
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || '';

// Test users (will be created via anonymous auth)
let userAClient: SupabaseClient;
let userBClient: SupabaseClient;
let userAId: string;
let userBId: string;

/**
 * Helper: Create authenticated Supabase client for a test user
 */
async function createAuthenticatedClient(): Promise<{ client: SupabaseClient; userId: string }> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Sign in anonymously to get authenticated session
  const { data: authData, error: authError } = await client.auth.signInAnonymously();

  if (authError || !authData.user) {
    throw new Error(`Failed to create authenticated session: ${authError?.message}`);
  }

  // Create user record in users table
  const userId = authData.user.id;
  await client.from('users').insert({
    id: userId,
    partner_name: `Test User ${userId.substring(0, 8)}`,
    device_id: crypto.randomUUID(),
  });

  return { client, userId };
}

/**
 * Helper: Clean up test data after tests
 */
async function cleanupTestData(client: SupabaseClient, userId: string) {
  // Delete moods (CASCADE will handle other related data)
  await client.from('moods').delete().eq('user_id', userId);

  // Delete interactions
  await client
    .from('interactions')
    .delete()
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`);

  // Delete user record
  await client.from('users').delete().eq('id', userId);

  // Sign out
  await client.auth.signOut();
}

test.describe('Supabase RLS Policy Behavioral Validation (AC-10)', () => {
  // Setup: Create two authenticated user sessions before all tests
  test.beforeAll(async () => {
    // Validate environment variables
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error(
        'Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY'
      );
    }

    // Create User A session
    const userA = await createAuthenticatedClient();
    userAClient = userA.client;
    userAId = userA.userId;

    // Create User B session
    const userB = await createAuthenticatedClient();
    userBClient = userB.client;
    userBId = userB.userId;

    console.log(
      `Test users created: User A (${userAId.substring(0, 8)}), User B (${userBId.substring(0, 8)})`
    );
  });

  // Cleanup: Delete test data and sign out after all tests
  test.afterAll(async () => {
    await cleanupTestData(userAClient, userAId);
    await cleanupTestData(userBClient, userBId);
    console.log('Test data cleaned up');
  });

  test.describe('Moods Table RLS Policies', () => {
    test('AC-10.1: User A can INSERT own mood (should succeed)', async () => {
      const { data, error } = await userAClient
        .from('moods')
        .insert({
          user_id: userAId,
          mood_type: 'loved',
          note: 'Test mood from User A',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.user_id).toBe(userAId);
      expect(data?.mood_type).toBe('loved');
      expect(data?.note).toBe('Test mood from User A');
    });

    test('AC-10.2: User B cannot INSERT mood for User A (should fail with RLS error)', async () => {
      const { data, error } = await userBClient
        .from('moods')
        .insert({
          user_id: userAId, // Attempting to insert for User A
          mood_type: 'happy',
          note: 'Attempting to insert for User A',
        })
        .select();

      // Expect RLS policy to block this operation
      expect(error).not.toBeNull();
      expect(error?.message).toContain('violates row-level security policy');
      expect(data).toBeNull();
    });

    test("AC-10.3: User B can SELECT User A's moods (should succeed per simplified policy)", async () => {
      // First, User A creates a mood
      const { data: moodA } = await userAClient
        .from('moods')
        .insert({
          user_id: userAId,
          mood_type: 'content',
          note: 'Visible to partner',
        })
        .select()
        .single();

      expect(moodA).toBeDefined();

      // User B queries for User A's moods
      const { data: moodsFromB, error: errorB } = await userBClient
        .from('moods')
        .select('*')
        .eq('user_id', userAId);

      // Should succeed (SELECT policy is USING (true) for 2-user MVP)
      expect(errorB).toBeNull();
      expect(moodsFromB).toBeDefined();
      expect(moodsFromB?.length).toBeGreaterThan(0);

      // Verify User B can see User A's mood
      const visibleMood = moodsFromB?.find((m) => m.id === moodA?.id);
      expect(visibleMood).toBeDefined();
      expect(visibleMood?.mood_type).toBe('content');
    });

    test("AC-10.4: User B cannot UPDATE User A's mood (should fail with RLS error)", async () => {
      // User A creates a mood
      const { data: moodA } = await userAClient
        .from('moods')
        .insert({
          user_id: userAId,
          mood_type: 'thoughtful',
          note: 'Original note',
        })
        .select()
        .single();

      expect(moodA).toBeDefined();

      // User B attempts to update User A's mood
      const { data, error } = await userBClient
        .from('moods')
        .update({ note: 'Hacked note' })
        .eq('id', moodA?.id)
        .select();

      // Expect RLS policy to block this operation
      expect(error).not.toBeNull();
      expect(error?.message).toContain('violates row-level security policy');
      expect(data).toEqual([]);

      // Verify mood was not modified
      const { data: unchanged } = await userAClient
        .from('moods')
        .select('*')
        .eq('id', moodA?.id)
        .single();

      expect(unchanged?.note).toBe('Original note');
    });

    test("AC-10.5: User B cannot DELETE User A's mood (should fail with RLS error)", async () => {
      // User A creates a mood
      const { data: moodA } = await userAClient
        .from('moods')
        .insert({
          user_id: userAId,
          mood_type: 'grateful',
          note: 'Should not be deletable by User B',
        })
        .select()
        .single();

      expect(moodA).toBeDefined();

      // User B attempts to delete User A's mood
      const { data, error } = await userBClient.from('moods').delete().eq('id', moodA?.id).select();

      // Expect RLS policy to block this operation
      expect(error).not.toBeNull();
      expect(error?.message).toContain('violates row-level security policy');
      expect(data).toEqual([]);

      // Verify mood still exists
      const { data: stillExists } = await userAClient
        .from('moods')
        .select('*')
        .eq('id', moodA?.id)
        .single();

      expect(stillExists).toBeDefined();
      expect(stillExists?.id).toBe(moodA?.id);
    });

    test('AC-10.6: User A can UPDATE own mood (should succeed)', async () => {
      // User A creates a mood
      const { data: moodA } = await userAClient
        .from('moods')
        .insert({
          user_id: userAId,
          mood_type: 'happy',
          note: 'Original note',
        })
        .select()
        .single();

      expect(moodA).toBeDefined();

      // User A updates own mood
      const { data, error } = await userAClient
        .from('moods')
        .update({ note: 'Updated note' })
        .eq('id', moodA?.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.note).toBe('Updated note');
    });

    test('AC-10.7: User A can DELETE own mood (should succeed)', async () => {
      // User A creates a mood
      const { data: moodA } = await userAClient
        .from('moods')
        .insert({
          user_id: userAId,
          mood_type: 'content',
          note: 'To be deleted',
        })
        .select()
        .single();

      expect(moodA).toBeDefined();

      // User A deletes own mood
      const { error } = await userAClient.from('moods').delete().eq('id', moodA?.id);

      expect(error).toBeNull();

      // Verify mood no longer exists
      const { data: deleted } = await userAClient
        .from('moods')
        .select('*')
        .eq('id', moodA?.id)
        .single();

      expect(deleted).toBeNull();
    });
  });

  test.describe('Interactions Table RLS Policies', () => {
    test('AC-10.8: User A can INSERT interaction to User B (should succeed)', async () => {
      const { data, error } = await userAClient
        .from('interactions')
        .insert({
          type: 'poke',
          from_user_id: userAId,
          to_user_id: userBId,
          viewed: false,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.from_user_id).toBe(userAId);
      expect(data?.to_user_id).toBe(userBId);
      expect(data?.type).toBe('poke');
    });

    test('AC-10.9: User B cannot INSERT interaction on behalf of User A (should fail)', async () => {
      const { data, error } = await userBClient
        .from('interactions')
        .insert({
          type: 'kiss',
          from_user_id: userAId, // Impersonating User A
          to_user_id: userBId,
          viewed: false,
        })
        .select();

      // Expect RLS policy to block this operation
      expect(error).not.toBeNull();
      expect(error?.message).toContain('violates row-level security policy');
      expect(data).toBeNull();
    });

    test('AC-10.10: User B can SELECT interactions sent to them (should succeed)', async () => {
      // User A sends interaction to User B
      const { data: interaction } = await userAClient
        .from('interactions')
        .insert({
          type: 'kiss',
          from_user_id: userAId,
          to_user_id: userBId,
          viewed: false,
        })
        .select()
        .single();

      expect(interaction).toBeDefined();

      // User B queries for interactions sent to them
      const { data, error } = await userBClient
        .from('interactions')
        .select('*')
        .eq('to_user_id', userBId);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThan(0);

      // Verify User B can see the interaction
      const received = data?.find((i) => i.id === interaction?.id);
      expect(received).toBeDefined();
      expect(received?.type).toBe('kiss');
    });

    test('AC-10.11: User B can SELECT interactions they sent (should succeed)', async () => {
      // User B sends interaction to User A
      const { data: interaction } = await userBClient
        .from('interactions')
        .insert({
          type: 'poke',
          from_user_id: userBId,
          to_user_id: userAId,
          viewed: false,
        })
        .select()
        .single();

      expect(interaction).toBeDefined();

      // User B queries for interactions they sent
      const { data, error } = await userBClient
        .from('interactions')
        .select('*')
        .eq('from_user_id', userBId);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThan(0);

      // Verify User B can see their sent interaction
      const sent = data?.find((i) => i.id === interaction?.id);
      expect(sent).toBeDefined();
      expect(sent?.type).toBe('poke');
    });

    test('AC-10.12: User B can UPDATE viewed status on received interactions (should succeed)', async () => {
      // User A sends interaction to User B
      const { data: interaction } = await userAClient
        .from('interactions')
        .insert({
          type: 'kiss',
          from_user_id: userAId,
          to_user_id: userBId,
          viewed: false,
        })
        .select()
        .single();

      expect(interaction).toBeDefined();
      expect(interaction?.viewed).toBe(false);

      // User B marks interaction as viewed
      const { data, error } = await userBClient
        .from('interactions')
        .update({ viewed: true })
        .eq('id', interaction?.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.viewed).toBe(true);
    });

    test('AC-10.13: User A cannot UPDATE viewed status on interactions they sent (should fail)', async () => {
      // User A sends interaction to User B
      const { data: interaction } = await userAClient
        .from('interactions')
        .insert({
          type: 'poke',
          from_user_id: userAId,
          to_user_id: userBId,
          viewed: false,
        })
        .select()
        .single();

      expect(interaction).toBeDefined();

      // User A attempts to mark their own sent interaction as viewed
      const { data, error } = await userAClient
        .from('interactions')
        .update({ viewed: true })
        .eq('id', interaction?.id)
        .select();

      // Expect RLS policy to block this operation (only recipient can update)
      expect(error).not.toBeNull();
      expect(error?.message).toContain('violates row-level security policy');
      expect(data).toEqual([]);
    });
  });

  test.describe('Users Table RLS Policies', () => {
    test('AC-10.14: User A can SELECT all users (should succeed)', async () => {
      const { data, error } = await userAClient.from('users').select('*');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThanOrEqual(2); // At least User A and User B

      // Verify both users are visible
      const userIds = data?.map((u) => u.id) || [];
      expect(userIds).toContain(userAId);
      expect(userIds).toContain(userBId);
    });

    test("AC-10.15: User B cannot UPDATE User A's profile (should fail)", async () => {
      // User B attempts to update User A's partner_name
      const { data, error } = await userBClient
        .from('users')
        .update({ partner_name: 'Hacked Name' })
        .eq('id', userAId)
        .select();

      // Expect RLS policy to block this operation
      expect(error).not.toBeNull();
      expect(error?.message).toContain('violates row-level security policy');
      expect(data).toEqual([]);
    });

    test('AC-10.16: User A can UPDATE own profile (should succeed)', async () => {
      const newPartnerName = `Updated Name ${Date.now()}`;

      const { data, error } = await userAClient
        .from('users')
        .update({ partner_name: newPartnerName })
        .eq('id', userAId)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.partner_name).toBe(newPartnerName);
    });
  });
});
