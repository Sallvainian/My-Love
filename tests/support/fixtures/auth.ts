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
import { initializeAuthSystem } from '../auth/setup';
import { SupabaseAuthProvider } from '../auth/supabase-auth-provider';
import { getAuthPoolSize, normalizeWorkerIndex } from '../auth/worker-pool';

// Must run before any auth operations
initializeAuthSystem();

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
      const normalizedIndex = normalizeWorkerIndex(workerInfo.workerIndex, getAuthPoolSize());
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
      const normalizedIndex = normalizeWorkerIndex(workerInfo.workerIndex, getAuthPoolSize());
      await use(`worker-${normalizedIndex}-partner`);
    },
    { scope: 'worker' },
  ],
});
