/**
 * App wiring for the shared per-account local copies: `refreshLocalCopies()`
 * runs on every signed-in start (including an in-place account switch) and on
 * the window `online` event, but only while someone is signed in.
 *
 * Harness copied from App.eventsSession.test.tsx; services/localCopy is mocked
 * so the calls themselves are what is asserted.
 */
import type { Session } from '@supabase/supabase-js';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { HTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App';
import { eventsService } from '../../src/services/eventsService';
import { useAppStore } from '../../src/stores/useAppStore';

const localCopy = vi.hoisted(() => ({
  refreshLocalCopies: vi.fn(async () => {}),
  refreshLocalCopy: vi.fn(async (_kind: string) => {}),
}));
vi.mock('../../src/services/localCopy', () => ({
  refreshLocalCopies: localCopy.refreshLocalCopies,
  refreshLocalCopy: localCopy.refreshLocalCopy,
  registerLocalCopy: vi.fn(() => () => {}),
  readLocalCopy: vi.fn(async () => null),
  writeLocalCopy: vi.fn(async () => {}),
  deleteAccountCopies: vi.fn(async () => {}),
}));

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
vi.mock('../../src/components/shared', () => ({
  NetworkStatusIndicator: () => null,
  SyncToast: () => null,
}));
vi.mock('../../src/utils/backgroundSync', () => ({ isServiceWorkerSupported: () => false }));
vi.mock('../../src/utils/storageMonitor', () => ({ logStorageQuota: vi.fn() }));
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

vi.mock('motion/react', () => ({
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

const USER_ID = 'local-copy-user';
const OTHER_USER_ID = 'other-local-copy-user';

function session(userId = USER_ID): Session {
  return {
    access_token: 'token',
    refresh_token: 'refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    user: {
      id: userId,
      email: 'copy@example.com',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-09-01T00:00:00Z',
    },
  };
}

const initialState = useAppStore.getInitialState();

// Pinned (noon EDT), so the welcome splash's "seen it recently" stamp below is
// measured against a fixed clock rather than the live one. Only `Date` is
// faked, so RTL's `waitFor` keeps its real timers.
const NOW = new Date('2026-09-15T16:00:00.000Z');

beforeEach(() => {
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('lastWelcomeView', String(NOW.getTime()));
  window.history.replaceState({}, '', '/');
  auth.getSession.mockResolvedValue(session());
  profile.lookupOwnDisplayName.mockResolvedValue({ status: 'chosen', displayName: 'Copy User' });
  vi.mocked(eventsService.getEvents).mockResolvedValue([]);
  useAppStore.setState(
    {
      ...initialState,
      isLoading: false,
      initializeApp: vi.fn(async () => {}),
      syncPendingMoods: vi.fn(async () => ({ synced: 0, failed: 0, skipped: false })),
      updateSyncStatus: vi.fn(async () => {}),
      drainQueuedNotes: vi.fn(async () => {}),
    },
    true
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  vi.useRealTimers();
});

async function renderApp() {
  render(<App />);
  await act(async () => {});
}

describe('App refreshes the local copies', () => {
  it('on signed-in start', async () => {
    await renderApp();

    expect(screen.getByTestId('app-container')).toBeInTheDocument();
    expect(localCopy.refreshLocalCopies).toHaveBeenCalledTimes(1);
  });

  it('again on an in-place account switch', async () => {
    await renderApp();
    expect(localCopy.refreshLocalCopies).toHaveBeenCalledTimes(1);

    await act(async () => auth.listener!(session(OTHER_USER_ID)));

    expect(useAppStore.getState().userId).toBe(OTHER_USER_ID);
    expect(localCopy.refreshLocalCopies).toHaveBeenCalledTimes(2);
  });

  it('on the window online event while signed in', async () => {
    await renderApp();
    localCopy.refreshLocalCopies.mockClear();

    await act(async () => window.dispatchEvent(new Event('online'))); // raw online: connectivity change, not a user action

    expect(localCopy.refreshLocalCopies).toHaveBeenCalledTimes(1);
  });

  it('not at all while signed out, including on the online event', async () => {
    auth.getSession.mockResolvedValue(null);
    await renderApp();
    expect(screen.getByText('Sign in')).toBeInTheDocument();

    await act(async () => window.dispatchEvent(new Event('online'))); // raw online: connectivity change, not a user action

    expect(localCopy.refreshLocalCopies).not.toHaveBeenCalled();
  });
});

describe('App triggers the message-data refresh once the bundled rows are seeded', () => {
  const seeded = [
    { id: 1, text: 'Shared daily', category: 'reason' as const, isCustom: false, createdAt: new Date() },
  ];

  it('when seeding lands for a signed-in user, and not before', async () => {
    await renderApp();
    expect(localCopy.refreshLocalCopy).not.toHaveBeenCalled();

    await act(async () => useAppStore.setState({ messages: seeded }));

    expect(localCopy.refreshLocalCopy).toHaveBeenCalledTimes(1);
    expect(localCopy.refreshLocalCopy).toHaveBeenCalledWith('message-data');
  });

  it('not again on an account switch, which refreshLocalCopies already covers', async () => {
    await renderApp();
    await act(async () => useAppStore.setState({ messages: seeded }));
    localCopy.refreshLocalCopy.mockClear();

    await act(async () => auth.listener!(session(OTHER_USER_ID)));

    expect(localCopy.refreshLocalCopy).not.toHaveBeenCalled();
    expect(localCopy.refreshLocalCopies).toHaveBeenCalledTimes(2);
  });
});

describe('App refreshes the profile copy after the first-run name gate', () => {
  it('completing the display-name setup refreshes the profile copy', async () => {
    profile.lookupOwnDisplayName.mockResolvedValue({ status: 'unset' });
    const user = userEvent.setup();
    await renderApp();
    // The gate is resolved from the auth listener, as on a real sign-in.
    await act(async () => auth.listener!(session()));
    const gate = await screen.findByText('Set your display name');
    localCopy.refreshLocalCopy.mockClear();

    await user.click(gate);

    expect(localCopy.refreshLocalCopy).toHaveBeenCalledWith('profile');
  });
});

describe('App drains the love-note send queue', () => {
  const drain = () => vi.mocked(useAppStore.getState().drainQueuedNotes);

  it('on signed-in start', async () => {
    await renderApp();

    expect(screen.getByTestId('app-container')).toBeInTheDocument();
    expect(drain()).toHaveBeenCalled();
  });

  it('on the window online event while signed in', async () => {
    await renderApp();
    drain().mockClear();

    await act(async () => window.dispatchEvent(new Event('online'))); // raw online: connectivity change, not a user action

    expect(drain()).toHaveBeenCalledTimes(1);
  });

  it('on the 5-minute interval while signed in', async () => {
    // 'Date' too: faking timers without it would un-pin the clock.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    try {
      await renderApp();
      drain().mockClear();

      await act(async () => {
        vi.advanceTimersByTime(5 * 60 * 1000);
      });

      expect(drain()).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('not at all while signed out, including on the online event and the interval', async () => {
    // 'Date' too: faking timers without it would un-pin the clock.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    try {
      auth.getSession.mockResolvedValue(null);
      await renderApp();
      expect(screen.getByText('Sign in')).toBeInTheDocument();

      await act(async () => window.dispatchEvent(new Event('online'))); // raw online: connectivity change, not a user action
      await act(async () => {
        vi.advanceTimersByTime(5 * 60 * 1000);
      });

      expect(drain()).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
