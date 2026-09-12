/**
 * Home keeps its local load outcome across renders, so the event slice's own
 * identity guard is not enough: auth can change after a result is fulfilled
 * but before App's continuation runs. Keep the real Home slot and composed
 * store/auth actions, and control outcomes at that consumer boundary.
 */
import type { Session } from '@supabase/supabase-js';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App';
import { eventsService, type CoupleEvent } from '../../src/services/eventsService';
import type { EventLoadResult } from '../../src/stores/slices/eventsSlice';
import { useAppStore } from '../../src/stores/useAppStore';

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  listener: null as ((session: Session | null) => void) | null,
}));

vi.mock('../../src/api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
}));
vi.mock('../../src/api/auth/sessionService', () => ({
  getSession: auth.getSession,
  onAuthStateChange: vi.fn((listener: (session: Session | null) => void) => {
    auth.listener = listener;
    return () => {
      auth.listener = null;
    };
  }),
}));
vi.mock('../../src/services/eventsService', () => ({
  eventsService: { getEvents: vi.fn() },
}));
vi.mock('../../src/components/DailyMessage/DailyMessage', () => ({
  DailyMessage: () => null,
}));
vi.mock('../../src/components/Navigation/NavigationTray', () => ({
  NavigationTray: () => null,
}));
vi.mock('../../src/components/RelationshipTimers/BirthdayCountdown', () => ({
  BirthdayCountdown: () => null,
}));
vi.mock('../../src/components/RelationshipTimers/TimeTogether', () => ({
  TimeTogether: () => null,
}));
vi.mock('../../src/components/LoginScreen', () => ({
  LoginScreen: () => <p>Sign in</p>,
}));
vi.mock('../../src/components/DisplayNameSetup', () => ({ DisplayNameSetup: () => null }));
vi.mock('../../src/components/PhotoUpload/PhotoUpload', () => ({ PhotoUpload: () => null }));
vi.mock('../../src/components/PhotoCarousel/PhotoCarousel', () => ({ PhotoCarousel: () => null }));
vi.mock('../../src/components/shared', () => ({
  NetworkStatusIndicator: () => null,
  SyncToast: () => null,
}));
vi.mock('../../src/services/migrationService', () => ({
  migrateCustomMessagesFromLocalStorage: vi.fn(async () => ({
    migratedCount: 0,
    skippedCount: 0,
    success: true,
    errors: [],
  })),
}));
vi.mock('../../src/utils/backgroundSync', () => ({ isServiceWorkerSupported: () => false }));
vi.mock('../../src/utils/storageMonitor', () => ({ logStorageQuota: vi.fn() }));
vi.mock('../../src/utils/themes', () => ({ applyTheme: vi.fn() }));
vi.mock('../../src/utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

type MotionDivProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
  initial?: unknown;
  animate?: unknown;
  whileHover?: unknown;
  transition?: unknown;
};

vi.mock('framer-motion', () => ({
  m: {
    div: ({
      children,
      initial: _initial,
      animate: _animate,
      whileHover: _whileHover,
      transition: _transition,
      ...props
    }: MotionDivProps) => <div {...props}>{children}</div>,
  },
}));

const USER_ID = 'home-events-user';
const success: EventLoadResult = { status: 'success' };
const failure: EventLoadResult = { status: 'failure', error: 'Prior request failed' };

function session(accessToken = 'initial-token'): Session {
  return {
    access_token: accessToken,
    refresh_token: 'refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    user: {
      id: USER_ID,
      email: 'home@example.com',
      app_metadata: {},
      user_metadata: { display_name: 'Home User' },
      aud: 'authenticated',
      created_at: '2026-09-01T00:00:00Z',
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function event(label: string): CoupleEvent {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return {
    id: label,
    userId: USER_ID,
    label,
    date,
    description: null,
    icon: 'calendar',
    createdAt: new Date(),
  };
}

const initialState = useAppStore.getInitialState();

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('lastWelcomeView', String(Date.now()));
  window.history.replaceState({}, '', '/');
  auth.getSession.mockResolvedValue(session());
  useAppStore.setState(
    {
      ...initialState,
      isLoading: false,
      initializeApp: vi.fn(async () => {}),
      syncPendingMoods: vi.fn(async () => ({ synced: 0, failed: 0, skipped: false })),
      updateSyncStatus: vi.fn(async () => {}),
    },
    true
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

async function renderHome() {
  render(<App />);
  await act(async () => {});
  expect(screen.getByTestId('app-container')).toBeInTheDocument();
}

function expectUnsettled() {
  expect(screen.queryByTestId('events-empty-placeholder')).not.toBeInTheDocument();
  expect(screen.queryByTestId('events-load-error')).not.toBeInTheDocument();
}

/** The production auth listener calls the real clearAuth/setAuthUser actions. */
function reauthenticate() {
  expect(auth.listener).not.toBeNull();
  auth.listener!(null);
  expect(useAppStore.getState().userId).toBeNull();
  expect(useAppStore.getState().events).toEqual([]);
  auth.listener!(session('reauthenticated-token'));
  expect(useAppStore.getState().userId).toBe(USER_ID);
}

function controlHomeLoads() {
  type Request = ReturnType<typeof deferred<EventLoadResult>> & { deliveredAtLoadCount: number | null };
  const requests: Request[] = [];
  const loadEvents = vi.fn((): Promise<EventLoadResult> => {
    const request: Request = { ...deferred<EventLoadResult>(), deliveredAtLoadCount: null };
    const originalThen = request.promise.then.bind(request.promise);
    // Observe delivery to App, not the later test continuation: React can
    // flush its queued work between those two microtasks.
    request.promise.then = function <TResult1 = EventLoadResult, TResult2 = never>(
      onFulfilled?: ((result: EventLoadResult) => TResult1 | PromiseLike<TResult1>) | null,
      onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ): Promise<TResult1 | TResult2> {
      return originalThen((result) => {
        request.deliveredAtLoadCount ??= loadEvents.mock.calls.length;
        return onFulfilled ? onFulfilled(result) : (result as TResult1);
      }, onRejected);
    };
    requests.push(request);
    return request.promise;
  });
  useAppStore.setState({ loadEvents });
  return { requests, loadEvents };
}

describe('Home event-load session ownership', () => {
  it.each([
    ['success', success],
    ['failure', failure],
  ] as const)('ignores prior-session %s and re-arms after same-account reauthentication', async (_name, outcome) => {
    const { requests, loadEvents } = controlHomeLoads();
    await renderHome();
    expect(loadEvents).toHaveBeenCalledTimes(1);
    expectUnsettled();

    await act(async () => reauthenticate());
    expect(loadEvents).toHaveBeenCalledTimes(2);
    expectUnsettled();

    await act(async () => requests[0].resolve(outcome));
    expectUnsettled();

    await act(async () => requests[1].resolve(success));
    expect(screen.getByTestId('events-empty-placeholder')).toHaveTextContent('No upcoming events yet.');
    expect(screen.queryByTestId('events-load-error')).not.toBeInTheDocument();
  });

  it.each([
    ['success', success],
    ['failure', failure],
  ] as const)('ignores queued %s after reauthentication and before effect cleanup', async (_name, outcome) => {
    const { requests, loadEvents } = controlHomeLoads();
    await renderHome();

    await act(async () => {
      // Fulfil the original promise first: App's .then is already queued.
      // Auth changes synchronously before that continuation can run, while
      // React has not rendered the auth transition or cleaned up the effect.
      requests[0].resolve(outcome);
      reauthenticate();
      await requests[0].promise;
      // The callback itself saw only the old load; the effect had not been
      // replaced when it received its result, even if React has flushed now.
      expect(requests[0].deliveredAtLoadCount).toBe(1);
    });

    expect(loadEvents).toHaveBeenCalledTimes(2);
    expectUnsettled();
    await act(async () => requests[1].resolve(success));
    expect(screen.getByTestId('events-empty-placeholder')).toBeInTheDocument();
    expect(screen.queryByTestId('events-load-error')).not.toBeInTheDocument();
  });

  it('shows only current-session events with the real event slice after an old response arrives', async () => {
    const oldResponse = deferred<CoupleEvent[]>();
    const currentResponse = deferred<CoupleEvent[]>();
    vi.mocked(eventsService.getEvents)
      .mockReturnValueOnce(oldResponse.promise)
      .mockReturnValueOnce(currentResponse.promise);
    await renderHome();
    expect(eventsService.getEvents).toHaveBeenCalledTimes(1);

    await act(async () => reauthenticate());
    expect(eventsService.getEvents).toHaveBeenCalledTimes(2);
    await act(async () => oldResponse.resolve([event('Previous trip')]));
    expect(screen.queryByRole('heading', { name: 'Previous trip' })).not.toBeInTheDocument();
    expectUnsettled();
    expect(useAppStore.getState().eventsIsLoading).toBe(true);

    await act(async () => currentResponse.resolve([event('Current trip')]));
    expect(screen.getByRole('heading', { name: 'Current trip' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Previous trip' })).not.toBeInTheDocument();
    expectUnsettled();
    expect(useAppStore.getState().eventsIsLoading).toBe(false);
  });

  it('shows a current-session failure and recovers on reconnect', async () => {
    const { requests, loadEvents } = controlHomeLoads();
    await renderHome();
    await act(async () => reauthenticate());
    await act(async () => requests[1].resolve({ status: 'failure', error: 'Current request failed' }));
    expect(screen.getByTestId('events-load-error')).toHaveTextContent('Unable to load events');
    expect(screen.queryByTestId('events-empty-placeholder')).not.toBeInTheDocument();

    await act(async () => requests[0].resolve(success));
    expect(screen.getByTestId('events-load-error')).toBeInTheDocument();

    await act(async () => {
      useAppStore.setState((state) => ({ syncStatus: { ...state.syncStatus, isOnline: false } }));
    });
    await act(async () => {
      useAppStore.setState((state) => ({ syncStatus: { ...state.syncStatus, isOnline: true } }));
    });
    expect(loadEvents).toHaveBeenCalledTimes(4);
    await act(async () => requests[3].resolve(success));
    expect(screen.getByTestId('events-empty-placeholder')).toBeInTheDocument();
    expect(screen.queryByTestId('events-load-error')).not.toBeInTheDocument();
  });

  it('keeps the active load and settled state across token refresh and user metadata updates', async () => {
    const { requests, loadEvents } = controlHomeLoads();
    await renderHome();
    const ownership = useAppStore.getState().authSessionVersion;

    await act(async () => auth.listener!(session('refreshed-token')));
    expect(useAppStore.getState().authSessionVersion).toBe(ownership);
    expect(loadEvents).toHaveBeenCalledTimes(1);
    expectUnsettled();

    await act(async () => requests[0].resolve(success));
    expect(screen.getByTestId('events-empty-placeholder')).toBeInTheDocument();

    await act(async () => {
      const updated = session('refreshed-token');
      updated.user.user_metadata.display_name = 'Updated Name';
      auth.listener!(updated);
    });
    expect(useAppStore.getState().authSessionVersion).toBe(ownership);
    expect(loadEvents).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('events-empty-placeholder')).toBeInTheDocument();
  });
});
