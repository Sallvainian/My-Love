/**
 * RLS Security Test Helpers
 *
 * Shared RLS helpers used by events, auth, and API specs.
 */
import { createClient } from '@supabase/supabase-js';
import type { TypedSupabaseClient } from '../factories';
import { TEST_USER_PASSWORD } from '../test-credentials';

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
    password: TEST_USER_PASSWORD,
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
  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: `${emailPrefix}-${Date.now()}@test.example.com`,
    password: TEST_USER_PASSWORD,
    email_confirm: true,
  });

  if (createError || !newUser?.user) {
    throw new Error(
      `Failed to create outsider user: ${createError?.message ?? 'no user in response'}`
    );
  }

  const userId = newUser.user.id;
  const cleanup = () => supabaseAdmin.auth.admin.deleteUser(userId);

  // Setup can fail after the account exists but before the caller gets a cleanup
  // handle. Attempt deletion here, preserving both failures if cleanup also fails.
  const client = await createUserClient(supabaseAdmin, userId).catch(async (error) => {
    try {
      const { error: cleanupError } = await cleanup();
      if (cleanupError) throw cleanupError;
    } catch (cleanupError) {
      const describeFailure = (failure: unknown): string => {
        if (failure instanceof Error) return `${failure.name}: ${failure.message}`;
        try {
          return JSON.stringify(failure) ?? String(failure);
        } catch {
          try {
            return String(failure);
          } catch {
            return '<unprintable rejection>';
          }
        }
      };

      // Playwright reports omit AggregateError.errors, so include both details here.
      throw new AggregateError(
        [error, cleanupError],
        `Failed to set up and clean up outsider account ${userId}. ` +
          `Setup: ${describeFailure(error)}. Cleanup: ${describeFailure(cleanupError)}`,
        { cause: cleanupError }
      );
    }
    throw error;
  });

  return { client, userId, cleanup };
}
