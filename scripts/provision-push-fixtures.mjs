#!/usr/bin/env node
// Provision the accounts the push device checks sign in as (story 3.13):
//
//   fnox exec -- node scripts/provision-push-fixtures.mjs
//
// Behaviour:
//   * Ensures a second fictional pair, push-fixture@test.example.com ("Riley")
//     and push-fixture-partner@test.example.com ("Avery"): an account that does
//     not exist is created confirmed with its name in user_metadata; one that
//     exists gets its password, confirmation and name reset. Either way the
//     profile's own public.users.display_name is reset too, because the auth
//     trigger seeds that name only on insert.
//   * Links the pair with two service-role updates of public.users.partner_id,
//     as linkUserPair in tests/support/auth/global-setup.ts does.
//   * Sets claude-bot-partner@test.example.com's password to the same value, so
//     the checks can send notes from the website as Claude Partner.
//   * Re-running it changes nothing but the passwords and names it resets; it
//     never creates a second account for an address.
//
// Required: PUSH_FIXTURE_PASSWORD, SUPABASE_URL (or VITE_SUPABASE_URL) and
// SUPABASE_SERVICE_KEY. Any of them unset or empty exits 1 before a request.
// A non-2xx answer exits 1 naming the step and its HTTP status.
//
// This script never prints a password or key: output is limited to step names,
// the fictional fixture addresses, user ids and HTTP status codes.

import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const FIXTURE_PAIR = [
  { email: 'push-fixture@test.example.com', displayName: 'Riley' },
  { email: 'push-fixture-partner@test.example.com', displayName: 'Avery' },
];
export const CLAUDE_PARTNER_EMAIL = 'claude-bot-partner@test.example.com';
const PER_PAGE = 100;
const MAX_PAGES = 100;
const NAME = 'provision-push-fixtures';

export class StepError extends Error {
  constructor(step, status, detail) {
    super(`${NAME}: step "${step}" failed with HTTP ${status}${detail ? ` (${detail})` : ''}`);
    this.step = step;
    this.status = status;
    if (detail) this.detail = detail;
  }
}

export function readConfig(env) {
  const password = env.PUSH_FIXTURE_PASSWORD || '';
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const serviceKey = env.SUPABASE_SERVICE_KEY || '';
  const missing = [];
  if (!password) missing.push('PUSH_FIXTURE_PASSWORD');
  if (!url) missing.push('SUPABASE_URL (or VITE_SUPABASE_URL)');
  if (!serviceKey) missing.push('SUPABASE_SERVICE_KEY');
  return { url, serviceKey, password, missing };
}

function headers(serviceKey, extra = {}) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function findUser({ url, serviceKey }, email) {
  const wanted = email.toLowerCase();
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const res = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=${PER_PAGE}`, {
      headers: headers(serviceKey),
    });
    if (!res.ok) throw new StepError('find-user', res.status);
    const body = await res.json();
    const users = Array.isArray(body.users) ? body.users : [];
    const hit = users.find((u) => typeof u.email === 'string' && u.email.toLowerCase() === wanted);
    if (hit) return hit;
    if (users.length < PER_PAGE) return null;
  }
  return null;
}

async function createUser({ url, serviceKey, password }, { email, displayName }) {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: headers(serviceKey),
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { display_name: displayName } }),
  });
  if (!res.ok) throw new StepError('create-user', res.status);
  const body = await res.json();
  if (typeof body.id !== 'string' || body.id.length === 0) {
    throw new StepError('create-user', res.status, 'no user id in response');
  }
  return body.id;
}

async function updateUser({ url, serviceKey }, userId, fields, step) {
  const res = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    headers: headers(serviceKey),
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new StepError(step, res.status);
  return res.status;
}

// One PATCH of one public.users row; anything but exactly one row back is a
// failure, so a missing profile cannot pass as a silent no-op.
async function patchProfile({ url, serviceKey }, userId, fields, step) {
  const res = await fetch(`${url}/rest/v1/users?id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: headers(serviceKey, { Prefer: 'return=representation' }),
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new StepError(step, res.status);
  const rows = await res.json();
  const count = Array.isArray(rows) ? rows.length : 0;
  if (count !== 1) throw new StepError(step, res.status, `${count} profile rows updated, expected 1`);
  return res.status;
}

async function ensureFixture(config, fixture, log) {
  const { email, displayName } = fixture;
  const existing = await findUser(config, email);
  let userId;
  if (existing) {
    userId = existing.id;
    const status = await updateUser(
      config,
      userId,
      { password: config.password, email_confirm: true, user_metadata: { display_name: displayName } },
      'update-user'
    );
    log(`${NAME}: ${email} (${displayName}) reset (${userId}, HTTP ${status})`);
  } else {
    userId = await createUser(config, fixture);
    log(`${NAME}: ${email} (${displayName}) created (${userId})`);
  }
  const status = await patchProfile(
    config,
    userId,
    { display_name: displayName, updated_at: new Date().toISOString() },
    'reset-name'
  );
  log(`${NAME}: ${email} profile name reset (HTTP ${status})`);
  return userId;
}

export async function provisionPushFixtures(env, log = console.log) {
  const config = readConfig(env);
  if (config.missing.length > 0) {
    log(`${NAME}: missing required environment: ${config.missing.join(', ')}`);
    return 1;
  }

  const first = await ensureFixture(config, FIXTURE_PAIR[0], log);
  const second = await ensureFixture(config, FIXTURE_PAIR[1], log);

  for (const [id, partner] of [
    [first, second],
    [second, first],
  ]) {
    const status = await patchProfile(config, id, { partner_id: partner }, 'link-partners');
    log(`${NAME}: linked ${id} to ${partner} (HTTP ${status})`);
  }

  const claudePartner = await findUser(config, CLAUDE_PARTNER_EMAIL);
  if (!claudePartner) {
    log(`${NAME}: user not found: ${CLAUDE_PARTNER_EMAIL}`);
    return 1;
  }
  const status = await updateUser(config, claudePartner.id, { password: config.password }, 'partner-password');
  log(`${NAME}: ${CLAUDE_PARTNER_EMAIL} password set (${claudePartner.id}, HTTP ${status})`);
  return 0;
}

function isInvokedDirectly() {
  const entry = process.argv[1];
  if (typeof entry !== 'string') return false;
  try {
    // Node resolves the entry module through symlinks, so compare real paths.
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
}

if (isInvokedDirectly()) {
  provisionPushFixtures(process.env)
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      const message = error instanceof StepError ? error.message : `${NAME}: ${error?.message ?? 'unknown error'}`;
      console.error(message);
      process.exitCode = 1;
    });
}
