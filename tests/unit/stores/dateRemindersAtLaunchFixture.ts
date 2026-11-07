/**
 * Mock-free helpers for the date-reminder re-plan test files
 * (`dateRemindersAtLaunch.test.ts` and `dateRemindersAtLaunch.triggers.test.ts`):
 * the identities, the saved date copies they seed, and readers for the plugin's
 * schedule calls. Each of those files keeps its own `vi.hoisted` values,
 * `vi.mock`s and hooks, and the helpers that read them (`restoreRefreshers`,
 * `emitAuth`).
 */
import { expect, vi } from 'vitest';
import { MAX_SCHEDULED_REMINDERS } from '../../../src/services/dateReminders';
import { openMyLoveDB } from '../../../src/services/dbSchema';
import { ALL_PUSH_PREFERENCES_ON } from '../../../src/services/pushPreferencesService';
import { registerLocalCopy, writeLocalCopy } from '../../../src/services/localCopy';
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

export const A = 'USER-A-ID';
export const B = 'USER-B-ID';
const P = 'PARTNER-ID';

// Vitest runs with TZ=America/New_York; local time throughout.
export const NOW = new Date(2026, 10, 1, 10, 0); // Sun 1 Nov 2026, 10:00

export function state() {
  return useAppStore.getState();
}

/** The identity of the start the store is on now, as App captures it. */
export function owner() {
  return { userId: state().userId!, authSessionVersion: state().authSessionVersion };
}

export async function clearCopies(): Promise<void> {
  const db = await openMyLoveDB();
  try {
    await db.clear('local-copies');
  } finally {
    db.close();
  }
}

export function savedEvent(label: string, date: string) {
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

export const DATE_KINDS = [
  EVENTS_COPY_KIND,
  ANNIVERSARIES_COPY_KIND,
  COUPLE_SETTINGS_COPY_KIND,
  PROFILE_COPY_KIND,
  PARTNER_COPY_KIND,
  REMINDERS_OFF_COPY_KIND,
  PUSH_PREFERENCES_COPY_KIND,
] as const;

export function partnerInfo(birthday: string | null = '1995-11-09') {
  return {
    id: P,
    email: 'jessie@test.example.com',
    displayName: 'Jessie',
    linkedSince: null,
    birthday,
  };
}

/** One date of each kind, 3 to 8 days ahead of `NOW`, as the saved copies; no Remind me is off and the Date reminders switch is on. */
export function defaultCopies(): Record<(typeof DATE_KINDS)[number], unknown> {
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
    [REMINDERS_OFF_COPY_KIND]: [],
    [PUSH_PREFERENCES_COPY_KIND]: { ...ALL_PUSH_PREFERENCES_ON },
  };
}

/** Writes the copies for A; `overrides` replaces a kind's value, `omit` leaves a kind unsaved. */
export async function seedCopies(
  overrides: Partial<Record<(typeof DATE_KINDS)[number], unknown>> = {},
  omit: readonly string[] = []
): Promise<void> {
  const copies = { ...defaultCopies(), ...overrides };
  for (const kind of DATE_KINDS) {
    if (!omit.includes(kind)) await writeLocalCopy(A, kind, copies[kind]);
  }
}

export const seedOneOfEachKind = () => seedCopies();

/** Replaces the seven date kinds' refreshers with spies that resolve at once; `hold` makes them wait on it. */
export function spyOnRefreshers(hold?: Promise<void>) {
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

/** The plugin's `schedule` mock, as far as the readers below look at it. */
type ScheduleMock = {
  mock: { calls: [options: { notifications: { title: string; schedule: unknown }[] }][] };
};

/** Readers for the file's `schedule` mock (a `vi.hoisted` value, so it is passed in). */
export function scheduleReaders(schedule: ScheduleMock) {
  /** The scheduled notifications as `title @ month/day hour:minute`. */
  function scheduledTitles(): string[] {
    expect(schedule).toHaveBeenCalledTimes(1);
    return titlesOfSchedule(0);
  }

  /** The `call`th schedule (0-based) as `title @ month/day hour:minute`, for runs that schedule more than once. */
  function titlesOfSchedule(call: number): string[] {
    const [options] = schedule.mock.calls[call];
    return options.notifications.map((n) => {
      const on = (n.schedule as { on: { month: number; day: number; hour: number; minute: number } }).on;
      return `${n.title} @ ${on.month}/${on.day} ${on.hour}:${String(on.minute).padStart(2, '0')}`;
    });
  }

  return { scheduledTitles, titlesOfSchedule };
}

/** Every id a date reminder can hold: what each re-plan cancels. */
export const ALL_REMINDER_IDS = Array.from({ length: MAX_SCHEDULED_REMINDERS }, (_, i) => ({ id: i + 1 }));
