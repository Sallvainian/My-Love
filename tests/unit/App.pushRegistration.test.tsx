/**
 * App wiring for push registration: `startPushRegistration()` runs on every
 * signed-in start and again on an in-place account switch (a new
 * authSessionVersion), and never while signed out.
 *
 * Harness copied from App.localCopyRefresh.test.tsx; the push service is
 * mocked so the calls themselves are what is asserted.
 */
import type { Session } from '@supabase/supabase-js';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App';
import { eventsService } from '../../src/services/eventsService';
import { useAppStore } from '../../src/stores/useAppStore';
import { createAuthBootstrapSession } from '../support/factories/auth-bootstrap-notification-order';

const push = vi.hoisted(() => ({
  startPushRegistration: vi.fn(async () => 'registering' as const),
}));
vi.mock('../../src/services/pushNotifications', () => ({
  startPushRegistration: push.startPushRegistration,
}));

vi.mock('../../src/services/localCopy', () => ({
  refreshLocalCopies: vi.fn(async () => {}),
  refreshLocalCopy: vi.fn(async (_kind: string) => {}),
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
  LoginScreen: () => <p data-testid="login-screen">Sign in</p>,
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
  return createAuthBootstrapSession({ userId, accessToken: 'token', email: 'copy@example.com', displayName: null });
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

describe('App registers for push', () => {
  it('once on signed-in start', async () => {
    await renderApp();

    expect(screen.getByTestId('app-container')).toBeInTheDocument();
    expect(push.startPushRegistration).toHaveBeenCalledTimes(1);
  });

  it('again after an in-place account switch changes authSessionVersion', async () => {
    await renderApp();
    const before = useAppStore.getState().authSessionVersion;

    await act(async () => auth.listener!(session(OTHER_USER_ID)));

    expect(useAppStore.getState().authSessionVersion).not.toBe(before);
    expect(push.startPushRegistration).toHaveBeenCalledTimes(2);
  });

  it('not at all while signed out', async () => {
    auth.getSession.mockResolvedValue(null);
    await renderApp();

    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
    expect(push.startPushRegistration).not.toHaveBeenCalled();
  });
});
