/**
 * RLS Security Test Helpers
 *
 * Shared utilities for scripture RLS security E2E tests.
 */
import { createClient } from '@supabase/supabase-js';
import type { TypedSupabaseClient } from '../factories';

/**
 * Create a Supabase client authenticated as a specific user.
 * Uses service role to look up the user, then signs in with test credentials.
 */
export async function createUserClient(supabaseAdmin: TypedSupabaseClient, userId: string) {
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
    password: 'testpassword123',
  });

  if (signInError) {
    throw new Error(`Failed to sign in as ${userId}: ${signInError.message}`);
  }

  return userClient;
}

/**
 * Create an outsider user client for RLS testing.
 * Returns the client, userId, and a cleanup function.
 */
export async function createOutsiderClient(
  supabaseAdmin: TypedSupabaseClient,
  emailPrefix = 'outsider'
) {
  const { data: newUser } = await supabaseAdmin.auth.admin.createUser({
    email: `${emailPrefix}-${Date.now()}@test.example.com`,
    password: 'testpassword123',
    email_confirm: true,
  });

  const userId = newUser!.user!.id;
  const client = await createUserClient(supabaseAdmin, userId);

  return {
    client,
    userId,
    cleanup: () => supabaseAdmin.auth.admin.deleteUser(userId),
  };
}
