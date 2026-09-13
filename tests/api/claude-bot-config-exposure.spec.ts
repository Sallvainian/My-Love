/**
 * F1: public.claude_bot_config once carried the live bot password. The row is
 * gone, but the table stays (it names the bot accounts) and its only gate is
 * RLS-with-no-policies: 20260725170000_grant_api_roles_on_public.sql:35 grants
 * ALL on every public table to anon and authenticated, and its own comment
 * (:29) relies on "a table with RLS on and no policies stays deny-all". pgTAP
 * 22_claude_bot_config_no_secret.sql proves that with `set local role`; these
 * tests prove it over HTTP, which is the request an attacker or a stray app
 * query actually makes, and they hold the identifier rows to exactly the two
 * keys the story keeps.
 *
 * Measured 2026-09-12 on the local stack (curl, keys from `supabase status`):
 *   anon GET  ?select=key            -> 200 []
 *   anon POST {key,value}            -> 401 {"code":"42501","message":"new row violates row-level security policy for table \"claude_bot_config\""}
 *   service GET ?select=key&order=key -> 200 [{"key":"partner_email"},{"key":"test_email"}]
 * The `api` project sends the anon `apikey` on every request
 * (playwright.config.ts:150-154); the authenticated cases add a worker bearer.
 *
 * Only `key` is ever selected, so no `value` reaches a report, trace or log.
 */
import { randomUUID } from 'node:crypto';
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../support/merged-fixtures';

interface KeyRow {
  key: string;
}

interface PostgrestErrorBody {
  code: string;
  details: string | null;
  hint: string | null;
  message: string;
}

const TABLE_PATH = '/rest/v1/claude_bot_config';
const IDENTIFIER_KEYS = ['partner_email', 'test_email'];
const PASSWORD_KEY = 'test_password';
const RLS_VIOLATION = 'new row violates row-level security policy for table "claude_bot_config"';

function serviceRoleHeaders(): Record<string, string> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('F1 exposure spec requires SUPABASE_SERVICE_ROLE_KEY for its positive control');
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
}

test.describe('F1 claude_bot_config exposure over PostgREST', () => {
  test('[P1] F1-API-001 the anon key reads no rows', async ({ apiRequest }) => {
    // GIVEN: a caller holding only the public key. WHEN it reads the table.
    await log.step(`GET ${TABLE_PATH} with the anon apikey and no bearer`);
    const read = await apiRequest<KeyRow[]>({ method: 'GET', path: `${TABLE_PATH}?select=key` });

    // THEN: the grant admits the query and RLS returns nothing — 200 with an
    // empty array, not a permission error. Pinned to the measured posture so
    // a later grant change is a visible decision rather than a silent drift.
    expect(read.status).toBe(200);
    expect(read.body).toEqual([]);
  });

  test('[P1] F1-API-002 an authenticated app user reads no rows', async ({ apiRequest, authToken }) => {
    // GIVEN: a real signed-in user from this worker's pool account.
    await log.step(`GET ${TABLE_PATH} as this worker's authenticated user`);
    const read = await apiRequest<KeyRow[]>({
      method: 'GET',
      path: `${TABLE_PATH}?select=key`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    // THEN: the authenticated role is deny-all here too.
    expect(read.status).toBe(200);
    expect(read.body).toEqual([]);
  });

  test('[P1] F1-API-003 an authenticated app user cannot insert a row, and none is committed', async ({
    apiRequest,
    authToken,
  }) => {
    // A unique key so a refused write can be looked for by name afterwards,
    // and a value that is not a secret.
    const probeKey = `f1-probe-${randomUUID()}`;

    // WHEN: the signed-in user writes a well-formed row.
    await log.step(`POST ${TABLE_PATH} as this worker's authenticated user`);
    const write = await apiRequest<PostgrestErrorBody>({
      method: 'POST',
      path: TABLE_PATH,
      headers: { Authorization: `Bearer ${authToken}`, Prefer: 'return=representation' },
      body: { key: probeKey, value: 'probe-not-a-secret' },
    });

    // THEN: RLS refuses it with the Postgres insufficient_privilege code.
    expect(write.status).toBe(403);
    expect(write.body.code).toBe('42501');
    expect(write.body.message).toBe(RLS_VIOLATION);

    // AND the refusal is an outcome, not just a status: the row is absent
    // through a read that bypasses RLS, and the table still holds exactly the
    // two identifier keys.
    await log.step('Confirm through the service role that nothing was committed');
    const admin = await apiRequest<KeyRow[]>({
      method: 'GET',
      path: `${TABLE_PATH}?select=key&order=key`,
      headers: serviceRoleHeaders(),
    });
    expect(admin.status).toBe(200);
    expect(admin.body).toEqual(IDENTIFIER_KEYS.map((key) => ({ key })));
    expect(admin.body.map((row) => row.key)).not.toContain(probeKey);
  });

  test('[P1] F1-API-004 the service role reads exactly the two identifier rows and no test_password row', async ({
    apiRequest,
  }) => {
    // Positive control for the three empty results above: the same endpoint
    // does serve rows to a caller RLS does not confine, so `[]` cannot be a
    // dead table masquerading as deny-all. It also pins the story's outcome —
    // the identifiers remain and the password key is gone.
    await log.step(`GET ${TABLE_PATH} as service_role`);
    const admin = await apiRequest<KeyRow[]>({
      method: 'GET',
      path: `${TABLE_PATH}?select=key&order=key`,
      headers: serviceRoleHeaders(),
    });

    expect(admin.status).toBe(200);
    expect(admin.body).toEqual(IDENTIFIER_KEYS.map((key) => ({ key })));
    expect(admin.body.map((row) => row.key)).not.toContain(PASSWORD_KEY);
  });
});
