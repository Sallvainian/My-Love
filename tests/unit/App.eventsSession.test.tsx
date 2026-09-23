/**
 * Home keeps its local load outcome across renders, so the event slice's own
 * identity guard is not enough: auth can change after a result is fulfilled
 * but before App's continuation runs. Keep the real Home slot and composed
 * store/auth actions, and control outcomes at that consumer boundary.
 */
import type { Session } from '@supabase/supabase-js';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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

/**
 * The display-name gate reads `public.users`, not the session. Driving it means
 * controlling that read, and it settles a microtask after the notification
 * rather than inside it.
 */
const profile = vi.hoisted(() => ({ lookupOwnDisplayName: vi.fn() }));

vi.mock('../../src/api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
  lookupOwnDisplayName: profile.lookupOwnDisplayName,
  // App's bootstrap reads the callback outcome from this module too. Nothing
  // here drives a callback, so the ordinary answer is the only one needed --
  // but it must exist, or `checkAuth` throws before it settles the session.
  getAuthCallbackOutcome: vi.fn(async () => null),
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
vi.mock('../../src/services/eventsService', () => {
  const eventsService = {
    getEvents: vi.fn(),
    getEventsPage: async () => ({
      events: await eventsService.getEvents(),
      pagination: {
        todayISO: '2026-09-12',
        upcoming: { cursor: null, hasMore: false },
        past: { cursor: null, hasMore: false },
      },
    }),
  };
  return { eventsService };
});
vi.mock('../../src/components/DailyMessage/DailyMessage', () => ({
  DailyMessage: () => null,
}));
vi.mock('../../src/components/Navigation/AppNavigation', () => ({
  AppNavigation: () => null,
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
// A button, not a <p>: the setup gate's `onComplete` has to be reachable so a
// test can prove a read raised before the save does not re-open the modal.
vi.mock('../../src/components/DisplayNameSetup', () => ({
  DisplayNameSetup: ({ onComplete }: { onComplete: () => void }) => (
    <button onClick={onComplete}>Set your display name</button>
  ),
}));
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

/** The shape `lookupOwnDisplayName` answers with; see src/api/supabaseClient.ts. */
type OwnDisplayNameResult =
  | { status: 'chosen'; displayName: string }
  | { status: 'unset' }
  | { status: 'error'; reason: string };

const USER_ID = 'home-events-user';
const OTHER_USER_ID = 'other-home-user';
const success: EventLoadResult = { status: 'success' };
const failure: EventLoadResult = { status: 'failure', error: 'Prior request failed' };

function session(accessToken = 'initial-token', userId = USER_ID): Session {
  return {
    access_token: accessToken,
    refresh_token: 'refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    user: {
      id: userId,
      email: 'home@example.com',
      app_metadata: {},
      // Empty on purpose. The setup gate used to be `!user_metadata.display_name`
      // and every test here rendered the app only because this object carried a
      // name. It now comes from the profile row, so these sessions carry none
      // and the `profile` mock below is what decides.
      user_metadata: {},
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
  profile.lookupOwnDisplayName.mockResolvedValue({ status: 'chosen', displayName: 'Home User' });
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
  vi.restoreAllMocks();
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
  // The Upcoming row does not wait for the slot below it.
  expect(screen.getByRole('heading', { name: 'Upcoming' })).toBeInTheDocument();
  expect(screen.getByTestId('home-add-event')).toHaveAccessibleName('Add event');
}

/** A slot placeholder is a kit card with muted text that announces itself. */
function expectKitPlaceholder(testId: 'events-empty-placeholder' | 'events-load-error') {
  const placeholder = screen.getByTestId(testId);
  expect(placeholder).toHaveAttribute('role', 'status');
  expect(placeholder).toHaveClass('bg-card', 'border-line', 'shadow-card');
  expect(placeholder.querySelector('p')).toHaveClass('text-muted');
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

describe('Auth bootstrap notification ownership', () => {
  it('installs the initial authenticated session when no notification supersedes it', async () => {
    const lookup = deferred<Session | null>();
    auth.getSession.mockReturnValueOnce(lookup.promise);
    const { requests, loadEvents } = controlHomeLoads();
    const ownership = useAppStore.getState().authSessionVersion;
    render(<App />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    // The auth loader's heart is a kit-accent lucide icon, not an emoji.
    const loader = screen.getByText('Loading...').parentElement!;
    expect(loader.querySelector('svg')).toHaveClass('text-accent');
    expect(loader.textContent).not.toMatch(/\p{Extended_Pictographic}/u);

    await act(async () => lookup.resolve(session()));
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    expect(screen.getByTestId('app-container')).toBeInTheDocument();
    expect(useAppStore.getState()).toMatchObject({
      userId: USER_ID,
      isAuthenticated: true,
      authSessionVersion: ownership + 1,
    });
    expect(loadEvents).toHaveBeenCalledTimes(1);
    await act(async () => requests[0].resolve(success));
    expect(screen.getByTestId('events-empty-placeholder')).toBeInTheDocument();
  });

  it('clears store auth for an initial null session without a notification', async () => {
    const lookup = deferred<Session | null>();
    auth.getSession.mockReturnValueOnce(lookup.promise);
    controlHomeLoads();
    useAppStore.getState().setAuthUser(USER_ID, 'home@example.com');
    useAppStore.setState({ events: [event('Previous trip')] });
    const ownership = useAppStore.getState().authSessionVersion;
    render(<App />);

    await act(async () => lookup.resolve(null));
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    expect(screen.getByText('Sign in')).toBeInTheDocument();
    expect(useAppStore.getState()).toMatchObject({
      userId: null,
      userEmail: null,
      isAuthenticated: false,
      authSessionVersion: ownership + 1,
      events: [],
    });
  });

  it.each([
    ['null', null],
    ['different-user', session('stale-token', OTHER_USER_ID)],
  ] as const)('discards a stale %s lookup without disturbing the listener-owned event load', async (_name, snapshot) => {
    const lookup = deferred<Session | null>();
    const response = deferred<CoupleEvent[]>();
    auth.getSession.mockReturnValueOnce(lookup.promise);
    vi.mocked(eventsService.getEvents).mockReturnValueOnce(response.promise);
    const { syncPendingMoods } = useAppStore.getState();
    render(<App />);

    await act(async () => auth.listener!(session('listener-token')));
    expect(syncPendingMoods).toHaveBeenCalledTimes(1);
    const ownership = useAppStore.getState().authSessionVersion;
    const cachedEvents = [event('Cached current trip')];
    await act(async () => useAppStore.setState({ events: cachedEvents }));
    expect(useAppStore.getState().userId).toBe(USER_ID);
    expect(eventsService.getEvents).toHaveBeenCalledTimes(1);

    await act(async () => lookup.resolve(snapshot));
    expect(useAppStore.getState()).toMatchObject({
      userId: USER_ID,
      isAuthenticated: true,
      authSessionVersion: ownership,
      events: cachedEvents,
      eventsIsLoading: true,
    });
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    expect(screen.getByTestId('app-container')).toBeInTheDocument();
    expect(screen.queryByText('Sign in')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cached current trip' })).toBeInTheDocument();
    expect(eventsService.getEvents).toHaveBeenCalledTimes(1);
    expect(syncPendingMoods).toHaveBeenCalledTimes(1);

    await act(async () => response.resolve([event('Current trip')]));
    expect(useAppStore.getState().eventsIsLoading).toBe(false);
    expect(screen.getByRole('heading', { name: 'Current trip' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Cached current trip' })).not.toBeInTheDocument();
  });

  it('lets a first and only null notification supersede an authenticated lookup', async () => {
    const lookup = deferred<Session | null>();
    auth.getSession.mockReturnValueOnce(lookup.promise);
    const { loadEvents } = controlHomeLoads();
    const { initializeApp, syncPendingMoods } = useAppStore.getState();
    render(<App />);
    await act(async () => auth.listener!(null));
    const ownership = useAppStore.getState().authSessionVersion;
    expect(useAppStore.getState().userId).toBeNull();
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await act(async () => lookup.resolve(session('stale-token', OTHER_USER_ID)));
    expect(useAppStore.getState()).toMatchObject({
      userId: null,
      userEmail: null,
      isAuthenticated: false,
      authSessionVersion: ownership,
    });
    expect(screen.getByText('Sign in')).toBeInTheDocument();
    expect(screen.queryByTestId('app-container')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    expect(loadEvents).not.toHaveBeenCalled();
    expect(initializeApp).not.toHaveBeenCalled();
    expect(syncPendingMoods).not.toHaveBeenCalled();
  });

  it('preserves a newer sign-out when the initial lookup returns a user', async () => {
    const lookup = deferred<Session | null>();
    auth.getSession.mockReturnValueOnce(lookup.promise);
    const { requests, loadEvents } = controlHomeLoads();
    render(<App />);
    await act(async () => auth.listener!(session('listener-token')));
    await act(async () => auth.listener!(null));
    const ownership = useAppStore.getState().authSessionVersion;

    await act(async () => lookup.resolve(session('stale-token', OTHER_USER_ID)));
    expect(useAppStore.getState()).toMatchObject({
      userId: null,
      isAuthenticated: false,
      authSessionVersion: ownership,
      events: [],
    });
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    expect(screen.getByText('Sign in')).toBeInTheDocument();
    expect(screen.queryByTestId('app-container')).not.toBeInTheDocument();
    expect(loadEvents).toHaveBeenCalledTimes(1);
    await act(async () => requests[0].resolve(success));
    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });

  it.each([true, false])('preserves same-user updates and display-name handling (has name: %s)', async (hasDisplayName) => {
    const lookup = deferred<Session | null>();
    auth.getSession.mockReturnValueOnce(lookup.promise);
    const { requests, loadEvents } = controlHomeLoads();
    useAppStore.getState().setAuthUser(USER_ID, 'home@example.com');
    render(<App />);
    const ownership = useAppStore.getState().authSessionVersion;
    const updated = session('updated-token');
    updated.user.email = 'updated@example.com';
    // Deliberately the OPPOSITE of what the profile says, so a regression that
    // reads the gate back off the session fails both halves of this case rather
    // than passing one by luck.
    updated.user.user_metadata = hasDisplayName ? {} : { display_name: 'Metadata Name' };
    profile.lookupOwnDisplayName.mockResolvedValue(
      hasDisplayName ? { status: 'chosen', displayName: 'Updated Name' } : { status: 'unset' }
    );

    await act(async () => {
      // Even a notification delivered after resolution but before the awaited
      // continuation runs must take ownership synchronously.
      lookup.resolve(session('stale-token'));
      auth.listener!(updated);
    });
    expect(useAppStore.getState()).toMatchObject({
      userId: USER_ID,
      userEmail: 'updated@example.com',
      authSessionVersion: ownership,
    });
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    expect(loadEvents).toHaveBeenCalledTimes(1);
    if (hasDisplayName) {
      expect(screen.getByTestId('app-container')).toBeInTheDocument();
      expect(screen.queryByText('Set your display name')).not.toBeInTheDocument();
    } else {
      expect(screen.getByText('Set your display name')).toBeInTheDocument();
      expect(screen.queryByTestId('app-container')).not.toBeInTheDocument();
    }
    await act(async () => requests[0].resolve(success));
    if (hasDisplayName) {
      expect(screen.getByTestId('events-empty-placeholder')).toBeInTheDocument();
    }
  });

  it.each([true, false])('finishes a rejected lookup while preserving listener state (notified: %s)', async (notified) => {
    const lookup = deferred<Session | null>();
    const error = new Error('Initial lookup failed');
    const reportError = vi.spyOn(console, 'error').mockImplementation(() => {});
    auth.getSession.mockReturnValueOnce(lookup.promise);
    controlHomeLoads();
    render(<App />);
    if (notified) {
      await act(async () => auth.listener!(session('listener-token')));
    }
    const ownership = useAppStore.getState().authSessionVersion;

    await act(async () => lookup.reject(error));
    expect(reportError).toHaveBeenCalledWith('[App] Auth check failed:', error);
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    expect(useAppStore.getState()).toMatchObject({
      userId: notified ? USER_ID : null,
      authSessionVersion: ownership,
    });
    if (notified) {
      expect(screen.getByTestId('app-container')).toBeInTheDocument();
    } else {
      expect(screen.getByText('Sign in')).toBeInTheDocument();
    }
  });

  it.each(['null', 'different-user', 'rejection'] as const)('ignores a cleaned-up effect when its lookup settles with %s', async (outcome) => {
    const lookup = deferred<Session | null>();
    auth.getSession.mockReturnValueOnce(lookup.promise);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { requests, loadEvents } = controlHomeLoads();
    const previousApp = render(<App />);
    const oldListener = auth.listener!;
    previousApp.unmount();
    expect(auth.listener).toBeNull();

    await renderHome();
    const ownership = useAppStore.getState().authSessionVersion;
    await act(async () => {
      oldListener(null);
      if (outcome === 'rejection') {
        lookup.reject(new Error('Old lookup failed'));
      } else {
        lookup.resolve(outcome === 'null' ? null : session('stale-token', OTHER_USER_ID));
      }
    });
    expect(useAppStore.getState()).toMatchObject({
      userId: USER_ID,
      isAuthenticated: true,
      authSessionVersion: ownership,
    });
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    expect(screen.getByTestId('app-container')).toBeInTheDocument();
    expect(loadEvents).toHaveBeenCalledTimes(1);
    await act(async () => requests[0].resolve(success));
    expect(screen.getByTestId('events-empty-placeholder')).toBeInTheDocument();
  });
});

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
    expectKitPlaceholder('events-empty-placeholder');
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
    expectKitPlaceholder('events-load-error');
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

  it('keeps the active load and settled state across token refresh and profile name updates', async () => {
    const { requests, loadEvents } = controlHomeLoads();
    await renderHome();
    const ownership = useAppStore.getState().authSessionVersion;

    await act(async () => auth.listener!(session('refreshed-token')));
    expect(useAppStore.getState().authSessionVersion).toBe(ownership);
    expect(loadEvents).toHaveBeenCalledTimes(1);
    expectUnsettled();

    await act(async () => requests[0].resolve(success));
    expect(screen.getByTestId('events-empty-placeholder')).toBeInTheDocument();

    // Every refresh re-reads the profile, and a name that changed since must not
    // disturb a settled Home.
    profile.lookupOwnDisplayName.mockResolvedValue({ status: 'chosen', displayName: 'Updated Name' });
    await act(async () => auth.listener!(session('refreshed-token')));
    expect(useAppStore.getState().authSessionVersion).toBe(ownership);
    expect(loadEvents).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('events-empty-placeholder')).toBeInTheDocument();
  });

  it('discards a profile read raised under the previous account', async () => {
    const staleRead = deferred<OwnDisplayNameResult>();
    controlHomeLoads();
    await renderHome();

    // A signs in and its profile read stays in flight.
    profile.lookupOwnDisplayName.mockReturnValueOnce(staleRead.promise);
    await act(async () => auth.listener!(session()));

    // B signs in over the live session before A's read answers.
    profile.lookupOwnDisplayName.mockResolvedValue({ status: 'chosen', displayName: 'B' });
    await act(async () => auth.listener!(session('b-token', OTHER_USER_ID)));
    expect(useAppStore.getState().userId).toBe(OTHER_USER_ID);

    // A's answer must not decide anything about B.
    await act(async () => staleRead.resolve({ status: 'unset' }));
    expect(screen.queryByText('Set your display name')).not.toBeInTheDocument();
    expect(screen.getByTestId('app-container')).toBeInTheDocument();
  });

  it('discards a profile read raised before the same account signed back in', async () => {
    const staleRead = deferred<OwnDisplayNameResult>();
    controlHomeLoads();
    await renderHome();

    profile.lookupOwnDisplayName.mockReturnValueOnce(staleRead.promise);
    await act(async () => auth.listener!(session()));
    const firstLifetime = useAppStore.getState().authSessionVersion;

    // Sign out and back in as the SAME account: userId is identical either side,
    // so only authSessionVersion separates the two lifetimes.
    await act(async () => {
      auth.listener!(null);
      auth.listener!(session('second-token'));
    });
    expect(useAppStore.getState().userId).toBe(USER_ID);
    expect(useAppStore.getState().authSessionVersion).not.toBe(firstLifetime);

    await act(async () => staleRead.resolve({ status: 'unset' }));
    expect(screen.queryByText('Set your display name')).not.toBeInTheDocument();
    expect(screen.getByTestId('app-container')).toBeInTheDocument();
  });

  it('does not re-open setup when a read raised before the name was saved lands after', async () => {
    const firstRead = deferred<OwnDisplayNameResult>();
    controlHomeLoads();
    render(<App />);

    profile.lookupOwnDisplayName.mockReturnValueOnce(firstRead.promise);
    await act(async () => auth.listener!(session()));
    await act(async () => firstRead.resolve({ status: 'unset' }));
    expect(screen.getByText('Set your display name')).toBeInTheDocument();

    // A token refresh while the modal is open raises a second read, which is
    // still in flight when the user submits their name. Auth never changes here,
    // so the identity guard cannot be what discards it.
    const staleRead = deferred<OwnDisplayNameResult>();
    profile.lookupOwnDisplayName.mockReturnValueOnce(staleRead.promise);
    const ownership = useAppStore.getState().authSessionVersion;
    await act(async () => auth.listener!(session('refreshed-token')));

    await act(async () => {
      fireEvent.click(screen.getByText('Set your display name'));
    });
    expect(screen.queryByText('Set your display name')).not.toBeInTheDocument();

    await act(async () => staleRead.resolve({ status: 'unset' }));
    expect(useAppStore.getState().authSessionVersion).toBe(ownership);
    expect(screen.queryByText('Set your display name')).not.toBeInTheDocument();
    expect(screen.getByTestId('app-container')).toBeInTheDocument();
  });

  it('leaves the gate alone when the profile read fails', async () => {
    const reportError = vi.spyOn(console, 'error').mockImplementation(() => {});
    profile.lookupOwnDisplayName.mockResolvedValue({ status: 'error', reason: 'Service unavailable' });
    controlHomeLoads();
    render(<App />);

    await act(async () => auth.listener!(session()));
    // Fail open on display: a 5xx is not evidence that the user has no name.
    expect(screen.queryByText('Set your display name')).not.toBeInTheDocument();
    expect(screen.getByTestId('app-container')).toBeInTheDocument();
    expect(reportError).toHaveBeenCalledWith(
      '[App] Could not read the profile display name:',
      'Service unavailable'
    );
  });
});
