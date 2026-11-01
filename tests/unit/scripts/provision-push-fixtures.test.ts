/**
 * scripts/provision-push-fixtures.mjs provisions the accounts story 3.13's
 * device checks sign in as on the hosted project. It runs under `fnox exec`
 * with plain `node`, so it is exercised here the same way: as a child process
 * with an explicit environment and a small stand-in for the GoTrue admin and
 * PostgREST endpoints it calls. Nothing here touches a real Supabase project,
 * and the fake password and key below are not secrets.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readBody, runNodeScript } from '../../support/helpers/node-script';

// vitest runs with the project root as cwd; happy-dom rewrites import.meta.url
// to an http: URL, so the repo path is resolved from cwd instead.
const SCRIPT = path.resolve(process.cwd(), 'scripts', 'provision-push-fixtures.mjs');
const FAKE_PASSWORD = 'unit-test-only-push-password-not-a-secret';
const SERVICE_KEY = 'unit-test-push-service-key';
const RILEY = 'push-fixture@test.example.com';
const AVERY = 'push-fixture-partner@test.example.com';
const CLAUDE_PARTNER = 'claude-bot-partner@test.example.com';
const CLAUDE_PARTNER_ID = 'b5a7e4c1-0000-4000-8000-00000000c1a0';

interface SeenRequest {
  method: string;
  url: string;
  authorization: string | undefined;
  apikey: string | undefined;
  prefer: string | undefined;
  body: string;
}

interface StubUser {
  id: string;
  email: string;
}

interface StubOptions {
  users?: StubUser[];
  /**
   * Fixed per-page admin listing; when set, the listing ignores `users` and
   * unknown pages are empty, so accounts the script creates are never listed.
   */
  pages?: Record<number, StubUser[]>;
  /** Status for a PATCH whose body carries `partner_id`. */
  linkStatus?: number;
  /** Rows a PATCH of a profile name returns; defaults to the one matching row. */
  nameRows?: unknown[];
}

interface Stub {
  server: Server;
  url: string;
  seen: SeenRequest[];
  /** Every account the stub holds after the run, keyed by email. */
  users: Map<string, StubUser>;
}

async function startStub(options: StubOptions = {}): Promise<Stub> {
  const seen: SeenRequest[] = [];
  const users = new Map<string, StubUser>();
  const initial = options.pages
    ? Object.values(options.pages).flat()
    : (options.users ?? [{ id: CLAUDE_PARTNER_ID, email: CLAUDE_PARTNER }]);
  for (const u of initial) users.set(u.email, u);
  let created = 0;
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const body = await readBody(req);
    const url = req.url ?? '';
    seen.push({
      method: req.method ?? '',
      url,
      authorization: req.headers.authorization,
      apikey: typeof req.headers.apikey === 'string' ? req.headers.apikey : undefined,
      prefer: typeof req.headers.prefer === 'string' ? req.headers.prefer : undefined,
      body,
    });
    const json = (status: number, payload: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
    };
    const byId = (id: string) => [...users.values()].find((u) => u.id === id);
    if (req.method === 'GET' && url.startsWith('/auth/v1/admin/users?')) {
      if (options.pages) {
        const page = Number(new URL(url, 'http://stub').searchParams.get('page'));
        return json(200, { users: options.pages[page] ?? [] });
      }
      return json(200, { users: [...users.values()] });
    }
    if (req.method === 'POST' && url === '/auth/v1/admin/users') {
      const { email } = JSON.parse(body) as { email: string };
      if (users.has(email)) return json(422, { error_code: 'email_exists' });
      created += 1;
      const user = { id: `00000000-0000-4000-8000-00000000000${created}`, email };
      users.set(email, user);
      return json(200, user);
    }
    const put = url.match(/^\/auth\/v1\/admin\/users\/([^/?]+)$/);
    if (req.method === 'PUT' && put) {
      const user = byId(decodeURIComponent(put[1]));
      return user ? json(200, user) : json(404, {});
    }
    const patch = url.match(/^\/rest\/v1\/users\?id=eq\.([^&]+)$/);
    if (req.method === 'PATCH' && patch) {
      const id = decodeURIComponent(patch[1]);
      const fields = JSON.parse(body) as Record<string, unknown>;
      if ('partner_id' in fields && options.linkStatus) return json(options.linkStatus, {});
      if ('display_name' in fields && options.nameRows) return json(200, options.nameRows);
      return json(200, byId(id) ? [{ id, ...fields }] : []);
    }
    return json(404, { error: 'unexpected request' });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('stub did not bind a port');
  return { server, url: `http://127.0.0.1:${address.port}`, seen, users };
}

function runScript(env: Record<string, string>): Promise<{ status: number | null; output: string }> {
  return runNodeScript(SCRIPT, env);
}

function fixtureEnv(url: string, overrides: Record<string, string> = {}): Record<string, string> {
  return {
    SUPABASE_URL: url,
    SUPABASE_SERVICE_KEY: SERVICE_KEY,
    PUSH_FIXTURE_PASSWORD: FAKE_PASSWORD,
    ...overrides,
  };
}

const route = (r: SeenRequest) => `${r.method} ${r.url.replace(/\?page=.*$/, '')}`;

describe('scripts/provision-push-fixtures.mjs', () => {
  let stub: Stub | undefined;

  afterEach(async () => {
    if (stub) {
      await new Promise<void>((resolve) => stub!.server.close(() => resolve()));
      stub = undefined;
    }
  });

  it.each([
    ['PUSH_FIXTURE_PASSWORD', { PUSH_FIXTURE_PASSWORD: '' }],
    ['SUPABASE_URL (or VITE_SUPABASE_URL)', { SUPABASE_URL: '' }],
    ['SUPABASE_SERVICE_KEY', { SUPABASE_SERVICE_KEY: '' }],
  ])('exits 1 naming %s when it is missing, before any request', async (name, override) => {
    stub = await startStub();
    const env = Object.fromEntries(
      Object.entries(fixtureEnv(stub.url, override)).filter(([, value]) => value !== '')
    );
    const { status, output } = await runScript(env);
    expect(status).toBe(1);
    expect(output).toContain(`missing required environment: ${name}`);
    expect(output).not.toContain(FAKE_PASSWORD);
    expect(output).not.toContain(SERVICE_KEY);
    expect(stub.seen).toHaveLength(0);
  });

  it('creates both fixtures confirmed and named, resets their names, links them and sets Claude Partner’s password', async () => {
    stub = await startStub();
    const { status, output } = await runScript(fixtureEnv(stub.url));
    expect(status).toBe(0);

    const riley = stub.users.get(RILEY)!.id;
    const avery = stub.users.get(AVERY)!.id;
    expect(stub.seen.map(route)).toEqual([
      'GET /auth/v1/admin/users',
      'POST /auth/v1/admin/users',
      `PATCH /rest/v1/users?id=eq.${riley}`,
      'GET /auth/v1/admin/users',
      'POST /auth/v1/admin/users',
      `PATCH /rest/v1/users?id=eq.${avery}`,
      `PATCH /rest/v1/users?id=eq.${riley}`,
      `PATCH /rest/v1/users?id=eq.${avery}`,
      'GET /auth/v1/admin/users',
      `PUT /auth/v1/admin/users/${CLAUDE_PARTNER_ID}`,
    ]);
    const bodies = stub.seen.map((r) => (r.body ? (JSON.parse(r.body) as Record<string, unknown>) : null));
    expect(bodies[1]).toEqual({
      email: RILEY,
      password: FAKE_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: 'Riley' },
    });
    expect(bodies[4]).toEqual({
      email: AVERY,
      password: FAKE_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: 'Avery' },
    });
    expect(bodies[2]).toMatchObject({ display_name: 'Riley' });
    expect(bodies[5]).toMatchObject({ display_name: 'Avery' });
    expect(bodies[6]).toEqual({ partner_id: avery });
    expect(bodies[7]).toEqual({ partner_id: riley });
    expect(bodies[9]).toEqual({ password: FAKE_PASSWORD });

    expect(output).toContain(`${RILEY} (Riley) created (${riley})`);
    expect(output).toContain(`${AVERY} (Avery) created (${avery})`);
    expect(output).toContain(`linked ${riley} to ${avery}`);
    expect(output).toContain(`linked ${avery} to ${riley}`);
    expect(output).toContain(`${CLAUDE_PARTNER} password set`);
  });

  it('sends the service key on every request and asks PostgREST for the updated rows', async () => {
    stub = await startStub();
    const { status } = await runScript(fixtureEnv(stub.url));
    expect(status).toBe(0);
    expect(stub.seen.length).toBeGreaterThan(0);
    expect(stub.seen.some((r) => r.method === 'PATCH')).toBe(true);
    for (const r of stub.seen) {
      expect(r.apikey).toBe(SERVICE_KEY);
      expect(r.authorization).toBe(`Bearer ${SERVICE_KEY}`);
    }
    for (const r of stub.seen.filter((s) => s.method === 'PATCH')) {
      expect(r.prefer).toBe('return=representation');
    }
  });

  it('resets existing fixtures in place on a re-run, creating nothing', async () => {
    const riley = 'aaaaaaaa-0000-4000-8000-000000000001';
    const avery = 'aaaaaaaa-0000-4000-8000-000000000002';
    stub = await startStub({
      users: [
        { id: CLAUDE_PARTNER_ID, email: CLAUDE_PARTNER },
        { id: riley, email: 'Push-Fixture@TEST.example.com' },
        { id: avery, email: AVERY },
      ],
    });
    const { status, output } = await runScript(fixtureEnv(stub.url));
    expect(status).toBe(0);
    expect(stub.users.size).toBe(3);
    expect(stub.seen.some((r) => r.method === 'POST')).toBe(false);

    const puts = stub.seen.filter((r) => r.method === 'PUT');
    expect(puts.map((r) => [r.url, JSON.parse(r.body)])).toEqual([
      [
        `/auth/v1/admin/users/${riley}`,
        { password: FAKE_PASSWORD, email_confirm: true, user_metadata: { display_name: 'Riley' } },
      ],
      [
        `/auth/v1/admin/users/${avery}`,
        { password: FAKE_PASSWORD, email_confirm: true, user_metadata: { display_name: 'Avery' } },
      ],
      [`/auth/v1/admin/users/${CLAUDE_PARTNER_ID}`, { password: FAKE_PASSWORD }],
    ]);
    const links = stub.seen
      .filter((r) => r.method === 'PATCH' && r.body.includes('partner_id'))
      .map((r) => [r.url, JSON.parse(r.body)]);
    expect(links).toEqual([
      [`/rest/v1/users?id=eq.${riley}`, { partner_id: avery }],
      [`/rest/v1/users?id=eq.${avery}`, { partner_id: riley }],
    ]);
    expect(output).toContain(`${RILEY} (Riley) reset (${riley}, HTTP 200)`);
    expect(output).toContain(`${AVERY} (Avery) reset (${avery}, HTTP 200)`);
  });

  it('uses VITE_SUPABASE_URL with a trailing slash when SUPABASE_URL is unset', async () => {
    stub = await startStub();
    const { status } = await runScript({
      VITE_SUPABASE_URL: `${stub.url}/`,
      SUPABASE_SERVICE_KEY: SERVICE_KEY,
      PUSH_FIXTURE_PASSWORD: FAKE_PASSWORD,
    });
    expect(status).toBe(0);
    expect(stub.seen[0].url).toBe('/auth/v1/admin/users?page=1&per_page=100');
  });

  it('prints neither the password nor the service key on success', async () => {
    stub = await startStub();
    const { status, output } = await runScript(fixtureEnv(stub.url));
    expect(status).toBe(0);
    expect(output).not.toContain(FAKE_PASSWORD);
    expect(output).not.toContain(SERVICE_KEY);
  });

  it('walks to page 2 of the admin listing when page 1 is full of other users', async () => {
    const filler = Array.from({ length: 100 }, (_, i) => ({
      id: `filler-${i}`,
      email: `filler-${i}@test.example.com`,
    }));
    const riley = 'aaaaaaaa-0000-4000-8000-000000000001';
    const avery = 'aaaaaaaa-0000-4000-8000-000000000002';
    stub = await startStub({
      pages: {
        1: filler,
        2: [
          { id: riley, email: RILEY },
          { id: avery, email: AVERY },
          { id: CLAUDE_PARTNER_ID, email: CLAUDE_PARTNER },
        ],
      },
    });
    const { status, output } = await runScript(fixtureEnv(stub.url));
    expect(status).toBe(0);
    expect(stub.seen.some((r) => r.method === 'POST')).toBe(false);
    expect(stub.seen.map((r) => `${r.method} ${r.url}`).slice(0, 3)).toEqual([
      'GET /auth/v1/admin/users?page=1&per_page=100',
      'GET /auth/v1/admin/users?page=2&per_page=100',
      `PUT /auth/v1/admin/users/${riley}`,
    ]);
    expect(stub.seen.filter((r) => r.method === 'PUT').map((r) => r.url)).toEqual([
      `/auth/v1/admin/users/${riley}`,
      `/auth/v1/admin/users/${avery}`,
      `/auth/v1/admin/users/${CLAUDE_PARTNER_ID}`,
    ]);
    expect(output).toContain(`${RILEY} (Riley) reset (${riley}, HTTP 200)`);
    expect(output).toContain(`${CLAUDE_PARTNER} password set (${CLAUDE_PARTNER_ID}, HTTP 200)`);
  });

  it('exits 1 naming the step and status when a link is refused, and never sets the partner password', async () => {
    stub = await startStub({ linkStatus: 403 });
    const { status, output } = await runScript(fixtureEnv(stub.url));
    expect(status).toBe(1);
    expect(output).toContain('step "link-partners" failed with HTTP 403');
    expect(output).not.toContain(FAKE_PASSWORD);
    expect(output).not.toContain(SERVICE_KEY);
    expect(stub.seen.some((r) => r.method === 'PUT')).toBe(false);
  });

  it('exits 1 when a name reset matches no profile row instead of passing as a no-op', async () => {
    stub = await startStub({ nameRows: [] });
    const { status, output } = await runScript(fixtureEnv(stub.url));
    expect(status).toBe(1);
    expect(output).toContain('step "reset-name" failed with HTTP 200 (0 profile rows updated, expected 1)');
    expect(stub.seen.filter((r) => r.method === 'POST')).toHaveLength(1);
  });

  it('exits 1 with "user not found" when Claude Partner does not exist', async () => {
    stub = await startStub({ users: [] });
    const { status, output } = await runScript(fixtureEnv(stub.url));
    expect(status).toBe(1);
    expect(output).toContain(`user not found: ${CLAUDE_PARTNER}`);
    expect(output).not.toContain(FAKE_PASSWORD);
    expect(stub.seen.some((r) => r.method === 'PUT')).toBe(false);
  });
});
