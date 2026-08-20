/**
 * Composed fixture for the event load/error-attribution API and E2E specs.
 *
 * Target path once activated: `tests/support/fixtures/events-load-concurrency.ts`.
 * The generated specs import this target path. This copy is parked under
 * `test_artifacts` with them and is validated by copying all three files to
 * their target paths together.
 *
 * Pair-scoped cleanup remains owned by the existing `coupleEvents` fixture.
 * Vite runs the app in React StrictMode, so Settings' mount effect starts two
 * loads. Each load reads upcoming and past pages; the controller captures all
 * four response snapshots, then releases them behind one deterministic gate.
 */
import { test as base, expect } from '../merged-fixtures';
import type { Route, TestType } from '@playwright/test';
import { eventDateFrom } from '../factories/events';
import type { EventSpec, SeededEvent } from '../factories/events';
import type { Database } from '../../../src/types/database.types';

type EventRow = Database['public']['Tables']['events']['Row'];

type EventApiActor = {
  id: string;
  token: string;
};

type EventApiSeedInput = Omit<EventSpec, 'owner'> & {
  owner: 'creator' | 'partner';
};

export type EventApiHarness = {
  creator: EventApiActor;
  date: (dayOffset: number) => string;
  label: (scenario: string) => string;
  seed: (input: EventApiSeedInput) => Promise<SeededEvent>;
  /** Read one full row and reject accidental access outside this worker pair. */
  find: (eventId: string) => Promise<EventRow | null>;
};

export type HeldEventLoadPair = {
  /** Resolves only after both StrictMode loads' four GET snapshots are retained. */
  captured: Promise<void>;
  /** Releases all retained responses, waits for delivery, and removes the route. */
  release: () => Promise<void>;
};

export type HeldEventLoads = {
  holdNextPair: () => HeldEventLoadPair;
};

type EventConcurrencyFixtures = {
  eventApiHarness: EventApiHarness;
  heldEventLoads: HeldEventLoads;
};

type EventConcurrencyTest = typeof base extends TestType<infer T, infer W>
  ? TestType<T & EventConcurrencyFixtures, W>
  : never;

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
};

type ActiveLoadPair = {
  forceRelease: () => Promise<void>;
};

const EVENTS_ENDPOINT = '**/rest/v1/events*';
const LOAD_PAIR_CAPTURE_TIMEOUT_MS = 10_000;
const SETTINGS_MOUNT_SNAPSHOT_COUNT = 4;

function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

// The explicit type prevents a nested-worktree TS2883 declaration from naming
// playwright-utils' transitive LogParams path while preserving every fixture
// already composed into the merged base.
export const test: EventConcurrencyTest = base.extend<EventConcurrencyFixtures>({
  eventApiHarness: async (
    { authToken, coupleEvents, supabaseAdmin },
    use,
    testInfo
  ) => {
    if (!authToken) {
      throw new Error('eventApiHarness: the current worker auth token is empty');
    }

    const pairIds = new Set([coupleEvents.userId, coupleEvents.partnerId]);
    const labelSuffix =
      `${testInfo.workerIndex}-${testInfo.retry}-${coupleEvents.userId.slice(0, 8)}`;

    const find = async (eventId: string): Promise<EventRow | null> => {
      const { data, error } = await supabaseAdmin
        .from('events')
        .select('*')
        .eq('id', eventId)
        .maybeSingle();

      if (error) {
        throw new Error(`eventApiHarness.find: ${error.message}`);
      }
      if (data && !pairIds.has(data.user_id)) {
        throw new Error(
          `eventApiHarness.find: ${eventId} belongs outside this worker's pair`
        );
      }

      return data;
    };

    await use({
      creator: { id: coupleEvents.userId, token: authToken },
      date: (dayOffset) => eventDateFrom(coupleEvents.anchor, dayOffset),
      label: (scenario) => {
        const roomForScenario = 100 - labelSuffix.length - 1;
        return `${scenario.slice(0, roomForScenario)}-${labelSuffix}`;
      },
      seed: async ({ owner, ...spec }) => {
        const [seeded] = await coupleEvents.seed([
          { ...spec, owner: owner === 'partner' ? 'partner' : 'self' },
        ]);
        if (!seeded) {
          throw new Error('eventApiHarness.seed: no row returned');
        }
        return seeded;
      },
      find,
    });
  },

  heldEventLoads: async ({ page, interceptNetworkCall }, use) => {
    const activePairs = new Set<ActiveLoadPair>();

    await use({
      holdNextPair: () => {
        if (activePairs.size > 0) {
          throw new Error('heldEventLoads: only one held GET pair is supported per test');
        }

        const captured = deferred();
        const releaseGate = deferred();
        const deliveries: Promise<void>[] = [];
        let reservedCount = 0;
        let capturedCount = 0;
        let gateOpened = false;
        let routeRemoved = false;
        let releasePromise: Promise<void> | null = null;
        const captureTimeout = setTimeout(() => {
          captured.reject(
            new Error(
              `heldEventLoads: expected ${SETTINGS_MOUNT_SNAPSHOT_COUNT} GET snapshots, reserved ${reservedCount} and captured ${capturedCount}`
            )
          );
        }, LOAD_PAIR_CAPTURE_TIMEOUT_MS);

        const openGate = () => {
          if (gateOpened) return;
          gateOpened = true;
          releaseGate.resolve();
        };

        const removeRoute = async () => {
          if (routeRemoved) return;
          routeRemoved = true;
          // playwright-utils deviation: interceptNetworkCall installs a route
          // but exposes no route handle or teardown API. Because this fixture
          // permits one pair per test, removing the exact endpoint pattern is
          // deterministic after every observed mutation call has settled.
          await page.unroute(EVENTS_ENDPOINT);
        };

        const handleSnapshot = (route: Route): Promise<void> => {
          // Reserve synchronously before route.fetch() yields. Counting only
          // completed fetches lets three concurrent GETs all see zero and enter.
          const slot = reservedCount++;
          if (slot >= SETTINGS_MOUNT_SNAPSHOT_COUNT) {
            const failure = Promise.reject(
              new Error(`heldEventLoads: unexpected events GET in slot ${slot + 1}`)
            );
            deliveries.push(failure);
            void failure.catch((error) => captured.reject(error));
            return failure;
          }

          const delivery = (async () => {
            const response = await route.fetch();
            if (!response.ok()) {
              throw new Error(
                `heldEventLoads: expected a successful GET snapshot, got ${response.status()}`
              );
            }

            capturedCount += 1;
            if (capturedCount === SETTINGS_MOUNT_SNAPSHOT_COUNT) {
              clearTimeout(captureTimeout);
              captured.resolve();
            }

            await releaseGate.promise;
            await route.fulfill({ response });
          })();

          deliveries.push(delivery);
          void delivery.catch((error) => captured.reject(error));
          return delivery;
        };

        const interception = interceptNetworkCall({
          method: 'GET',
          url: EVENTS_ENDPOINT,
          handler: (route) => handleSnapshot(route),
        });
        void interception.catch((error) => captured.reject(error));

        const activePair: ActiveLoadPair = {
          forceRelease: async () => {
            clearTimeout(captureTimeout);
            openGate();
            await Promise.allSettled(deliveries);
            await removeRoute();
          },
        };
        activePairs.add(activePair);

        return {
          captured: captured.promise,
          release: () => {
            releasePromise ??= (async () => {
              await captured.promise;
              clearTimeout(captureTimeout);
              openGate();
              await Promise.all(deliveries);
              await removeRoute();
              activePairs.delete(activePair);
            })();
            return releasePromise;
          },
        };
      },
    });

    for (const pair of activePairs) {
      await pair.forceRelease();
    }
    activePairs.clear();
  },
});

export { expect };
