import type { Page, Route } from '@playwright/test';
import { recurse } from '@seontechnologies/playwright-utils/recurse';
import type { PersistenceScenario } from '../../../../tests/support/harnesses/auth-token-persistence';

/**
 * Run with authSessionEnabled: false so merged fixtures supply a fresh context.
 * The real harness drains all work and restores native/SDK methods in finally.
 * Only opaque ownership/version labels cross the browser boundary.
 */
export async function runNativeTokenPersistence(
  page: Page, baseURL: string | undefined, scenario: PersistenceScenario
) {
  if (!baseURL) throw new Error('Missing isolated harness origin');
  const origin = new URL(baseURL).origin;
  let externalRequests = 0;
  let pageErrors = 0;
  const countPageError = () => { pageErrors += 1; };
  const guardOrigin = async (route: Route) => {
    if (new URL(route.request().url()).origin !== origin) {
      externalRequests += 1;
      await route.abort();
    } else await route.continue();
  };
  page.on('pageerror', countPageError);
  // playwright-utils deviation: all-traffic origin guard prevents synthetic credentials escaping; no application endpoint is observed or stubbed.
  await page.route('**/*', guardOrigin);
  try {
    await page.goto(new URL('/tests/support/harnesses/auth-token-persistence.html', baseURL).href);
    await recurse(
      () => page.evaluate(() => !!window.__authTokenPersistence),
      (ready) => ready,
      { timeout: 10_000, interval: 250, log: false }
    );
    const result = await page.evaluate(async (name) => {
      // Capture outside the harness, so restoration checks do not rely only on
      // its reported cleanup flags. Function references never leave this scope.
      const before = {
        open: IDBFactory.prototype.open,
        transaction: IDBDatabase.prototype.transaction,
        close: IDBDatabase.prototype.close,
        put: IDBObjectStore.prototype.put,
        delete: IDBObjectStore.prototype.delete,
        get: IDBObjectStore.prototype.get,
      };
      const evidence = await window.__authTokenPersistence!.run(name);
      return {
        evidence,
        verification: {
          nativeReferencesRestored: {
            open: IDBFactory.prototype.open === before.open,
            transaction: IDBDatabase.prototype.transaction === before.transaction,
            close: IDBDatabase.prototype.close === before.close,
            put: IDBObjectStore.prototype.put === before.put,
            delete: IDBObjectStore.prototype.delete === before.delete,
            get: IDBObjectStore.prototype.get === before.get,
          },
          harnessRemoved: window.__authTokenPersistence === undefined,
          remainingDatabases: (await indexedDB.databases()).length,
          localStorageEntries: localStorage.length,
        },
      };
    }, scenario);
    return { ...result, externalRequests, pageErrors };
  } finally {
    await page.unroute('**/*', guardOrigin);
    page.off('pageerror', countPageError);
  }
}
