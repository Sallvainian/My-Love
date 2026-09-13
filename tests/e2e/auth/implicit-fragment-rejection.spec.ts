/**
 * P0 E2E: CAP-13 / F13 — an authentication redirect is accepted only for a flow
 * this browser started.
 *
 * The attacker identity here is a REAL throwaway account, created and deleted
 * through the admin client, and the fragment carries its real, complete token
 * set. That matters: a fake token yields "no session" even on the vulnerable
 * implicit client, because the server rejects it. Only real tokens make the
 * absence of a session evidence of the client refusing the callback.
 *
 * The spec never links, unlinks or resets a worker-pool account — it only reads
 * the worker's id to assert the signed-in session did not move.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../../support/merged-fixtures';
import { resolveWorkerPairIds } from '../../support/factories/events';
import { createOutsiderClient } from '../../support/helpers/rls-security';

// `.env.test` points the dev server at http://127.0.0.1:54321, and the SDK
// derives its storage key as `sb-${hostname.split('.')[0]}-auth-token`.
const STORAGE_KEY = 'sb-127-auth-token';

// Copied rather than imported: `src/services/dbSchema.ts` pulls in
// `src/utils/logger.ts`, which reads `import.meta.env.DEV` at module scope and
// throws under Playwright's Node runner. Kept in step with dbSchema.ts:182 and
// dbSchema.ts:199 (`SW_AUTH_STORE`).
const DB_NAME = 'my-love-db';
const SW_AUTH_STORE = 'sw-auth';

type ForeignSession = {
  userId: string;
  fragment: string;
  cleanup: () => Promise<unknown>;
};

/** Mint a real second account and build its complete implicit grant fragment. */
async function createForeignSession(
  supabaseAdmin: Parameters<typeof createOutsiderClient>[0]
): Promise<ForeignSession> {
  const { client, userId, cleanup } = await createOutsiderClient(supabaseAdmin, 'pkce-attacker');
  const { data } = await client.auth.getSession();
  const session = data.session;
  if (!session) throw new Error('Foreign account produced no session to forge a fragment from');

  const fragment =
    '#access_token=' +
    encodeURIComponent(session.access_token) +
    '&refresh_token=' +
    encodeURIComponent(session.refresh_token) +
    '&expires_in=' +
    String(session.expires_in ?? 3600) +
    '&token_type=bearer';

  return { userId, fragment, cleanup };
}

/** The user id of the session the SDK has persisted, or null when there is none. */
async function storedSessionUserId(page: Page, storageKey: string): Promise<string | null> {
  return await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    try {
      return (JSON.parse(raw) as { user?: { id?: string } }).user?.id ?? null;
    } catch {
      return null;
    }
  }, storageKey);
}

/**
 * Every `sb-*-auth-token` key present, whatever the project host resolves to.
 * `storedSessionUserId` returns null for a key that simply does not exist, so
 * asserting on one hard-coded key alone would pass if that key ever drifted.
 */
async function storedSessionKeys(page: Page): Promise<string[]> {
  return await page.evaluate(() =>
    Object.keys(window.localStorage).filter((key) => /^sb-.*-auth-token$/.test(key))
  );
}

/**
 * The user id bound into the Background Sync record the service worker reads.
 * Opened without a version so this read never triggers an upgrade; a database
 * or store that does not exist yet simply has no record.
 */
async function backgroundSyncUserId(page: Page, dbName: string, store: string) {
  return await page.evaluate(
    ([name, storeName]) =>
      new Promise<string | null>((resolve, reject) => {
        const request = window.indexedDB.open(name);
        request.onerror = () => reject(request.error);
        // Without this the promise never settles when another connection holds a
        // pending versionchange, and the test hangs to its own timeout instead.
        request.onblocked = () => resolve(null);
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.close();
            resolve(null);
            return;
          }
          const read = db.transaction(storeName, 'readonly').objectStore(storeName).get('current');
          read.onerror = () => {
            db.close();
            reject(read.error);
          };
          read.onsuccess = () => {
            const token = read.result as { userId?: string } | undefined;
            db.close();
            resolve(token?.userId ?? null);
          };
        };
      }),
    [dbName, store] as const
  );
}

test.describe('Foreign implicit fragment — signed out', () => {
  test.use({ authSessionEnabled: false });

  test('[P0] cannot establish a session from another account’s token fragment', async ({
    page,
    supabaseAdmin,
  }) => {
    // GIVEN: a real second account whose complete token set an attacker holds.
    const foreign = await createForeignSession(supabaseAdmin);

    try {
      // WHEN: the victim opens the app through a link carrying that fragment.
      await page.goto('/' + foreign.fragment);

      // THEN: the app is still signed out and nothing was persisted.
      await expect(page.getByTestId('login-screen')).toBeVisible();
      expect(await storedSessionKeys(page)).toEqual([]);
      expect(await storedSessionUserId(page, STORAGE_KEY)).toBeNull();
      expect(await backgroundSyncUserId(page, DB_NAME, SW_AUTH_STORE)).toBeNull();
    } finally {
      await foreign.cleanup();
    }
  });
});

test.describe('Foreign implicit fragment — already signed in', () => {
  // The default authenticated storage state: this worker's own account.

  test('[P0] cannot replace the signed-in account', async ({ page, supabaseAdmin }) => {
    // GIVEN: this worker's account is signed in, and a real second account exists.
    const { userId: workerUserId } = await resolveWorkerPairIds(supabaseAdmin);
    const foreign = await createForeignSession(supabaseAdmin);
    expect(foreign.userId).not.toBe(workerUserId);

    try {
      await page.goto('/');
      await expect(page.getByTestId('app-container')).toBeVisible();
      expect(await storedSessionUserId(page, STORAGE_KEY)).toBe(workerUserId);

      // WHEN: the signed-in victim opens the attacker's link. The reload is
      // load-bearing: `goto` to a URL that differs only by its fragment is a
      // same-document navigation, so without it the client is never rebuilt and
      // the callback is never classified at all.
      await page.goto('/' + foreign.fragment);
      await page.reload();

      // THEN: the app settles back into its normal shell. This wait is also the
      // assertion, and it is what makes reading storage below race-free: the
      // attacker's account is brand new and has no display name, so a client
      // that accepted the fragment lands on the setup overlay instead, which
      // `src/App.tsx:581` returns *in place of* the shell.
      await expect(page.getByTestId('app-container')).toBeVisible();
      await expect(page.getByTestId('display-name-setup')).toHaveCount(0);
      await expect(page.getByTestId('login-screen')).toHaveCount(0);

      // Session and Background Sync token still belong to the original account.
      expect(await storedSessionUserId(page, STORAGE_KEY)).toBe(workerUserId);
      // The requirement is that this record never comes to belong to the
      // attacker. Both admissible values are accepted deliberately, and this
      // is not a weakening to "fix" on a later pass:
      //   null   -- the measured value today. A session restored from storage
      //             emits no SIGNED_IN, and `sessionService.ts:71` writes the
      //             record only on SIGNED_IN or TOKEN_REFRESHED, so a returning
      //             browser has no record at all.
      //   worker -- the same line writes it on TOKEN_REFRESHED, which the app
      //             client (autoRefreshToken: true) fires on its own schedule.
      //             A cached worker token close to expiry therefore produces a
      //             record mid-test, and pinning `toBeNull()` would redden this
      //             P0 for a reason that has nothing to do with PKCE.
      // A callback that bound the attacker's identity fails either way, and the
      // session assertion above already proves the victim's session survived.
      const syncUserId = await backgroundSyncUserId(page, DB_NAME, SW_AUTH_STORE);
      expect(syncUserId).not.toBe(foreign.userId);
      expect([null, workerUserId]).toContain(syncUserId);
    } finally {
      await foreign.cleanup();
    }
  });
});
