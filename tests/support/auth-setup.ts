/**
 * Playwright Auth Setup
 *
 * Creates test user (if needed) via Supabase Admin API, authenticates
 * via signInWithPassword, and injects the session into the browser's
 * localStorage. Runs once before all chromium tests via the 'setup'
 * project dependency.
 *
 * Uses API-based auth (not UI login) for speed and reliability.
 *
 * The scripture_seed_test_data RPC expects auth users to already exist
 * (SELECT id FROM auth.users ORDER BY created_at LIMIT 1), so this
 * setup ensures they do before any E2E test runs.
 */
import { test as setup, expect } from '@playwright/test';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';

const authFile = 'tests/.auth/user.json';

const TEST_USER_EMAIL = 'testuser1@test.example.com';
const TEST_USER_PASSWORD = 'testpassword123';

/**
 * Parse `supabase status -o env` to get local Supabase connection details.
 */
function getSupabaseLocalVars(): Record<string, string> {
  const output = execSync('supabase status -o env 2>/dev/null', {
    encoding: 'utf-8',
  });
  const vars: Record<string, string> = {};
  for (const line of output.split('\n')) {
    const match = line.match(/^(\w+)="(.+)"$/);
    if (match) vars[match[1]] = match[2];
  }
  return vars;
}

function isValidUrl(s?: string): boolean {
  try {
    return s ? /^https?:\/\//.test(s) && !!new URL(s) : false;
  } catch {
    return false;
  }
}

setup('authenticate as test user 1', async ({ page }) => {
  // Resolve Supabase vars — prefer env, fall back to `supabase status`
  let url = process.env.SUPABASE_URL;
  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let anonKey = process.env.SUPABASE_ANON_KEY;

  if (!isValidUrl(url) || !serviceRoleKey || !anonKey) {
    const vars = getSupabaseLocalVars();
    url = vars.API_URL;
    serviceRoleKey = vars.SERVICE_ROLE_KEY;
    anonKey = vars.ANON_KEY;

    if (!isValidUrl(url) || !serviceRoleKey || !anonKey) {
      throw new Error(
        `Cannot resolve Supabase connection. URL=${JSON.stringify(url)}. ` +
          'Ensure Supabase local is running: `supabase start`'
      );
    }
  }

  // Use admin client to ensure test user exists
  const admin = createClient(url!, serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Create test user (idempotent — ignore "already registered" error)
  const { error: createError } = await admin.auth.admin.createUser({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: 'Test User 1' },
  });

  if (createError) {
    if (!createError.message.includes('already been registered')) {
      throw new Error(`Failed to create test user: ${createError.message}`);
    }
    // User already exists - update password to ensure it matches test expectations
    const { data: users } = await admin.auth.admin.listUsers();
    const existingUser = users.users.find((u) => u.email === TEST_USER_EMAIL);
    if (existingUser) {
      const { error: updateError } = await admin.auth.admin.updateUserById(existingUser.id, {
        password: TEST_USER_PASSWORD,
        email_confirm: true,
      });
      if (updateError) {
        throw new Error(`Failed to update test user password: ${updateError.message}`);
      }
    }
  }

  // Create a second test user so the seed RPC can find a partner for together-mode sessions.
  // The scripture_seed_test_data RPC selects user2 as: SELECT id FROM auth.users WHERE id != user1 LIMIT 1.
  const { error: createError2 } = await admin.auth.admin.createUser({
    email: 'testuser2@test.example.com',
    password: TEST_USER_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: 'Test User 2' },
  });

  if (createError2) {
    if (!createError2.message.includes('already been registered')) {
      throw new Error(`Failed to create test user 2: ${createError2.message}`);
    }
    // User already exists - update password to ensure it matches test expectations
    const { data: users } = await admin.auth.admin.listUsers();
    const existingUser = users.users.find((u) => u.email === 'testuser2@test.example.com');
    if (existingUser) {
      const { error: updateError } = await admin.auth.admin.updateUserById(existingUser.id, {
        password: TEST_USER_PASSWORD,
        email_confirm: true,
      });
      if (updateError) {
        throw new Error(`Failed to update test user 2 password: ${updateError.message}`);
      }
    }
  }

  // Sign in as test user with anon key (same permissions as the real app)
  const client = createClient(url!, anonKey!, {
    auth: { persistSession: false },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });

  if (error) {
    throw new Error(`Auth sign-in failed: ${error.message}`);
  }

  // Supabase JS stores session under: sb-<first-label-of-hostname>-auth-token
  // e.g. http://127.0.0.1:54321 → sb-127-auth-token (NOT sb-127.0.0.1)
  const storageKey = `sb-${new URL(url!).hostname.split('.')[0]}-auth-token`;

  // Load the app and inject the authenticated session into localStorage
  await page.goto('/');
  await page.evaluate(
    ({ key, session }) => {
      localStorage.setItem(key, JSON.stringify(session));
      // Bypass the WelcomeSplash screen for E2E tests
      // App shows splash if lastWelcomeView is missing or >60min old
      localStorage.setItem('lastWelcomeView', Date.now().toString());
    },
    { key: storageKey, session: data.session },
  );

  // Reload so the app's auth check picks up the session
  await page.reload();

  // Verify: login screen should not be visible (user is authenticated)
  await expect(page.locator('.login-screen')).not.toBeVisible({ timeout: 15_000 });

  // Save authenticated browser state for reuse by test projects
  await page.context().storageState({ path: authFile });
});
