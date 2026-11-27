import { execSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';

/**
 * Sign a JWT with ES256 using the EC private key from GoTrue's GOTRUE_JWT_KEYS.
 * Supabase CLI v2.71.1+ defaults GoTrue to ES256 but `supabase status -o env`
 * still outputs stale HS256-signed keys. This re-signs tokens so they're accepted.
 */
function signES256(payload: object, jwk: crypto.JsonWebKey & { kid?: string }): string {
  const header = { alg: 'ES256', typ: 'JWT', kid: jwk.kid };
  const b64url = (data: string) => Buffer.from(data).toString('base64url');
  const signingInput = b64url(JSON.stringify(header)) + '.' + b64url(JSON.stringify(payload));
  const key = crypto.createPrivateKey({ key: jwk, format: 'jwk' });
  const sig = crypto.sign('SHA256', Buffer.from(signingInput), { key, dsaEncoding: 'ieee-p1363' });
  return signingInput + '.' + Buffer.from(sig).toString('base64url');
}

/**
 * Load Supabase local env vars for test fixtures.
 * Parses `supabase status`'s env output and, when GoTrue uses ES256 signing keys,
 * re-signs SERVICE_ROLE_KEY and ANON_KEY so they're accepted by the auth service.
 * Falls back gracefully if Supabase CLI is unavailable (CI).
 *
 * This runs unconditionally. It used to be guarded by `if (!process.env.SUPABASE_URL)`,
 * but CI exports SUPABASE_URL from .github/actions/setup-supabase before Playwright
 * starts, so the guard skipped the block exactly where it was needed most: the VITE_
 * force-set below never ran, the dev server fell back to the placeholder anon key in
 * .env.test, and every Realtime WebSocket handshake was rejected with 403 — which is
 * what made Realtime specs fail in CI but pass locally.
 * `??=` below still preserves any externally-provided SUPABASE_* values.
 */
// Suppress stderr via stdio rather than a `2>/dev/null` redirect: execSync shells
// through cmd.exe on Windows, which treats that as a path and fails the command
// outright, so the whole block silently fell into the catch and no local Supabase
// env vars were ever set.
const execOpts = { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] } as const;

/**
 * The port of this checkout's test dev server. Every worktree has its own local
 * Supabase (the stack backend), so it needs its own dev server too: with one fixed
 * port, `reuseExistingServer` would hand a second worktree's run the first one's
 * server, which points at the first worktree's database. A fixed port per folder,
 * from a hash of its path, keeps reuse working within a checkout. CI keeps 5173.
 * PLAYWRIGHT_DEV_PORT overrides it. BASE_URL is set here, before the workers start,
 * so the auth provider and specs that read it agree with Playwright's baseURL.
 */
const devPort =
  Number(process.env.PLAYWRIGHT_DEV_PORT) ||
  (process.env.CI
    ? 5173
    : 5200 +
      (parseInt(crypto.createHash('sha1').update(process.cwd()).digest('hex').slice(0, 8), 16) %
        700));
process.env.BASE_URL ??= `http://localhost:${devPort}`;

/**
 * This checkout's local Supabase as KEY=value lines. The stack backend
 * (`[experimental] stack` in supabase/config.toml: one local Supabase per worktree
 * and branch, each on its own ports) answers `status --env` and answers `-o env`
 * with an error message and exit 0; the classic backend CI runs
 * (SUPABASE_EXPERIMENTAL_STACK=0) rejects `--env`. So try the stack form first and
 * keep whichever output carries API_URL.
 */
function localSupabaseEnv(): string {
  for (const cmd of ['supabase status --env --output-format text', 'supabase status -o env']) {
    try {
      const output = execSync(cmd, execOpts);
      if (/^API_URL=/m.test(output)) return output;
    } catch {
      // try the other backend's form
    }
  }
  throw new Error('no local Supabase answers in this checkout');
}

/**
 * The auth container of this checkout's local Supabase. The classic backend has one
 * fixed name per project; the stack backend names it supabase-<project>-auth-<hash>,
 * one per worktree and branch, so it is found by the stack id `status` reports.
 */
function authContainer(): string {
  try {
    const id = JSON.parse(execSync('supabase status --output-format json', execOpts))?.identity?.id;
    if (typeof id === 'string' && /^[0-9a-f]+$/.test(id)) {
      const name = execSync(
        `docker ps --filter label=com.supabase.stack=${id} --filter label=com.supabase.service=auth --format "{{.Names}}"`,
        execOpts
      )
        .trim()
        .split('\n')[0];
      if (name) return name;
    }
  } catch {
    // classic backend: its status JSON has no identity
  }
  return 'supabase_auth_My-Love';
}

try {
  const output = localSupabaseEnv();
  const vars: Record<string, string> = {};
  for (const line of output.split('\n')) {
    // The classic backend double-quotes values, the stack backend single-quotes them.
    const match = line.match(/^(\w+)=(["'])(.+)\2$/);
    if (match) vars[match[1]] = match[3];
  }

  let serviceRoleKey = vars.SERVICE_ROLE_KEY;
  let anonKey = vars.ANON_KEY;

  // Detect HS256/ES256 mismatch: if GoTrue has GOTRUE_JWT_KEYS, re-sign tokens.
  try {
    // Double quotes, not single: cmd.exe does not treat ' as a quote character,
    // so a single-quoted --format string arrives as separate argv entries there.
    const jwtKeysRaw = execSync(
      `docker inspect ${authContainer()} --format "{{range .Config.Env}}{{println .}}{{end}}"`,
      execOpts
    );
    const jwtKeysLine = jwtKeysRaw.split('\n').find((l) => l.startsWith('GOTRUE_JWT_KEYS='));
    if (jwtKeysLine) {
      const jwk = JSON.parse(jwtKeysLine.replace('GOTRUE_JWT_KEYS=', ''))[0];
      serviceRoleKey = signES256(
        { iss: 'supabase-demo', role: 'service_role', exp: 1983812996 },
        jwk
      );
      anonKey = signES256({ iss: 'supabase-demo', role: 'anon', exp: 1983812996 }, jwk);
    }
  } catch {
    // Docker not available or container not found — use keys from supabase status
  }

  process.env.SUPABASE_URL ??= vars.API_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= serviceRoleKey;
  process.env.SUPABASE_ANON_KEY ??= anonKey;
  // The local mail catcher, so a spec can read a real auth email. Assigned only
  // when the parse actually found it: `process.env.X ??= undefined` stores the
  // STRING "undefined", which is truthy, so a spec's `test.skip(!MAILPIT_URL)`
  // would not fire and it would fetch against a host named "undefined" instead.
  if (vars.MAILPIT_URL) process.env.MAILPIT_URL ??= vars.MAILPIT_URL;

  // Force-set VITE_ variants so the Vite dev server connects to local Supabase.
  // Must use `=` (not `??=`) because fnox may inject production values
  // and Vite's loadEnv gives process.env highest priority.
  process.env.VITE_SUPABASE_URL = vars.API_URL;
  process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY = anonKey;
} catch {
  // Supabase CLI unavailable — env vars must be set externally (CI)
}

/**
 * Playwright Test Configuration
 * @see https://playwright.dev/docs/test-configuration
 *
 * Uses @seontechnologies/playwright-utils for enhanced fixtures.
 * See tests/support/merged-fixtures.ts for fixture composition.
 */
export default defineConfig({
  globalSetup: './tests/support/auth/global-setup.ts',
  globalTeardown: './tests/support/global-teardown.ts',
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // CI ran strictly serial (workers: 1), which left the slowest shard as the
  // whole pipeline's critical path. Shards are balanced by test *count*, not
  // duration, so a wait-heavy slice still sets the wall-clock after the
  // faster shards have finished.
  //
  // These specs are wait-bound, not CPU-bound — disconnect timeouts, realtime
  // propagation, waitForPartnerDisconnected — so the time is mostly spent
  // idle and parallelises nearly free. global-setup already provisions 24
  // isolated worker pairs, so per-worker data isolation is built for this.
  //
  // 2, not 4: ubuntu-latest is 4 vCPU and each shard also runs the local
  // Supabase stack plus a Vite server, so 2 workers means ~2 Chromium
  // contexts sharing 4 cores. Higher risks starving the realtime tests into
  // timeout-driven flakes, which would cost far more than the minutes saved.
  workers: process.env.CI ? 2 : undefined,

  // Timeouts
  timeout: 60 * 1000, // Test timeout: 60s
  expect: {
    timeout: 15 * 1000, // Assertion timeout: 15s
  },

  use: {
    baseURL: process.env.BASE_URL,
    trace: 'on',
    screenshot: 'on',
    video: 'on',
    actionTimeout: 15 * 1000, // Action timeout: 15s
    navigationTimeout: 30 * 1000, // Navigation timeout: 30s
  },

  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'],
    ['./tests/support/reporters/failure-summary-reporter.ts'],
    // Only the full E2E CI shards feed the merged report. Keep local runs and
    // burn-in's repeated invocations on their existing reporters.
    ...(process.env.E2E_BLOB_REPORT === '1' ? [['blob'] as const] : []),
  ],

  outputDir: 'test-results',

  projects: [
    {
      name: 'chromium',
      testDir: './tests/e2e',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'api',
      testDir: './tests/api',
      // One worker: push-love-note-trigger.spec.ts's "sender is down" test
      // rewrites the one global push_sender_settings row, and a push trigger
      // that another api file fires meanwhile would miss the sender.
      workers: 1,
      use: {
        baseURL: process.env.SUPABASE_URL,
        extraHTTPHeaders: {
          apikey: process.env.SUPABASE_ANON_KEY ?? '',
          'Content-Type': 'application/json',
        },
      },
    },
    {
      name: 'integration',
      testDir: './tests/integration',
    },
    // Uncomment for cross-browser testing
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],

  // Run local dev server before tests.
  // --mode test makes Vite load .env.test (plain-text local Supabase values);
  // the encrypted production credentials live in fnox.toml, not in any .env file.
  // In CI, set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY directly.
  webServer: {
    command: `npx vite --mode test --port ${devPort} --strictPort`,
    url: `http://localhost:${devPort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
