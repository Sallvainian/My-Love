/**
 * Abort a read endpoint and count the requests it took, so a spec can prove a
 * screen came from its saved copy rather than from a server answer.
 *
 * Import by this deep path: `tests/support/helpers` has no barrel.
 */
import type { Page } from '@playwright/test';

/**
 * Route `url` to an abort and count the requests it took. Install it before
 * the navigation it serves.
 */
export async function abortReads(page: Page, url: string): Promise<{ count: () => number }> {
  let aborted = 0;
  // playwright-utils deviation: the route must be installed before the navigation it serves and count and abort every match; interceptNetworkCall registers its route inside a test.step the caller cannot await, so nothing guarantees it is in place first.
  await page.route(url, (route) => {
    aborted += 1;
    return route.abort();
  });
  return { count: () => aborted };
}
