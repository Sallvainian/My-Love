/**
 * The launch step for date reminders (story 4.1): a real store, a real events
 * copy in fake-indexeddb, and the Capacitor plugin mocked.
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

vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: localNotifications }));

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
      return original.readLocalCopy(...args);
    },
  };
});

import { Capacitor } from '@capacitor/core';
import { scheduleDateRemindersAtLaunch } from '../../../src/services/dateRemindersAtLaunch';
import { openMyLoveDB } from '../../../src/services/dbSchema';
import { writeLocalCopy } from '../../../src/services/localCopy';
import { EVENTS_COPY_KIND } from '../../../src/stores/slices/eventsSlice';
import { useAppStore } from '../../../src/stores/useAppStore';
import { setAnniversaries, setOnline, type StoreState } from './accountDataFixtures';

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

/** One date of each kind, 3 to 8 days ahead of `NOW`. */
async function seedOneOfEachKind(): Promise<void> {
  await writeLocalCopy(A, EVENTS_COPY_KIND, [savedEvent('Trip', '2026-11-04')]);
  setAnniversaries([{ id: 1, date: '2021-11-05', label: 'Dinner' }]);
  useAppStore.setState({
    coupleSettings: {
      status: 'linked',
      partnerId: P,
      relationshipStart: new Date(2018, 10, 6, 20, 0).toISOString(),
      weddingDate: '2026-11-07',
    },
    ownProfile: { displayName: null, birthday: '1996-11-08' },
    partner: {
      id: P,
      email: 'jessie@test.example.com',
      displayName: 'Jessie',
      connectedAt: null,
      birthday: '1995-11-09',
    },
  } as StoreState);
}

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
  it('schedules one date of each kind from the saved events copy and the store', async () => {
    await seedOneOfEachKind();

    await scheduleDateRemindersAtLaunch(owner());

    expect(localNotifications.cancel).not.toHaveBeenCalled();
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

  it('names an own birthday after a chosen display name', async () => {
    await seedOneOfEachKind();
    useAppStore.setState({
      ownProfile: { displayName: 'Casey', birthday: '1996-11-08' },
    } as StoreState);

    await scheduleDateRemindersAtLaunch(owner());

    expect(scheduledTitles()).toContain('Today: Casey turns 30 @ 11/8 9:00');
  });

  it('plans the other dates when there is no saved events copy', async () => {
    await seedOneOfEachKind();
    await clearCopies();

    await scheduleDateRemindersAtLaunch(owner());

    expect(scheduledTitles()).not.toContain('Tomorrow: Trip @ 11/3 9:00');
    expect(scheduledTitles()).toContain('Today: Wedding day @ 11/7 9:00');
  });

  it('ignores the couple settings of an unlinked account but plans its own dates', async () => {
    setAnniversaries([{ id: 1, date: '2021-11-05', label: 'Dinner' }]);
    useAppStore.setState({
      coupleSettings: { status: 'unlinked' },
      ownProfile: { displayName: null, birthday: '1996-11-08' },
    } as StoreState);

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

    expect(localNotifications.cancel).toHaveBeenCalledWith({ notifications: [{ id: 3 }] });
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
