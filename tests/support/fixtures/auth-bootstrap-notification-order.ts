import { test as base } from '@playwright/test';
import { recurse } from '@seontechnologies/playwright-utils/recurse';
import type {
  AuthBootstrapBridge,
  AuthBootstrapMountOptions,
  AuthBootstrapSnapshot,
} from '../harnesses/auth-bootstrap-notification-order';

/**
 * `profileDisplayName` is a Playwright-level concern, not a harness one: the
 * display-name gate reads `public.users` over HTTP, and this harness's sessions
 * carry a synthetic access token PostgREST answers 401 for. Serving the row the
 * scenario means keeps that read out of the network-error monitor AND lets a
 * scenario actually choose the gate's answer, which `user_metadata` used to do.
 * `null` is the seed state — no name chosen — so the setup modal opens.
 */
type MountOptions = AuthBootstrapMountOptions & { profileDisplayName?: string | null };

type AuthBootstrap = {
  mount: (options?: MountOptions) => Promise<void>;
  snapshot: () => Promise<AuthBootstrapSnapshot>;
  notify: (...args: Parameters<AuthBootstrapBridge['notify']>) => Promise<void>;
  resolveLookup: (...args: Parameters<AuthBootstrapBridge['resolveLookup']>) => Promise<void>;
  resolveLookupThenNotify: (...args: Parameters<AuthBootstrapBridge['resolveLookupThenNotify']>) => Promise<void>;
  rejectLookup: (message: string) => Promise<void>;
  seedEvents: (...args: Parameters<AuthBootstrapBridge['seedEvents']>) => Promise<void>;
  resolveEvents: (...args: Parameters<AuthBootstrapBridge['resolveEvents']>) => Promise<void>;
};

export const test = base.extend<{ authBootstrap: AuthBootstrap }>({
  authBootstrap: async ({ page, baseURL }, use) => {
    try {
      await use({
        mount: async (options) => {
          const { profileDisplayName = 'Bootstrap User', ...harnessOptions } = options ?? {};
          // `.single()` asks for a bare object rather than an array.
          await page.route('**/rest/v1/users?select=display_name*', (route) =>
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ display_name: profileDisplayName }),
            })
          );
          const url = new URL('/tests/support/harnesses/auth-bootstrap-notification-order.html', baseURL);
          await page.goto(url.href);
          await recurse(
            () => page.evaluate(() => Boolean(window.__authBootstrap)),
            (ready) => ready,
            { timeout: 10000, interval: 50, log: 'Waiting for the auth bootstrap harness' }
          );
          await page.evaluate((options) => window.__authBootstrap!.mount(options), harnessOptions);
          await recurse(
            () => page.evaluate(() => window.__authBootstrap!.snapshot()),
            (state) => state.lookupCalls === 1 && state.activeSubscriptions === 1,
            { timeout: 10000, interval: 50, log: 'Waiting for the pending lookup and App listener' }
          );
        },
        snapshot: () => page.evaluate(() => window.__authBootstrap!.snapshot()),
        notify: (event, session) => page.evaluate(
          ({ event, session }) => window.__authBootstrap!.notify(event, session),
          { event, session }
        ),
        resolveLookup: (session) => page.evaluate(
          (session) => window.__authBootstrap!.resolveLookup(session), session
        ),
        resolveLookupThenNotify: (snapshot, event, session) => page.evaluate(
          ({ snapshot, event, session }) => window.__authBootstrap!.resolveLookupThenNotify(snapshot, event, session),
          { snapshot, event, session }
        ),
        rejectLookup: (message) => page.evaluate(
          (message) => window.__authBootstrap!.rejectLookup(message), message
        ),
        seedEvents: (events) => page.evaluate(
          (events) => window.__authBootstrap!.seedEvents(events), events
        ),
        resolveEvents: (events, index) => page.evaluate(
          ({ events, index }) => window.__authBootstrap!.resolveEvents(events, index), { events, index }
        ),
      });
    } finally {
      if (!page.isClosed()) {
        await page.evaluate(() => window.__authBootstrap?.dispose());
      }
    }
  },
});
