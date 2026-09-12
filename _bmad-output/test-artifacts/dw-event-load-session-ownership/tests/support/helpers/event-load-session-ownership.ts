import type { Page, Request } from '@playwright/test';
import type { InterceptNetworkCallFn } from '@seontechnologies/playwright-utils/intercept-network-call';
import type { AppState } from '../../../src/stores/types';
import type { EventWireRow } from '../factories/event-load-session-ownership';

type LoadStatus = Awaited<ReturnType<AppState['loadEvents']>>['status'];
type Observation = { invocation: number; status: LoadStatus };
type Observer = {
  original: AppState['loadEvents'];
  invocations: number;
  results: Observation[];
};
type ObserverWindow = Window & { __TEA_EVENT_LOAD_OBSERVER__?: Observer };
type WindowName = 'upcoming' | 'past';

export type EventLoadSnapshot = {
  invocations: number;
  results: Observation[];
  userId: string | null;
  authSessionVersion: number;
  events: Array<{ id: string; label: string }>;
  eventsIsLoading: boolean;
  eventsError: string | null;
};

const EVENT_URL = '**/rest/v1/events*';
const DEADLINE_MS = 10000;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

type HeldRead = {
  invocation: number;
  status: 200 | 400;
  rows: EventWireRow[];
  requests: Partial<Record<WindowName, Request>>;
  ready: ReturnType<typeof deferred<void>>;
  allowed: ReturnType<typeof deferred<void>>;
};

/**
 * Controls the two event windows while retaining the production service,
 * store action and auth callbacks. Call before goto, then install on Mood.
 */
export function createEventLoadSessionControl({
  page,
  interceptNetworkCall,
}: {
  page: Page;
  interceptNetworkCall: InterceptNetworkCallFn;
}) {
  const reads: HeldRead[] = [];
  const handlers = new Set<Promise<void>>();
  const failed = deferred<Error>();
  let failure: Error | undefined;
  let receivedRequest = false;
  let installed = false;
  let disposed = false;

  const fail = (error: unknown) => {
    failure ??= error instanceof Error ? error : new Error(String(error));
    failed.resolve(failure);
  };

  const checked = async <T>(
    operation: Promise<T>, description: string, cleaningUp = false
  ): Promise<T> => {
    if (failure && !cleaningUp) throw failure;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        ...(!cleaningUp ? [failed.promise.then((error) => { throw error; })] : []),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(description)), DEADLINE_MS);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };

  // Register before navigation. This promise observes capture, not completion.
  const firstCapture = interceptNetworkCall({
    method: 'GET',
    url: EVENT_URL,
    handler: async (route, request) => {
      receivedRequest = true;
      const task = (async () => {
        const filter = new URL(request.url()).searchParams.get('event_date');
        const windowName = filter?.startsWith('gte.') ? 'upcoming'
          : filter?.startsWith('lt.') ? 'past' : null;
        const read = windowName && reads.find((entry) => !entry.requests[windowName]);
        if (!windowName || !read) {
          fail(new Error(`Unexpected events request: ${request.url()}`));
          await route.abort();
          return;
        }
        read.requests[windowName] = request;
        if (read.requests.upcoming && read.requests.past) read.ready.resolve();
        await read.allowed.promise;
        const status = windowName === 'upcoming' ? read.status : 200;
        await route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify(status === 400
            ? { code: '22000', message: 'TEA held previous-session event load failed', details: null, hint: null }
            : windowName === 'upcoming' ? read.rows : []),
        });
      })();
      handlers.add(task);
      try {
        await task;
      } catch (error) {
        fail(error);
      } finally {
        handlers.delete(task);
      }
    },
  }).then(() => undefined, fail);

  const responseStatus = async (request: Request): Promise<number> => {
    // playwright-utils deviation: handler mode resolves at capture with a synthetic status; captured requests witness actual fulfillment of both event windows.
    const response = await request.response();
    if (!response) throw new Error('The held event GET completed without a response');
    const error = await response.finished();
    if (error) throw new Error(`The held event GET did not finish: ${error}`);
    return response.status();
  };

  return {
    async install(): Promise<void> {
      if (installed) throw new Error('Event load observer is already installed');
      await page.evaluate(() => {
        const store = window.__APP_STORE__;
        if (!store) throw new Error('The application store is unavailable');
        if (store.getState().currentView !== 'mood') throw new Error('Install the observer on Mood');
        const observedWindow = window as ObserverWindow;
        if (observedWindow.__TEA_EVENT_LOAD_OBSERVER__) throw new Error('An observer is already present');
        const observer: Observer = {
          original: store.getState().loadEvents,
          invocations: 0,
          results: [],
        };
        observedWindow.__TEA_EVENT_LOAD_OBSERVER__ = observer;
        store.setState({
          loadEvents: async () => {
            const invocation = ++observer.invocations;
            const result = await observer.original();
            observer.results.push({ invocation, status: result.status });
            return result;
          },
        });
      });
      installed = true;
    },

    async snapshot(): Promise<EventLoadSnapshot> {
      if (failure) throw failure;
      return page.evaluate(() => {
        const state = window.__APP_STORE__?.getState();
        const observer = (window as ObserverWindow).__TEA_EVENT_LOAD_OBSERVER__;
        if (!state || !observer) throw new Error('Install the event load observer before reading it');
        return {
          invocations: observer.invocations,
          results: observer.results,
          userId: state.userId,
          authSessionVersion: state.authSessionVersion,
          events: state.events.map(({ id, label }) => ({ id, label })),
          eventsIsLoading: state.eventsIsLoading,
          eventsError: state.eventsError,
        };
      });
    },

    holdNext({ status, rows }: { status: 200 | 400; rows: EventWireRow[] }) {
      if (failure) throw failure;
      if (disposed) throw new Error('The event load controller is disposed');
      const read: HeldRead = {
        invocation: reads.length + 1, status, rows, requests: {},
        ready: deferred<void>(), allowed: deferred<void>(),
      };
      reads.push(read);
      const waitForRequests = () => checked(read.ready.promise,
        `Event load ${read.invocation} did not issue both date windows`);
      return {
        invocation: read.invocation,
        waitForRequests,
        async release(): Promise<{ upcomingStatus: number; pastStatus: number }> {
          await waitForRequests();
          read.allowed.resolve();
          const [upcomingStatus, pastStatus] = await checked(Promise.all([
            responseStatus(read.requests.upcoming!), responseStatus(read.requests.past!),
          ]), `Event load ${read.invocation} responses did not complete`);
          return { upcomingStatus, pastStatus };
        },
      };
    },

    async dispose(): Promise<void> {
      if (disposed) return;
      disposed = true;
      reads.forEach((read) => read.allowed.resolve());
      try {
        // Unused gates never wait for a request during teardown.
        if (receivedRequest) await checked(firstCapture, 'Event interception did not settle', true);
        await checked(Promise.allSettled([...handlers]), 'Held event handlers did not settle', true);
      } finally {
        // playwright-utils deviation: the installed interceptor exposes no disposer; this test owns the only route for its exact events pattern.
        await page.unroute(EVENT_URL);
        if (installed && !page.isClosed()) {
          await page.evaluate(() => {
            const observedWindow = window as ObserverWindow;
            const observer = observedWindow.__TEA_EVENT_LOAD_OBSERVER__;
            if (observer) window.__APP_STORE__?.setState({ loadEvents: observer.original });
            delete observedWindow.__TEA_EVENT_LOAD_OBSERVER__;
          });
        }
      }
      if (failure) throw failure;
    },
  };
}
