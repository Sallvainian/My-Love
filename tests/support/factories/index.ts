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
 */
export type SeedPreset = 'mid_session' | 'completed' | 'with_help_flags';

/**
 * Options for creating test sessions
 */
export interface CreateTestSessionOptions {
  sessionCount?: number;
  includeReflections?: boolean;
  includeMessages?: boolean;
  preset?: SeedPreset;
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
  const { data, error } = await supabase.rpc('scripture_seed_test_data', {
    p_session_count: options?.sessionCount ?? 1,
    p_include_reflections: options?.includeReflections ?? false,
    p_include_messages: options?.includeMessages ?? false,
    p_preset: options?.preset ?? null,
  });

  if (error) {
    throw new Error(`Seeding failed: ${error.message}`);
  }

  return data as SeedResult;
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
