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

vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: localNotifications }));

vi.mock('../../../src/services/dateReminders', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/services/dateReminders')>()),
  cancelDateReminders: cancelSpy,
}));

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
  lookupPartnerId: vi.fn(),
  isSeedFallbackName: () => false,
}));

vi.mock('../../../src/services/localCopy', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../src/services/localCopy')>();
  return {
    ...original,
    readLocalCopy: (...args: Parameters<typeof original.readLocalCopy>) => {
      readLocalCopySpy(...args);
      if (args[1] === readFailure.kind) return Promise.resolve(null);
      return original.readLocalCopy(...args);
    },
  };
});

import { Capacitor } from '@capacitor/core';
import { partnerService } from '../../../src/api/partnerService';
import {
  replanDateReminders,
  scheduleDateRemindersAtLaunch,
  startDateReminderTriggers,
} from '../../../src/services/dateRemindersAtLaunch';
import { MAX_SCHEDULED_REMINDERS } from '../../../src/services/dateReminders';
import { openMyLoveDB } from '../../../src/services/dbSchema';
import { ALL_PUSH_PREFERENCES_ON } from '../../../src/services/pushPreferencesService';
import { anniversariesService } from '../../../src/services/anniversariesService';
import { refreshLocalCopy, writeLocalCopy } from '../../../src/services/localCopy';
import { EVENTS_COPY_KIND } from '../../../src/stores/slices/eventsSlice';
import { PARTNER_COPY_KIND } from '../../../src/stores/slices/partnerSlice';
import {
  ANNIVERSARIES_COPY_KIND,
  COUNTDOWN_MARKS_COPY_KIND,
  COUPLE_SETTINGS_COPY_KIND,
  PROFILE_COPY_KIND,
  PUSH_PREFERENCES_COPY_KIND,
} from '../../../src/stores/slices/settingsSlice';
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
    connectedAt: null,
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
  const [options] = localNotifications.schedule.mock.calls[0];
  return options.notifications.map((n) => {
    const on = (n.schedule as { on: { month: number; day: number; hour: number; minute: number } }).on;
    return `${n.title} @ ${on.month}/${on.day} ${on.hour}:${String(on.minute).padStart(2, '0')}`;
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
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

  it('keeps the other push switches out of it: only dateReminders decides', async () => {
    await seedCopies({
      [PUSH_PREFERENCES_COPY_KIND]: { ...ALL_PUSH_PREFERENCES_ON, dates: false, loveNotes: false },
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

  beforeEach(async () => {
    await seedOneOfEachKind();
    stop = startDateReminderTriggers();
  });

  afterEach(async () => {
    stop();
    await settle();
  });

  it('re-plans when the app returns to the foreground, and not when it is hidden', async () => {
    setVisibility('hidden');
    await settle();
    expect(localNotifications.getPending).not.toHaveBeenCalled();

    setVisibility('visible');
    await scheduledTimes(1);

    expect(localNotifications.getPending).toHaveBeenCalledTimes(1);
    expect(scheduledTitles()).toContain('Today: Wedding day @ 11/7 9:00');
  });

  it('re-plans on every return to the foreground, from the copies and not the server', async () => {
    const getPartner = vi.spyOn(partnerService, 'getPartner');
    const fetchAnniversaries = vi.spyOn(anniversariesService, 'fetchAnniversaries');
    setVisibility('visible');
    await scheduledTimes(1);
    setVisibility('visible');
    await scheduledTimes(2);

    expect(localNotifications.getPending).toHaveBeenCalledTimes(2);
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
    localNotifications.getPending.mockRejectedValueOnce(new Error('bridge gone'));

    setVisibility('visible');
    await vi.waitFor(() => expect(console.error).toHaveBeenCalled());
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
    readLocalCopySpy.mockClear();

    const stop = startDateReminderTriggers();
    document.dispatchEvent(new Event('visibilitychange'));
    await writeLocalCopy(A, EVENTS_COPY_KIND, []);
    await new Promise((resolve) => setTimeout(resolve, 20));
    stop();

    expect(addListener).not.toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(readLocalCopySpy).not.toHaveBeenCalled();
    expect(localNotifications.getPending).not.toHaveBeenCalled();
  });
});
