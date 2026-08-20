/**
 * Composed fixture for the Settings event-load recovery API and E2E specs.
 *
 * Target path once activated: `tests/support/fixtures/events-settings-load-retry.ts`.
 * The parked specs import that target path and are validated by activating all
 * three generated sources together.
 *
 * Pair-scoped setup and teardown remain owned by the existing `coupleEvents`
 * fixture. This wrapper adds exact production read paths, checked clearing,
 * browser connectivity control, and one deterministic two-window request gate.
 */
import type { Request, Route, TestType } from '@playwright/test';
import { test as base, expect } from '../merged-fixtures';
import type { EventSpec, SeededEvent } from '../factories/events';
import { formatDateISO } from '../../../src/utils/dateUtils';

type EventReadPaths = {
  upcoming: string;
  past: string;
};

type EventReadPatterns = {
  upcoming: string;
  past: string;
};

type EventReadCounts = {
  upcoming: number;
  past: number;
  total: number;
};

export type EventReadGate = {
  handler: (route: Route, request: Request) => Promise<void>;
  counts: () => EventReadCounts;
  release: () => void;
};

export type EventsLoadRetryHarness = {
  userId: string;
  token: string;
  readPaths: EventReadPaths;
  seed: (specs: EventSpec[]) => Promise<SeededEvent[]>;
  /** Delete and verify only this worker pair's rows. */
  clear: () => Promise<void>;
};

export type EventsLoadRetryBrowser = {
  readPatterns: EventReadPatterns;
  /** Change Chromium connectivity before dispatching the matching DOM event. */
  goOffline: () => Promise<void>;
  goOnline: () => Promise<void>;
  /** Remove only the two exact routes installed by these generated specs. */
  removeReadInterceptors: () => Promise<void>;
  createReadGate: () => EventReadGate;
};

type EventsLoadRetryFixtures = {
  eventsLoadRetryHarness: EventsLoadRetryHarness;
  eventsLoadRetryBrowser: EventsLoadRetryBrowser;
};

type EventsLoadRetryTest = typeof base extends TestType<infer T, infer W>
  ? TestType<T & EventsLoadRetryFixtures, W>
  : never;

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

const UPCOMING_ORDER = 'event_date.asc,created_at.asc';
const PAST_ORDER = 'event_date.desc,created_at.desc';
const UPCOMING_PATTERN =
  '**/rest/v1/events?select=*&event_date=gte.*&order=event_date.asc%2Ccreated_at.asc&offset=0&limit=50';
const PAST_PATTERN =
  '**/rest/v1/events?select=*&event_date=lt.*&order=event_date.desc%2Ccreated_at.desc&offset=0&limit=50';

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function eventReadPath(predicate: 'gte' | 'lt', date: string, order: string): string {
  const params = new URLSearchParams({
    select: '*',
    event_date: `${predicate}.${date}`,
    order,
    offset: '0',
    limit: '50',
  });
  return `/rest/v1/events?${params.toString()}`;
}

function classifySettingsRead(request: Request): 'upcoming' | 'past' {
  const url = new URL(request.url());
  const predicate = url.searchParams.get('event_date');
  const order = url.searchParams.get('order');
  const offset = url.searchParams.get('offset');
  const limit = url.searchParams.get('limit');

  if (offset !== '0' || limit !== '50') {
    throw new Error(
      `eventsLoadRetryHarness gate: expected offset 0 / limit 50, got ${offset} / ${limit}`
    );
  }
  if (predicate?.startsWith('gte.') && order === UPCOMING_ORDER) return 'upcoming';
  if (predicate?.startsWith('lt.') && order === PAST_ORDER) return 'past';

  throw new Error(
    `eventsLoadRetryHarness gate: unexpected Settings read ${url.pathname}${url.search}`
  );
}

// The explicit type prevents a nested-worktree TS2883 declaration from naming
// playwright-utils' transitive LogParams path while preserving every fixture
// already composed into the merged base.
export const test: EventsLoadRetryTest = base.extend<EventsLoadRetryFixtures>({
  eventsLoadRetryHarness: async (
    { authToken, coupleEvents, supabaseAdmin },
    use
  ) => {
    if (!authToken) {
      throw new Error('eventsLoadRetryHarness: the current worker auth token is empty');
    }

    const today = formatDateISO(coupleEvents.anchor);
    const readPaths = {
      upcoming: eventReadPath('gte', today, UPCOMING_ORDER),
      past: eventReadPath('lt', today, PAST_ORDER),
    };
    const pairIds = [coupleEvents.userId, coupleEvents.partnerId];

    const clear = async (): Promise<void> => {
      await coupleEvents.clear();

      const { data, error } = await supabaseAdmin
        .from('events')
        .select('id')
        .in('user_id', pairIds);

      if (error) {
        throw new Error(`eventsLoadRetryHarness.clear: verification failed: ${error.message}`);
      }
      if ((data?.length ?? 0) !== 0) {
        throw new Error(
          `eventsLoadRetryHarness.clear: ${data?.length ?? 0} pair event(s) remained`
        );
      }
    };

    await use({
      userId: coupleEvents.userId,
      token: authToken,
      readPaths,
      seed: (specs) => coupleEvents.seed(specs),
      clear,
    });
  },

  eventsLoadRetryBrowser: async ({ page }, use) => {
    const readPatterns = {
      upcoming: UPCOMING_PATTERN,
      past: PAST_PATTERN,
    };
    const activeGates = new Set<EventReadGate>();
    let isOffline = false;

    const removeReadInterceptors = async (): Promise<void> => {
      // playwright-utils deviation: interceptNetworkCall owns installation but
      // exposes no teardown handle. Exact-pattern unroute is the narrowest safe
      // removal and cannot disturb unrelated events routes.
      await page.unroute(readPatterns.upcoming);
      await page.unroute(readPatterns.past);
    };

    await use({
      readPatterns,
      goOffline: async () => {
        await page.context().setOffline(true);
        isOffline = true;
        await page.evaluate(() => window.dispatchEvent(new Event('offline')));
      },
      goOnline: async () => {
        await page.context().setOffline(false);
        isOffline = false;
        await page.evaluate(() => window.dispatchEvent(new Event('online')));
      },
      removeReadInterceptors,
      createReadGate: () => {
        const releaseGate = deferred();
        const count = { upcoming: 0, past: 0 };
        let released = false;

        const gate: EventReadGate = {
          handler: async (route, request) => {
            const window = classifySettingsRead(request);
            count[window] += 1;
            await releaseGate.promise;
            await route.continue();
          },
          counts: () => ({
            upcoming: count.upcoming,
            past: count.past,
            total: count.upcoming + count.past,
          }),
          release: () => {
            if (released) return;
            released = true;
            releaseGate.resolve();
            activeGates.delete(gate);
          },
        };

        activeGates.add(gate);
        return gate;
      },
    });

    for (const gate of activeGates) gate.release();
    await removeReadInterceptors();

    if (isOffline && !page.isClosed()) {
      await page.context().setOffline(false);
      await page.evaluate(() => window.dispatchEvent(new Event('online')));
    }
  },
});

export { expect };
