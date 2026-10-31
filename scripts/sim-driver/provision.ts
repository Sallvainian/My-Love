// Provisions the sim driver's fixture pair on the local Supabase stack:
// two confirmed accounts with fictional names, linked as partners. No E2E
// worker slot (tests/support/auth/worker-pool.ts) uses them, so a driver run
// never writes another worker's rows.
//
//   node scripts/sim-driver/provision.ts   (run by `sim provision`)
//
// Idempotent, as ensureUser/linkUserPair in tests/support/auth/global-setup.ts
// are: an existing account gets its password and name reset. Needs
// SIM_SUPABASE_URL and SIM_SUPABASE_SECRET_KEY (`sim` reads both from
// `supabase status`) and refuses any host but 127.0.0.1 or localhost.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { TEST_USER_PASSWORD } from '../../tests/support/test-credentials.ts';

const FIXTURE_PAIR = [
  { email: 'simdriver@test.example.com', displayName: 'Casey' },
  { email: 'simdriver-partner@test.example.com', displayName: 'Jessie' },
] as const;

function localConfig(): { url: string; key: string } {
  const url = process.env.SIM_SUPABASE_URL ?? '';
  const key = process.env.SIM_SUPABASE_SECRET_KEY ?? '';
  if (!url || !key) throw new Error('SIM_SUPABASE_URL and SIM_SUPABASE_SECRET_KEY must be set');
  const host = new URL(url).hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(`refusing ${url}: the fixture pair lives on the local stack only`);
  }
  return { url, key };
}

async function findAuthUserId(admin: SupabaseClient, email: string): Promise<string> {
  const perPage = 1000;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listing users for ${email}: ${error.message}`);
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found) return found.id;
    if (data.users.length < perPage) break;
  }
  throw new Error(`${email} was reported as registered but was not found`);
}

async function ensureUser(admin: SupabaseClient, email: string, displayName: string) {
  const { error } = await admin.auth.admin.createUser({
    email,
    password: TEST_USER_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (!error) return 'created';
  if (!/already.*registered/i.test(error.message)) {
    throw new Error(`creating ${email}: ${error.message}`);
  }
  const id = await findAuthUserId(admin, email);
  const { error: updateError } = await admin.auth.admin.updateUserById(id, {
    password: TEST_USER_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (updateError) throw new Error(`updating ${email}: ${updateError.message}`);
  // The profile keeps its own name once it exists, so reset it here too.
  const { error: nameError } = await admin
    .from('users')
    .update({ display_name: displayName, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (nameError) throw new Error(`resetting the name of ${email}: ${nameError.message}`);
  return 'reset';
}

// The profile row comes from a trigger on the auth user and can trail it.
async function profileId(admin: SupabaseClient, email: string): Promise<string> {
  for (let attempt = 1; attempt <= 10; attempt++) {
    const { data, error } = await admin.from('users').select('id').eq('email', email).single();
    if (!error && data?.id) return data.id as string;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no profile row for ${email}`);
}

async function main() {
  const { url, key } = localConfig();
  const admin = createClient(url, key, { auth: { persistSession: false } });
  for (const { email, displayName } of FIXTURE_PAIR) {
    console.log(`${email} (${displayName}): ${await ensureUser(admin, email, displayName)}`);
  }
  const [first, second] = await Promise.all(FIXTURE_PAIR.map((u) => profileId(admin, u.email)));
  for (const [id, partner] of [
    [first, second],
    [second, first],
  ]) {
    const { error } = await admin.from('users').update({ partner_id: partner }).eq('id', id);
    if (error) throw new Error(`linking ${id} to ${partner}: ${error.message}`);
  }
  console.log('linked as partners');
}

main().catch((error: unknown) => {
  console.error(`provision: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
