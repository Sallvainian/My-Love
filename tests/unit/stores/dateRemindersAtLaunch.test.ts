/**
 * The re-plan for date reminders and its triggers (stories 4.1, 4.2, 4.3 and
 * 4.6): a real store, real local copies of the five date kinds, the countdown
 * marks and the push switches (the "Date reminders" switch) in fake-indexeddb,
 * and the
 * Capacitor plugin mocked. The sign-out cancel is stubbed here (a switch of
 * account in these cases would otherwise call the plugin); its own cases are in
 * `signOutCancelsDateReminders.test.ts` and `dateReminders.test.ts`.
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
  scheduleDateRemindersAtLaunch,
  startDateReminderTriggers,
} from '../../../src/services/dateRemindersAtLaunch';
import { MAX_SCHEDULED_REMINDERS } from '../../../src/services/dateReminders';
import { openMyLoveDB } from '../../../src/services/dbSchema';
import { ALL_PUSH_PREFERENCES_ON } from '../../../src/services/pushPreferencesService';
import { anniversariesService } from '../../../src/services/anniversariesService';
import {
  refreshLocalCopies,
  refreshLocalCopy,
  registerLocalCopy,
  writeLocalCopy,
} from '../../../src/services/localCopy';
import { EVENTS_COPY_KIND } from '../../../src/stores/slices/eventsSlice';
import { PARTNER_COPY_KIND } from '../../../src/stores/slices/partnerSlice';
import {
  ANNIVERSARIES_COPY_KIND,
  COUNTDOWN_MARKS_COPY_KIND,
  COUPLE_SETTINGS_COPY_KIND,
} from '../../../src/stores/slices/datesSlice';
import { PUSH_PREFERENCES_COPY_KIND } from '../../../src/stores/slices/notificationsSlice';
import { PROFILE_COPY_KIND } from '../../../src/stores/slices/profileSlice';
import { useAppStore } from '../../../src/stores/useAppStore';
import { deferred, setOnline, type StoreState } from './accountDataFixtures';

const A = 'USER-A-ID';
const B = 'USER-B-ID';
const P = 'PARTNER-ID';

// Vitest runs with TZ=America/New_York; local time throughout.
const NOW = new Date(2026, 10, 1, 10, 0); // Sun 1 Nov 2026, 10:00

function state() {
  return useAppStore.getState();
}

/** The identity of the start the store is on now, as App captures it. */
function owner() {
  return { userId: state().userId!, authSessionVersion: state().authSessionVersion };
}

async function clearCopies(): Promise<void> {
  const db = await openMyLoveDB();
  try {
    await db.clear('local-copies');
  } finally {
    db.close();
  }
}

function savedEvent(label: string, date: string) {
  return {
    id: `event-${label}`,
    userId: A,
    label,
    date,
    createdAt: '2026-10-01T12:00:00.000Z',
    description: null,
    icon: 'calendar',
  };
}

const DATE_KINDS = [
  EVENTS_COPY_KIND,
  ANNIVERSARIES_COPY_KIND,
  COUPLE_SETTINGS_COPY_KIND,
  PROFILE_COPY_KIND,
  PARTNER_COPY_KIND,
  COUNTDOWN_MARKS_COPY_KIND,
  PUSH_PREFERENCES_COPY_KIND,
] as const;

function partnerInfo(birthday: string | null = '1995-11-09') {
  return {
    id: P,
    email: 'jessie@test.example.com',
    displayName: 'Jessie',
    linkedSince: null,
    birthday,
  };
}

/** One date of each kind, 3 to 8 days ahead of `NOW`, as the saved copies; nothing is marked and the Date reminders switch is on. */
function defaultCopies(): Record<(typeof DATE_KINDS)[number], unknown> {
  return {
    [EVENTS_COPY_KIND]: [savedEvent('Trip', '2026-11-04')],
    [ANNIVERSARIES_COPY_KIND]: [{ id: 1, date: '2021-11-05', label: 'Dinner' }],
    [COUPLE_SETTINGS_COPY_KIND]: {
      status: 'linked',
      partnerId: P,
      relationshipStart: new Date(2018, 10, 6, 20, 0).toISOString(),
      weddingDate: '2026-11-07',
    },
    [PROFILE_COPY_KIND]: { displayName: null, birthday: '1996-11-08' },
    [PARTNER_COPY_KIND]: { status: 'linked', partner: partnerInfo() },
    [COUNTDOWN_MARKS_COPY_KIND]: [],
    [PUSH_PREFERENCES_COPY_KIND]: { ...ALL_PUSH_PREFERENCES_ON },
  };
}

/** Writes the copies for A; `overrides` replaces a kind's value, `omit` leaves a kind unsaved. */
async function seedCopies(
  overrides: Partial<Record<(typeof DATE_KINDS)[number], unknown>> = {},
  omit: readonly string[] = []
): Promise<void> {
  const copies = { ...defaultCopies(), ...overrides };
  for (const kind of DATE_KINDS) {
    if (!omit.includes(kind)) await writeLocalCopy(A, kind, copies[kind]);
  }
}

const seedOneOfEachKind = () => seedCopies();

/** The scheduled notifications as `title @ month/day hour:minute`. */
function scheduledTitles(): string[] {
  expect(localNotifications.schedule).toHaveBeenCalledTimes(1);
  return titlesOfSchedule(0);
}

/** The `call`th schedule (0-based) as `title @ month/day hour:minute`, for runs that schedule more than once. */
function titlesOfSchedule(call: number): string[] {
  const [options] = localNotifications.schedule.mock.calls[call];
  return options.notifications.map((n) => {
    const on = (n.schedule as { on: { month: number; day: number; hour: number; minute: number } }).on;
    return `${n.title} @ ${on.month}/${on.day} ${on.hour}:${String(on.minute).padStart(2, '0')}`;
  });
}

/** Replaces the seven date kinds' refreshers with spies that resolve at once; `hold` makes them wait on it. */
function spyOnRefreshers(hold?: Promise<void>) {
  const spies = new Map(
    DATE_KINDS.map((kind) => [kind, vi.fn((): Promise<void> => hold ?? Promise.resolve())] as const)
  );
  for (const [kind, spy] of spies) registerLocalCopy(kind, spy);
  return {
    spies,
    /** How many of the seven kinds have refreshed at least once. */
    kindsRefreshed: () => [...spies.values()].filter((spy) => spy.mock.calls.length > 0).length,
    /** The most calls any one kind's refresher has had. */
    timesRefreshed: () => Math.max(...[...spies.values()].map((spy) => spy.mock.calls.length)),
  };
}

/** Puts the store's own refreshers back. */
function restoreRefreshers() {
  for (const kind of DATE_KINDS) registerLocalCopy(kind, realRefreshers.get(kind)!);
}

/** Delivers an auth event to every live supabase auth listener, as auth-js does. */
function emitAuth(event: string, userId: string | null) {
  for (const listener of [...authEvents.listeners]) listener(event, userId ? { user: { id: userId } } : null);
}

const settleMs = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

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

/** Every id a date reminder can hold: what each re-plan cancels. */
const ALL_REMINDER_IDS = Array.from({ length: MAX_SCHEDULED_REMINDERS }, (_, i) => ({ id: i + 1 }));

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
      on: { year: 2026, month: 11, day: 3, hour: 9, minute: 0 },
    });
  });

  it('adds In a month and In a week for the dates in the marks copy, and only for those', async () => {
    await seedCopies({
      [EVENTS_COPY_KIND]: [savedEvent('Trip', '2026-11-04'), savedEvent('Far', '2026-12-11')],
      [ANNIVERSARIES_COPY_KIND]: [{ id: 1, date: '2021-12-20', label: 'Dinner', serverId: 'ann-1' }],
      [COUNTDOWN_MARKS_COPY_KIND]: ['event:event-Far', 'anniversary:ann-1', 'event:deleted-event'],
    });

    await scheduleDateRemindersAtLaunch(owner());

    const titles = scheduledTitles();
    expect(titles).toContain('In a month: Far @ 11/11 9:00');
    expect(titles).toContain('In a week: Far @ 12/4 9:00');
    expect(titles).toContain('Tomorrow: Far @ 12/10 9:00');
    expect(titles).toContain('In a month: Dinner @ 11/20 9:00');
    expect(titles).toContain('In a week: Dinner @ 12/13 9:00');
    // Unmarked dates stay as they were.
    expect(titles.filter((title) => title.startsWith('In a'))).toHaveLength(4);
    expect(titles).toContain('Tomorrow: Trip @ 11/3 9:00');
  });

  it('plans an empty marks copy as a loaded "no marks"', async () => {
    await seedCopies({ [COUNTDOWN_MARKS_COPY_KIND]: [] });

    await scheduleDateRemindersAtLaunch(owner());

    expect(scheduledTitles().some((title) => title.startsWith('In a'))).toBe(false);
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
    [COUNTDOWN_MARKS_COPY_KIND, 'not a list'],
    [COUNTDOWN_MARKS_COPY_KIND, ['wedding', 7]],
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
      await new Promise((resolve) => setTimeout(resolve, 20));
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

describe('startDateReminderTriggers', () => {
  let stop: () => void = () => {};

  /** Waits for `count` schedules, since a trigger starts its run without returning it. */
  async function scheduledTimes(count: number) {
    await vi.waitFor(() => expect(localNotifications.schedule).toHaveBeenCalledTimes(count));
  }

  /** Lets a trigger that should do nothing have its chance. */
  async function settle() {
    await new Promise((resolve) => setTimeout(resolve, 20));
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
    await settle();
    restoreRefreshers();
  });

  it('re-plans when the app returns to the foreground, and not when it is hidden', async () => {
    setVisibility('hidden');
    await settle();
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
    await settle();

    expect(localNotifications.getPending).toHaveBeenCalledTimes(2);
    expect(localNotifications.schedule).toHaveBeenCalledTimes(2);
    expect(refreshers.kindsRefreshed()).toBe(0);
    expect(getPartner).not.toHaveBeenCalled();
    expect(fetchAnniversaries).not.toHaveBeenCalled();
  });

  it('re-plans with an own edit: a real addAnniversary writes its copy and the plan includes it', async () => {
    vi.spyOn(anniversariesService, 'createAnniversary').mockResolvedValue({
      serverId: 'ann-new',
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

  it('re-plans with a marks copy write: marking a far date adds its month and week reminders', async () => {
    await writeLocalCopy(A, EVENTS_COPY_KIND, [savedEvent('Far', '2026-12-11')]);
    await scheduledTimes(1);
    expect(scheduledTitles().some((title) => title.startsWith('In a'))).toBe(false);

    await writeLocalCopy(A, COUNTDOWN_MARKS_COPY_KIND, ['event:event-Far']);
    await scheduledTimes(2);

    const titles = localNotifications.schedule.mock.calls[1][0].notifications.map((n) => n.title);
    expect(titles).toEqual(
      expect.arrayContaining(['In a month: Far', 'In a week: Far', 'Tomorrow: Far'])
    );
  });

  it('does not re-plan for a kind that holds no date', async () => {
    await writeLocalCopy(A, 'love-notes', []);
    await writeLocalCopy(A, 'interactions', []);
    await settle();

    expect(localNotifications.getPending).not.toHaveBeenCalled();
  });

  it('does not re-plan for a copy written for another account', async () => {
    await writeLocalCopy(B, EVENTS_COPY_KIND, []);
    await settle();

    expect(localNotifications.getPending).not.toHaveBeenCalled();
    expect(localNotifications.schedule).not.toHaveBeenCalled();
  });

  it('does nothing once stopped', async () => {
    stop();

    setVisibility('visible');
    await writeLocalCopy(A, EVENTS_COPY_KIND, defaultCopies()[EVENTS_COPY_KIND]);
    await settle();

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
    await new Promise((resolve) => setTimeout(resolve, 20));
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
      await settleMs();
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

  it('does not plan the second time for an owner the store has left', async () => {
    await seedOneOfEachKind();
    const gate = deferred<void>();
    const run = scheduleDateRemindersAtLaunch(owner(), gate.promise);
    await vi.waitFor(() => expect(localNotifications.schedule).toHaveBeenCalledTimes(1));

    state().setAuthUser(B);
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
