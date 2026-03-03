import { execSync } from 'child_process';
import * as crypto from 'crypto';
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
 * Parses `supabase status -o env` and, when GoTrue uses ES256 signing keys,
 * re-signs SERVICE_ROLE_KEY and ANON_KEY so they're accepted by the auth service.
 * Falls back gracefully if Supabase CLI is unavailable (CI).
 */
if (!process.env.SUPABASE_URL) {
  try {
    const output = execSync('supabase status -o env 2>/dev/null', { encoding: 'utf-8' });
    const vars: Record<string, string> = {};
    for (const line of output.split('\n')) {
      const match = line.match(/^(\w+)="(.+)"$/);
      if (match) vars[match[1]] = match[2];
    }

    let serviceRoleKey = vars.SERVICE_ROLE_KEY;
    let anonKey = vars.ANON_KEY;

    // Detect HS256/ES256 mismatch: if GoTrue has GOTRUE_JWT_KEYS, re-sign tokens.
    try {
      const jwtKeysRaw = execSync(
        "docker inspect supabase_auth_My-Love --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null",
        { encoding: 'utf-8' }
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

    // Force-set VITE_ variants so the Vite dev server connects to local Supabase.
    // Must use `=` (not `??=`) because fnox may inject production values
    // and Vite's loadEnv gives process.env highest priority.
    process.env.VITE_SUPABASE_URL = vars.API_URL;
    process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY = anonKey;
  } catch {
    // Supabase CLI unavailable — env vars must be set externally (CI)
  }
}

/**
 * Playwright Test Configuration
 * @see https://playwright.dev/docs/test-configuration
 *
 * Uses @seontechnologies/playwright-utils for enhanced fixtures.
 * See tests/support/merged-fixtures.ts for fixture composition.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Timeouts
  timeout: 60 * 1000, // Test timeout: 60s
  expect: {
    timeout: 15 * 1000, // Assertion timeout: 15s
  },

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
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
  ],

  outputDir: 'test-results',

  projects: [
    // Auth setup — runs once, saves storageState for E2E tests
    {
      name: 'setup',
      testMatch: /auth-setup\.ts/,
      testDir: './tests/support',
    },
    {
      name: 'chromium',
      testDir: './tests/e2e',
      use: {
        ...devices['Desktop Chrome'],
      },
      dependencies: ['setup'],
    },
    {
      name: 'api',
      testDir: './tests/api',
      dependencies: ['setup'],
    },
    // Uncomment for cross-browser testing
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],

  // Run local dev server before tests.
  // --mode test makes Vite load .env.test (plain-text local Supabase values)
  // which overrides the encrypted production credentials in .env.local.
  // In CI, set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY directly.
  webServer: {
    command: 'npx vite --mode test',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
