/**
 * Observe the read a navigation's own document sends.
 *
 * Import by this deep path: `tests/support/helpers` has no barrel.
 *
 * `interceptNetworkCall`'s observe mode latches onto the first matching request,
 * whichever document sent it, and throws when that request gets no response. A
 * spec that signs in and then navigates to the screen it asserts on has a
 * request from the page it is leaving in flight: sign-in starts the refreshers
 * (Home's anniversaries read, `datesSlice.ts`), Daily re-reads when its Realtime
 * channel joins, and the navigation cuts that request off unanswered, so the
 * observer fails with "No response received" or waits for a response that never
 * settles (DW-524, DW-280, 535fc097).
 *
 * Start {@link observeReadAfterNavigation} before the `goto`, `reload` or click
 * that navigates, and await it after: it ignores every request sent before the
 * main frame commits the navigation and accepts only the loaded document's own.
 */
import type { Frame, Page } from '@playwright/test';
import { SECOND_CONTEXT_READ_TIMEOUT } from './reads';

/** A wait of {@link observeReadAfterNavigation} ran out; `stage` says which one. */
export class ReadAfterNavigationTimeoutError extends Error {
  constructor(
    readonly method: string,
    readonly url: string,
    readonly stage: 'request' | 'response',
    readonly timeout: number
  ) {
    super(
      stage === 'request'
        ? `${method} ${url}: the loaded page sent no such request within ${timeout} ms of the navigation`
        : `${method} ${url}: the loaded page's own request got no response within ${timeout} ms`
    );
    this.name = 'ReadAfterNavigationTimeoutError';
  }
}

/**
 * The path a read glob from `reads.ts` names: `**` then a path, with an optional
 * trailing `*` for the query string. A glob that pins query parameters, or has a
 * wildcard anywhere else, is refused: this helper matches on the path alone.
 */
function pathOfRead(glob: string): string {
  const path = glob.replace(/^\*\*/, '').replace(/\*$/, '');
  if (!path.startsWith('/') || /[*?]/.test(path)) {
    throw new Error(`${glob}: observeReadAfterNavigation matches a path glob like '**/rest/v1/table*'`);
  }
  return path;
}

/**
 * Observe the first `method` request to `url` (a path glob from `reads.ts`) sent
 * by the document the next navigation of `page` loads, and its response.
 */
export async function observeReadAfterNavigation(
  page: Page,
  {
    method,
    url,
    timeout = SECOND_CONTEXT_READ_TIMEOUT,
  }: { method: 'GET' | 'POST'; url: string; timeout?: number }
): Promise<{ status: number; responseJson: unknown }> {
  const path = pathOfRead(url);
  let navigated = false;
  const onNavigated = (frame: Frame) => {
    if (frame === page.mainFrame()) navigated = true;
  };
  page.on('framenavigated', onNavigated);
  const deadline = Date.now() + timeout;
  try {
    // playwright-utils deviation: interceptNetworkCall's observe mode latches onto the first matching request, whichever document sent it, and throws when that one gets no response.
    const request = await page
      .waitForRequest(
        (candidate) =>
          navigated &&
          candidate.method() === method &&
          new URL(candidate.url()).pathname.endsWith(path),
        { timeout }
      )
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'TimeoutError') {
          throw new ReadAfterNavigationTimeoutError(method, url, 'request', timeout);
        }
        throw error;
      });
    let timer: NodeJS.Timeout | undefined;
    const response = await Promise.race([
      request.response(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new ReadAfterNavigationTimeoutError(method, url, 'response', timeout)),
          Math.max(deadline - Date.now(), 0)
        );
      }),
    ]).finally(() => clearTimeout(timer));
    if (!response) throw new Error(`${method} ${url}: the loaded page's own read got no response`);
    return { status: response.status(), responseJson: await response.json() };
  } finally {
    page.off('framenavigated', onNavigated);
  }
}
