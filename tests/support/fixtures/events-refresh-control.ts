import { test as base } from '@playwright/test';
import { interceptNetworkCall } from '@seontechnologies/playwright-utils/intercept-network-call';
import { recurse } from '@seontechnologies/playwright-utils/recurse';

export type EventReadOutcome = 'success' | 'failure';
type EventWindow = 'upcoming' | 'past';

export type EventsRefreshGate = {
  waitForPending: (requestsPerWindow?: number) => Promise<void>;
  release: () => void;
  waitForCompleted: () => Promise<number[]>;
};

export type EventsRefreshControl = {
  holdNextLoad: (outcome: EventReadOutcome) => EventsRefreshGate;
  waitForIdle: (minimumRequestsPerWindow?: number) => Promise<void>;
};

type GateState = {
  outcome: EventReadOutcome;
  arrived: Record<EventWindow, number>;
  completed: number;
  statuses: number[];
  released: boolean;
  release: () => void;
  ready: Promise<void>;
};

/**
 * Owns both GET windows of eventsService.getEvents. Gates are armed before a
 * trigger, and response completion is tracked separately from request arrival:
 * the installed utility's handler promise reports only the first arrival.
 * Success forwards real PostgREST traffic; failure injects a terminal 400.
 */
export const test = base.extend<{ eventsRefreshControl: EventsRefreshControl }>({
  eventsRefreshControl: async ({ page }, use) => {
    const totals: Record<EventWindow, number> = { upcoming: 0, past: 0 };
    const gates: GateState[] = [];
    const operations: Promise<void>[] = [];
    const errors: unknown[] = [];
    let currentGate: GateState | null = null;
    let pending = 0;

    const checkErrors = () => {
      if (errors.length) throw new AggregateError(errors, 'Events response control failed');
    };

    // Installed before the test navigates. One persistent handler coordinates
    // the parallel upcoming/past queries and StrictMode's mount replay.
    const firstRequest = interceptNetworkCall({
      page,
      method: 'GET',
      url: '**/rest/v1/events*',
      handler: async (route, request) => {
        const dateFilter = new URL(request.url()).searchParams.get('event_date');
        const window: EventWindow | null = dateFilter?.startsWith('gte.')
          ? 'upcoming'
          : dateFilter?.startsWith('lt.')
            ? 'past'
            : null;
        if (!window) {
          await route.continue();
          return;
        }

        const gate = currentGate;
        totals[window] += 1;
        pending += 1;
        if (gate) gate.arrived[window] += 1;

        const operation = (async () => {
          try {
            if (gate) await gate.ready;
            if (gate?.outcome === 'failure') {
              // PostgREST retries 503/520; use a terminal response so this
              // gate exercises a failed load rather than automatic recovery.
              await route.fulfill({
                status: 400,
                contentType: 'application/json',
                body: JSON.stringify({
                  code: 'TEA_EVENTS_LOAD_FAILURE',
                  message: 'TEA forced events refresh failure',
                  details: null,
                  hint: null,
                }),
              });
            } else {
              await route.continue();
            }

            // This is the captured request supplied by interceptNetworkCall,
            // not a second response observer which might miss either window.
            const response = await request.response();
            if (!response) throw new Error('Events GET completed without an HTTP response');
            const responseFailure = await response.finished();
            if (responseFailure) throw responseFailure;
            if (gate) {
              gate.statuses.push(response.status());
              gate.completed += 1;
            }
          } catch (error) {
            errors.push(error);
          } finally {
            pending -= 1;
          }
        })();
        operations.push(operation);
        await operation;
      },
    });
    // Capture setup failure immediately, including when a test fails before
    // its first request. The promise is awaited on successful idle checks.
    void firstRequest.catch((error: unknown) => errors.push(error));

    try {
      await use({
        holdNextLoad: (outcome) => {
          checkErrors();
          if (currentGate) throw new Error('Release the current events gate before arming another');
          let release = () => {};
          const ready = new Promise<void>((resolve) => { release = resolve; });
          const gate: GateState = {
            outcome,
            arrived: { upcoming: 0, past: 0 },
            completed: 0,
            statuses: [],
            released: false,
            release,
            ready,
          };
          gates.push(gate);
          currentGate = gate;

          return {
            waitForPending: async (requestsPerWindow = 1) => {
              await recurse(
                async () => {
                  checkErrors();
                  return { ...gate.arrived, completed: gate.completed };
                },
                (state) => state.upcoming >= requestsPerWindow &&
                  state.past >= requestsPerWindow && state.completed === 0,
                { timeout: 15000, interval: 50, log: 'Waiting for both held events GET windows' }
              );
            },
            release: () => {
              if (gate.released) return;
              gate.released = true;
              if (currentGate === gate) currentGate = null;
              gate.release();
            },
            waitForCompleted: async () => {
              await recurse(
                async () => {
                  checkErrors();
                  return gate.released && gate.completed > 0 &&
                    gate.completed === gate.arrived.upcoming + gate.arrived.past;
                },
                (completed) => completed,
                { timeout: 15000, interval: 50, log: 'Waiting for all released events responses' }
              );
              return [...gate.statuses];
            },
          };
        },
        waitForIdle: async (minimumRequestsPerWindow = 2) => {
          await recurse(
            async () => {
              checkErrors();
              return totals.upcoming >= minimumRequestsPerWindow &&
                totals.past >= minimumRequestsPerWindow && pending === 0;
            },
            (idle) => idle,
            { timeout: 15000, interval: 50, log: 'Waiting for events mount requests to settle' }
          );
          await firstRequest;
        },
      });
    } finally {
      // Drain every held response before the authenticated page/context closes,
      // including when an assertion or navigation fails before explicit release.
      currentGate = null;
      for (const gate of gates) gate.release();
      await Promise.allSettled(operations);
      checkErrors();
    }
  },
});
