import { describe, expect, it, vi } from 'vitest';

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
  MARK_KEYS,
  MAX_SCHEDULED_REMINDERS,
  planDateReminders,
  reminderDatesFrom,
  type PlannedReminder,
} from '../dateReminders';
import { NOW, plan } from './dateRemindersKit';

const EARLY = new Date(2026, 10, 1, 8, 0); // the same day before 9:00

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

    it('on the day after 9:00 plans next year\'s occurrence', () => {
      expect(summary(plan({ anniversaries: [{ label: 'Dinner', date: '2020-11-01' }] }))).toEqual([
        'Tomorrow: Dinner @ 2027-10-31 9:00',
        'Today: Dinner @ 2027-11-1 9:00',
      ]);
    });

    it('at exactly 9:00 on the day plans next year\'s occurrence', () => {
      expect(
        summary(plan({ anniversaries: [{ label: 'Dinner', date: '2020-11-01' }] }, new Date(2026, 10, 1, 9, 0)))
      ).toEqual(['Tomorrow: Dinner @ 2027-10-31 9:00', 'Today: Dinner @ 2027-11-1 9:00']);
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

    it('on the birthday before 9:00 plans this year\'s, after 9:00 next year\'s with the next age', () => {
      const birthday = { ownBirthday: { name: 'Casey', birthday: '1996-11-01' } };

      expect(summary(plan(birthday, EARLY))).toEqual(['Today: Casey turns 30 @ 2026-11-1 9:00']);
      expect(summary(plan(birthday))).toEqual([
        'Tomorrow: Casey turns 31 @ 2027-10-31 9:00',
        'Today: Casey turns 31 @ 2027-11-1 9:00',
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

    it('plans next year\'s "Wedding anniversary" when the wedding is today after 9:00', () => {
      expect(summary(plan({ weddingDate: '2026-11-01' }))).toEqual([
        'Tomorrow: Wedding anniversary @ 2027-10-31 9:00',
        'Today: Wedding anniversary @ 2027-11-1 9:00',
      ]);
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

  describe('marked dates', () => {
    const TRIP = MARK_KEYS.event('event-Trip');

    it('adds In a month and In a week for an event 40 days ahead, beside Tomorrow', () => {
      const reminders = plan({
        events: [{ label: 'Trip', date: new Date(2026, 11, 11) }],
        marks: [TRIP],
      });

      expect(summary(reminders)).toEqual([
        'In a month: Trip @ 2026-11-11 9:00',
        'In a week: Trip @ 2026-12-4 9:00',
        'Tomorrow: Trip @ 2026-12-10 9:00',
      ]);
      expect(reminders[0].fireAt).toEqual(new Date(2026, 10, 11, 9, 0));
      expect(reminders[0].on).toEqual({ year: 2026, month: 11, day: 11, hour: 9, minute: 0 });
    });

    it('drops the month and week reminders that are already past (5 days ahead)', () => {
      const relationshipStart = new Date(2020, 10, 6, 22, 30).toISOString();

      expect(summary(plan({ relationshipStart, marks: [MARK_KEYS.relationshipStart] }))).toEqual([
        'Tomorrow: Our anniversary @ 2026-11-5 9:00',
        'Today: Our anniversary @ 2026-11-6 9:00',
      ]);
    });

    it('keeps only In a week for a date 10 days ahead', () => {
      expect(
        summary(
          plan({
            anniversaries: [{ label: 'Dinner', date: '2020-11-11', serverId: 'ann-1' }],
            marks: [MARK_KEYS.anniversary('ann-1')],
          })
        )
      ).toEqual([
        'In a week: Dinner @ 2026-11-4 9:00',
        'Tomorrow: Dinner @ 2026-11-10 9:00',
        'Today: Dinner @ 2026-11-11 9:00',
      ]);
    });

    it('keeps an In a month reminder that is still ahead earlier the same day', () => {
      // 9:00 on 1 Nov is the moment, so at 08:00 it is still ahead.
      expect(
        summary(
          plan({ events: [{ label: 'Trip', date: new Date(2026, 11, 1) }], marks: [TRIP] }, EARLY)
        )
      ).toEqual([
        'In a month: Trip @ 2026-11-1 9:00',
        'In a week: Trip @ 2026-11-24 9:00',
        'Tomorrow: Trip @ 2026-11-30 9:00',
      ]);
    });

    it('plans an unmarked date exactly as before', () => {
      const dates = {
        events: [{ label: 'Trip', date: new Date(2026, 11, 11) }],
        anniversaries: [{ label: 'Dinner', date: '2020-11-11', serverId: 'ann-1' }],
        weddingDate: '2026-12-20',
        ownBirthday: { name: null, birthday: '1996-12-24' },
      };

      expect(plan({ ...dates, marks: [] })).toEqual(plan({ ...dates, marks: ['event:other'] }));
      expect(summary(plan({ ...dates, marks: [] })).some((line) => line.startsWith('In a'))).toBe(false);
    });

    it('ignores a mark that matches no current date', () => {
      const reminders = plan({
        events: [{ label: 'Trip', date: new Date(2026, 11, 11) }],
        marks: ['event:deleted-event', 'anniversary:deleted', MARK_KEYS.wedding, 'garbage'],
      });

      expect(summary(reminders)).toEqual(['Tomorrow: Trip @ 2026-12-10 9:00']);
    });

    it('gives an anniversary with no serverId no month and week reminders', () => {
      const reminders = plan({
        anniversaries: [{ label: 'Dinner', date: '2020-12-20' }],
        marks: ['anniversary:undefined', 'anniversary:', 'anniversary:ann-1'],
      });

      expect(summary(reminders)).toEqual([
        'Tomorrow: Dinner @ 2026-12-19 9:00',
        'Today: Dinner @ 2026-12-20 9:00',
      ]);
    });

    it('clamps the month-before day to the last day of a shorter month', () => {
      // 31 March 2027: February has 28 days.
      expect(
        summary(plan({ events: [{ label: 'Trip', date: new Date(2027, 2, 31) }], marks: [TRIP] }))
      ).toEqual([
        'In a month: Trip @ 2027-2-28 9:00',
        'In a week: Trip @ 2027-3-24 9:00',
        'Tomorrow: Trip @ 2027-3-30 9:00',
      ]);
      // 31 March 2028: February has 29 days.
      expect(
        summary(
          plan({ events: [{ label: 'Trip', date: new Date(2028, 2, 31) }], marks: [TRIP] }, new Date(2028, 0, 2))
        )[0]
      ).toBe('In a month: Trip @ 2028-2-29 9:00');
      // 31 December: November has 30 days.
      expect(
        summary(plan({ events: [{ label: 'Trip', date: new Date(2026, 11, 31) }], marks: [TRIP] }))[0]
      ).toBe('In a month: Trip @ 2026-11-30 9:00');
    });

    it('takes the month before across a year boundary', () => {
      expect(
        summary(
          plan({ events: [{ label: 'Trip', date: new Date(2027, 0, 15) }], marks: [TRIP] }, new Date(2026, 10, 20))
        )[0]
      ).toBe('In a month: Trip @ 2026-12-15 9:00');
    });

    it('uses the next occurrence of a yearly date', () => {
      // 15 October has passed this year, so the occurrence is 15 October 2027.
      expect(
        summary(
          plan({
            anniversaries: [{ label: 'Dinner', date: '2020-10-15', serverId: 'ann-1' }],
            marks: [MARK_KEYS.anniversary('ann-1')],
          })
        )
      ).toEqual([
        'In a month: Dinner @ 2027-9-15 9:00',
        'In a week: Dinner @ 2027-10-8 9:00',
        'Tomorrow: Dinner @ 2027-10-14 9:00',
        'Today: Dinner @ 2027-10-15 9:00',
      ]);
    });

    it('marks the relationship start under its own key', () => {
      const relationshipStart = new Date(2020, 11, 20, 22, 30).toISOString();

      expect(summary(plan({ relationshipStart, marks: [MARK_KEYS.relationshipStart] }))).toEqual([
        'In a month: Our anniversary @ 2026-11-20 9:00',
        'In a week: Our anniversary @ 2026-12-13 9:00',
        'Tomorrow: Our anniversary @ 2026-12-19 9:00',
        'Today: Our anniversary @ 2026-12-20 9:00',
      ]);
    });

    it('marks the wedding, before and after the day', () => {
      const marks = [MARK_KEYS.wedding];

      expect(summary(plan({ weddingDate: '2026-12-20', marks }))).toEqual([
        'In a month: Wedding day @ 2026-11-20 9:00',
        'In a week: Wedding day @ 2026-12-13 9:00',
        'Tomorrow: Wedding day @ 2026-12-19 9:00',
        'Today: Wedding day @ 2026-12-20 9:00',
      ]);
      expect(summary(plan({ weddingDate: '2020-12-20', marks }))).toEqual([
        'In a month: Wedding anniversary @ 2026-11-20 9:00',
        'In a week: Wedding anniversary @ 2026-12-13 9:00',
        'Tomorrow: Wedding anniversary @ 2026-12-19 9:00',
        'Today: Wedding anniversary @ 2026-12-20 9:00',
      ]);
    });

    it('marks each birthday on its own and names them as the day-before reminder does', () => {
      const dates = {
        ownBirthday: { name: null, birthday: '1996-12-24' },
        partnerBirthday: { name: 'Jessie', birthday: '1995-12-26' },
      };

      expect(summary(plan({ ...dates, marks: [MARK_KEYS.ownBirthday] }))).toEqual([
        'In a month: You turn 30 @ 2026-11-24 9:00',
        'In a week: You turn 30 @ 2026-12-17 9:00',
        'Tomorrow: You turn 30 @ 2026-12-23 9:00',
        'Today: You turn 30 @ 2026-12-24 9:00',
        'Tomorrow: Jessie turns 31 @ 2026-12-25 9:00',
        'Today: Jessie turns 31 @ 2026-12-26 9:00',
      ]);
      expect(summary(plan({ ...dates, marks: [MARK_KEYS.partnerBirthday] })).filter((l) => l.startsWith('In a'))).toEqual([
        'In a month: Jessie turns 31 @ 2026-11-26 9:00',
        'In a week: Jessie turns 31 @ 2026-12-19 9:00',
      ]);
    });

    it('cuts to the soonest 64 across the month and week reminders too', () => {
      const day = (offset: number) => new Date(2026, 10, 1 + offset);
      // 20 marked events 40..59 days ahead (3 reminders each) and 10 unmarked ones 2..11 days ahead.
      const marked = Array.from({ length: 20 }, (_, i) => ({ label: `Marked ${i}`, date: day(40 + i) }));
      const unmarked = Array.from({ length: 10 }, (_, i) => ({ label: `Plain ${i}`, date: day(2 + i) }));
      const expected = [
        ...marked.flatMap((_, i) => [
          new Date(2026, 10, 11 + i, 9, 0).getTime(), // the month before: 11 Nov..30 Nov
          day(40 + i - 7).setHours(9, 0, 0, 0),
          day(40 + i - 1).setHours(9, 0, 0, 0),
        ]),
        ...unmarked.map((_, i) => day(2 + i - 1).setHours(9, 0, 0, 0)),
      ].sort((a, b) => a - b);
      expect(expected).toHaveLength(70);

      const reminders = plan({
        events: [...unmarked, ...marked],
        marks: marked.map((event) => MARK_KEYS.event(`event-${event.label}`)),
      });

      expect(reminders).toHaveLength(MAX_SCHEDULED_REMINDERS);
      expect(reminders.map((r) => r.fireAt.getTime())).toEqual(expected.slice(0, 64));
    });
  });

  describe('the Settings switch', () => {
    const TRIP = MARK_KEYS.event('event-Trip');
    const input: PlanInput = {
      events: [{ label: 'Trip', date: new Date(2026, 11, 11) }],
      anniversaries: [{ label: 'Dinner', date: '2020-11-06', serverId: 'a1' }],
      relationshipStart: new Date(2020, 10, 6, 22, 30).toISOString(),
      weddingDate: '2027-06-12',
      ownBirthday: { name: 'Casey', birthday: '1996-12-24' },
      partnerBirthday: { name: 'Jessie', birthday: '1995-12-26' },
      marks: [TRIP, MARK_KEYS.ownBirthday],
    };

    it('plans nothing when it is off, even with marked and far dates', () => {
      expect(plan({ ...input, remindersOn: false })).toEqual([]);
    });

    it('plans the same reminders as before when it is on', () => {
      const on = plan({ ...input, remindersOn: true });
      expect(on.length).toBeGreaterThan(0);
      expect(on).toEqual(plan(input));
      expect(summary(on)).toContain('In a month: Trip @ 2026-11-11 9:00');
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

    it('reads the mark keys of every kind of date: marking all seven marks every date far enough ahead', () => {
      const dates = {
        events: [
          { id: 'e1', label: 'Trip', date: new Date(2026, 11, 11) },
          { id: 'e2', label: 'Move', date: new Date(2027, 0, 5) },
        ],
        anniversaries: [
          { label: 'Dinner', date: '2020-11-06', serverId: 'a1' },
          { label: 'Not saved yet', date: '2020-11-07' },
          { label: 'Garbage', date: 'garbage', serverId: 'a3' },
        ],
        relationshipStart: new Date(2020, 10, 6, 22, 30).toISOString(),
        weddingDate: '2026-12-20',
        ownBirthday: { name: 'Casey', birthday: '1996-12-24' },
        partnerBirthday: { name: 'Jessie', birthday: '1995-12-26' },
      };
      const keys = [
        'event:e1',
        'event:e2',
        'anniversary:a1',
        'relationship-start',
        'wedding',
        'own-birthday',
        'partner-birthday',
      ];
      const marked = planDateReminders({ ...dates, marks: new Set(keys), remindersOn: true }, NOW);

      // Dinner and Our anniversary are 5 days ahead, so their month and week reminders are already past.
      expect(marked.filter((r) => r.text.startsWith('In a month')).map((r) => r.text)).toEqual([
        'In a month: Trip',
        'In a month: Wedding day',
        'In a month: Casey turns 30',
        'In a month: Jessie turns 31',
        'In a month: Move',
      ]);
      expect(marked.filter((r) => r.text.startsWith('In a week')).map((r) => r.text)).toEqual([
        'In a week: Trip',
        'In a week: Wedding day',
        'In a week: Casey turns 30',
        'In a week: Jessie turns 31',
        'In a week: Move',
      ]);
    });
  });
});

describe('reminderDatesFrom', () => {
  const sources = {
    events: [{ id: 'e1', label: 'Trip', date: new Date(2026, 11, 11) }],
    anniversaries: [{ label: 'Dinner', date: '2020-11-06', serverId: 'a1' }],
    coupleSettings: {
      status: 'linked',
      relationshipStart: '2020-11-06T22:30:00.000Z',
      weddingDate: '2026-12-20',
    },
    ownProfile: { displayName: 'Casey', birthday: '1996-12-24' },
    partner: { displayName: 'Jessie', birthday: '1995-12-26' },
  };

  it('reads the start and wedding from linked couple settings', () => {
    expect(reminderDatesFrom(sources)).toEqual({
      events: sources.events,
      anniversaries: sources.anniversaries,
      relationshipStart: '2020-11-06T22:30:00.000Z',
      weddingDate: '2026-12-20',
      ownBirthday: { name: 'Casey', birthday: '1996-12-24' },
      partnerBirthday: { name: 'Jessie', birthday: '1995-12-26' },
    });
  });

  it('has no start or wedding when the couple is unlinked or not loaded', () => {
    for (const coupleSettings of [{ status: 'unlinked' }, null]) {
      const built = reminderDatesFrom({ ...sources, coupleSettings });
      expect(built.relationshipStart).toBeNull();
      expect(built.weddingDate).toBeNull();
    }
  });

  it('has no birthday for a missing profile or partner', () => {
    const built = reminderDatesFrom({ ...sources, ownProfile: null, partner: null });
    expect(built.ownBirthday).toBeNull();
    expect(built.partnerBirthday).toBeNull();
  });

  it('keeps a person with no birthday set as a birthday with a null date', () => {
    const built = reminderDatesFrom({ ...sources, ownProfile: { displayName: null, birthday: null } });
    expect(built.ownBirthday).toEqual({ name: null, birthday: null });
  });
});
