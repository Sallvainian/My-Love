/**
 * Test Factories
 *
 * TypeScript functions that call Supabase RPCs to create test data.
 * Used by Playwright fixtures for E2E test setup/teardown.
 *
 * @see tech-spec-03-test-factories.md
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../src/types/database.types';
import { getWorkerPairEmails } from '../auth/worker-pool';

/**
 * Typed Supabase client with project schema for compile-time table/RPC validation
 */
export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Result returned from scripture_seed_test_data RPC.
 * Shape matches the jsonb_build_object in the migration SQL.
 */
export interface SeedResult {
  session_ids: string[];
  session_count: number;
  preset: string;
  test_user1_id: string;
  test_user2_id: string | null;
  reflection_ids?: string[];
  message_ids?: string[];
}

/**
 * Preset configurations for test session state
 * - mid_session: Session at step 7 in reading phase
 * - completed: Fully completed session
 * - with_help_flags: Session with help flags set
 * - unlinked: Solo session at step 7 with NO partner (user2_id = NULL)
 */
export type SeedPreset =
  | 'mid_session'
  | 'completed'
  | 'with_help_flags'
  | 'unlinked'
  | 'at_reflection';

/**
 * Options for creating test sessions
 */
export interface CreateTestSessionOptions {
  sessionCount?: number;
  includeReflections?: boolean;
  includeMessages?: boolean;
  preset?: SeedPreset;
  bookmarkSteps?: number[];
  /**
   * Seed for this specific user rather than letting the RPC pick one.
   *
   * Omitting it falls back to the RPC's legacy global lookup — the first row in
   * auth.users by created_at — which hands every parallel worker the same user.
   * global-setup.ts provisions a dedicated pair per worker; pass that worker's
   * IDs so seeded data cannot collide with another worker's.
   */
  user1Id?: string;
  /** Partner for `user1Id`. Omit for a solo session. */
  user2Id?: string;
}

/**
 * email → public.users.id, memoised for the life of the worker process.
 *
 * The worker pool is provisioned once by global-setup and never changes during
 * a run, so a worker resolves its own two ids on first seed and never again.
 */
const appUserIdByEmail = new Map<string, string>();

async function resolveAppUserIdByEmail(
  supabase: TypedSupabaseClient,
  email: string
): Promise<string> {
  const cached = appUserIdByEmail.get(email);
  if (cached !== undefined) return cached;

  const { data, error } = await supabase.from('users').select('id').eq('email', email).single();

  if (error || !data?.id) {
    throw new Error(
      `Could not resolve app user for ${email}: ${error?.message ?? 'not found'}. ` +
        'The worker pool is created by tests/support/auth/global-setup.ts — if this ' +
        'fires, globalSetup did not run or PLAYWRIGHT_AUTH_POOL_SIZE shrank between runs.'
    );
  }

  appUserIdByEmail.set(email, data.id);
  return data.id;
}

/**
 * Create test scripture sessions via the seeding RPC.
 *
 * Calls the scripture_seed_test_data() RPC which creates sessions,
 * step states, and optionally reflections/messages.
 *
 * @param supabase - Supabase client (must have service role for admin access)
 * @param options - Configuration for test data creation
 * @returns SeedResult with created entity IDs
 * @throws Error if RPC call fails
 *
 * @example
 * const result = await createTestSession(supabase, {
 *   sessionCount: 2,
 *   includeReflections: true,
 *   preset: 'mid_session'
 * });
 */
export async function createTestSession(
  supabase: TypedSupabaseClient,
  options?: CreateTestSessionOptions
): Promise<SeedResult> {
  let user1Id = options?.user1Id;
  let user2Id = options?.user2Id;

  if (user1Id === undefined) {
    if (user2Id !== undefined) {
      throw new Error(
        'createTestSession: user2Id was given without user1Id. Pass both, or neither ' +
          "to seed for this worker's own pair."
      );
    }

    // Default to the calling worker's dedicated pair, so parallel workers never
    // seed onto each other's users. Callers do not opt in — isolation is the
    // default and an explicit user1Id/user2Id is the only way out of it.
    //
    // getWorkerPairEmails() returns null when there is no worker identity —
    // globalSetup, a reporter, an ad-hoc script. In that case BOTH ids stay
    // undefined and the RPC falls back to its legacy global lookup, which is
    // exactly what those callers got before. Do not replace this null branch
    // with a default index: worker 0 is a real worker, and seeding its
    // accounts from outside a worker corrupts a live test run.
    const pair = getWorkerPairEmails();
    if (pair !== null) {
      user1Id = await resolveAppUserIdByEmail(supabase, pair.user1Email);
      user2Id = await resolveAppUserIdByEmail(supabase, pair.user2Email);
    }
  }

  const { data, error } = await supabase.rpc('scripture_seed_test_data', {
    p_session_count: options?.sessionCount ?? 1,
    p_include_reflections: options?.includeReflections ?? false,
    p_include_messages: options?.includeMessages ?? false,
    p_preset: options?.preset,
    p_bookmark_steps: options?.bookmarkSteps,
    p_user1_id: user1Id,
    p_user2_id: user2Id,
  });

  if (error) {
    throw new Error(`Seeding failed: ${error.message}`);
  }

  return data as unknown as SeedResult;
}

/**
 * Link two test users as partners.
 *
 * Updates the partner_id field for both users to establish a bidirectional
 * partner relationship. Used for together-mode session testing.
 *
 * @param supabase - Supabase client (must have service role for admin access)
 * @param user1Id - First user's UUID
 * @param user2Id - Second user's UUID
 * @throws Error if either update fails
 *
 * @example
 * await linkTestPartners(supabase, result.test_user1_id, result.test_user2_id);
 */
export async function linkTestPartners(
  supabase: TypedSupabaseClient,
  user1Id: string,
  user2Id: string
): Promise<void> {
  const { error: error1 } = await supabase
    .from('users')
    .update({ partner_id: user2Id })
    .eq('id', user1Id);
  if (error1) throw new Error(`Failed to link user1 (${user1Id}) as partner: ${error1.message}`);

  const { error: error2 } = await supabase
    .from('users')
    .update({ partner_id: user1Id })
    .eq('id', user2Id);
  if (error2) throw new Error(`Failed to link user2 (${user2Id}) as partner: ${error2.message}`);
}

/**
 * Unlink two test users (remove bidirectional partner relationship).
 *
 * Reverses the effect of linkTestPartners by clearing partner_id for both
 * users. Call in finally blocks to prevent partner state from leaking into
 * subsequent tests within the same worker.
 *
 * @param supabase - Supabase client (must have service role for admin access)
 * @param user1Id - First user's UUID
 * @param user2Id - Second user's UUID
 *
 * @example
 * await unlinkTestPartners(supabase, result.test_user1_id, result.test_user2_id);
 */
export async function unlinkTestPartners(
  supabase: TypedSupabaseClient,
  user1Id: string,
  user2Id: string
): Promise<void> {
  const { error: error1 } = await supabase
    .from('users')
    .update({ partner_id: null })
    .eq('id', user1Id);
  if (error1) throw new Error(`Failed to unlink user1 (${user1Id}) partner: ${error1.message}`);

  const { error: error2 } = await supabase
    .from('users')
    .update({ partner_id: null })
    .eq('id', user2Id);
  if (error2) throw new Error(`Failed to unlink user2 (${user2Id}) partner: ${error2.message}`);
}

/**
 * Clean up test scripture sessions and all related data.
 *
 * Deletes data in the correct order to respect foreign key constraints:
 * messages → reflections → bookmarks → step_states → sessions
 *
 * @param supabase - Supabase client (must have service role for admin access)
 * @param sessionIds - Array of session UUIDs to delete
 *
 * @example
 * await cleanupTestSession(supabase, result.session_ids);
 */
export async function cleanupTestSession(
  supabase: TypedSupabaseClient,
  sessionIds: string[]
): Promise<void> {
  if (!sessionIds?.length) return;

  // Delete all sessions in parallel; within each session, delete in FK order
  const errors: string[] = [];

  await Promise.all(
    sessionIds.map(async (id) => {
      // Sequential within each session to respect foreign key constraints
      const tables = [
        { table: 'scripture_messages' as const, key: 'session_id' },
        { table: 'scripture_reflections' as const, key: 'session_id' },
        { table: 'scripture_bookmarks' as const, key: 'session_id' },
        { table: 'scripture_step_states' as const, key: 'session_id' },
        { table: 'scripture_sessions' as const, key: 'id' },
      ];

      for (const { table, key } of tables) {
        const { error } = await supabase.from(table).delete().eq(key, id);
        if (error) {
          errors.push(`Failed to delete from ${table} (${key}=${id}): ${error.message}`);
        }
      }
    })
  );

  if (errors.length > 0) {
    console.warn(`[cleanupTestSession] ${errors.length} cleanup error(s):\n${errors.join('\n')}`);
  }
}
