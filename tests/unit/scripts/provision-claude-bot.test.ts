/**
 * scripts/provision-claude-bot.mjs is the only path that puts the Claude bot
 * password onto the hosted Auth user (security finding F1). It runs under
 * `fnox exec` with plain `node`, so it is exercised here the same way: as a
 * child process with an explicit environment and a tiny stand-in for the four
 * GoTrue endpoints it calls. Nothing here touches a real Supabase project, and
 * the fake password below is not a secret.
 */
import { spawn } from 'node:child_process';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// vitest runs with the project root as cwd; happy-dom rewrites import.meta.url
// to an http: URL, so the repo path is resolved from cwd instead.
const SCRIPT = path.resolve(process.cwd(), 'scripts', 'provision-claude-bot.mjs');
const FAKE_PASSWORD = 'unit-test-only-password-not-a-secret';
const BOT_EMAIL = 'claude-bot@test.example.com';
const BOT_ID = 'c2675795-d8af-45ce-a881-98dfbda90171';
const SERVICE_KEY = 'unit-test-service-key';

interface SeenRequest {
  method: string;
  url: string;
  authorization: string | undefined;
  apikey: string | undefined;
  body: string;
}

interface StubUser {
  id: string;
  email: string;
}

interface StubOptions {
  users?: StubUser[];
  /** Per-page listing; when set, `users` is ignored and unknown pages are empty. */
  pages?: Record<number, StubUser[]>;
  updateStatus?: number;
  signInStatus?: number;
  /** Body returned by a 200 sign-in; defaults to a well-formed token response. */
  signInBody?: Record<string, unknown>;
  signOutStatus?: number;
}

const HALF_DONE_WARNING = 'the password was already rotated but existing sessions were NOT revoked';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
  });
}

async function startStub(options: StubOptions = {}): Promise<{ server: Server; url: string; seen: SeenRequest[] }> {
  const seen: SeenRequest[] = [];
  const users = options.users ?? [{ id: BOT_ID, email: BOT_EMAIL }];
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const body = await readBody(req);
    const url = req.url ?? '';
    seen.push({
      method: req.method ?? '',
      url,
      authorization: req.headers.authorization,
      apikey: typeof req.headers.apikey === 'string' ? req.headers.apikey : undefined,
      body,
    });
    const json = (status: number, payload: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
    };
    if (req.method === 'GET' && url.startsWith('/auth/v1/admin/users?')) {
      if (options.pages) {
        const page = Number(new URL(url, 'http://stub').searchParams.get('page'));
        return json(200, { users: options.pages[page] ?? [] });
      }
      return json(200, { users });
    }
    if (req.method === 'PUT' && url === `/auth/v1/admin/users/${BOT_ID}`) {
      return json(options.updateStatus ?? 200, {});
    }
    if (req.method === 'POST' && url === '/auth/v1/token?grant_type=password') {
      const status = options.signInStatus ?? 200;
      const okBody = options.signInBody ?? { access_token: 'unit-test-access-token', token_type: 'bearer' };
      return json(status, status === 200 ? okBody : {});
    }
    if (req.method === 'POST' && url === '/auth/v1/logout?scope=global') {
      res.writeHead(options.signOutStatus ?? 204);
      return res.end();
    }
    return json(404, { error: 'unexpected request' });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('stub did not bind a port');
  return { server, url: `http://127.0.0.1:${address.port}`, seen };
}

function runScript(env: Record<string, string>): Promise<{ status: number | null; output: string }> {
  // The environment is built from scratch so a real CLAUDE_BOT_PASSWORD or
  // service key in the developer's shell can never leak into the run. Only the
  // non-secret variables Node itself needs pass through (Windows networking
  // requires SYSTEMROOT).
  // The child is spawned asynchronously: a blocking spawnSync would freeze this
  // worker's event loop and the stub server above could never answer it.
  const passthrough: Record<string, string> = {};
  for (const name of ['PATH', 'SYSTEMROOT', 'TEMP', 'TMP']) {
    const value = process.env[name];
    if (value !== undefined) passthrough[name] = value;
  }
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SCRIPT], {
      env: { ...passthrough, ...env },
    });
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      output += chunk;
    });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, output }));
  });
}

/**
 * The complete environment a provisioning run needs, pointed at the stub. The
 * missing-key cases and the `VITE_SUPABASE_URL` fallback case build theirs
 * inline, since which key is absent is the point of each.
 */
function botEnv(url: string, overrides: Record<string, string> = {}): Record<string, string> {
  return {
    SUPABASE_URL: url,
    SUPABASE_SERVICE_KEY: SERVICE_KEY,
    CLAUDE_BOT_PASSWORD: FAKE_PASSWORD,
    ...overrides,
  };
}

describe('scripts/provision-claude-bot.mjs', () => {
  let stub: { server: Server; url: string; seen: SeenRequest[] } | undefined;

  afterEach(async () => {
    if (stub) {
      await new Promise<void>((resolve) => stub!.server.close(() => resolve()));
      stub = undefined;
    }
  });

  it('skips with exit 0 and no network call when CLAUDE_BOT_PASSWORD is unset', async () => {
    stub = await startStub();
    const { status, output } = await runScript({ SUPABASE_URL: stub.url, SUPABASE_SERVICE_KEY: SERVICE_KEY });
    expect(status).toBe(0);
    expect(output).toContain('optional bot provisioning skipped');
    expect(stub.seen).toHaveLength(0);
  });

  it('exits 1 naming the missing service key and never prints the password', async () => {
    stub = await startStub();
    const { status, output } = await runScript({ SUPABASE_URL: stub.url, CLAUDE_BOT_PASSWORD: FAKE_PASSWORD });
    expect(status).toBe(1);
    expect(output).toContain('SUPABASE_SERVICE_KEY');
    expect(output).not.toContain(FAKE_PASSWORD);
    expect(stub.seen).toHaveLength(0);
  });

  it('exits 1 with "user not found" and never attempts a password update', async () => {
    stub = await startStub({ users: [{ id: 'someone-else', email: 'other@test.example.com' }] });
    const { status, output } = await runScript(botEnv(stub.url));
    expect(status).toBe(1);
    expect(output).toContain(`user not found: ${BOT_EMAIL}`);
    expect(output).not.toContain(FAKE_PASSWORD);
    expect(stub.seen.map((r) => r.method)).toEqual(['GET']);
  });

  it('finds the user, sets the password, signs in, signs out globally, and prints no secret', async () => {
    stub = await startStub();
    const { status, output } = await runScript({
      VITE_SUPABASE_URL: `${stub.url}/`,
      SUPABASE_SERVICE_KEY: SERVICE_KEY,
      CLAUDE_BOT_PASSWORD: FAKE_PASSWORD,
    });
    expect(status).toBe(0);
    expect(output).not.toContain(FAKE_PASSWORD);
    expect(output).not.toContain('unit-test-access-token');
    expect(output).toContain(`found user ${BOT_EMAIL} (${BOT_ID})`);
    expect(output).toContain('update-password ok (HTTP 200)');
    expect(output).toContain('sign-in with new password ok (HTTP 200)');
    expect(output).toContain('sign-out-global ok (HTTP 204)');

    expect(stub.seen.map((r) => `${r.method} ${r.url}`)).toEqual([
      'GET /auth/v1/admin/users?page=1&per_page=100',
      `PUT /auth/v1/admin/users/${BOT_ID}`,
      'POST /auth/v1/token?grant_type=password',
      'POST /auth/v1/logout?scope=global',
    ]);
    const [list, update, signIn, signOut] = stub.seen;
    expect(list.authorization).toBe(`Bearer ${SERVICE_KEY}`);
    expect(JSON.parse(update.body)).toEqual({ password: FAKE_PASSWORD });
    expect(JSON.parse(signIn.body)).toEqual({ email: BOT_EMAIL, password: FAKE_PASSWORD });
    expect(signOut.authorization).toBe('Bearer unit-test-access-token');
    expect(signOut.apikey).toBe(SERVICE_KEY);
  });

  it('exits 1 for an empty CLAUDE_BOT_PASSWORD instead of reporting a skip', async () => {
    stub = await startStub();
    const { status, output } = await runScript(botEnv(stub.url, { CLAUDE_BOT_PASSWORD: '' }));
    expect(status).toBe(1);
    expect(output).toContain('CLAUDE_BOT_PASSWORD (set but empty)');
    expect(output).not.toContain('skipped');
    expect(stub.seen).toHaveLength(0);
  });

  it('walks to page 2 of the admin listing when page 1 is full of other users', async () => {
    const filler = Array.from({ length: 100 }, (_, i) => ({
      id: `filler-${i}`,
      email: `filler-${i}@test.example.com`,
    }));
    stub = await startStub({ pages: { 1: filler, 2: [{ id: BOT_ID, email: BOT_EMAIL }] } });
    const { status, output } = await runScript(botEnv(stub.url));
    expect(status).toBe(0);
    expect(output).toContain(`found user ${BOT_EMAIL} (${BOT_ID})`);
    expect(stub.seen.map((r) => `${r.method} ${r.url}`).slice(0, 3)).toEqual([
      'GET /auth/v1/admin/users?page=1&per_page=100',
      'GET /auth/v1/admin/users?page=2&per_page=100',
      `PUT /auth/v1/admin/users/${BOT_ID}`,
    ]);
  });

  it('warns that the password is rotated but sessions are not revoked when sign-in fails', async () => {
    stub = await startStub({ signInStatus: 403 });
    const { status, output } = await runScript(botEnv(stub.url));
    expect(status).toBe(1);
    expect(output).toContain('update-password ok (HTTP 200)');
    expect(output).toContain(HALF_DONE_WARNING);
    expect(output).toContain('step "sign-in" failed with HTTP 403');
    expect(output).not.toContain(FAKE_PASSWORD);
    expect(stub.seen.map((r) => r.method)).toEqual(['GET', 'PUT', 'POST']);
  });

  it('warns that the password is rotated but sessions are not revoked when global sign-out fails', async () => {
    stub = await startStub({ signOutStatus: 500 });
    const { status, output } = await runScript(botEnv(stub.url));
    expect(status).toBe(1);
    expect(output).toContain('sign-in with new password ok (HTTP 200)');
    expect(output).toContain(HALF_DONE_WARNING);
    expect(output).toContain('step "sign-out-global" failed with HTTP 500');
    expect(output).not.toContain(FAKE_PASSWORD);
    expect(output).not.toContain('unit-test-access-token');
    expect(stub.seen.map((r) => r.method)).toEqual(['GET', 'PUT', 'POST', 'POST']);
  });

  it('finds the CLAUDE_BOT_EMAIL override case-insensitively and signs in with it as given', async () => {
    // The admin listing reports the address as GoTrue stored it; the override
    // is what the operator typed. Both carry different casing on purpose, so
    // dropping the lowercase on either side of the comparison loses the user.
    // The sign-in must then carry the operator's value verbatim, not the default.
    const override = 'Rotation-Bot@test.example.com';
    stub = await startStub({ users: [{ id: BOT_ID, email: 'rotation-bot@TEST.example.com' }] });
    const { status, output } = await runScript(botEnv(stub.url, { CLAUDE_BOT_EMAIL: override }));
    expect(status).toBe(0);
    expect(output).toContain(`found user ${override} (${BOT_ID})`);
    expect(output).not.toContain(BOT_EMAIL);
    expect(output).not.toContain(FAKE_PASSWORD);
    const signIn = stub.seen.find((r) => r.url === '/auth/v1/token?grant_type=password');
    expect(signIn && JSON.parse(signIn.body)).toEqual({ email: override, password: FAKE_PASSWORD });
  });

  it('exits 1 and warns that sessions are not revoked when sign-in returns 200 without an access_token', async () => {
    // A 200 with no token is the one sign-in failure a status check misses;
    // without the guard the script would POST /logout with "Bearer undefined".
    stub = await startStub({ signInBody: { token_type: 'bearer' } });
    const { status, output } = await runScript(botEnv(stub.url));
    expect(status).toBe(1);
    expect(output).toContain('update-password ok (HTTP 200)');
    expect(output).toContain(HALF_DONE_WARNING);
    expect(output).toContain('step "sign-in" failed with HTTP 200 (no access_token in response)');
    expect(output).not.toContain(FAKE_PASSWORD);
    expect(stub.seen.map((r) => r.method)).toEqual(['GET', 'PUT', 'POST']);
  });

  it('exits 1 with the failing step and status when the Auth API rejects the update', async () => {
    stub = await startStub({ updateStatus: 500 });
    const { status, output } = await runScript(botEnv(stub.url));
    expect(status).toBe(1);
    expect(output).toContain('step "update-password" failed with HTTP 500');
    expect(output).not.toContain(FAKE_PASSWORD);
    expect(stub.seen.map((r) => r.method)).toEqual(['GET', 'PUT']);
  });
});
