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
import type { Browser } from '@playwright/test';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync } from 'fs';
import { cpus } from 'os';

const AUTH_DIR = 'tests/.auth';
const LEGACY_AUTH_FILE = `${AUTH_DIR}/user.json`;

const TEST_USER_PASSWORD = 'testpassword123';
const MIN_AUTH_POOL_SIZE = 8;

const LEGACY_TEST_USERS = [
  { email: 'testuser1@test.example.com', displayName: 'Test User 1' },
  { email: 'testuser2@test.example.com', displayName: 'Test User 2' },
];

function getAuthPoolSize(): number {
  const cpuCount = cpus().length;
  const defaultAuthPoolSize = Number.isFinite(cpuCount)
    ? Math.max(MIN_AUTH_POOL_SIZE, cpuCount)
    : MIN_AUTH_POOL_SIZE;

  const raw = process.env.PLAYWRIGHT_AUTH_POOL_SIZE;
  if (!raw) return defaultAuthPoolSize;

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return defaultAuthPoolSize;
  }

  return parsed;
}

function getWorkerEmail(workerIndex: number): string {
  return `testworker${workerIndex}@test.example.com`;
}

function getWorkerPartnerEmail(workerIndex: number): string {
  return `testworker${workerIndex}-partner@test.example.com`;
}

function getWorkerAuthFile(workerIndex: number): string {
  return `${AUTH_DIR}/worker-${workerIndex}.json`;
}

function getWorkerPartnerAuthFile(workerIndex: number): string {
  return `${AUTH_DIR}/worker-${workerIndex}-partner.json`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function ensureUser(
  admin: ReturnType<typeof createClient>,
  email: string,
  password: string,
  displayName: string
): Promise<void> {
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (!createError) {
    return;
  }

  if (!/already.*registered/i.test(createError.message)) {
    throw new Error(`Failed to create user ${email}: ${createError.message}`);
  }

  // Supabase listUsers is paginated; scan pages to avoid false negatives
  // when projects accumulate many test users over time.
  const perPage = 1000;
  const maxPages = 10;
  let existingUserId: string | null = null;

  for (let page = 1; page <= maxPages; page++) {
    const { data, error: listError } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (listError) {
      throw new Error(`Failed to list users for ${email}: ${listError.message}`);
    }

    const users = data?.users ?? [];
    const existingUser = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      existingUserId = existingUser.id;
      break;
    }

    if (users.length < perPage) {
      break;
    }
  }

  if (!existingUserId) {
    throw new Error(`User ${email} was expected to exist but was not found`);
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(existingUserId, {
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (updateError) {
    throw new Error(`Failed to update user ${email}: ${updateError.message}`);
  }
}

async function getAppUserIdByEmail(
  admin: ReturnType<typeof createClient>,
  email: string
): Promise<string> {
  const maxAttempts = 10;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { data, error } = await admin.from('users').select('id').eq('email', email).single();

    if (!error && data?.id) {
      return data.id;
    }

    if (attempt === maxAttempts) {
      throw new Error(
        `Could not resolve app user for ${email} after ${maxAttempts} attempts: ${error?.message ?? 'not found'}`
      );
    }

    await sleep(250);
  }

  throw new Error(`Could not resolve app user for ${email}`);
}

async function linkUserPair(
  admin: ReturnType<typeof createClient>,
  firstEmail: string,
  secondEmail: string
): Promise<void> {
  const firstUserId = await getAppUserIdByEmail(admin, firstEmail);
  const secondUserId = await getAppUserIdByEmail(admin, secondEmail);

  const { error: firstUpdateError } = await admin
    .from('users')
    .update({ partner_id: secondUserId })
    .eq('id', firstUserId);
  if (firstUpdateError) {
    throw new Error(`Failed to link ${firstEmail} to ${secondEmail}: ${firstUpdateError.message}`);
  }

  const { error: secondUpdateError } = await admin
    .from('users')
    .update({ partner_id: firstUserId })
    .eq('id', secondUserId);
  if (secondUpdateError) {
    throw new Error(`Failed to link ${secondEmail} to ${firstEmail}: ${secondUpdateError.message}`);
  }
}

async function signInAndPersistStorageState(
  browser: Browser,
  url: string,
  anonKey: string,
  email: string,
  password: string,
  authPath: string
): Promise<void> {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    throw new Error(`Auth sign-in failed for ${email}: ${error?.message ?? 'missing session'}`);
  }

  const storageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/');
  await page.evaluate(
    ({ key, session }) => {
      localStorage.setItem(key, JSON.stringify(session));
      // Bypass WelcomeSplash for deterministic E2E entry.
      localStorage.setItem('lastWelcomeView', Date.now().toString());
    },
    { key: storageKey, session: data.session }
  );
  await page.reload();
  await expect(page.locator('.login-screen')).not.toBeVisible({ timeout: 15_000 });
  await context.storageState({ path: authPath });
  await context.close();
}

setup('authenticate worker test users', async ({ browser }) => {
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

  // Use admin client to ensure test users exist
  const admin = createClient(url!, serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const user of LEGACY_TEST_USERS) {
    await ensureUser(admin, user.email, TEST_USER_PASSWORD, user.displayName);
  }

  const authPoolSize = getAuthPoolSize();
  for (let workerIndex = 0; workerIndex < authPoolSize; workerIndex++) {
    await ensureUser(
      admin,
      getWorkerEmail(workerIndex),
      TEST_USER_PASSWORD,
      `Test Worker ${workerIndex}`
    );
    await ensureUser(
      admin,
      getWorkerPartnerEmail(workerIndex),
      TEST_USER_PASSWORD,
      `Test Worker ${workerIndex} Partner`
    );
  }

  // Ensure default users are linked for tests that expect a partner by default.
  await linkUserPair(admin, LEGACY_TEST_USERS[0].email, LEGACY_TEST_USERS[1].email);

  // Ensure each worker user has a dedicated linked partner account.
  for (let workerIndex = 0; workerIndex < authPoolSize; workerIndex++) {
    await linkUserPair(admin, getWorkerEmail(workerIndex), getWorkerPartnerEmail(workerIndex));
  }

  mkdirSync(AUTH_DIR, { recursive: true });

  // Preserve legacy single-user auth state for compatibility.
  await signInAndPersistStorageState(
    browser,
    url!,
    anonKey!,
    LEGACY_TEST_USERS[0].email,
    TEST_USER_PASSWORD,
    LEGACY_AUTH_FILE
  );

  // Generate worker-isolated auth states for parallel test safety.
  for (let workerIndex = 0; workerIndex < authPoolSize; workerIndex++) {
    await signInAndPersistStorageState(
      browser,
      url!,
      anonKey!,
      getWorkerEmail(workerIndex),
      TEST_USER_PASSWORD,
      getWorkerAuthFile(workerIndex)
    );
    // Generate partner auth state for multi-user (together-mode) tests.
    await signInAndPersistStorageState(
      browser,
      url!,
      anonKey!,
      getWorkerPartnerEmail(workerIndex),
      TEST_USER_PASSWORD,
      getWorkerPartnerAuthFile(workerIndex)
    );
  }
});
