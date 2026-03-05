/**
 * Auth Fixture using @seontechnologies/playwright-utils auth-session
 *
 * Replaces the hand-rolled worker-auth fixture with the library's
 * auth-session system. Each worker gets a unique user identifier
 * mapped to its pool index.
 */
import { test as base } from '@playwright/test';
import type { AuthOptions } from '@seontechnologies/playwright-utils/auth-session';
import { getStorageStatePath } from '@seontechnologies/playwright-utils/auth-session';
import { cpus } from 'os';
import { initializeAuthSystem } from '../auth/setup';
import { SupabaseAuthProvider } from '../auth/supabase-auth-provider';

// Must run before any auth operations
initializeAuthSystem();

const MIN_AUTH_POOL_SIZE = 8;

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

const provider = new SupabaseAuthProvider();

type AuthTestFixtures = {
  authSessionEnabled: boolean;
  authToken: string;
};

type AuthWorkerFixtures = {
  authOptions: AuthOptions;
  partnerUserIdentifier: string;
};

export const test = base.extend<AuthTestFixtures, AuthWorkerFixtures>({
  // Worker-scoped: map workerIndex → user identifier
  authOptions: [
    async ({}, use, workerInfo) => {
      const poolSize = getAuthPoolSize();
      const normalizedIndex = ((workerInfo.workerIndex % poolSize) + poolSize) % poolSize;
      await use({
        environment: 'local',
        userIdentifier: `worker-${normalizedIndex}`,
      });
    },
    { scope: 'worker' },
  ],

  authSessionEnabled: [true, { option: true }],

  // Test-scoped: acquire auth token lazily
  authToken: async ({ request, authOptions, authSessionEnabled }, use) => {
    if (!authSessionEnabled) {
      await use('');
      return;
    }
    const storageState = await provider.manageAuthToken(request, authOptions);
    const rawToken = provider.extractToken(storageState) || '';
    await use(rawToken);
  },

  // Test-scoped: create authenticated browser context
  context: async ({ browser, request, authOptions, authSessionEnabled }, use) => {
    if (authSessionEnabled) {
      await provider.manageAuthToken(request, authOptions);
    }

    const context = await browser.newContext({
      ...(authSessionEnabled ? { storageState: getStorageStatePath(authOptions) } : {}),
    });

    await use(context);
    await context.close();
  },

  // Test-scoped: page from authenticated context
  page: async ({ context }, use) => {
    const page = await context.newPage();
    await use(page);
  },

  // Worker-scoped: partner user identifier for together-mode tests
  partnerUserIdentifier: [
    async ({}, use, workerInfo) => {
      const poolSize = getAuthPoolSize();
      const normalizedIndex = ((workerInfo.workerIndex % poolSize) + poolSize) % poolSize;
      await use(`worker-${normalizedIndex}-partner`);
    },
    { scope: 'worker' },
  ],
});
