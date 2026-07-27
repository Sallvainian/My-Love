/**
 * Supabase Helper Functions
 *
 * Pure functions for Supabase client operations.
 * These are extracted from fixtures to promote reusability.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../src/types/database.types';
import type { TypedSupabaseClient } from '../factories';
import { TEST_USER_PASSWORD } from '../test-credentials';

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
 * Looks the user up with the admin client, then signs in with the shared test
 * password to get a valid access token.
 *
 * This used to reset the user's password first. That made every call a write to
 * state shared with other Playwright projects running concurrently, and because
 * it reset to a different literal than the rest of the suite uses, it left the
 * user unable to sign in anywhere else. Read-only is the point — do not
 * reintroduce a password write here.
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

  // Sign in with the shared test password every test user is provisioned with
  const url = process.env.SUPABASE_URL!;
  const anonKey = process.env.SUPABASE_ANON_KEY!;
  const userClient = createClient(url, anonKey);

  const { data: signInData, error: signInError } = await userClient.auth.signInWithPassword({
    email: user.user.email!,
    password: TEST_USER_PASSWORD,
  });

  if (signInError || !signInData.session) {
    throw new Error(`Failed to sign in as ${userId}: ${signInError?.message}`);
  }

  return signInData.session.access_token;
}
