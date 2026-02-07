/**
 * Supabase Helper Functions
 *
 * Pure functions for Supabase client operations.
 * These are extracted from fixtures to promote reusability.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../src/types/database.types';
import type { TypedSupabaseClient } from '../factories';

/**
 * Create a Supabase admin client with service role key.
 *
 * @param url - Supabase project URL
 * @param serviceRoleKey - Service role key for admin access
 * @returns Typed Supabase client
 * @throws Error if URL or service role key is invalid
 */
export function createSupabaseAdminClient(
  url: string,
  serviceRoleKey: string
): TypedSupabaseClient {
  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Get an access token for a specific user using admin API.
 *
 * Uses admin client to look up user email, then resets password to a known value
 * and signs in to get a valid access token.
 *
 * @param supabaseAdmin - Admin client with service role
 * @param userId - User UUID to get token for
 * @returns Access token string
 * @throws Error if token generation fails
 */
export async function getUserAccessToken(
  supabaseAdmin: TypedSupabaseClient,
  userId: string
): Promise<string> {
  // Get user details
  const { data: user, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (getUserError || !user?.user) {
    throw new Error(`Failed to get user ${userId}: ${getUserError?.message}`);
  }

  // Update user password to a known test password
  const testPassword = 'test-password-123';
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: testPassword,
  });

  if (updateError) {
    throw new Error(`Failed to set password for user ${userId}: ${updateError.message}`);
  }

  // Now sign in with the known password
  const url = process.env.SUPABASE_URL!;
  const anonKey = process.env.SUPABASE_ANON_KEY!;
  const userClient = createClient(url, anonKey);

  const { data: signInData, error: signInError } = await userClient.auth.signInWithPassword({
    email: user.user.email!,
    password: testPassword,
  });

  if (signInError || !signInData.session) {
    throw new Error(`Failed to sign in as ${userId}: ${signInError?.message}`);
  }

  return signInData.session.access_token;
}
