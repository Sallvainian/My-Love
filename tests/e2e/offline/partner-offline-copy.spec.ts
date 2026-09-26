/**
 * E2E: the partner profile from the shared per-account local copy, offline.
 *
 * A linked user opens the partner view online (which saves the copy), goes
 * offline, leaves via the dock and comes back. The in-memory partner is
 * cleared while away, so what comes back can only be the saved IndexedDB copy
 * — never "Connect with Your Partner". The global offline indicator says the
 * data may be out of date rather than promising a sync.
 */
import { test, expect } from '../../support/merged-fixtures';
import { resolveOwnPair } from '../../support/helpers/events';
import { navigateTo } from '../../support/helpers/navigation';
import { partnerRecordRead } from '../../support/helpers/reads';
import { recurseUntil } from '../../support/helpers/recurse';
import type { Page } from '@playwright/test';

// Tracing corrupts when the context goes offline (see network-status.spec.ts).
test.use({ trace: 'off', video: 'off' });

const OFFLINE_TEXT = "You're offline. Showing saved data, which may be out of date.";

/** Whether the signed-in account's partner copy has been saved as linked. */
async function partnerCopySaved(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const userId = window.__APP_STORE__?.getState().userId;
    if (!userId) return false;
    return new Promise<boolean>((resolve) => {
      const open = indexedDB.open('my-love-db');
      open.onerror = () => resolve(false);
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains('local-copies')) {
          db.close();
          resolve(false);
          return;
        }
        const get = db.transaction('local-copies').objectStore('local-copies').get([userId, 'partner']);
        get.onsuccess = () => {
          db.close();
          resolve(get.result?.value?.status === 'linked');
        };
        get.onerror = () => {
          db.close();
          resolve(false);
        };
      };
    });
  });
}

test.describe('Partner profile offline', () => {
  test('[P1] a linked user sees the saved partner offline, never the Connect UI', async ({
    page,
    context,
    supabaseAdmin,
    interceptNetworkCall,
  }) => {
    // GIVEN: the partner view loaded online, which saves the partner copy.
    const { partnerId } = await resolveOwnPair(supabaseAdmin);
    const partnerRead = interceptNetworkCall({ method: 'GET', url: partnerRecordRead(partnerId) });
    await page.goto('/partner');
    const partnerRecord = await partnerRead;
    expect(partnerRecord.status).toBe(200);
    // A `maybeSingle` read: PostgREST answers with a one-row array.
    const partnerName = ((partnerRecord.responseJson as { display_name: string | null }[] | null)
      ?.[0]?.display_name ?? '').trim();
    expect(partnerName).not.toBe('');
    const heading = page.getByTestId('partner-mood-view').getByRole('heading', { level: 1 });
    await expect(heading).toHaveText(partnerName);
    await expect(page.getByTestId('partner-mood-refresh-button')).toBeVisible();
    await recurseUntil(() => partnerCopySaved(page), (v) => { expect(v).toBe(true); });

    try {
      // WHEN: the device goes offline and the user leaves the view.
      await context.setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));
      await navigateTo(page, 'home');

      // Drop the in-memory partner, as a fresh open would, so the return trip
      // can only be served from the saved copy.
      await page.evaluate(() => window.__APP_STORE__!.setState({ partner: null }));

      await navigateTo(page, 'partner');

      // THEN: the saved partner is shown, not the Connect UI or a load error.
      await expect(heading).toHaveText(partnerName);
      await expect(
        page.getByRole('heading', { level: 1, name: 'Connect with Your Partner' })
      ).toHaveCount(0);
      await expect(page.getByTestId('partner-load-error')).toHaveCount(0);

      // AND: the global indicator says the data may be out of date.
      const indicator = page.getByTestId('network-status-indicator');
      await expect(indicator).toHaveAttribute('data-status', 'offline');
      await expect(indicator).toContainText(OFFLINE_TEXT);
      await expect(indicator).not.toContainText('will sync');
    } finally {
      await context.setOffline(false);
    }
  });
});
