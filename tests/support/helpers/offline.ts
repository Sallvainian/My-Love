/**
 * Take the browser context off or on the network, as the app sees it.
 *
 * Import by this deep path: `tests/support/helpers` has no barrel.
 *
 * `setOffline` alone flips `navigator.onLine` and fails requests, but the app
 * reacts to the window's `offline`/`online` events, so the matching event is
 * dispatched too — the app then runs its offline or reconnect path at once
 * instead of whenever the browser next reports the change.
 */
import type { Page } from '@playwright/test';

export async function goOffline(page: Page, offline: boolean): Promise<void> {
  await page.context().setOffline(offline);
  await page.evaluate(
    (event) => window.dispatchEvent(new Event(event)),
    offline ? 'offline' : 'online'
  );
}
