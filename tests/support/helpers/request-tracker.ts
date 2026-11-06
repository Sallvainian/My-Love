/**
 * Request counting for a spec that must tell "the screen updated from the
 * live event" from "a read delivered it instead".
 *
 * Import by this deep path: `tests/support/helpers` has no barrel.
 */
import type { Page, Request } from '@playwright/test';

/**
 * `moodSyncService` reporting a join of the partner channel (`logger.debug`,
 * which the dev server the E2E project runs against does print). Arm
 * `page.waitForEvent('console', { predicate })` on it before the navigation
 * that logs it.
 */
export const MOOD_SUBSCRIBED_LOG = /\[MoodSyncService\] Broadcast subscription status:.*SUBSCRIBED/;

/**
 * Counts the requests of one method and path a page starts and settles, failed
 * ones too, so a spec can tell that none is in flight and that none started
 * later. A GET read of a REST table by default; pass `'POST'` for an RPC. The
 * path is matched on its end, so `/rest/v1/rpc/get_daily_day` does not count
 * `/rest/v1/rpc/get_daily_day_by_id`.
 *
 * Attach it to the page before it loads: a read it never saw start would look
 * settled.
 */
export function trackReads(page: Page, pathSuffix: string, method: 'GET' | 'POST' = 'GET') {
  let started = 0;
  let settled = 0;
  const isRead = (request: Request) =>
    request.method() === method && new URL(request.url()).pathname.endsWith(pathSuffix);
  const settle = (request: Request) => {
    if (isRead(request)) settled += 1;
  };
  // playwright-utils deviation: counts every read the receiver starts, to know when none is in flight; interceptNetworkCall's observe mode latches onto the first matching request only.
  page.on('request', (request) => {
    if (isRead(request)) started += 1;
  });
  // playwright-utils deviation: settles every read, failed ones too; interceptNetworkCall's observe mode throws on a request that gets no response rather than reporting it.
  page.on('requestfinished', settle);
  page.on('requestfailed', settle);
  return {
    started: () => started,
    inFlight: () => started - settled,
  };
}

export type ReadTracker = ReturnType<typeof trackReads>;
