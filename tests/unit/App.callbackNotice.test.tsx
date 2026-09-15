/**
 * DW-95 / DW-96, at the level where the notice's lifetime is decided: App owns
 * the outcome, and two lines there are the whole of "a notice belongs to one
 * signed-out moment".
 *
 * `LoginScreen.callbackNotice.test.tsx` covers the rendering of each outcome.
 * What only App can show is the sequence: a notice appears, the person signs
 * in, and the login screen they come back to at sign-out is clean. Sibling
 * `App.eventsSession.test.tsx` mocks `LoginScreen` wholesale, so this keeps the
 * real one -- the notice has to be the rendered notice, not a stand-in -- and
 * borrows that file's mock set for everything the signed-in shell needs.
 */
import type { Session } from '@supabase/supabase-js';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App';
import type { AuthCallbackOutcome } from '../../src/api/supabaseClient';
import { useAppStore } from '../../src/stores/useAppStore';

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  getAuthCallbackOutcome: vi.fn(),
  listener: null as ((session: Session | null) => void) | null,
}));

const profile = vi.hoisted(() => ({ lookupOwnDisplayName: vi.fn() }));

vi.mock('../../src/api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
  lookupOwnDisplayName: profile.lookupOwnDisplayName,
  getAuthCallbackOutcome: auth.getAuthCallbackOutcome,
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
// The real LoginScreen reaches these when a sign-in attempt starts. Nothing
// here starts one, but the module imports the mocked client above, so the stub
// is only to keep the component's dependency honest.
vi.mock('../../src/api/auth/actionService', () => ({
  signIn: vi.fn(),
  signInWithGoogle: vi.fn(),
}));
vi.mock('../../src/services/eventsService', () => {
  const eventsService = {
    getEvents: vi.fn(async () => []),
    getEventsPage: async () => ({
      events: [],
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
vi.mock('../../src/components/Navigation/NavigationTray', () => ({
  NavigationTray: () => null,
}));
vi.mock('../../src/components/RelationshipTimers/BirthdayCountdown', () => ({
  BirthdayCountdown: () => null,
}));
vi.mock('../../src/components/RelationshipTimers/TimeTogether', () => ({
  TimeTogether: () => null,
}));
vi.mock('../../src/components/DisplayNameSetup', () => ({
  DisplayNameSetup: () => null,
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

const USER_ID = 'callback-notice-user';

function session(): Session {
  return {
    access_token: 'callback-notice-token',
    refresh_token: 'refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    user: {
      id: USER_ID,
      email: 'notice@example.com',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-09-01T00:00:00Z',
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const initialState = useAppStore.getInitialState();

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // The welcome splash renders over the shell and would answer for the app
  // instead of `app-container`; this is the "seen it recently" state.
  localStorage.setItem('lastWelcomeView', String(Date.now()));
  window.history.replaceState({}, '', '/');
  // Signed out: the login screen is the only surface a notice has.
  auth.getSession.mockResolvedValue(null);
  auth.getAuthCallbackOutcome.mockResolvedValue(null);
  profile.lookupOwnDisplayName.mockResolvedValue({ status: 'chosen', displayName: 'Notice User' });
  useAppStore.setState(
    {
      ...initialState,
      isLoading: false,
      initializeApp: vi.fn(async () => {}),
      syncPendingMoods: vi.fn(async () => ({ synced: 0, failed: 0, skipped: false })),
      updateSyncStatus: vi.fn(async () => {}),
      loadEvents: vi.fn(async () => ({ status: 'success' as const })),
    },
    true
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

async function renderSignedOut() {
  render(<App />);
  await act(async () => {});
  expect(screen.getByTestId('login-screen')).toBeInTheDocument();
}

describe('App callback notice lifetime', () => {
  it('shows the notice for the callback this load arrived with', async () => {
    auth.getAuthCallbackOutcome.mockResolvedValue('cancelled');

    await renderSignedOut();

    expect(screen.getByTestId('login-notice').textContent).toContain('cancelled');
    // Read once per load, not per render.
    expect(auth.getAuthCallbackOutcome).toHaveBeenCalledTimes(1);
  });

  it('shows no notice when the load carried no callback', async () => {
    await renderSignedOut();

    expect(screen.queryByTestId('login-notice')).toBeNull();
  });

  it('leaves the login screen clean when the person signs out after a notice', async () => {
    // The row this pins: notice shown, person signs in, person signs out. The
    // notice belongs to the callback that raised it and to nothing after it.
    auth.getAuthCallbackOutcome.mockResolvedValue('cancelled');

    await renderSignedOut();
    expect(screen.getByTestId('login-notice')).toBeInTheDocument();

    // WHEN: they sign in from here -- the login screen unmounts with its own
    // local dismissal, so only App's cleared outcome keeps the notice away.
    await act(async () => auth.listener!(session()));
    expect(screen.getByTestId('app-container')).toBeInTheDocument();
    expect(screen.queryByTestId('login-notice')).toBeNull();

    // ...and later sign out.
    await act(async () => auth.listener!(null));

    // THEN: the login screen they come back to says nothing about a callback
    // that is long over. Without the clear in the session branch the remounted
    // LoginScreen reads the stale outcome and shows it again.
    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('login-notice')).toBeNull();
  });

  it('does not revive a notice from an outcome that resolves after a session', async () => {
    // The `hasSessionNotification` guard, which nothing else reaches: a session
    // notification can land while `getAuthCallbackOutcome()` is still in
    // flight, and the outcome that arrives afterwards belongs to a moment that
    // has already passed.
    const outcome = deferred<AuthCallbackOutcome>();
    auth.getAuthCallbackOutcome.mockReturnValue(outcome.promise);

    render(<App />);
    await act(async () => {});
    // `checkAuth` awaits the outcome before it clears `authLoading`, so the app
    // is still on its bootstrap screen -- which is the window this guards.
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // WHEN: a session arrives first, and only then does the outcome resolve.
    await act(async () => auth.listener!(session()));
    await act(async () => {
      outcome.resolve('cancelled');
      await outcome.promise;
    });
    expect(screen.getByTestId('app-container')).toBeInTheDocument();

    // THEN: signing out reveals a login screen with nothing on it.
    await act(async () => auth.listener!(null));

    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('login-notice')).toBeNull();
  });
});
