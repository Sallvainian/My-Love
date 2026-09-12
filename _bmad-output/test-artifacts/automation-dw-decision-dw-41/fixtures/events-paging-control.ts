import type { Page } from '@playwright/test';
import type { InterceptNetworkCallFn } from '@seontechnologies/playwright-utils/intercept-network-call';
import { recurse } from '@seontechnologies/playwright-utils/recurse';

type EventWindow = 'past' | 'upcoming';
type Outcome = 'success' | 'failure';
export type CapturedPage = {
  window: EventWindow;
  url: string;
  status: number;
  rowIds: string[];
};
type GateState = {
  outcomes: Partial<Record<EventWindow, Outcome>>;
  captured: CapturedPage[];
  completed: CapturedPage[];
  release: () => void;
  ready: Promise<void>;
};
export type EventsPagingControl = {
  waitForIdle: (minimumRequestsPerWindow?: number) => Promise<void>;
  holdNextContinuation: (outcomes: Partial<Record<EventWindow, Outcome>>) => {
    waitForCaptured: () => Promise<CapturedPage[]>;
    release: () => void;
    waitForCompleted: () => Promise<CapturedPage[]>;
  };
  dispose: () => Promise<void>;
};

/**
 * Coordinates the two independently requested history windows. A successful
 * held response is captured from real PostgREST before the test mutates data.
 * The utility handler reports request arrival, so this controller separately
 * observes callback completion (as the existing eventsRefreshControl does).
 */
export async function createEventsPagingControl(
  page: Page,
  interceptNetworkCall: InterceptNetworkCallFn
): Promise<EventsPagingControl> {
  const pattern = '**/rest/v1/events*';
  const totals: Record<EventWindow, number> = { past: 0, upcoming: 0 };
  const operations: Promise<void>[] = [];
  const errors: unknown[] = [];
  const gates: GateState[] = [];
  let currentGate: GateState | null = null;
  let pending = 0;
  const checkErrors = () => {
    if (errors.length) throw new AggregateError(errors, 'History response control failed');
  };
  const firstRequest = interceptNetworkCall({
    method: 'GET',
    url: pattern,
    handler: async (route, request) => {
      const url = new URL(request.url());
      const date = url.searchParams.get('event_date');
      const window: EventWindow | null = date?.startsWith('gte.') ? 'upcoming'
        : date?.startsWith('lt.') ? 'past' : null;
      if (!window) {
        await route.continue();
        return;
      }
      const gate = url.searchParams.has('or') && currentGate?.outcomes[window]
        ? currentGate : null;
      totals[window] += 1;
      pending += 1;
      const operation = (async () => {
        try {
          let captured: CapturedPage | undefined;
          if (gate) {
            const failure = gate.outcomes[window] === 'failure';
            // This is the intercepted application's actual request. Capturing
            // its response here preserves a real stale snapshot for replay.
            const backend = failure ? null : await route.fetch();
            const rows = backend ? await backend.json() as { id: string }[] : [];
            captured = {
              window,
              url: request.url(),
              status: backend?.status() ?? 400,
              rowIds: rows.map((row) => row.id),
            };
            gate.captured.push(captured);
            await gate.ready;
            if (backend) {
              await route.fulfill({ response: backend });
              await backend.dispose();
            } else {
              // A terminal 400 avoids the SDK's retryable-response behavior.
              await route.fulfill({
                status: 400,
                contentType: 'application/json',
                body: JSON.stringify({
                  code: 'TEA_HISTORY_FAILURE',
                  message: 'TEA forced history page failure',
                  details: null,
                  hint: null,
                }),
              });
            }
          } else {
            await route.continue();
          }
          const response = await request.response();
          if (!response) throw new Error('Events request finished without an HTTP response');
          const failure = await response.finished();
          if (failure) throw failure;
          if (gate && captured) gate.completed.push({ ...captured, status: response.status() });
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
  void firstRequest.catch((error: unknown) => errors.push(error));

  const waitForPages = async (gate: GateState, field: 'captured' | 'completed') => {
    await recurse(
      async () => {
        checkErrors();
        return gate[field].length;
      },
      (count) => count === Object.keys(gate.outcomes).length,
      { timeout: 15000, interval: 50, log: `Waiting for history pages ${field}` }
    );
    return [...gate[field]].sort((a, b) => a.window.localeCompare(b.window));
  };
  return {
    waitForIdle: async (minimumRequestsPerWindow = 2) => {
      await recurse(
        async () => {
          checkErrors();
          return pending === 0 && totals.past >= minimumRequestsPerWindow &&
            totals.upcoming >= minimumRequestsPerWindow;
        },
        (idle) => idle,
        { timeout: 15000, interval: 50, log: 'Waiting for initial event reads' }
      );
      await firstRequest;
    },
    holdNextContinuation: (outcomes) => {
      checkErrors();
      if (currentGate) throw new Error('Release the current history gate first');
      if (!Object.keys(outcomes).length) throw new Error('A history gate needs a window');
      let release = () => {};
      const ready = new Promise<void>((resolve) => { release = resolve; });
      const gate: GateState = { outcomes, captured: [], completed: [], release, ready };
      currentGate = gate;
      gates.push(gate);
      return {
        waitForCaptured: () => waitForPages(gate, 'captured'),
        release: () => {
          if (currentGate === gate) currentGate = null;
          gate.release();
        },
        waitForCompleted: () => waitForPages(gate, 'completed'),
      };
    },
    dispose: async () => {
      currentGate = null;
      for (const gate of gates) gate.release();
      await Promise.allSettled(operations);
      await page.unroute(pattern);
      checkErrors();
    },
  };
}
