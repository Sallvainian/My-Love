/**
 * The date reminders' re-plan triggers (stories 4.1, 4.2, 4.3 and 4.6): a
 * foreground return, a token renewal and a date copy's write, and the date
 * copies' refresh they start. A real store, real local copies of the five date
 * kinds, the countdown marks and the push switches in fake-indexeddb, and the
 * Capacitor plugin mocked. The re-plan itself is in `dateRemindersAtLaunch.test.ts`.
 * The sign-out cancel is stubbed here (a switch of account in these cases would
 * otherwise call the plugin); its own cases are in
 * `signOutCancelsDateReminders.test.ts` and `dateReminders.schedule.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';

const localNotifications = vi.hoisted(() => ({
  getPending: vi.fn(() => Promise.resolve({ notifications: [] as { id: number }[] })),
  cancel: vi.fn((_options: unknown) => Promise.resolve()),
  checkPermissions: vi.fn(() => Promise.resolve({ display: 'granted' })),
  requestPermissions: vi.fn(() => Promise.resolve({ display: 'granted' })),
  schedule: vi.fn((_options: { notifications: { id: number; title: string; schedule: unknown }[] }) =>
    Promise.resolve({ notifications: [] })
  ),
}));
const readLocalCopySpy = vi.hoisted(() => vi.fn());
const cancelSpy = vi.hoisted(() => vi.fn(() => Promise.resolve()));
// Answers a read in place of the real one, as readLocalCopy does on a failed read: null.
const readFailure = vi.hoisted(() => ({ kind: null as string | null }));
// The refreshers the store's slices registered, kept so a test can put them back after it replaces them with spies.
const realRefreshers = vi.hoisted(() => new Map<string, () => Promise<void>>());
// The supabase auth listeners, so a test can deliver an auth event; `subscribed` counts every subscription ever made.
const authEvents = vi.hoisted(() => {
  type Listener = (event: string, session: { user: { id: string } } | null) => void;
  const listeners = new Set<Listener>();
  return {
    listeners,
    subscribed: { count: 0 },
    onAuthStateChange(listener: Listener) {
      authEvents.subscribed.count += 1;
      listeners.add(listener);
      return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
    },
  };
});

vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: localNotifications }));

vi.mock('../../../src/services/dateReminders', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/services/dateReminders')>()),
  cancelDateReminders: cancelSpy,
}));

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    auth: { onAuthStateChange: authEvents.onAuthStateChange },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
  getPartnerId: vi.fn(),
  lookupPartnerId: vi.fn(),
  isSeedFallbackName: () => false,
}));

vi.mock('../../../src/services/localCopy', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/services/localCopy')>();
  return {
    ...original,
    registerLocalCopy: (...args: Parameters<typeof original.registerLocalCopy>) => {
      if (!realRefreshers.has(args[0])) realRefreshers.set(args[0], args[1]);
      return original.registerLocalCopy(...args);
    },
    readLocalCopy: (...args: Parameters<typeof original.readLocalCopy>) => {
      readLocalCopySpy(...args);
      if (args[1] === readFailure.kind) return Promise.resolve(null);
      return original.readLocalCopy(...args);
    },
  };
});

import { Capacitor } from '@capacitor/core';
import { AUTH_STORAGE_KEY } from '../../../src/api/authStorage';
import { partnerService } from '../../../src/api/partnerService';
import {
  DATE_COPY_REFRESH_INTERVAL_MS,
  replanDateReminders,
  startDateReminderTriggers,
} from '../../../src/services/dateRemindersAtLaunch';
import { anniversariesService } from '../../../src/services/anniversariesService';
import { refreshLocalCopy, registerLocalCopy, writeLocalCopy } from '../../../src/services/localCopy';
import { EVENTS_COPY_KIND } from '../../../src/stores/slices/eventsSlice';
import { PARTNER_COPY_KIND } from '../../../src/stores/slices/partnerSlice';
import { REMINDERS_OFF_COPY_KIND } from '../../../src/stores/slices/datesSlice';
import { useAppStore } from '../../../src/stores/useAppStore';
import { deferred, setOnline, type StoreState } from './accountDataFixtures';
import {
  A,
  B,
  NOW,
  state,
  clearCopies,
  savedEvent,
  DATE_KINDS,
  partnerInfo,
  defaultCopies,
  seedOneOfEachKind,
  scheduleReaders,
  spyOnRefreshers,
  settleMs,
} from './dateRemindersAtLaunchFixture';

const { scheduledTitles, titlesOfSchedule } = scheduleReaders(localNotifications.schedule);

/** Puts the store's own refreshers back. */
function restoreRefreshers() {
  for (const kind of DATE_KINDS) registerLocalCopy(kind, realRefreshers.get(kind)!);
}

/** Delivers an auth event to every live supabase auth listener, as auth-js does. */
function emitAuth(event: string, userId: string | null) {
  for (const listener of [...authEvents.listeners]) listener(event, userId ? { user: { id: userId } } : null);
}

beforeEach(async () => {
  vi.clearAllMocks();
  authEvents.listeners.clear();
  authEvents.subscribed.count = 0;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
  vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true);
  localNotifications.getPending.mockResolvedValue({ notifications: [] });
  localNotifications.cancel.mockResolvedValue(undefined);
  localNotifications.checkPermissions.mockResolvedValue({ display: 'granted' });
  localNotifications.schedule.mockResolvedValue({ notifications: [] });
  cancelSpy.mockResolvedValue(undefined);
  readFailure.kind = null;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  setOnline(true);
  state().clearAuth();
  state().setAuthUser(A);
  // After the identity setup: clearAuth's copy deletion is fire-and-forget.
  await clearCopies();
});

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await clearCopies();
});

describe('startDateReminderTriggers', () => {
  let stop: () => void = () => {};

  /** Waits for `count` schedules, since a trigger starts its run without returning it. */
  async function scheduledTimes(count: number) {
    await vi.waitFor(() => expect(localNotifications.schedule).toHaveBeenCalledTimes(count));
  }

  function setVisibility(value: 'visible' | 'hidden') {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(value);
    document.dispatchEvent(new Event('visibilitychange'));
  }

  // The seven refreshers are spies, so a foreground return or a token renewal
  // reads nothing from the server and each refresh is counted.
  let refreshers: ReturnType<typeof spyOnRefreshers>;

  beforeEach(async () => {
    await seedOneOfEachKind();
    refreshers = spyOnRefreshers();
    stop = startDateReminderTriggers();
  });

  afterEach(async () => {
    stop();
    // Resolves once any run a trigger started, and a follow-up, have finished.
    await replanDateReminders();
    restoreRefreshers();
  });

  // A trigger that re-plans reads the copies before its first await, so
  // `readLocalCopySpy` shows at once whether one fired.

  it('re-plans when the app returns to the foreground, and not when it is hidden', async () => {
    readLocalCopySpy.mockClear();
    setVisibility('hidden');
    expect(readLocalCopySpy).not.toHaveBeenCalled();
    expect(localNotifications.getPending).not.toHaveBeenCalled();
    expect(refreshers.kindsRefreshed()).toBe(0);

    setVisibility('visible');
    // The re-plan from the copies, then the re-plan after the refresh.
    await scheduledTimes(2);

    expect(localNotifications.getPending).toHaveBeenCalledTimes(2);
    expect(titlesOfSchedule(0)).toContain('Today: Wedding day @ 11/7 9:00');
    expect(titlesOfSchedule(1)).toContain('Today: Wedding day @ 11/7 9:00');
  });

  it('re-plans on every return to the foreground, offline, from the copies and not the server', async () => {
    setOnline(false);
    const getPartner = vi.spyOn(partnerService, 'getPartner');
    const fetchAnniversaries = vi.spyOn(anniversariesService, 'fetchAnniversaries');
    setVisibility('visible');
    await scheduledTimes(1);
    setVisibility('visible');
    await scheduledTimes(2);

    expect(localNotifications.getPending).toHaveBeenCalledTimes(2);
    expect(localNotifications.schedule).toHaveBeenCalledTimes(2);
    expect(refreshers.kindsRefreshed()).toBe(0);
    expect(getPartner).not.toHaveBeenCalled();
    expect(fetchAnniversaries).not.toHaveBeenCalled();
  });

  it('re-plans with an own edit: a real addAnniversary writes its copy and the plan includes it', async () => {
    vi.spyOn(anniversariesService, 'createAnniversary').mockResolvedValue({
      serverId: 'ann-new',
      userId: A,
      date: '2022-11-04',
      label: 'Picnic',
    });
    await useAppStore.getState().addAnniversary({ date: '2022-11-04', label: 'Picnic' });
    await scheduledTimes(1);

    expect(scheduledTitles()).toEqual(
      expect.arrayContaining(['Tomorrow: Picnic @ 11/3 9:00', 'Today: Picnic @ 11/4 9:00'])
    );
  });

  it("re-plans with a partner's change: a refresh writes the partner copy", async () => {
    restoreRefreshers();
    vi.spyOn(partnerService, 'getPartner').mockResolvedValue({
      status: 'linked',
      partner: partnerInfo('1995-11-12'),
    });

    await refreshLocalCopy(PARTNER_COPY_KIND);
    await vi.waitFor(() => expect(localNotifications.schedule).toHaveBeenCalled());

    expect(scheduledTitles()).toContain('Today: Jessie turns 31 @ 11/12 9:00');
    expect(scheduledTitles()).not.toContain('Today: Jessie turns 31 @ 11/9 9:00');
  });

  it.each(DATE_KINDS)('re-plans when the %s copy is written', async (kind) => {
    await writeLocalCopy(A, kind, defaultCopies()[kind]);
    await scheduledTimes(1);
  });

  it('re-plans with a reminders-off copy write: switching a far date off drops its month and week reminders', async () => {
    await writeLocalCopy(A, EVENTS_COPY_KIND, [savedEvent('Far', '2026-12-11')]);
    await scheduledTimes(1);
    expect(scheduledTitles()).toEqual(
      expect.arrayContaining(['In a month: Far @ 11/11 9:00', 'In a week: Far @ 12/4 9:00'])
    );

    await writeLocalCopy(A, REMINDERS_OFF_COPY_KIND, ['event:event-Far']);
    await scheduledTimes(2);

    const titles = localNotifications.schedule.mock.calls[1][0].notifications.map((n) => n.title);
    expect(titles).toContain('Tomorrow: Far');
    expect(titles.filter((title) => title.startsWith('In a') && title.endsWith('Far'))).toEqual([]);
  });

  it('does not re-plan for a kind that holds no date', async () => {
    readLocalCopySpy.mockClear();
    await writeLocalCopy(A, 'love-notes', []);
    await writeLocalCopy(A, 'interactions', []);

    expect(readLocalCopySpy).not.toHaveBeenCalled();
    expect(localNotifications.getPending).not.toHaveBeenCalled();
  });

  it('does not re-plan for a copy written for another account', async () => {
    readLocalCopySpy.mockClear();
    await writeLocalCopy(B, EVENTS_COPY_KIND, []);

    expect(readLocalCopySpy).not.toHaveBeenCalled();
    expect(localNotifications.getPending).not.toHaveBeenCalled();
    expect(localNotifications.schedule).not.toHaveBeenCalled();
  });

  it('does nothing once stopped', async () => {
    stop();
    readLocalCopySpy.mockClear();

    setVisibility('visible');
    await writeLocalCopy(A, EVENTS_COPY_KIND, defaultCopies()[EVENTS_COPY_KIND]);

    expect(readLocalCopySpy).not.toHaveBeenCalled();
    expect(localNotifications.getPending).not.toHaveBeenCalled();
    expect(localNotifications.schedule).not.toHaveBeenCalled();
  });

  it('a throwing plugin call is logged and the next trigger still runs', async () => {
    setOnline(false);
    const failure = new Error('bridge gone');
    localNotifications.getPending.mockRejectedValueOnce(failure);

    setVisibility('visible');
    await vi.waitFor(() =>
      expect(console.error).toHaveBeenCalledWith(
        '[DateReminders] Could not schedule the date reminders:',
        failure
      )
    );
    setVisibility('visible');
    await scheduledTimes(1);
  });
});

describe('startDateReminderTriggers off native', () => {
  it.each([
    ['on the web', () => vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)],
    [
      'in a shell without the plugin',
      () => vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(false),
    ],
  ])('adds no listener and plans nothing %s', async (_name, arrange) => {
    await seedOneOfEachKind();
    arrange();
    const addListener = vi.spyOn(document, 'addEventListener');
    const { spies, kindsRefreshed } = spyOnRefreshers();
    readLocalCopySpy.mockClear();

    const stop = startDateReminderTriggers();
    document.dispatchEvent(new Event('visibilitychange'));
    emitAuth('TOKEN_REFRESHED', A);
    await writeLocalCopy(A, EVENTS_COPY_KIND, []);
    stop();
    restoreRefreshers();

    expect(spies.size).toBe(DATE_KINDS.length);
    expect(kindsRefreshed()).toBe(0);
    expect(authEvents.subscribed.count).toBe(0);
    expect(addListener).not.toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(readLocalCopySpy).not.toHaveBeenCalled();
    expect(localNotifications.getPending).not.toHaveBeenCalled();
  });
});

describe('the date copies refresh on a foreground return and a token renewal', () => {
  let stop: () => void = () => {};
  let held: ReturnType<typeof deferred<void>> | null = null;
  let refreshers: ReturnType<typeof spyOnRefreshers>;

  const scheduledTimes = (count: number) =>
    vi.waitFor(() => expect(localNotifications.schedule).toHaveBeenCalledTimes(count));

  function setVisible() {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
  }

  /** Starts the triggers with refreshers that wait on `gate` when given. */
  async function start(gate?: ReturnType<typeof deferred<void>>) {
    held = gate ?? null;
    await seedOneOfEachKind();
    refreshers = spyOnRefreshers(gate?.promise);
    stop = startDateReminderTriggers();
  }

  afterEach(async () => {
    held?.settle();
    stop();
    await settleMs();
    restoreRefreshers();
    stop = () => {};
  });

  it('plans from the copies at once, refreshes all seven kinds, then plans again', async () => {
    await start(deferred<void>());

    setVisible();
    await scheduledTimes(1);
    await vi.waitFor(() => expect(refreshers.kindsRefreshed()).toBe(DATE_KINDS.length));
    // The refresh is still held and the plan did not wait for it.
    expect(localNotifications.schedule).toHaveBeenCalledTimes(1);

    held!.settle();
    await scheduledTimes(2);
    expect(refreshers.timesRefreshed()).toBe(1);
  });

  it('refreshes only the seven date kinds', async () => {
    await start();
    const other = vi.fn(() => Promise.resolve());
    registerLocalCopy('love-notes', other);
    try {
      setVisible();
      await vi.waitFor(() => expect(refreshers.kindsRefreshed()).toBe(DATE_KINDS.length));
      await settleMs();
    } finally {
      // Put the store's own refresher back; unregistering would delete the kind for later tests.
      registerLocalCopy('love-notes', realRefreshers.get('love-notes')!);
    }
    expect(other).not.toHaveBeenCalled();
  });

  it('runs no refresher on a second foreground return within 5 minutes, but still plans from the copies', async () => {
    await start();
    setVisible();
    await scheduledTimes(2);

    vi.setSystemTime(new Date(NOW.getTime() + DATE_COPY_REFRESH_INTERVAL_MS - 1));
    setVisible();
    await scheduledTimes(3);
    await settleMs();

    expect(localNotifications.schedule).toHaveBeenCalledTimes(3);
    expect(refreshers.timesRefreshed()).toBe(1);
  });

  it('treats a clock moved back before the last refresh as elapsed', async () => {
    await start();
    setVisible();
    await scheduledTimes(2);
    expect(refreshers.timesRefreshed()).toBe(1);

    vi.setSystemTime(new Date(NOW.getTime() - 60_000));
    setVisible();

    await vi.waitFor(() => expect(refreshers.timesRefreshed()).toBe(2));
  });

  it('refreshes again once 5 minutes have passed', async () => {
    await start();
    setVisible();
    await scheduledTimes(2);

    vi.setSystemTime(new Date(NOW.getTime() + DATE_COPY_REFRESH_INTERVAL_MS));
    setVisible();
    await vi.waitFor(() => expect(refreshers.timesRefreshed()).toBe(2));
    await scheduledTimes(4);
  });

  it.each([
    ['another account', () => state().setAuthUser(B)],
    [
      'the same account signed in again',
      () => useAppStore.setState({ authSessionVersion: state().authSessionVersion + 1 } as StoreState),
    ],
  ])('does not throttle a different identity: %s', async (_name, switchIdentity) => {
    await start();
    setVisible();
    await vi.waitFor(() => expect(refreshers.timesRefreshed()).toBe(1));
    await settleMs();

    switchIdentity();
    setVisible();

    await vi.waitFor(() => expect(refreshers.timesRefreshed()).toBe(2));
  });

  it('offline: plans from the copies, runs no refresher and does not stamp the throttle; the next online return refreshes', async () => {
    await start();
    setOnline(false);
    setVisible();
    await scheduledTimes(1);
    setVisible();
    await scheduledTimes(2);
    await settleMs();
    expect(refreshers.kindsRefreshed()).toBe(0);

    setOnline(true);
    setVisible();

    await vi.waitFor(() => expect(refreshers.kindsRefreshed()).toBe(DATE_KINDS.length));
    await scheduledTimes(4);
  });

  it('does not refresh when signed out', async () => {
    await start();
    state().clearAuth();

    setVisible();
    await settleMs();

    expect(refreshers.kindsRefreshed()).toBe(0);
  });

  it('plans again from the refreshed copies: a date the refresh wrote reaches the reminders', async () => {
    await start();
    // The partner kind's refresher answers with a new birthday, as a server read would.
    const partnerRefresher = refreshers.spies.get(PARTNER_COPY_KIND)!;
    partnerRefresher.mockImplementation(() =>
      writeLocalCopy(A, PARTNER_COPY_KIND, { status: 'linked', partner: partnerInfo('1995-11-12') })
    );

    setVisible();

    await vi.waitFor(() => {
      const last = localNotifications.schedule.mock.calls.length - 1;
      expect(last).toBeGreaterThanOrEqual(1);
      expect(titlesOfSchedule(last)).toContain('Today: Jessie turns 31 @ 11/12 9:00');
    });
    expect(titlesOfSchedule(0)).toContain('Today: Jessie turns 31 @ 11/9 9:00');
  });

  it('does nothing after the refresh for an owner the store has left', async () => {
    await start(deferred<void>());
    setVisible();
    await scheduledTimes(1);
    await vi.waitFor(() => expect(refreshers.kindsRefreshed()).toBe(DATE_KINDS.length));

    state().setAuthUser(B);
    held!.settle();
    await settleMs();

    expect(localNotifications.schedule).toHaveBeenCalledTimes(1);
    expect(localNotifications.getPending).toHaveBeenCalledTimes(1);
  });

  describe('the stored access token at a foreground return', () => {
    /** Stores a session whose access token expires `inMs` from the (faked) now; `null` leaves out `expires_at`. */
    function storeSession(inMs: number | null) {
      localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({
          access_token: 'access',
          refresh_token: 'refresh',
          user: { id: A },
          ...(inMs === null ? {} : { expires_at: Math.floor((Date.now() + inMs) / 1000) }),
        })
      );
    }

    afterEach(() => {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    });

    it.each([
      ['has expired', -60_000],
      ['expires within 90 s', 60_000],
    ])('re-plans from the copies and runs no refresher when the token %s; the TOKEN_REFRESHED that follows refreshes', async (_name, inMs) => {
      await start();
      storeSession(inMs);

      setVisible();
      await scheduledTimes(1);
      await settleMs();
      expect(refreshers.kindsRefreshed()).toBe(0);

      // Nothing was stamped, so the renewal's own event is not throttled out.
      emitAuth('TOKEN_REFRESHED', A);
      await vi.waitFor(() => expect(refreshers.kindsRefreshed()).toBe(DATE_KINDS.length));
      await scheduledTimes(2);
    });

    it.each([
      ['a fresh stored token', 10 * 60_000],
      ['a stored token with no expires_at', null],
    ])('refreshes as before with %s', async (_name, inMs) => {
      await start();
      storeSession(inMs);

      setVisible();

      await vi.waitFor(() => expect(refreshers.kindsRefreshed()).toBe(DATE_KINDS.length));
      await scheduledTimes(2);
    });

    it('refreshes as before with no stored session', async () => {
      await start();
      localStorage.removeItem(AUTH_STORAGE_KEY);

      setVisible();

      await vi.waitFor(() => expect(refreshers.kindsRefreshed()).toBe(DATE_KINDS.length));
    });
  });

  describe('TOKEN_REFRESHED', () => {
    it('refreshes the seven kinds on the next task, then plans', async () => {
      await start();

      emitAuth('TOKEN_REFRESHED', A);
      // The listener only defers: nothing ran inside it.
      expect(refreshers.kindsRefreshed()).toBe(0);

      await vi.waitFor(() => expect(refreshers.kindsRefreshed()).toBe(DATE_KINDS.length));
      await scheduledTimes(1);
      expect(refreshers.timesRefreshed()).toBe(1);
    });

    it('is throttled with the foreground refresh', async () => {
      await start();
      setVisible();
      await scheduledTimes(2);

      emitAuth('TOKEN_REFRESHED', A);
      await settleMs();
      expect(refreshers.timesRefreshed()).toBe(1);

      vi.setSystemTime(new Date(NOW.getTime() + DATE_COPY_REFRESH_INTERVAL_MS));
      emitAuth('TOKEN_REFRESHED', A);
      await vi.waitFor(() => expect(refreshers.timesRefreshed()).toBe(2));
    });

    it('refreshes once for a burst of renewals', async () => {
      await start();

      emitAuth('TOKEN_REFRESHED', A);
      emitAuth('TOKEN_REFRESHED', A);
      await vi.waitFor(() => expect(refreshers.kindsRefreshed()).toBe(DATE_KINDS.length));
      await settleMs();

      expect(refreshers.timesRefreshed()).toBe(1);
    });

    it.each([
      ['another user', 'TOKEN_REFRESHED', B],
      ['a sign-in', 'SIGNED_IN', A],
      ['a sign-out', 'SIGNED_OUT', null],
      ['a user update', 'USER_UPDATED', A],
      ['a token renewal with no session', 'TOKEN_REFRESHED', null],
    ] as const)('does nothing for %s', async (_name, event, userId) => {
      await start();

      emitAuth(event, userId);
      await settleMs();

      expect(refreshers.kindsRefreshed()).toBe(0);
      expect(localNotifications.schedule).not.toHaveBeenCalled();
    });

    it('does nothing offline', async () => {
      await start();
      setOnline(false);

      emitAuth('TOKEN_REFRESHED', A);
      await settleMs();

      expect(refreshers.kindsRefreshed()).toBe(0);
    });

    it('does nothing after stop, and drops its auth subscription', async () => {
      await start();
      expect(authEvents.listeners.size).toBe(1);

      stop();
      expect(authEvents.listeners.size).toBe(0);
      emitAuth('TOKEN_REFRESHED', A);
      await settleMs();

      expect(refreshers.kindsRefreshed()).toBe(0);
    });

    it('does nothing when stopped before the deferred refresh runs', async () => {
      await start();

      emitAuth('TOKEN_REFRESHED', A);
      stop();
      await settleMs();

      expect(refreshers.kindsRefreshed()).toBe(0);
    });
  });
});
