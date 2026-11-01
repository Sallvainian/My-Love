import { beforeEach, describe, expect, it, vi } from 'vitest';

const capacitor = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => true),
  isPluginAvailable: vi.fn((_name: string) => true),
}));

const tapListeners = vi.hoisted(() => ({
  // The `localNotificationActionPerformed` callback the code under test registered.
  current: null as ((action: { actionId: string }) => void) | null,
}));

const localNotifications = vi.hoisted(() => ({
  getPending: vi.fn(() => Promise.resolve({ notifications: [] as { id: number }[] })),
  cancel: vi.fn((_options: unknown) => Promise.resolve()),
  checkPermissions: vi.fn(() => Promise.resolve({ display: 'granted' })),
  requestPermissions: vi.fn(() => Promise.resolve({ display: 'granted' })),
  schedule: vi.fn((_options: unknown) => Promise.resolve({ notifications: [] })),
  addListener: vi.fn((_event: string, listener: (action: { actionId: string }) => void) => {
    tapListeners.current = listener;
    return Promise.resolve({ remove: () => Promise.resolve() });
  }),
}));

// pushNotifications (the tap fan-out) loads these too.
vi.mock('@capacitor/core', () => ({ Capacitor: capacitor, registerPlugin: vi.fn(() => ({})) }));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: localNotifications }));
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: {} }));
vi.mock('../../api/supabaseClient', () => ({ supabase: {} }));

import { getNextAnniversaryDate, getNextBirthday, toBirthdayInfo } from '../../utils/countdownService';
import {
  MAX_SCHEDULED_REMINDERS,
  REMINDER_THREAD_ID,
  cancelDateReminders,
  hasNativeReminders,
  planDateReminders,
  scheduleDateReminders,
  type PlannedReminder,
  type ReminderDates,
} from '../dateReminders';

// Vitest runs with TZ=America/New_York. Local time throughout, as the app reads it.
const NOW = new Date(2026, 10, 1, 10, 0); // Sun 1 Nov 2026, 10:00
const EARLY = new Date(2026, 10, 1, 8, 0); // the same day before 9:00

const NO_DATES: ReminderDates = {
  events: [],
  anniversaries: [],
  relationshipStart: null,
  weddingDate: null,
  ownBirthday: null,
  partnerBirthday: null,
};

function plan(dates: Partial<ReminderDates>, now: Date = NOW): PlannedReminder[] {
  return planDateReminders({ ...NO_DATES, ...dates }, now);
}

/** `text` and the local `YYYY-M-D H:mm` of each reminder. */
function summary(reminders: PlannedReminder[]): string[] {
  return reminders.map(
    ({ text, on }) => `${text} @ ${on.year}-${on.month}-${on.day} ${on.hour}:${String(on.minute).padStart(2, '0')}`
  );
}

describe('planDateReminders', () => {
  describe('events', () => {
    it('plans only a day-before reminder, at 9:00 local', () => {
      const reminders = plan({ events: [{ label: 'Trip', date: new Date(2026, 10, 4) }] });

      expect(summary(reminders)).toEqual(['Tomorrow: Trip @ 2026-11-3 9:00']);
      expect(reminders[0].fireAt).toEqual(new Date(2026, 10, 3, 9, 0));
    });

    it('drops the day-before reminder once its moment has passed', () => {
      expect(plan({ events: [{ label: 'Trip', date: new Date(2026, 10, 2) }] })).toEqual([]);
    });

    it('keeps a day-before reminder that is still ahead earlier the same day', () => {
      expect(summary(plan({ events: [{ label: 'Trip', date: new Date(2026, 10, 2) }] }, EARLY))).toEqual([
        'Tomorrow: Trip @ 2026-11-1 9:00',
      ]);
    });

    it('plans nothing for an event today, and nothing for a past one', () => {
      expect(
        plan({
          events: [
            { label: 'Today', date: new Date(2026, 10, 1) },
            { label: 'Past', date: new Date(2026, 9, 1) },
          ],
        })
      ).toEqual([]);
    });

    it('skips an event whose date is not a date', () => {
      expect(plan({ events: [{ label: 'Broken', date: new Date('garbage') }] })).toEqual([]);
    });

    it('does not repeat a past event next year', () => {
      expect(plan({ events: [{ label: 'Trip', date: new Date(2026, 9, 20) }] })).toEqual([]);
    });
  });

  describe('anniversaries', () => {
    it('plans a day-before and an on-the-day reminder', () => {
      const reminders = plan({ anniversaries: [{ label: 'Dinner', date: '2020-11-06' }] });

      expect(summary(reminders)).toEqual([
        'Tomorrow: Dinner @ 2026-11-5 9:00',
        'Today: Dinner @ 2026-11-6 9:00',
      ]);
    });

    it('plans next year once this year has passed', () => {
      expect(summary(plan({ anniversaries: [{ label: 'Dinner', date: '2020-10-15' }] }))).toEqual([
        'Tomorrow: Dinner @ 2027-10-14 9:00',
        'Today: Dinner @ 2027-10-15 9:00',
      ]);
    });

    it('recurs yearly: a year later plans the following occurrence', () => {
      const later = new Date(2027, 10, 7, 10, 0);

      expect(summary(plan({ anniversaries: [{ label: 'Dinner', date: '2020-11-06' }] }, later))).toEqual([
        'Tomorrow: Dinner @ 2028-11-5 9:00',
        'Today: Dinner @ 2028-11-6 9:00',
      ]);
    });

    it('on the day before 9:00 plans only the on-the-day reminder', () => {
      expect(summary(plan({ anniversaries: [{ label: 'Dinner', date: '2020-11-01' }] }, EARLY))).toEqual([
        'Today: Dinner @ 2026-11-1 9:00',
      ]);
    });

    it('on the day after 9:00 plans nothing for it until the next launch', () => {
      expect(plan({ anniversaries: [{ label: 'Dinner', date: '2020-11-01' }] })).toEqual([]);
    });

    it('matches getNextAnniversaryDate for a leap-day anniversary in a non-leap year', () => {
      const now = new Date(2027, 1, 20, 10, 0);
      const next = getNextAnniversaryDate('2024-02-29', now);
      const reminders = plan({ anniversaries: [{ label: 'Leap', date: '2024-02-29' }] }, now);

      expect(next).toEqual(new Date(2027, 1, 28));
      expect(summary(reminders)).toEqual(['Tomorrow: Leap @ 2027-2-27 9:00', 'Today: Leap @ 2027-2-28 9:00']);
    });

    it('keeps 29 February in a leap year', () => {
      const now = new Date(2028, 1, 20, 10, 0);
      const next = getNextAnniversaryDate('2024-02-29', now);

      expect(next).toEqual(new Date(2028, 1, 29));
      expect(summary(plan({ anniversaries: [{ label: 'Leap', date: '2024-02-29' }] }, now))).toEqual([
        'Tomorrow: Leap @ 2028-2-28 9:00',
        'Today: Leap @ 2028-2-29 9:00',
      ]);
    });

    it('fires at 9:00 on the day the clocks change', () => {
      // US clocks go forward on 14 March 2027.
      const now = new Date(2027, 2, 1, 10, 0);
      const reminders = plan({ anniversaries: [{ label: 'Spring', date: '2020-03-14' }] }, now);

      expect(summary(reminders)).toEqual(['Tomorrow: Spring @ 2027-3-13 9:00', 'Today: Spring @ 2027-3-14 9:00']);
      expect(reminders[1].fireAt).toEqual(new Date(2027, 2, 14, 9, 0));
    });

    it('skips an unparseable date and a date that does not exist', () => {
      expect(
        plan({
          anniversaries: [
            { label: 'Garbage', date: 'garbage' },
            { label: 'Impossible', date: '2026-02-30' },
          ],
        })
      ).toEqual([]);
    });
  });

  describe('birthdays', () => {
    it('reads "You turn N" for an own birthday with no name', () => {
      expect(summary(plan({ ownBirthday: { name: null, birthday: '1996-11-06' } }))).toEqual([
        'Tomorrow: You turn 30 @ 2026-11-5 9:00',
        'Today: You turn 30 @ 2026-11-6 9:00',
      ]);
    });

    it('reads "{name} turns N" for a named own birthday and for the partner', () => {
      const reminders = plan({
        ownBirthday: { name: 'Casey', birthday: '1996-11-06' },
        partnerBirthday: { name: 'Jessie', birthday: '1995-11-08' },
      });

      expect(summary(reminders)).toEqual([
        'Tomorrow: Casey turns 30 @ 2026-11-5 9:00',
        'Today: Casey turns 30 @ 2026-11-6 9:00',
        'Tomorrow: Jessie turns 31 @ 2026-11-7 9:00',
        'Today: Jessie turns 31 @ 2026-11-8 9:00',
      ]);
    });

    it('names the age at the occurrence, which is next year once this year has passed', () => {
      expect(summary(plan({ partnerBirthday: { name: 'Jessie', birthday: '1995-10-15' } }))).toEqual([
        'Tomorrow: Jessie turns 32 @ 2027-10-14 9:00',
        'Today: Jessie turns 32 @ 2027-10-15 9:00',
      ]);
    });

    it('plans only the on-the-day reminder on the birthday before 9:00', () => {
      expect(summary(plan({ ownBirthday: { name: null, birthday: '1996-11-01' } }, EARLY))).toEqual([
        'Today: You turn 30 @ 2026-11-1 9:00',
      ]);
    });

    it('matches getNextBirthday for a leap-day birthday in a non-leap year: 1 March, unlike an anniversary', () => {
      const now = new Date(2027, 1, 20, 10, 0);
      const birthday = toBirthdayInfo('1996-02-29')!;

      expect(getNextBirthday(birthday, now)).toEqual(new Date(2027, 2, 1));
      expect(summary(plan({ ownBirthday: { name: null, birthday: '1996-02-29' } }, now))).toEqual([
        'Tomorrow: You turn 31 @ 2027-2-28 9:00',
        'Today: You turn 31 @ 2027-3-1 9:00',
      ]);
    });

    it('skips a birthday that is not set or cannot be read', () => {
      expect(
        plan({
          ownBirthday: { name: null, birthday: null },
          partnerBirthday: { name: 'Jessie', birthday: 'garbage' },
        })
      ).toEqual([]);
    });
  });

  describe('wedding', () => {
    it('plans "Wedding day" for a date ahead', () => {
      expect(summary(plan({ weddingDate: '2026-11-10' }))).toEqual([
        'Tomorrow: Wedding day @ 2026-11-9 9:00',
        'Today: Wedding day @ 2026-11-10 9:00',
      ]);
    });

    it('plans "Wedding day" for a date far ahead, once, not yearly', () => {
      expect(summary(plan({ weddingDate: '2027-06-19' }))).toEqual([
        'Tomorrow: Wedding day @ 2027-6-18 9:00',
        'Today: Wedding day @ 2027-6-19 9:00',
      ]);
    });

    it('plans only "Today: Wedding day" when the wedding is today before 9:00', () => {
      expect(summary(plan({ weddingDate: '2026-11-01' }, EARLY))).toEqual(['Today: Wedding day @ 2026-11-1 9:00']);
    });

    it('plans "Wedding anniversary" for the next year once the wedding has passed', () => {
      expect(summary(plan({ weddingDate: '2025-06-20' }))).toEqual([
        'Tomorrow: Wedding anniversary @ 2027-6-19 9:00',
        'Today: Wedding anniversary @ 2027-6-20 9:00',
      ]);
    });

    it('skips an unparseable wedding date', () => {
      expect(plan({ weddingDate: 'garbage' })).toEqual([]);
    });
  });

  describe('relationship start', () => {
    it('recurs on its local calendar date', () => {
      const relationshipStart = new Date(2020, 10, 6, 22, 30).toISOString();

      expect(summary(plan({ relationshipStart }))).toEqual([
        'Tomorrow: Our anniversary @ 2026-11-5 9:00',
        'Today: Our anniversary @ 2026-11-6 9:00',
      ]);
    });

    it('reads the date in the device time zone, not UTC', () => {
      // 02:30 UTC on 7 Nov is 21:30 on 6 Nov in New York.
      const relationshipStart = '2020-11-07T02:30:00.000Z';

      expect(summary(plan({ relationshipStart }))).toEqual([
        'Tomorrow: Our anniversary @ 2026-11-5 9:00',
        'Today: Our anniversary @ 2026-11-6 9:00',
      ]);
    });

    it('skips an occurrence on or before the start date itself', () => {
      const future = new Date(2026, 10, 6, 12, 0).toISOString();
      const today = new Date(2026, 10, 1, 7, 0).toISOString();

      expect(plan({ relationshipStart: future })).toEqual([]);
      expect(plan({ relationshipStart: today }, EARLY)).toEqual([]);
    });

    it('plans the first anniversary a year after the start', () => {
      const relationshipStart = new Date(2025, 10, 1, 7, 0).toISOString();

      expect(summary(plan({ relationshipStart }, EARLY))).toEqual(['Today: Our anniversary @ 2026-11-1 9:00']);
    });

    it('skips a start that is not a date', () => {
      expect(plan({ relationshipStart: 'garbage' })).toEqual([]);
    });
  });

  describe('order and limit', () => {
    it('sorts every kind by moment', () => {
      const reminders = plan({
        events: [{ label: 'Trip', date: new Date(2026, 10, 9) }],
        anniversaries: [{ label: 'Dinner', date: '2020-11-06' }],
        weddingDate: '2026-11-04',
        ownBirthday: { name: null, birthday: '1996-11-12' },
      });

      expect(summary(reminders)).toEqual([
        'Tomorrow: Wedding day @ 2026-11-3 9:00',
        'Today: Wedding day @ 2026-11-4 9:00',
        'Tomorrow: Dinner @ 2026-11-5 9:00',
        'Today: Dinner @ 2026-11-6 9:00',
        'Tomorrow: Trip @ 2026-11-8 9:00',
        'Tomorrow: You turn 30 @ 2026-11-11 9:00',
        'Today: You turn 30 @ 2026-11-12 9:00',
      ]);
      for (let i = 1; i < reminders.length; i++) {
        expect(reminders[i].fireAt.getTime()).toBeGreaterThanOrEqual(reminders[i - 1].fireAt.getTime());
      }
    });

    it('gives every reminder 9:00 as its calendar trigger', () => {
      const reminders = plan({
        events: [{ label: 'Trip', date: new Date(2026, 10, 9) }],
        anniversaries: [{ label: 'Dinner', date: '2020-11-06' }],
      });

      expect(reminders.map((r) => r.on)).toEqual([
        { year: 2026, month: 11, day: 5, hour: 9, minute: 0 },
        { year: 2026, month: 11, day: 6, hour: 9, minute: 0 },
        { year: 2026, month: 11, day: 8, hour: 9, minute: 0 },
      ]);
    });

    it('keeps the soonest 64 of 70 (50 events and 10 anniversaries)', () => {
      const day = (offset: number) => new Date(2026, 10, 1 + offset);
      const events = Array.from({ length: 50 }, (_, i) => ({ label: `Event ${i + 1}`, date: day(i + 2) }));
      const anniversaries = Array.from({ length: 10 }, (_, i) => {
        const date = day(i + 2);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return { label: `Anniversary ${i + 1}`, date: `2020-${month}-${String(date.getDate()).padStart(2, '0')}` };
      });
      // 50 day-before reminders (1..50 days ahead) + 10 pairs (1..10 and 2..11 days ahead).
      const expected = [
        ...events.map((_, i) => new Date(2026, 10, 1 + i + 1, 9, 0).getTime()),
        ...anniversaries.map((_, i) => new Date(2026, 10, 1 + i + 1, 9, 0).getTime()),
        ...anniversaries.map((_, i) => new Date(2026, 10, 1 + i + 2, 9, 0).getTime()),
      ].sort((a, b) => a - b);
      expect(expected).toHaveLength(70);

      const reminders = plan({ events, anniversaries });

      expect(reminders).toHaveLength(MAX_SCHEDULED_REMINDERS);
      expect(reminders.map((r) => r.fireAt.getTime())).toEqual(expected.slice(0, 64));
    });

    it('moves the cut on as now passes the earliest reminders', () => {
      const events = Array.from({ length: 70 }, (_, i) => ({
        label: `Event ${i + 1}`,
        date: new Date(2026, 10, 1 + i + 2),
      }));
      // Event N is due the day before, at 9:00: 70 reminders, one per day from 2 Nov.
      const first = plan({ events });
      expect(first).toHaveLength(MAX_SCHEDULED_REMINDERS);
      expect(first[0].text).toBe('Tomorrow: Event 1');
      expect(first.at(-1)?.text).toBe('Tomorrow: Event 64');

      // 3 Nov, 10:00: Events 1 and 2 are due and gone, so 65 and 66 move in.
      const later = plan({ events }, new Date(2026, 10, 3, 10, 0));
      expect(later).toHaveLength(MAX_SCHEDULED_REMINDERS);
      expect(later[0].text).toBe('Tomorrow: Event 3');
      expect(later.at(-1)?.text).toBe('Tomorrow: Event 66');
    });

    it('plans nothing without dates', () => {
      expect(plan({})).toEqual([]);
    });
  });
});

describe('hasNativeReminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capacitor.isNativePlatform.mockReturnValue(true);
    capacitor.isPluginAvailable.mockReturnValue(true);
  });

  it('is true on a native shell with the plugin', () => {
    expect(hasNativeReminders()).toBe(true);
    expect(capacitor.isPluginAvailable).toHaveBeenCalledWith('LocalNotifications');
  });

  it('is false on the web', () => {
    capacitor.isNativePlatform.mockReturnValue(false);

    expect(hasNativeReminders()).toBe(false);
  });

  it('is false in a shell without the plugin', () => {
    capacitor.isPluginAvailable.mockImplementation((name) => name !== 'LocalNotifications');

    expect(hasNativeReminders()).toBe(false);
  });
});

describe('scheduleDateReminders', () => {
  const reminders = plan({ anniversaries: [{ label: 'Dinner', date: '2020-11-06' }] });

  beforeEach(() => {
    vi.clearAllMocks();
    localNotifications.getPending.mockResolvedValue({ notifications: [] });
    localNotifications.cancel.mockResolvedValue(undefined);
    localNotifications.checkPermissions.mockResolvedValue({ display: 'granted' });
    localNotifications.schedule.mockResolvedValue({ notifications: [] });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('cancels every pending reminder, then schedules the list numbered from 1', async () => {
    localNotifications.getPending.mockResolvedValue({ notifications: [{ id: 7 }, { id: 9 }] });
    const order: string[] = [];
    localNotifications.cancel.mockImplementation(() => {
      order.push('cancel');
      return Promise.resolve();
    });
    localNotifications.schedule.mockImplementation(() => {
      order.push('schedule');
      return Promise.resolve({ notifications: [] });
    });

    await scheduleDateReminders(reminders, () => true);

    expect(localNotifications.cancel).toHaveBeenCalledWith({ notifications: [{ id: 7 }, { id: 9 }] });
    expect(localNotifications.schedule).toHaveBeenCalledWith({
      notifications: [
        {
          id: 1,
          title: 'Tomorrow: Dinner',
          body: '',
          threadIdentifier: 'partner-activity',
          schedule: { on: { year: 2026, month: 11, day: 5, hour: 9, minute: 0 } },
        },
        {
          id: 2,
          title: 'Today: Dinner',
          body: '',
          threadIdentifier: 'partner-activity',
          schedule: { on: { year: 2026, month: 11, day: 6, hour: 9, minute: 0 } },
        },
      ],
    });
    expect(order).toEqual(['cancel', 'schedule']);
  });

  it('does not call cancel when nothing is pending', async () => {
    await scheduleDateReminders(reminders, () => true);

    expect(localNotifications.cancel).not.toHaveBeenCalled();
    expect(localNotifications.schedule).toHaveBeenCalledTimes(1);
  });

  it.each(['prompt', 'prompt-with-rationale', 'denied'])(
    'cancels pending reminders but schedules nothing and never prompts when permission is %s',
    async (display) => {
      localNotifications.getPending.mockResolvedValue({ notifications: [{ id: 1 }] });
      localNotifications.checkPermissions.mockResolvedValue({ display });

      await scheduleDateReminders(reminders, () => true);

      expect(localNotifications.cancel).toHaveBeenCalledTimes(1);
      expect(localNotifications.schedule).not.toHaveBeenCalled();
      expect(localNotifications.requestPermissions).not.toHaveBeenCalled();
    }
  );

  it('cancels but does not schedule an empty plan', async () => {
    localNotifications.getPending.mockResolvedValue({ notifications: [{ id: 1 }] });

    await scheduleDateReminders([], () => true);

    expect(localNotifications.cancel).toHaveBeenCalledTimes(1);
    expect(localNotifications.schedule).not.toHaveBeenCalled();
  });

  it('makes no plugin call when the identity is already stale', async () => {
    await scheduleDateReminders(reminders, () => false);

    expect(localNotifications.getPending).not.toHaveBeenCalled();
    expect(localNotifications.cancel).not.toHaveBeenCalled();
    expect(localNotifications.checkPermissions).not.toHaveBeenCalled();
    expect(localNotifications.schedule).not.toHaveBeenCalled();
  });

  it.each([
    ['getPending', 1, ['getPending']],
    ['cancel', 2, ['getPending', 'cancel']],
    ['checkPermissions', 3, ['getPending', 'cancel', 'checkPermissions']],
  ])('stops after %s when the identity changes during it', async (_name, currentCalls, called) => {
    localNotifications.getPending.mockResolvedValue({ notifications: [{ id: 1 }] });
    let calls = 0;
    const isCurrent = () => ++calls <= currentCalls;

    await scheduleDateReminders(reminders, isCurrent);

    const seen = (
      [
        ['getPending', localNotifications.getPending],
        ['cancel', localNotifications.cancel],
        ['checkPermissions', localNotifications.checkPermissions],
      ] as const
    )
      .filter(([, fn]) => fn.mock.calls.length > 0)
      .map(([name]) => name);
    expect(seen).toEqual(called);
    expect(localNotifications.schedule).not.toHaveBeenCalled();
  });

  it('logs a rejecting plugin call instead of throwing', async () => {
    localNotifications.getPending.mockRejectedValue(new Error('boom'));

    await expect(scheduleDateReminders(reminders, () => true)).resolves.toBeUndefined();

    expect(console.error).toHaveBeenCalled();
    expect(localNotifications.schedule).not.toHaveBeenCalled();
  });

  it('logs a rejecting schedule instead of throwing', async () => {
    localNotifications.schedule.mockRejectedValue(new Error('boom'));

    await expect(scheduleDateReminders(reminders, () => true)).resolves.toBeUndefined();

    expect(console.error).toHaveBeenCalled();
  });
});

describe('scheduleDateReminders thread id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localNotifications.getPending.mockResolvedValue({ notifications: [] });
    localNotifications.checkPermissions.mockResolvedValue({ display: 'granted' });
    localNotifications.schedule.mockResolvedValue({ notifications: [] });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('stamps every scheduled reminder with thread id partner-activity', async () => {
    const reminders = plan({
      anniversaries: [{ label: 'Dinner', date: '2020-11-06' }],
      events: [{ label: 'Trip', date: new Date(2026, 10, 9) }],
    });
    expect(reminders.length).toBeGreaterThan(1);

    await scheduleDateReminders(reminders, () => true);

    const [options] = localNotifications.schedule.mock.calls[0] as [
      { notifications: { threadIdentifier?: string }[] },
    ];
    expect(options.notifications).toHaveLength(reminders.length);
    expect(options.notifications.map((n) => n.threadIdentifier)).toEqual(
      reminders.map(() => 'partner-activity')
    );
    expect(REMINDER_THREAD_ID).toBe('partner-activity');
  });
});

describe('cancelDateReminders', () => {
  const allIds = Array.from({ length: MAX_SCHEDULED_REMINDERS }, (_, i) => ({ id: i + 1 }));

  beforeEach(() => {
    vi.clearAllMocks();
    capacitor.isNativePlatform.mockReturnValue(true);
    capacitor.isPluginAvailable.mockReturnValue(true);
    localNotifications.getPending.mockResolvedValue({ notifications: [] });
    localNotifications.cancel.mockResolvedValue(undefined);
    localNotifications.checkPermissions.mockResolvedValue({ display: 'granted' });
    localNotifications.schedule.mockResolvedValue({ notifications: [] });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it.each([
    ['on the web', () => capacitor.isNativePlatform.mockReturnValue(false)],
    [
      'in a shell without the plugin',
      () => capacitor.isPluginAvailable.mockImplementation((name) => name !== 'LocalNotifications'),
    ],
  ])('does nothing %s', async (_name, arrange) => {
    arrange();

    await cancelDateReminders();

    expect(localNotifications.getPending).not.toHaveBeenCalled();
    expect(localNotifications.cancel).not.toHaveBeenCalled();
  });

  it('cancels ids 1..64 when nothing is pending', async () => {
    await cancelDateReminders();

    expect(localNotifications.cancel).toHaveBeenCalledTimes(1);
    expect(localNotifications.cancel).toHaveBeenCalledWith({ notifications: allIds });
  });

  it('cancels the union of ids 1..64 and every pending id', async () => {
    localNotifications.getPending.mockResolvedValue({ notifications: [{ id: 7 }, { id: 65 }, { id: 900 }] });

    await cancelDateReminders();

    expect(localNotifications.cancel).toHaveBeenCalledWith({
      notifications: [...allIds, { id: 65 }, { id: 900 }],
    });
  });

  it('still cancels ids 1..64 when the pending list cannot be read, and logs it', async () => {
    localNotifications.getPending.mockRejectedValue(new Error('boom'));

    await expect(cancelDateReminders()).resolves.toBeUndefined();

    expect(localNotifications.cancel).toHaveBeenCalledWith({ notifications: allIds });
    expect(console.error).toHaveBeenCalled();
  });

  it('logs a rejected cancel instead of throwing', async () => {
    localNotifications.cancel.mockRejectedValue(new Error('boom'));

    await expect(cancelDateReminders()).resolves.toBeUndefined();

    expect(console.error).toHaveBeenCalledWith(
      '[DateReminders] Could not cancel the date reminders:',
      expect.any(Error)
    );
  });

  it('runs after a schedule that is in flight, not between its calls', async () => {
    const order: string[] = [];
    let finishSchedule: () => void = () => {};
    localNotifications.schedule.mockImplementation(() => {
      order.push('schedule:start');
      return new Promise((resolve) => {
        finishSchedule = () => {
          order.push('schedule:end');
          resolve({ notifications: [] });
        };
      });
    });
    localNotifications.cancel.mockImplementation(() => {
      order.push('cancel');
      return Promise.resolve();
    });
    const reminders = plan({ anniversaries: [{ label: 'Dinner', date: '2020-11-06' }] });

    const scheduled = scheduleDateReminders(reminders, () => true);
    await vi.waitFor(() => expect(order).toEqual(['schedule:start']));
    const cancelled = cancelDateReminders();
    // Let the cancel's turn come round: it must still be waiting.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(order).toEqual(['schedule:start']);

    finishSchedule();
    await Promise.all([scheduled, cancelled]);

    expect(order).toEqual(['schedule:start', 'schedule:end', 'cancel']);
  });

  it('keeps the chain going after a failed run', async () => {
    localNotifications.getPending.mockRejectedValueOnce(new Error('boom'));
    const reminders = plan({ anniversaries: [{ label: 'Dinner', date: '2020-11-06' }] });

    await scheduleDateReminders(reminders, () => true);
    await cancelDateReminders();

    expect(localNotifications.cancel).toHaveBeenCalledTimes(1);
  });
});

describe('listenForReminderTaps', () => {
  // The listener and the held tap are module state: each case loads fresh modules.
  async function load() {
    vi.resetModules();
    const reminders = await import('../dateReminders');
    const push = await import('../pushNotifications');
    return { listenForReminderTaps: reminders.listenForReminderTaps, onPushTap: push.onPushTap };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    tapListeners.current = null;
    capacitor.isNativePlatform.mockReturnValue(true);
    capacitor.isPluginAvailable.mockReturnValue(true);
    localNotifications.addListener.mockImplementation((_event, listener) => {
      tapListeners.current = listener;
      return Promise.resolve({ remove: () => Promise.resolve() });
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('routes a warm tap to Home for every onPushTap handler', async () => {
    const { listenForReminderTaps, onPushTap } = await load();
    const handler = vi.fn();
    onPushTap(handler);
    await listenForReminderTaps();

    expect(localNotifications.addListener).toHaveBeenCalledWith(
      'localNotificationActionPerformed',
      expect.any(Function)
    );
    tapListeners.current!({ actionId: 'tap' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('home');
  });

  it('holds a cold-start tap until a handler subscribes, then delivers it once', async () => {
    const { listenForReminderTaps, onPushTap } = await load();
    await listenForReminderTaps();

    tapListeners.current!({ actionId: 'tap' });
    const first = vi.fn();
    onPushTap(first);
    const second = vi.fn();
    onPushTap(second);

    expect(first).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledWith('home');
    expect(second).not.toHaveBeenCalled();
  });

  it.each(['dismiss', 'snooze'])('ignores actionId %s', async (actionId) => {
    const { listenForReminderTaps, onPushTap } = await load();
    const handler = vi.fn();
    onPushTap(handler);
    await listenForReminderTaps();

    tapListeners.current!({ actionId });
    const late = vi.fn();
    onPushTap(late);

    expect(handler).not.toHaveBeenCalled();
    expect(late).not.toHaveBeenCalled();
  });

  it('adds the listener once however often it is called', async () => {
    const { listenForReminderTaps } = await load();

    await listenForReminderTaps();
    await listenForReminderTaps();

    expect(localNotifications.addListener).toHaveBeenCalledTimes(1);
  });

  it('retries after a failed add, and logs the failure', async () => {
    const { listenForReminderTaps } = await load();
    localNotifications.addListener.mockRejectedValueOnce(new Error('bridge gone'));

    await expect(listenForReminderTaps()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
    await listenForReminderTaps();

    expect(localNotifications.addListener).toHaveBeenCalledTimes(2);
    expect(tapListeners.current).not.toBeNull();
  });

  it.each([
    ['on the web', () => capacitor.isNativePlatform.mockReturnValue(false)],
    [
      'in a shell without the plugin',
      () => capacitor.isPluginAvailable.mockImplementation((name) => name !== 'LocalNotifications'),
    ],
  ])('adds no listener %s', async (_name, arrange) => {
    const { listenForReminderTaps } = await load();
    arrange();

    await listenForReminderTaps();

    expect(localNotifications.addListener).not.toHaveBeenCalled();
  });
});
