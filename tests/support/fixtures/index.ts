/**
 * Custom Project Fixtures
 *
 * Define project-specific fixtures here. These are merged with
 * playwright-utils fixtures in ../merged-fixtures.ts.
 *
 * Pattern: Pure function → fixture wrapper
 * @see _bmad/bmm/testarch/knowledge/fixture-architecture.md
 */
import { createClient } from '@supabase/supabase-js';
import { test as base } from '@playwright/test';
import { createTestSession, cleanupTestSession, linkTestPartners } from '../factories';
import type { SeedResult, TypedSupabaseClient } from '../factories';
import {
  clearPairEvents,
  resolveWorkerPairIds,
  seedEvents,
  type EventSpec,
  type SeededEvent,
} from '../factories/events';
import { createSupabaseAdminClient, getUserAccessToken } from '../helpers/supabase';
import type { Database } from '../../../src/types/database.types';

/**
 * Seeding handle for the running worker's own couple.
 *
 * `userId` / `partnerId` are `public.users.id`s, which is what `events.user_id`
 * holds. `anchor` is the single clock reading every seeded date derives from —
 * exposed rather than kept private so a spec that also fakes the browser clock
 * can pin both to the same instant.
 */
export type CoupleEventsFixture = {
  userId: string;
  partnerId: string;
  anchor: Date;
  /** Seed rows relative to `anchor`, in one statement. Returns them in order. */
  seed: (specs: EventSpec[]) => Promise<SeededEvent[]>;
  /** Drop every event owned by either half of the pair. */
  clear: () => Promise<void>;
};

/**
 * Custom fixture types for My-Love project
 */
type CustomFixtures = {
  /** Supabase admin client with service role key for test data manipulation */
  supabaseAdmin: TypedSupabaseClient;
  /** Pre-seeded test session with automatic cleanup */
  testSession: SeedResult;
  /**
   * A Supabase client speaking as this worker's own user, so RLS applies.
   *
   * Distinct from `supabaseAdmin`, which is service_role and sees every row:
   * a read asserted through the admin client proves nothing about the
   * `events_select` policy. Built with the publishable key plus a real user
   * JWT, which is what `src/api/supabaseClient.ts:55` gives the app.
   */
  supabaseAsUser: TypedSupabaseClient;
  /** Events seeding for this worker's couple, cleared before and after. */
  coupleEvents: CoupleEventsFixture;
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

  supabaseAsUser: async ({ supabaseAdmin }, use) => {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      throw new Error(
        'Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables. ' +
          'These are required for the supabaseAsUser fixture. Use Supabase Local for testing.'
      );
    }

    const { userId } = await resolveWorkerPairIds(supabaseAdmin);
    const accessToken = await getUserAccessToken(supabaseAdmin, userId);

    // `persistSession: false` and `autoRefreshToken: false`: this client lives
    // for one test and must never write a session to the shared storage the
    // browser contexts read.
    const client = createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    await use(client);
  },

  coupleEvents: async ({ supabaseAdmin }, use) => {
    const pair = await resolveWorkerPairIds(supabaseAdmin);
    // One reading for the whole test, shared by every seeded date. See
    // `../factories/events.ts` for why the offsets take an anchor at all.
    const anchor = new Date();

    // Cleared BEFORE as well as after: a previously failed run leaves rows
    // owned by this same fixed worker identity, and every events assertion is
    // about which rows the couple has. Self-healing here is what the existing
    // specs open with by hand (`tests/e2e/home/events.spec.ts:135-137`).
    await clearPairEvents(supabaseAdmin, pair);

    await use({
      userId: pair.userId,
      partnerId: pair.partnerId,
      anchor,
      seed: (specs: EventSpec[]) => seedEvents(supabaseAdmin, pair, specs, anchor),
      clear: () => clearPairEvents(supabaseAdmin, pair),
    });

    // Teardown deletes by owner rather than by tracked id, so a row created
    // through the UI mid-test is cleaned up too. Both ids belong to this
    // worker's own pair, so this never touches another worker's rows.
    await clearPairEvents(supabaseAdmin, pair);
  },
});

export { expect } from '@playwright/test';
