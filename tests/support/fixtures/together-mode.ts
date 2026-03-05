/**
 * Together Mode Fixture
 *
 * Encapsulates the full together-mode setup/teardown lifecycle:
 * seed → link partners → mark seeded sessions complete → navigate both
 * users to role selection → cleanup (unlink + session cleanup).
 *
 * Tests receive both users already at the role selection screen and only
 * need to handle role clicks, state assertions, and mid-test DB work.
 */
import { mergeTests } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import {
  createTestSession,
  cleanupTestSession,
  linkTestPartners,
  unlinkTestPartners,
} from '../factories';
import type { SeedResult } from '../factories';
import { navigateToTogetherRoleSelection } from '../helpers/scripture-lobby';

// Import the fixture files that provide our deps so TypeScript knows the types
import { test as customFixtures } from './index';
import { test as authFixture } from './auth';

const TEST_USER_PASSWORD = 'testpassword123';

/** Map worker-N-partner → email. */
function partnerEmail(identifier: string): string {
  const m = identifier.match(/^worker-(\d+)-partner$/);
  if (m) return `testworker${m[1]}-partner@test.example.com`;
  return `${identifier}@test.example.com`;
}

export type TogetherModeContext = {
  /** Seed result — has test_user1_id, test_user2_id, session_ids */
  seed: SeedResult;
  /** Browser context authenticated as the partner user */
  partnerContext: BrowserContext;
  /** Page for the partner user, already at the role selection screen */
  partnerPage: Page;
  /**
   * Mutable list of session IDs to clean up after the test.
   * The fixture pre-populates it with seed.session_ids plus both
   * UI-created session IDs. Tests may push additional IDs here.
   */
  sessionIdsToClean: string[];
  /**
   * The session ID created by User A's UI navigation (the active lobby session).
   * Both users join this session. Useful for mid-test DB manipulation.
   */
  uiSessionId: string;
};

type TogetherModeFixtures = {
  togetherMode: TogetherModeContext;
};

// Build a base that already has supabaseAdmin and auth fixtures
const togetherModeBase = mergeTests(customFixtures, authFixture);

export const test = togetherModeBase.extend<TogetherModeFixtures>({
  togetherMode: async ({ page, browser, supabaseAdmin, partnerUserIdentifier }, use) => {
    // 1. Seed test data
    const seed = await createTestSession(supabaseAdmin, {
      sessionCount: 1,
      preset: 'mid_session',
    });

    // 2. Fail fast if no partner user returned
    if (!seed.test_user2_id) {
      throw new Error('[togetherMode] createTestSession did not return a partner user ID');
    }

    // 3. Link the two test users as partners
    await linkTestPartners(supabaseAdmin, seed.test_user1_id, seed.test_user2_id);

    // 4. Build the cleanup list (start with seeded session IDs)
    const sessionIdsToClean: string[] = [...seed.session_ids];

    // 5. Mark seeded sessions complete so they don't interfere with the
    //    UI-created lobby session
    await supabaseAdmin
      .from('scripture_sessions')
      .update({ status: 'complete', current_phase: 'complete' })
      .in('id', seed.session_ids);

    // 6. User A navigates to role selection
    const uiSessionA = await navigateToTogetherRoleSelection(page);
    if (uiSessionA) sessionIdsToClean.push(uiSessionA);

    // 7. Fresh signInWithPassword for partner — bypasses token cache entirely.
    //    Cached tokens are unreliable in together-mode tests because parallel
    //    workers and session manipulation can invalidate them on the backend.
    let partnerAuthAttempts = 0;
    const maxPartnerAuthAttempts = 2;
    let partnerContext!: BrowserContext;
    let partnerPage!: Page;
    let uiSessionB = '';

    const baseURL = new URL(page.url()).origin;
    const supabaseUrl = process.env.SUPABASE_URL!;
    const anonKey = process.env.SUPABASE_ANON_KEY!;
    const email = partnerEmail(partnerUserIdentifier);
    const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;

    while (partnerAuthAttempts < maxPartnerAuthAttempts) {
      partnerAuthAttempts++;

      // Fresh sign-in — no cache, guaranteed valid JWT
      const client = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false },
      });
      const { data, error: authError } = await client.auth.signInWithPassword({
        email,
        password: TEST_USER_PASSWORD,
      });
      if (authError || !data.session) {
        throw new Error(
          `[togetherMode] signInWithPassword failed for ${email}: ${authError?.message ?? 'missing session'}`
        );
      }

      const storageState = {
        cookies: [] as never[],
        origins: [
          {
            origin: baseURL,
            localStorage: [
              { name: storageKey, value: JSON.stringify(data.session) },
              { name: 'lastWelcomeView', value: Date.now().toString() },
            ],
          },
        ],
      };

      partnerContext = await browser.newContext({ storageState, baseURL });
      partnerPage = await partnerContext.newPage();

      // 8. User B navigates to role selection
      try {
        uiSessionB = await navigateToTogetherRoleSelection(partnerPage);
        break; // Success — exit retry loop
      } catch (err) {
        await partnerContext.close().catch(() => {});
        if (partnerAuthAttempts >= maxPartnerAuthAttempts) {
          throw new Error(
            `[togetherMode] Partner navigation failed after ${maxPartnerAuthAttempts} attempts: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
        // Retry with a fresh signInWithPassword (no cache involved)
      }
    }
    if (uiSessionB && uiSessionB !== uiSessionA) sessionIdsToClean.push(uiSessionB);

    // 9. Yield the context to the test
    try {
      await use({ seed, partnerContext, partnerPage, sessionIdsToClean, uiSessionId: uiSessionA });
    } finally {
      // 10. Auto cleanup — always runs regardless of test pass/fail
      await partnerContext.close().catch(() => {});
      await cleanupTestSession(supabaseAdmin, sessionIdsToClean);
      await unlinkTestPartners(supabaseAdmin, seed.test_user1_id, seed.test_user2_id!);
    }
  },
});
