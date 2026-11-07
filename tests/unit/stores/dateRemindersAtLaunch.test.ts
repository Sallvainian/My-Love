/**
 * The re-plan for date reminders (stories 4.1, 4.2, 4.3 and 4.6): the launch
 * re-plan, which copies it reads, the "Date reminders" switch, single-flight
 * runs and the launch refresh. A real store, real local copies of the five date
 * kinds, the countdown marks and the push switches in fake-indexeddb, and the
 * Capacitor plugin mocked. The triggers that start a re-plan are in
 * `dateRemindersAtLaunch.triggers.test.ts`. The sign-out cancel is stubbed here
 * (a switch of account in these cases would otherwise call the plugin); its own
 * cases are in `signOutCancelsDateReminders.test.ts` and `dateReminders.schedule.test.ts`.
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
import {
  dateReminderWorkSettled,
  replanDateReminders,
  scheduleDateRemindersAtLaunch,
  startDateReminderTriggers,
} from '../../../src/services/dateRemindersAtLaunch';
import { ALL_PUSH_PREFERENCES_ON } from '../../../src/services/pushPreferencesService';
import { refreshLocalCopies, registerLocalCopy, writeLocalCopy } from '../../../src/services/localCopy';
import { EVENTS_COPY_KIND } from '../../../src/stores/slices/eventsSlice';
import { PARTNER_COPY_KIND } from '../../../src/stores/slices/partnerSlice';
import {
  ANNIVERSARIES_COPY_KIND,
  REMINDERS_OFF_COPY_KIND,
  COUPLE_SETTINGS_COPY_KIND,
} from '../../../src/stores/slices/datesSlice';
import { PUSH_PREFERENCES_COPY_KIND } from '../../../src/stores/slices/notificationsSlice';
import { PROFILE_COPY_KIND } from '../../../src/stores/slices/profileSlice';
import { useAppStore } from '../../../src/stores/useAppStore';
import { deferred, setOnline, type StoreState } from './accountDataFixtures';
import {
  A,
  B,
  NOW,
  state,
  owner,
  clearCopies,
  savedEvent,
  DATE_KINDS,
  seedCopies,
  seedOneOfEachKind,
  scheduleReaders,
  spyOnRefreshers,
  ALL_REMINDER_IDS,
} from './dateRemindersAtLaunchFixture';

const { scheduledTitles } = scheduleReaders(localNotifications.schedule);

/** Puts the store's own refreshers back. */
function restoreRefreshers() {
  for (const kind of DATE_KINDS) registerLocalCopy(kind, realRefreshers.get(kind)!);
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

describe('scheduleDateRemindersAtLaunch', () => {
  it('schedules one date of each kind from the five saved copies, not the store', async () => {
    await seedOneOfEachKind();
    // The store holds none of these dates: only the copies are read.
    expect(state().partner).toBeNull();
    expect(state().coupleSettings).toBeNull();
    expect(state().settings?.relationship.anniversaries).toEqual([]);

    await scheduleDateRemindersAtLaunch(owner());

    expect(localNotifications.cancel).toHaveBeenCalledWith({ notifications: ALL_REMINDER_IDS });
    expect(localNotifications.requestPermissions).not.toHaveBeenCalled();
    expect(scheduledTitles()).toEqual([
      // Remind me is on by default, and the partner's birthday is exactly a week out.
      'In a week: Jessie turns 31 @ 11/2 9:00',
      'Tomorrow: Trip @ 11/3 9:00',
      'Tomorrow: Dinner @ 11/4 9:00',
      'Today: Dinner @ 11/5 9:00',
      'Tomorrow: Our anniversary @ 11/5 9:00',
      'Today: Our anniversary @ 11/6 9:00',
      'Tomorrow: Wedding day @ 11/6 9:00',
      'Today: Wedding day @ 11/7 9:00',
      'Tomorrow: You turn 30 @ 11/7 9:00',
      'Today: You turn 30 @ 11/8 9:00',
      'Tomorrow: Jessie turns 31 @ 11/8 9:00',
      'Today: Jessie turns 31 @ 11/9 9:00',
    ]);
    const ids = localNotifications.schedule.mock.calls[0][0].notifications.map((n) => n.id);
    expect(ids).toEqual(ids.map((_, i) => i + 1));
    expect(localNotifications.schedule.mock.calls[0][0].notifications[0].schedule).toEqual({
      on: { year: 2026, month: 11, day: 2, hour: 9, minute: 0 },
    });
  });

  it('adds In a month and In a week for every date except those switched off', async () => {
    await seedCopies({
      [EVENTS_COPY_KIND]: [
        savedEvent('Trip', '2026-11-04'),
        savedEvent('Far', '2026-12-11'),
        savedEvent('Quiet', '2026-12-15'),
      ],
      [ANNIVERSARIES_COPY_KIND]: [{ id: 1, date: '2021-12-20', label: 'Dinner', serverId: 'ann-1' }],
      [REMINDERS_OFF_COPY_KIND]: ['event:event-Quiet', 'event:deleted-event'],
    });

    await scheduleDateRemindersAtLaunch(owner());

    const titles = scheduledTitles();
    expect(titles).toContain('In a month: Far @ 11/11 9:00');
    expect(titles).toContain('In a week: Far @ 12/4 9:00');
    expect(titles).toContain('Tomorrow: Far @ 12/10 9:00');
    expect(titles).toContain('In a month: Dinner @ 11/20 9:00');
    expect(titles).toContain('In a week: Dinner @ 12/13 9:00');
    // The date switched off keeps only its day-before reminder.
    expect(titles).toContain('Tomorrow: Quiet @ 12/14 9:00');
    expect(titles.filter((title) => title.includes('Quiet') && title.startsWith('In a'))).toEqual([]);
    // Trip is too close for a month or a week before; the partner's birthday,
    // a week out, adds its week-before one.
    expect(titles.filter((title) => title.startsWith('In a'))).toEqual([
      'In a week: Jessie turns 31 @ 11/2 9:00',
      'In a month: Far @ 11/11 9:00',
      'In a month: Dinner @ 11/20 9:00',
      'In a week: Far @ 12/4 9:00',
      'In a week: Dinner @ 12/13 9:00',
    ]);
    expect(titles).toContain('Tomorrow: Trip @ 11/3 9:00');
  });

  it('plans an empty reminders-off copy as every date on', async () => {
    await seedCopies({
      [EVENTS_COPY_KIND]: [savedEvent('Far', '2026-12-11')],
      [REMINDERS_OFF_COPY_KIND]: [],
    });

    await scheduleDateRemindersAtLaunch(owner());

    expect(scheduledTitles()).toContain('In a month: Far @ 11/11 9:00');
  });

  it('names an own birthday after a chosen display name', async () => {
    await seedCopies({ [PROFILE_COPY_KIND]: { displayName: 'Casey', birthday: '1996-11-08' } });

    await scheduleDateRemindersAtLaunch(owner());

    expect(scheduledTitles()).toContain('Today: Casey turns 30 @ 11/8 9:00');
  });

  it('makes no plugin call when there is no saved events copy', async () => {
    await seedCopies({}, [EVENTS_COPY_KIND]);
    localNotifications.getPending.mockResolvedValue({ notifications: [{ id: 1 }] });

    await scheduleDateRemindersAtLaunch(owner());

    expect(localNotifications.getPending).not.toHaveBeenCalled();
    expect(localNotifications.cancel).not.toHaveBeenCalled();
    expect(localNotifications.schedule).not.toHaveBeenCalled();
  });

  it('ignores the couple settings of an unlinked account but plans its own dates', async () => {
    await seedCopies({
      [EVENTS_COPY_KIND]: [],
      [COUPLE_SETTINGS_COPY_KIND]: { status: 'unlinked' },
      [PARTNER_COPY_KIND]: { status: 'unlinked' },
    });

    await scheduleDateRemindersAtLaunch(owner());

    expect(scheduledTitles()).toEqual([
      'Tomorrow: Dinner @ 11/4 9:00',
      'Today: Dinner @ 11/5 9:00',
      'Tomorrow: You turn 30 @ 11/7 9:00',
      'Today: You turn 30 @ 11/8 9:00',
    ]);
  });

  it('cancels pending reminders and schedules nothing when permission is not granted', async () => {
    await seedOneOfEachKind();
    localNotifications.getPending.mockResolvedValue({ notifications: [{ id: 3 }] });
    localNotifications.checkPermissions.mockResolvedValue({ display: 'prompt' });

    await scheduleDateRemindersAtLaunch(owner());

    expect(localNotifications.cancel).toHaveBeenCalledWith({ notifications: ALL_REMINDER_IDS });
    expect(localNotifications.schedule).not.toHaveBeenCalled();
    expect(localNotifications.requestPermissions).not.toHaveBeenCalled();
  });

  it('calls no plugin when the account changes during the copy read', async () => {
    await seedOneOfEachKind();

    const run = scheduleDateRemindersAtLaunch(owner());
    state().setAuthUser(B);
    await run;

    expect(localNotifications.getPending).not.toHaveBeenCalled();
    expect(localNotifications.schedule).not.toHaveBeenCalled();
  });

  it('calls no plugin when the same account signs in again during the copy read', async () => {
    await seedOneOfEachKind();

    const run = scheduleDateRemindersAtLaunch(owner());
    useAppStore.setState({ authSessionVersion: state().authSessionVersion + 1 } as StoreState);
    await run;

    expect(state().userId).toBe(A);
    expect(localNotifications.getPending).not.toHaveBeenCalled();
    expect(localNotifications.schedule).not.toHaveBeenCalled();
  });

  it('does nothing, and reads nothing, when the owner is no longer the store identity', async () => {
    await seedOneOfEachKind();
    const stale = { userId: A, authSessionVersion: state().authSessionVersion };
    state().setAuthUser(B);
    readLocalCopySpy.mockClear();

    await scheduleDateRemindersAtLaunch(stale);

    expect(readLocalCopySpy).not.toHaveBeenCalled();
    expect(localNotifications.getPending).not.toHaveBeenCalled();
    expect(localNotifications.schedule).not.toHaveBeenCalled();
  });

  it('stops before the next plugin call when the account changes during one', async () => {
    await seedOneOfEachKind();
    localNotifications.getPending.mockImplementation(() => {
      state().setAuthUser(B);
      return Promise.resolve({ notifications: [{ id: 1 }] });
    });

    await scheduleDateRemindersAtLaunch(owner());

    expect(localNotifications.getPending).toHaveBeenCalledTimes(1);
    expect(localNotifications.cancel).not.toHaveBeenCalled();
    expect(localNotifications.schedule).not.toHaveBeenCalled();
  });

  it('does nothing when signed out', async () => {
    const signedIn = owner();
    state().clearAuth();

    await scheduleDateRemindersAtLaunch(signedIn);

    expect(localNotifications.getPending).not.toHaveBeenCalled();
  });

  it.each([
    ['on the web', () => vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)],
    [
      'in a shell without the plugin',
      () => vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(false),
    ],
  ])('does nothing %s: no plugin call and no IndexedDB read', async (_name, arrange) => {
    await seedOneOfEachKind();
    arrange();
    readLocalCopySpy.mockClear();

    await scheduleDateRemindersAtLaunch(owner());

    expect(readLocalCopySpy).not.toHaveBeenCalled();
    expect(localNotifications.getPending).not.toHaveBeenCalled();
    expect(localNotifications.cancel).not.toHaveBeenCalled();
    expect(localNotifications.checkPermissions).not.toHaveBeenCalled();
    expect(localNotifications.schedule).not.toHaveBeenCalled();
  });
});

describe('replanDateReminders reads only loaded copies', () => {
  it.each(DATE_KINDS)('makes no plugin call, and keeps the pending list, when the %s copy is missing', async (kind) => {
    await seedCopies({}, [kind]);
    localNotifications.getPending.mockResolvedValue({ notifications: [{ id: 1 }, { id: 2 }] });

    await replanDateReminders();

    expect(localNotifications.getPending).not.toHaveBeenCalled();
    expect(localNotifications.cancel).not.toHaveBeenCalled();
    expect(localNotifications.checkPermissions).not.toHaveBeenCalled();
    expect(localNotifications.schedule).not.toHaveBeenCalled();
  });

  it.each([
    [ANNIVERSARIES_COPY_KIND, 'not a list'],
    [COUPLE_SETTINGS_COPY_KIND, { status: 'linked' }],
    [PROFILE_COPY_KIND, 'not a profile'],
    [PARTNER_COPY_KIND, { status: 'linked' }],
    [EVENTS_COPY_KIND, { not: 'a list' }],
    [REMINDERS_OFF_COPY_KIND, 'not a list'],
    [REMINDERS_OFF_COPY_KIND, ['wedding', 7]],
    [PUSH_PREFERENCES_COPY_KIND, 'not a row'],
    [PUSH_PREFERENCES_COPY_KIND, { ...ALL_PUSH_PREFERENCES_ON, dateReminders: 'yes' }],
    [PUSH_PREFERENCES_COPY_KIND, { loveNotes: true, moods: true }],
  ] as const)('treats a malformed %s copy as missing', async (kind, value) => {
    await seedCopies({ [kind]: value });

    await replanDateReminders();

    expect(localNotifications.getPending).not.toHaveBeenCalled();
    expect(localNotifications.schedule).not.toHaveBeenCalled();
  });

  it.each(DATE_KINDS)('treats a %s copy whose read failed as missing', async (kind) => {
    await seedCopies();
    readFailure.kind = kind;

    await replanDateReminders();

    expect(localNotifications.getPending).not.toHaveBeenCalled();
    expect(localNotifications.schedule).not.toHaveBeenCalled();
  });

  it('plans an unlinked, empty account once every copy has loaded', async () => {
    await seedCopies({
      [EVENTS_COPY_KIND]: [],
      [ANNIVERSARIES_COPY_KIND]: [],
      [COUPLE_SETTINGS_COPY_KIND]: { status: 'unlinked' },
      [PROFILE_COPY_KIND]: { displayName: null, birthday: null },
      [PARTNER_COPY_KIND]: { status: 'unlinked' },
    });
    localNotifications.getPending.mockResolvedValue({ notifications: [{ id: 4 }] });

    await replanDateReminders();

    // Loaded and empty is an answer: the stale reminder goes, nothing is scheduled.
    expect(localNotifications.cancel).toHaveBeenCalledWith({ notifications: ALL_REMINDER_IDS });
    expect(localNotifications.schedule).not.toHaveBeenCalled();
  });

  it('stamps thread id partner-activity on what it schedules', async () => {
    await seedOneOfEachKind();

    await replanDateReminders();

    const [options] = localNotifications.schedule.mock.calls[0] as [
      { notifications: { threadIdentifier?: string }[] },
    ];
    expect(options.notifications.length).toBeGreaterThan(0);
    expect(new Set(options.notifications.map((n) => n.threadIdentifier))).toEqual(
      new Set(['partner-activity'])
    );
  });

  it('does nothing when signed out, with no owner given', async () => {
    await seedOneOfEachKind();
    state().clearAuth();
    readLocalCopySpy.mockClear();

    await replanDateReminders();

    expect(readLocalCopySpy).not.toHaveBeenCalled();
    expect(localNotifications.getPending).not.toHaveBeenCalled();
  });
});

describe('the Date reminders switch', () => {
  const SWITCH_OFF = { ...ALL_PUSH_PREFERENCES_ON, dateReminders: false };

  it('cancels every reminder, even one the pending list misses, and schedules nothing when the saved row has it off', async () => {
    await seedCopies({ [PUSH_PREFERENCES_COPY_KIND]: SWITCH_OFF });
    // The pending list can lag a fresh schedule: an empty answer must not
    // leave a reminder the person turned off.
    localNotifications.getPending.mockResolvedValue({ notifications: [] });

    await replanDateReminders();

    expect(localNotifications.cancel).toHaveBeenCalledWith({ notifications: ALL_REMINDER_IDS });
    expect(localNotifications.schedule).not.toHaveBeenCalled();
  });

  const OTHER_KINDS = DATE_KINDS.filter((kind) => kind !== PUSH_PREFERENCES_COPY_KIND);

  // DW-392: off is an answer on its own, while on still needs every copy (each
  // kind's "on" case is in 'replanDateReminders reads only loaded copies').
  it.each(OTHER_KINDS)(
    'cancels every reminder and schedules nothing when the switch is off and the %s copy is missing',
    async (kind) => {
      await seedCopies({ [PUSH_PREFERENCES_COPY_KIND]: SWITCH_OFF }, [kind]);
      localNotifications.getPending.mockResolvedValue({ notifications: [{ id: 1 }, { id: 2 }] });

      await replanDateReminders();

      expect(localNotifications.cancel).toHaveBeenCalledTimes(1);
      expect(localNotifications.cancel).toHaveBeenCalledWith({ notifications: ALL_REMINDER_IDS });
      expect(localNotifications.schedule).not.toHaveBeenCalled();
    }
  );

  it.each(OTHER_KINDS)(
    'cancels every reminder when the switch is off and the %s copy read fails',
    async (kind) => {
      await seedCopies({ [PUSH_PREFERENCES_COPY_KIND]: SWITCH_OFF });
      readFailure.kind = kind;

      await replanDateReminders();

      expect(localNotifications.cancel).toHaveBeenCalledWith({ notifications: ALL_REMINDER_IDS });
      expect(localNotifications.schedule).not.toHaveBeenCalled();
    }
  );

  it('cancels with only the switch copy saved', async () => {
    await seedCopies({ [PUSH_PREFERENCES_COPY_KIND]: SWITCH_OFF }, OTHER_KINDS);

    await replanDateReminders();

    expect(localNotifications.cancel).toHaveBeenCalledWith({ notifications: ALL_REMINDER_IDS });
    expect(localNotifications.schedule).not.toHaveBeenCalled();
  });

  it('stops before the cancel when the account changes during the switch-off run', async () => {
    await seedCopies({ [PUSH_PREFERENCES_COPY_KIND]: SWITCH_OFF }, [EVENTS_COPY_KIND]);
    localNotifications.getPending.mockImplementation(() => {
      state().setAuthUser(B);
      return Promise.resolve({ notifications: [{ id: 1 }] });
    });

    await replanDateReminders();

    expect(localNotifications.getPending).toHaveBeenCalledTimes(1);
    expect(localNotifications.cancel).not.toHaveBeenCalled();
    expect(localNotifications.checkPermissions).not.toHaveBeenCalled();
    expect(localNotifications.schedule).not.toHaveBeenCalled();
  });

  it('keeps the other push switches out of it: only dateReminders decides', async () => {
    await seedCopies({
      [PUSH_PREFERENCES_COPY_KIND]: { ...ALL_PUSH_PREFERENCES_ON, photos: false, loveNotes: false },
    });

    await replanDateReminders();

    expect(scheduledTitles().length).toBeGreaterThan(0);
  });

  it('makes no plugin call, and keeps the pending list, when the row was never saved', async () => {
    await seedCopies({}, [PUSH_PREFERENCES_COPY_KIND]);
    localNotifications.getPending.mockResolvedValue({ notifications: [{ id: 1 }] });

    await replanDateReminders();

    expect(localNotifications.getPending).not.toHaveBeenCalled();
    expect(localNotifications.cancel).not.toHaveBeenCalled();
    expect(localNotifications.schedule).not.toHaveBeenCalled();
  });

  it('re-plans on a write of the row: off cancels, on schedules again', async () => {
    await seedOneOfEachKind();
    const stop = startDateReminderTriggers();
    try {
      localNotifications.getPending.mockResolvedValue({ notifications: [{ id: 1 }, { id: 2 }] });
      await writeLocalCopy(A, PUSH_PREFERENCES_COPY_KIND, SWITCH_OFF);
      await vi.waitFor(() => expect(localNotifications.cancel).toHaveBeenCalledTimes(1));
      expect(localNotifications.schedule).not.toHaveBeenCalled();

      await writeLocalCopy(A, PUSH_PREFERENCES_COPY_KIND, { ...ALL_PUSH_PREFERENCES_ON });
      await vi.waitFor(() => expect(localNotifications.schedule).toHaveBeenCalledTimes(1));
      expect(scheduledTitles()).toContain('Today: Wedding day @ 11/7 9:00');
    } finally {
      stop();
      // Resolves once the run the last write started, and a follow-up, have finished.
      await replanDateReminders();
    }
  });
});

describe('replanDateReminders is single-flight', () => {
  it('collapses a burst into the run in flight plus one follow-up, never overlapping', async () => {
    await seedOneOfEachKind();
    let active = 0;
    let maxActive = 0;
    const gate = deferred<void>();
    let first = true;
    localNotifications.getPending.mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      if (first) {
        first = false;
        await gate.promise;
      }
      return { notifications: [] };
    });
    localNotifications.schedule.mockImplementation(() => {
      active -= 1;
      return Promise.resolve({ notifications: [] });
    });

    const runs = [replanDateReminders()];
    await vi.waitFor(() => expect(localNotifications.getPending).toHaveBeenCalledTimes(1));
    for (let i = 0; i < 5; i++) runs.push(replanDateReminders());
    runs.push(scheduleDateRemindersAtLaunch(owner()));
    gate.settle();
    await Promise.all(runs);

    expect(localNotifications.getPending).toHaveBeenCalledTimes(2);
    expect(localNotifications.schedule).toHaveBeenCalledTimes(2);
    expect(maxActive).toBe(1);
  });

  it('runs the follow-up from the copies as they are then', async () => {
    await seedOneOfEachKind();
    const gate = deferred<void>();
    localNotifications.getPending.mockImplementationOnce(async () => {
      await gate.promise;
      return { notifications: [] };
    });

    const firstRun = replanDateReminders();
    await vi.waitFor(() => expect(localNotifications.getPending).toHaveBeenCalledTimes(1));
    await writeLocalCopy(A, ANNIVERSARIES_COPY_KIND, [{ id: 1, date: '2021-11-05', label: 'Picnic' }]);
    const followUp = replanDateReminders();
    gate.settle();
    await Promise.all([firstRun, followUp]);

    expect(localNotifications.schedule).toHaveBeenCalledTimes(2);
    const titles = (call: number) =>
      localNotifications.schedule.mock.calls[call][0].notifications.map((n) => n.title);
    expect(titles(0)).toContain('Today: Dinner');
    expect(titles(1)).toContain('Today: Picnic');
    expect(titles(1)).not.toContain('Today: Dinner');
  });

  it("does not let a replaced start's request take over the queued follow-up", async () => {
    await seedOneOfEachKind();
    const replaced = { userId: A, authSessionVersion: state().authSessionVersion - 1 };
    const gate = deferred<void>();
    localNotifications.getPending.mockImplementationOnce(async () => {
      await gate.promise;
      return { notifications: [] };
    });

    const firstRun = replanDateReminders();
    await vi.waitFor(() => expect(localNotifications.getPending).toHaveBeenCalledTimes(1));
    const followUp = replanDateReminders();
    const stale = replanDateReminders(replaced);
    gate.settle();
    await Promise.all([firstRun, followUp, stale]);

    expect(localNotifications.schedule).toHaveBeenCalledTimes(2);
  });
});

describe('scheduleDateRemindersAtLaunch with a launch refresh', () => {
  afterEach(() => {
    restoreRefreshers();
  });

  it('plans at once from the saved copies while a refresher is stalled, and again when the refresh settles', async () => {
    await seedOneOfEachKind();
    const gate = deferred<void>();
    spyOnRefreshers();
    const unregister = registerLocalCopy('stalled-kind', () => gate.promise);
    try {
      const refreshed = refreshLocalCopies();
      void scheduleDateRemindersAtLaunch(owner(), refreshed);

      await vi.waitFor(() => expect(localNotifications.schedule).toHaveBeenCalledTimes(1));
      await dateReminderWorkSettled();
      expect(localNotifications.schedule).toHaveBeenCalledTimes(1);
      expect(scheduledTitles()).toContain('Today: Wedding day @ 11/7 9:00');

      gate.settle();
      await vi.waitFor(() => expect(localNotifications.schedule).toHaveBeenCalledTimes(2));
    } finally {
      unregister();
    }
  });

  it('plans once, from the copies, without a refresh to wait for', async () => {
    await seedOneOfEachKind();

    await scheduleDateRemindersAtLaunch(owner());

    expect(localNotifications.schedule).toHaveBeenCalledTimes(1);
  });

  it('plans again after a refresh that rejects', async () => {
    await seedOneOfEachKind();

    const gate = deferred<void>();
    gate.fail(new Error('refresh gone'));

    await scheduleDateRemindersAtLaunch(owner(), gate.promise);

    expect(localNotifications.schedule).toHaveBeenCalledTimes(2);
  });

  // A switch to another account deletes the outgoing account's copies, so its
  // plan would find nothing to schedule even without the identity check; the
  // same account signed in again keeps them, so only the check stops that one.
  it.each([
    ['another account', () => state().setAuthUser(B)],
    [
      'the same account signed in again',
      () => useAppStore.setState({ authSessionVersion: state().authSessionVersion + 1 } as StoreState),
    ],
  ])('does not plan the second time for an owner the store has left: %s', async (_name, leave) => {
    await seedOneOfEachKind();
    const gate = deferred<void>();
    const run = scheduleDateRemindersAtLaunch(owner(), gate.promise);
    await vi.waitFor(() => expect(localNotifications.schedule).toHaveBeenCalledTimes(1));

    leave();
    gate.settle();
    await run;

    expect(localNotifications.schedule).toHaveBeenCalledTimes(1);
  });

  it('plans nothing, and does not wait for the refresh, off native', async () => {
    await seedOneOfEachKind();
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);

    await scheduleDateRemindersAtLaunch(owner(), new Promise(() => {}));

    expect(localNotifications.getPending).not.toHaveBeenCalled();
  });
});
