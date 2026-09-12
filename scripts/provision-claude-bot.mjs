#!/usr/bin/env node
// Provision the Claude bot test login's password from the environment.
//
// The password used to be seeded as a literal in
// supabase/migrations/20260316031209_create_claude_bot_config.sql. That literal
// was a live credential in public git history (security finding F1), so the
// value now lives only in the age-encrypted fnox.toml entry CLAUDE_BOT_PASSWORD
// and reaches the hosted project through this script:
//
//   fnox exec -- node scripts/provision-claude-bot.mjs
//
// Behaviour:
//   * CLAUDE_BOT_PASSWORD unset  -> optional provisioning is skipped, exit 0,
//                                   no network call (fresh local stacks need
//                                   no bot credential). A value that is set but
//                                   empty is a configuration error, not a skip.
//   * CLAUDE_BOT_PASSWORD set    -> find the bot user through the Auth Admin
//                                   API, set the password, sign in once with
//                                   it, then sign out with scope=global so every
//                                   previously issued refresh token is revoked.
//
// Required alongside the password: SUPABASE_URL (or VITE_SUPABASE_URL) and
// SUPABASE_SERVICE_KEY. CLAUDE_BOT_EMAIL overrides the default bot login.
//
// This script never prints a password or token: output is limited to step
// names, the bot email, the user id and HTTP status codes.

import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const DEFAULT_BOT_EMAIL = 'claude-bot@test.example.com';
const PER_PAGE = 100;
const MAX_PAGES = 100;

export class StepError extends Error {
  constructor(step, status) {
    super(`provision-claude-bot: step "${step}" failed with HTTP ${status}`);
    this.step = step;
    this.status = status;
  }
}

export function readConfig(env) {
  const password = env.CLAUDE_BOT_PASSWORD;
  if (password === undefined) {
    return { skip: true };
  }
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const serviceKey = env.SUPABASE_SERVICE_KEY || '';
  const missing = [];
  if (password.length === 0) missing.push('CLAUDE_BOT_PASSWORD (set but empty)');
  if (!url) missing.push('SUPABASE_URL (or VITE_SUPABASE_URL)');
  if (!serviceKey) missing.push('SUPABASE_SERVICE_KEY');
  return {
    skip: false,
    url,
    serviceKey,
    password,
    email: env.CLAUDE_BOT_EMAIL || DEFAULT_BOT_EMAIL,
    missing,
  };
}

function adminHeaders(serviceKey, extra = {}) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function findUser({ url, serviceKey, email }) {
  const wanted = email.toLowerCase();
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const res = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=${PER_PAGE}`, {
      headers: adminHeaders(serviceKey),
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

async function updatePassword({ url, serviceKey, password }, userId) {
  const res = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: adminHeaders(serviceKey),
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new StepError('update-password', res.status);
  return res.status;
}

async function signIn({ url, serviceKey, email, password }) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: adminHeaders(serviceKey),
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new StepError('sign-in', res.status);
  const body = await res.json();
  if (typeof body.access_token !== 'string' || body.access_token.length === 0) {
    throw new StepError('sign-in', `${res.status} (no access_token in response)`);
  }
  return { status: res.status, accessToken: body.access_token };
}

async function signOutEverywhere({ url, serviceKey }, accessToken) {
  const res = await fetch(`${url}/auth/v1/logout?scope=global`, {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new StepError('sign-out-global', res.status);
  return res.status;
}

export async function provisionClaudeBot(env, log = console.log) {
  const config = readConfig(env);
  if (config.skip) {
    log('provision-claude-bot: CLAUDE_BOT_PASSWORD is not set; optional bot provisioning skipped');
    return 0;
  }
  if (config.missing.length > 0) {
    log(`provision-claude-bot: missing required environment: ${config.missing.join(', ')}`);
    return 1;
  }

  const user = await findUser(config);
  if (!user) {
    log(`provision-claude-bot: user not found: ${config.email}`);
    return 1;
  }
  log(`provision-claude-bot: found user ${config.email} (${user.id})`);

  const updateStatus = await updatePassword(config, user.id);
  log(`provision-claude-bot: update-password ok (HTTP ${updateStatus})`);

  try {
    const { status: signInStatus, accessToken } = await signIn(config);
    log(`provision-claude-bot: sign-in with new password ok (HTTP ${signInStatus})`);

    const signOutStatus = await signOutEverywhere(config, accessToken);
    log(`provision-claude-bot: sign-out-global ok (HTTP ${signOutStatus}); all sessions revoked`);
  } catch (error) {
    // The password is already rotated at this point. Say so explicitly, because
    // a bare step failure would read as "nothing happened" while every
    // pre-existing session and refresh token is still valid.
    log(
      'provision-claude-bot: WARNING: the password was already rotated but existing sessions were NOT revoked; fix the cause reported below and re-run this script'
    );
    throw error;
  }
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
  provisionClaudeBot(process.env)
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      const message = error instanceof StepError ? error.message : `provision-claude-bot: ${error?.message ?? 'unknown error'}`;
      console.error(message);
      process.exitCode = 1;
    });
}
