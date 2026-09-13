import { test as base } from '@playwright/test';
import { recurse } from '@seontechnologies/playwright-utils/recurse';
import type { SupabaseInteractionRecord } from '../../../src/api/interactionService';
import type { OwnershipSnapshot } from '../harnesses/interaction-record-ownership';

type InteractionOwnership = {
  mount: (userId: string, partnerId: string) => Promise<void>;
  snapshot: () => Promise<OwnershipSnapshot>;
  setAuthUser: (userId: string, email?: string) => Promise<void>;
  setPartnerId: (partnerId: string) => Promise<void>;
  clearAuth: () => Promise<void>;
  subscribe: () => Promise<number>;
  dispatch: (index: number, record: SupabaseInteractionRecord) => Promise<void>;
};

export const test = base.extend<{ interactionOwnership: InteractionOwnership }>({
  interactionOwnership: async ({ page, baseURL }, use) => {
    try {
      await use({
        mount: async (userId, partnerId) => {
          const url = new URL('/tests/support/harnesses/interaction-record-ownership.html', baseURL);
          url.searchParams.set('userId', userId);
          url.searchParams.set('partnerId', partnerId);
          await page.goto(url.href);
          await recurse(
            () => page.evaluate(() => Boolean(window.__interactionOwnership)),
            (ready) => ready,
            { timeout: 10000, interval: 50, log: 'Waiting for the ownership harness' }
          );
          await page.evaluate(() => window.__interactionOwnership!.ready);
        },
        snapshot: () => page.evaluate(() => window.__interactionOwnership!.snapshot()),
        setAuthUser: (userId, email) => page.evaluate(
          ({ userId, email }) => window.__interactionOwnership!.setAuthUser(userId, email),
          { userId, email }
        ),
        setPartnerId: (partnerId) => page.evaluate(
          (partnerId) => window.__interactionOwnership!.setPartnerId(partnerId),
          partnerId
        ),
        clearAuth: () => page.evaluate(() => window.__interactionOwnership!.clearAuth()),
        subscribe: () => page.evaluate(() => window.__interactionOwnership!.subscribe()),
        dispatch: (index, record) => page.evaluate(
          ({ index, record }) => window.__interactionOwnership!.dispatch(index, record),
          { index, record }
        ),
      });
    } finally {
      if (!page.isClosed()) {
        await page.evaluate(() => window.__interactionOwnership?.dispose());
      }
    }
  },
});
