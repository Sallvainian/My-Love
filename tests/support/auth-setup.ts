/**
 * Playwright Auth Setup
 *
 * Authenticates as test user 1 via Supabase API and injects the session
 * into the browser's localStorage. Runs once before all chromium tests
 * via the 'setup' project dependency.
 *
 * Uses API-based auth (not UI login) for speed and reliability —
 * avoids waiting for React to render the login form.
 *
 * Resolves Supabase connection details directly from `supabase status`
 * so it works regardless of env var propagation from playwright.config.ts.
 *
 * Requires test users to exist in local Supabase with known credentials.
 */
import { test as setup, expect } from '@playwright/test';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';

const authFile = 'tests/.auth/user.json';

/**
 * Parse `supabase status -o env` to get local Supabase connection details.
 * Returns a map of KEY=VALUE pairs. Throws if Supabase CLI is unavailable.
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

setup('authenticate as test user 1', async ({ page }) => {
  // Resolve Supabase vars — prefer env, fall back to `supabase status`
  let url = process.env.SUPABASE_URL;
  let anonKey = process.env.SUPABASE_ANON_KEY;

  // Validate URL is actually usable (env might be unset or stale)
  const isValidUrl = (s?: string) => {
    try {
      return s ? /^https?:\/\//.test(s) && !!new URL(s) : false;
    } catch {
      return false;
    }
  };

  if (!isValidUrl(url) || !anonKey) {
    const vars = getSupabaseLocalVars();
    url = vars.API_URL;
    anonKey = vars.ANON_KEY;

    if (!isValidUrl(url) || !anonKey) {
      throw new Error(
        `Cannot resolve Supabase connection. Got URL=${JSON.stringify(url)}. ` +
          'Ensure Supabase local is running: `supabase start`'
      );
    }
  }

  // Authenticate via Supabase API (bypasses UI for reliability)
  const supabase = createClient(url!, anonKey!, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'testuser1@test.example.com',
    password: 'testpassword123',
  });

  if (error) {
    throw new Error(
      `Auth setup failed: ${error.message}. Ensure test user exists in local Supabase.`
    );
  }

  // Supabase JS stores session under: sb-<hostname>-auth-token
  const storageKey = `sb-${new URL(url!).hostname}-auth-token`;

  // Load the app and inject the authenticated session into localStorage
  await page.goto('/');
  await page.evaluate(
    ({ key, session }) => {
      localStorage.setItem(key, JSON.stringify(session));
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
