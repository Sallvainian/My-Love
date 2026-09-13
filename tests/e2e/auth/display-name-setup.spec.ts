/**
 * P0 E2E: Authentication - Display Name Setup
 *
 * Critical path: an account that arrived without a name must be asked for one
 * before it can use the app, and answering must stick.
 *
 * These two cases were skipped for want of "a test user without display_name in
 * user_metadata", because the gate used to be
 * `!session.user.user_metadata.display_name` and the Supabase client owns that
 * object — network interception cannot reach it. Story 8 moved the gate onto a
 * read of `public.users.display_name`, and the trigger seeds that column from
 * the email when no metadata name is supplied
 * (20251206024345_remote_schema.sql:164). So the fixture is now simply an
 * account created without `user_metadata`, which is what these tests do.
 *
 * The account is dedicated and thrown away, created in the shape of
 * `tests/support/auth/global-setup.ts:28-33` minus the display name. Never a
 * worker-pool account: those are provisioned WITH a name, are shared between
 * parallel workers, and this spec both reads and writes the name.
 *
 * `authSessionEnabled: false` drops the worker's storage state so the browser
 * starts signed out and signs in as the dedicated account through the real
 * login form.
 */
import type { Page } from '@playwright/test';
import { TEST_USER_PASSWORD } from '../../support/test-credentials';
import { test, expect } from '../../support/merged-fixtures';
import type { TypedSupabaseClient } from '../../support/factories';

type Dedicated = { email: string; userId: string; cleanup: () => Promise<void> };

/**
 * An account with no `user_metadata` at all, so `sync_user_profile()` seeds its
 * profile row with the email and the app reads that as "no name chosen".
 */
async function createNamelessAccount(
  supabaseAdmin: TypedSupabaseClient,
  prefix: string
): Promise<Dedicated> {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.example.com`;
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: TEST_USER_PASSWORD,
    email_confirm: true,
    // Deliberately no user_metadata — that absence IS the fixture.
  });

  if (error || !data?.user) {
    throw new Error(`Failed to create the dedicated account: ${error?.message ?? 'no user'}`);
  }

  const userId = data.user.id;
  return {
    email,
    userId,
    cleanup: async () => {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteError) throw new Error(`Failed to delete ${email}: ${deleteError.message}`);
    },
  };
}

/**
 * Stamp the welcome-splash timer so Home renders straight away, the same way
 * every other signed-in E2E does (`tests/e2e/home/events.spec.ts:44`). An init
 * script rather than an `evaluate`, so it is in place before the app's first
 * render reads it.
 */
async function suppressWelcomeSplash(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('lastWelcomeView', String(Date.now()));
  });
}

async function readProfileName(
  supabaseAdmin: TypedSupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('display_name')
    .eq('id', userId)
    .single();
  if (error) throw new Error(`Failed to read the profile row: ${error.message}`);
  return data?.display_name ?? null;
}

test.describe('Display Name Setup', () => {
  // Auth tests must run WITHOUT the shared authenticated storage state so they
  // can sign in as their own account.
  test.use({ authSessionEnabled: false });

  test('[P0] should show display name setup for new OAuth users', async ({
    page,
    supabaseAdmin,
  }) => {
    // GIVEN: An account signed up without a display name.
    const account = await createNamelessAccount(supabaseAdmin, 'nameless-shows');
    const failures: unknown[] = [];

    try {
      // Premise: the trigger seeded the profile with the email, which is the
      // state the gate has to recognise as "no name chosen".
      expect(await readProfileName(supabaseAdmin, account.userId)).toBe(account.email);

      // WHEN: App loads after signing in.
      // The worker storage state normally carries this
      // (`tests/support/auth/supabase-auth-provider.ts:153`) and
      // `authSessionEnabled: false` drops it, so the 60-minute welcome splash
      // would otherwise stand between setup and the app.
      await suppressWelcomeSplash(page);
      await page.goto('/');
      await expect(page.getByTestId('login-screen')).toBeVisible();
      await page.getByRole('textbox', { name: 'Email' }).fill(account.email);
      await page.getByTestId('password-input').fill(TEST_USER_PASSWORD);
      await page.getByTestId('submit-button').click();

      // THEN: Display name setup modal is shown, and the app is not.
      await expect(page.getByTestId('display-name-setup')).toBeVisible();
      await expect(page.getByTestId('app-container')).toHaveCount(0);

      // AND on a cold load, not just across the sign-in transition. This is the
      // path the nameless account actually arrives by: `needsDisplayName` starts
      // false, so the overlay here can only come from the gate having read the
      // profile on load. Asserting it is *visible* rather than absent is what
      // makes that observable — a `toHaveCount(0)` would pass whether or not the
      // gate ever ran.
      await page.reload();
      await expect(page.getByTestId('display-name-setup')).toBeVisible();
      await expect(page.getByTestId('app-container')).toHaveCount(0);
    } catch (error) {
      failures.push(error);
    }

    try {
      await account.cleanup();
    } catch (error) {
      failures.push(error);
    }

    if (failures.length > 0) {
      throw new AggregateError(failures, 'Display name gate assertion or account cleanup failed');
    }
  });

  test('[P0] should allow setting display name and proceed to app', async ({
    page,
    supabaseAdmin,
  }) => {
    // GIVEN: Display name setup modal is shown.
    const account = await createNamelessAccount(supabaseAdmin, 'nameless-sets');
    const chosenName = 'Chosen In E2E';
    const failures: unknown[] = [];

    // The whole point of the change is that saving a name is a profile write and
    // nothing else. A metadata write is a non-GET to /auth/v1/user; a session
    // refresh is a refresh_token grant.
    const authWrites: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      const method = request.method();
      if (method !== 'GET' && /\/auth\/v1\/user(\?|$)/.test(url)) {
        authWrites.push(`${method} ${url}`);
      }
      if (/\/auth\/v1\/token\?grant_type=refresh_token/.test(url)) {
        authWrites.push(`${method} ${url}`);
      }
    });

    try {
      await suppressWelcomeSplash(page);
      await page.goto('/');
      await expect(page.getByTestId('login-screen')).toBeVisible();
      await page.getByRole('textbox', { name: 'Email' }).fill(account.email);
      await page.getByTestId('password-input').fill(TEST_USER_PASSWORD);
      await page.getByTestId('submit-button').click();
      await expect(page.getByTestId('display-name-setup')).toBeVisible();

      // WHEN: User enters display name and submits.
      await page.getByLabel('Display Name').fill(chosenName);
      await page.getByTestId('display-name-submit').click();

      // THEN: Modal closes and main app is displayed.
      await expect(page.getByTestId('display-name-setup')).toHaveCount(0);
      await expect(page.getByTestId('app-container')).toBeVisible();

      // The name went to the profile row, and only there.
      expect(await readProfileName(supabaseAdmin, account.userId)).toBe(chosenName);
      expect(authWrites, 'setup must not write auth metadata or refresh the session').toEqual([]);

      // And it survives a reload — which is the case the old trigger broke, and
      // also what proves the gate is reading the saved name back rather than
      // remembering a React state flag.
      await page.reload();
      await expect(page.getByTestId('app-container')).toBeVisible();
      await expect(page.getByTestId('display-name-setup')).toHaveCount(0);
    } catch (error) {
      failures.push(error);
    }

    try {
      await account.cleanup();
    } catch (error) {
      failures.push(error);
    }

    if (failures.length > 0) {
      throw new AggregateError(failures, 'Display name setup assertion or account cleanup failed');
    }
  });
});
