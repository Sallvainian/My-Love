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
 * Requires test users to exist in local Supabase with known credentials.
 */
import { test as setup, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const authFile = 'tests/.auth/user.json';

setup('authenticate as test user 1', async ({ page }) => {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_ANON_KEY are required for auth setup. ' +
        'These should be auto-detected from `supabase status` in playwright.config.ts.'
    );
  }

  // Authenticate via Supabase API (bypasses UI for reliability)
  const supabase = createClient(url, anonKey, {
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
  // Use VITE_SUPABASE_URL (what the app sees) to derive the correct key
  const appUrl = process.env.VITE_SUPABASE_URL || url;
  const storageKey = `sb-${new URL(appUrl).hostname}-auth-token`;

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
