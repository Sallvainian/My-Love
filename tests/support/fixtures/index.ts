/**
 * Custom Project Fixtures
 *
 * Define project-specific fixtures here. These are merged with
 * playwright-utils fixtures in ../merged-fixtures.ts.
 *
 * Pattern: Pure function → fixture wrapper
 * @see _bmad/bmm/testarch/knowledge/fixture-architecture.md
 */
import { test as base } from '@playwright/test';
import {
  createTestSession,
  cleanupTestSession,
  linkTestPartners,
  SeedResult,
  TypedSupabaseClient,
} from '../factories';
import { createSupabaseAdminClient } from '../helpers/supabase';

/**
 * Custom fixture types for My-Love project
 */
type CustomFixtures = {
  /** Supabase admin client with service role key for test data manipulation */
  supabaseAdmin: TypedSupabaseClient;
  /** Pre-seeded test session with automatic cleanup */
  testSession: SeedResult;
};

/**
 * Custom fixtures for My-Love project.
 *
 * supabaseAdmin: Creates a Supabase client with service role key.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 *
 * testSession: Creates test scripture sessions via seeding RPC,
 * automatically cleans up after test completes.
 */
export const test = base.extend<CustomFixtures>({
  supabaseAdmin: async ({}, use) => {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error(
        'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. ' +
          'These are required for test fixtures. Use Supabase Local for testing.'
      );
    }

    const client = createSupabaseAdminClient(url, serviceRoleKey);

    await use(client);
  },

  testSession: async ({ supabaseAdmin }, use) => {
    const result = await createTestSession(supabaseAdmin);

    // Link test users as partners for together-mode sessions
    if (result.test_user2_id) {
      await linkTestPartners(supabaseAdmin, result.test_user1_id, result.test_user2_id);
    }

    await use(result);

    // Cleanup: only remove session data, NOT partner linkage.
    // Partner linkage is shared state across parallel workers — unlinking here
    // would break other workers' tests that depend on hasPartner = true.
    await cleanupTestSession(supabaseAdmin, result.session_ids);
  },
});

export { expect } from '@playwright/test';
