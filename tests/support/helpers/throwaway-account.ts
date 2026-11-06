/**
 * Throwaway accounts for E2E specs that need a real, unlinked account: made
 * through the admin client, named so sign-in lands in the app rather than on
 * the name-setup screen, and deleted at teardown through `cleanup`. Never the
 * worker pool, whose pairs a spec must not link or unlink (AGENTS.md).
 */
import type { Page } from '@playwright/test';
import { expect } from '../merged-fixtures';
import type { TypedSupabaseClient } from '../factories';
import { TEST_USER_PASSWORD } from '../test-credentials';
import { createOutsiderClient, deleteOutsider } from './rls-security';

export type Throwaway = Awaited<ReturnType<typeof createOutsiderClient>> & {
  email: string;
  name: string;
};

/**
 * A throwaway account with a chosen display name, so sign-in lands in the app
 * rather than on the name-setup screen. The name is written by the account
 * itself, through the same column grant the app's own name form uses.
 */
export async function createThrowaway(
  supabaseAdmin: TypedSupabaseClient,
  cleanup: { defer: (label: string, fn: () => Promise<unknown>) => void },
  role: string
): Promise<Throwaway> {
  const tag = Math.random().toString(36).slice(2, 8);
  const account = await createOutsiderClient(supabaseAdmin, `connect-${role}-${tag}`);
  cleanup.defer(`delete throwaway account ${role}`, () => deleteOutsider(account));

  const { data, error: userError } = await account.client.auth.getUser();
  if (userError || !data.user?.email) throw new Error(`No email for ${role}: ${userError?.message}`);
  const name = `Connect ${role.toUpperCase()} ${tag}`;
  const { error } = await account.client
    .from('users')
    .update({ display_name: name, updated_at: new Date().toISOString() })
    .eq('id', account.userId);
  if (error) throw new Error(`Failed to name ${role}: ${error.message}`);

  return { ...account, email: data.user.email, name };
}

/** Sign in through the real login form and wait for the app. */
export async function signIn(page: Page, account: Throwaway): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('login-screen')).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(account.email);
  await page.getByTestId('password-input').fill(TEST_USER_PASSWORD);
  await page.getByTestId('submit-button').click();
  await expect(page.getByTestId('app-container')).toBeVisible();
}
