/**
 * Global Setup: User Provisioning
 *
 * Ensures test users exist in Supabase and are linked as partner pairs.
 * Runs once before all tests via playwright.config.ts globalSetup.
 *
 * Does NOT pre-fetch auth tokens — the auth-session library handles that
 * lazily per-worker on first test.
 */
import { createClient } from '@supabase/supabase-js';
import { cpus } from 'os';
import { initializeAuthSystem } from './setup';
import { authStorageInit } from '@seontechnologies/playwright-utils/auth-session';

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
  if (Number.isNaN(parsed) || parsed < 1) return defaultAuthPoolSize;

  return parsed;
}

function getWorkerEmail(workerIndex: number): string {
  return `testworker${workerIndex}@test.example.com`;
}

function getWorkerPartnerEmail(workerIndex: number): string {
  return `testworker${workerIndex}-partner@test.example.com`;
}

async function ensureUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: ReturnType<typeof createClient<any, any, any>>,
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

  if (!createError) return;

  if (!/already.*registered/i.test(createError.message)) {
    throw new Error(`Failed to create user ${email}: ${createError.message}`);
  }

  // User exists — find and update
  const perPage = 1000;
  const maxPages = 10;
  let existingUserId: string | null = null;

  for (let page = 1; page <= maxPages; page++) {
    const { data, error: listError } = await admin.auth.admin.listUsers({ page, perPage });
    if (listError) throw new Error(`Failed to list users for ${email}: ${listError.message}`);

    const users = data?.users ?? [];
    const existing = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (existing) {
      existingUserId = existing.id;
      break;
    }
    if (users.length < perPage) break;
  }

  if (!existingUserId) {
    throw new Error(`User ${email} was expected to exist but was not found`);
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(existingUserId, {
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (updateError) throw new Error(`Failed to update user ${email}: ${updateError.message}`);
}

async function getAppUserIdByEmail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: ReturnType<typeof createClient<any, any, any>>,
  email: string
): Promise<string> {
  const maxAttempts = 10;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { data, error } = await admin.from('users').select('id').eq('email', email).single();
    if (!error && data?.id) return data.id;
    if (attempt === maxAttempts) {
      throw new Error(
        `Could not resolve app user for ${email} after ${maxAttempts} attempts: ${error?.message ?? 'not found'}`
      );
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('unreachable');
}

async function linkUserPair(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: ReturnType<typeof createClient<any, any, any>>,
  firstEmail: string,
  secondEmail: string
): Promise<void> {
  const firstUserId = await getAppUserIdByEmail(admin, firstEmail);
  const secondUserId = await getAppUserIdByEmail(admin, secondEmail);

  const { error: e1 } = await admin
    .from('users')
    .update({ partner_id: secondUserId })
    .eq('id', firstUserId);
  if (e1) throw new Error(`Failed to link ${firstEmail} to ${secondEmail}: ${e1.message}`);

  const { error: e2 } = await admin
    .from('users')
    .update({ partner_id: firstUserId })
    .eq('id', secondUserId);
  if (e2) throw new Error(`Failed to link ${secondEmail} to ${firstEmail}: ${e2.message}`);
}

export default async function globalSetup(): Promise<void> {
  // Initialize the auth system (provider + config) so authStorageInit works
  initializeAuthSystem();

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      `[global-setup] Missing env vars: SUPABASE_URL=${url ? 'set' : 'unset'}, ` +
        `SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey ? 'set' : 'unset'}. ` +
        'Ensure Supabase local is running.'
    );
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Create legacy users
  for (const user of LEGACY_TEST_USERS) {
    await ensureUser(admin, user.email, TEST_USER_PASSWORD, user.displayName);
  }

  // Create worker pool users + partners
  const authPoolSize = getAuthPoolSize();
  for (let i = 0; i < authPoolSize; i++) {
    await ensureUser(admin, getWorkerEmail(i), TEST_USER_PASSWORD, `Test Worker ${i}`);
    await ensureUser(
      admin,
      getWorkerPartnerEmail(i),
      TEST_USER_PASSWORD,
      `Test Worker ${i} Partner`
    );
  }

  // Link partner pairs
  await linkUserPair(admin, LEGACY_TEST_USERS[0].email, LEGACY_TEST_USERS[1].email);
  for (let i = 0; i < authPoolSize; i++) {
    await linkUserPair(admin, getWorkerEmail(i), getWorkerPartnerEmail(i));
  }

  // Initialize storage directories (empty storage-state.json files)
  // so Playwright can find them before the first lazy auth fetch
  authStorageInit({ environment: 'local', userIdentifier: 'default' });
  for (let i = 0; i < authPoolSize; i++) {
    authStorageInit({ environment: 'local', userIdentifier: `worker-${i}` });
    authStorageInit({ environment: 'local', userIdentifier: `worker-${i}-partner` });
  }

  console.log(`[global-setup] Provisioned ${authPoolSize} worker pairs + legacy users`);
}
