import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { TestInfo } from '@playwright/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventDateFrom } from '../../support/factories/events';
import {
  clockAnchor,
  clockAnchorAvoidingLeapDay,
  isoBirthdayDaysFromNow,
  isoDateDaysFromNow,
  msUntilClearOfDailyTurns,
  msUntilClearOfReminderTicks,
  waitClearOfDailyTurns,
  waitClearOfReminderTicks,
} from '../../support/helpers/events';

describe('isoDateDaysFromNow', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-19T23:30:00-04:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps a batch anchored to its original day when the clock crosses local midnight', () => {
    vi.setSystemTime(new Date('2026-08-19T23:59:59-04:00'));
    const anchor = new Date();
    const anchorTimestamp = anchor.getTime();

    expect(isoDateDaysFromNow(-1, anchor)).toBe('2026-08-18');
    expect(isoDateDaysFromNow(0, anchor)).toBe('2026-08-19');
    expect(isoDateDaysFromNow(2, anchor)).toBe('2026-08-21');

    vi.setSystemTime(new Date('2026-08-20T00:00:01-04:00'));
    expect(new Date().getDate()).toBe(20);

    expect(isoDateDaysFromNow(-1, anchor)).toBe('2026-08-18');
    expect(isoDateDaysFromNow(0, anchor)).toBe('2026-08-19');
    expect(isoDateDaysFromNow(2, anchor)).toBe('2026-08-21');
    expect(anchor.getTime()).toBe(anchorTimestamp);
  });

  it('has no live-clock fallback: a call without an anchor fails instead of reading today', () => {
    // @ts-expect-error -- the anchor is required; tsc -b fails if it becomes optional again
    expect(() => isoDateDaysFromNow(0)).toThrow(TypeError);
  });

  it.each([
    [-2, '2026-08-17'],
    [0, '2026-08-19'],
    [2, '2026-08-21'],
  ] as const)('uses the local calendar at late evening for offset %i', (dayOffset, expected) => {
    const anchor = new Date();
    const anchorTimestamp = anchor.getTime();

    // Vitest pins America/New_York: UTC already names the following day.
    expect(anchor.getDate()).toBe(19);
    expect(anchor.getUTCDate()).toBe(20);

    expect(isoDateDaysFromNow(dayOffset, anchor)).toBe(expected);
    expect(eventDateFrom(anchor, dayOffset)).toBe(expected);
    expect(anchor.getTime()).toBe(anchorTimestamp);
  });

  it.each([
    [-1, '2026-03-26'],
    [0, '2026-03-27'],
    [1, '2026-03-28'],
    [2, '2026-03-29'],
    [5, '2026-04-01'],
  ] as const)('uses calendar days across the Nuuk evening gap for offset %i', (dayOffset, expected) => {
    const parentTimezone = process.env.TZ;
    const parentOffset = new Date().getTimezoneOffset();

    // Load the actual exports in a child so Vitest keeps its New York timezone.
    // The child only computes and prints; every check is an `expect` below, so a
    // failure shows a diff rather than an opaque non-zero exit.
    const stdout = execFileSync(
      process.execPath,
      [
        '--import',
        'tsx',
        '--input-type=module',
        '--eval',
        `
          import { eventDateFrom } from './tests/support/factories/events.ts';
          import { isoDateDaysFromNow } from './tests/support/helpers/events.ts';

          const anchor = new Date(2026, 2, 27, 23, 30);
          const anchorTimestamp = anchor.getTime();
          const anchorISO = anchor.toISOString();
          // The following evening's 23:30 is skipped to March 29 at 00:30.
          const skippedHour = new Date(2026, 2, 28, 23, 30);

          const eventDate = eventDateFrom(anchor, ${dayOffset});
          const anchorAfterEventDateFrom = anchor.getTime();
          const isoDate = isoDateDaysFromNow(${dayOffset}, anchor);
          const anchorAfterIsoDate = anchor.getTime();

          console.log(JSON.stringify({
            tz: process.env.TZ,
            anchorISO,
            anchorTimestamp,
            skippedHour: [skippedHour.getDate(), skippedHour.getHours(), skippedHour.getMinutes()],
            skippedHourOffset: skippedHour.getTimezoneOffset(),
            eventDate,
            anchorAfterEventDateFrom,
            isoDate,
            anchorAfterIsoDate,
          }));
        `,
      ],
      {
        cwd: resolve(import.meta.dirname, '../../..'),
        env: { ...process.env, TZ: 'America/Nuuk' },
        encoding: 'utf8',
        timeout: 10_000,
      }
    );
    const child = JSON.parse(stdout.trim().split('\n').at(-1)!) as {
      tz: string;
      anchorISO: string;
      anchorTimestamp: number;
      skippedHour: number[];
      skippedHourOffset: number;
      eventDate: string;
      anchorAfterEventDateFrom: number;
      isoDate: string;
      anchorAfterIsoDate: number;
    };

    expect(child.tz).toBe('America/Nuuk');
    expect(child.anchorISO).toBe('2026-03-28T01:30:00.000Z');
    expect(child.skippedHour).toEqual([29, 0, 30]);
    expect(child.skippedHourOffset).toBe(60);
    expect(child.eventDate).toBe(expected);
    expect(child.anchorAfterEventDateFrom).toBe(child.anchorTimestamp);
    expect(child.isoDate).toBe(expected);
    expect(child.anchorAfterIsoDate).toBe(child.anchorTimestamp);

    expect(process.env.TZ).toBe(parentTimezone);
    expect(new Date().getTimezoneOffset()).toBe(parentOffset);
  });

  it.each([
    ['next month', '2026-04-30T23:30:00-04:00', 1, '2026-05-01'],
    ['previous month', '2026-05-01T00:30:00-04:00', -1, '2026-04-30'],
    ['next year', '2026-12-31T23:30:00-05:00', 1, '2027-01-01'],
    ['previous year', '2026-01-01T00:30:00-05:00', -1, '2025-12-31'],
    ['onto leap day', '2024-02-28T23:30:00-05:00', 1, '2024-02-29'],
    ['after leap day', '2024-02-29T23:30:00-05:00', 1, '2024-03-01'],
    ['back to leap day', '2024-03-01T00:30:00-05:00', -1, '2024-02-29'],
    ['spring DST forward', '2026-03-07T23:30:00-05:00', 1, '2026-03-08'],
    ['spring DST backward', '2026-03-09T00:30:00-04:00', -1, '2026-03-08'],
    ['fall DST forward', '2026-11-01T00:30:00-04:00', 1, '2026-11-02'],
    ['fall DST backward', '2026-11-01T23:30:00-05:00', -1, '2026-10-31'],
  ] as const)(
    'matches the anchored factory across %s without changing the anchor',
    (_scenario, instant, dayOffset, expected) => {
      const anchor = new Date(instant);
      const anchorTimestamp = anchor.getTime();

      expect(isoDateDaysFromNow(dayOffset, anchor)).toBe(expected);
      expect(anchor.getTime()).toBe(anchorTimestamp);
      expect(eventDateFrom(anchor, dayOffset)).toBe(expected);
      expect(anchor.getTime()).toBe(anchorTimestamp);
    }
  );
});

// Explicit `now` values throughout, under Vitest's pinned America/New_York: no
// clock is read, so nothing here needs a child process or a faked Date.
describe('clockAnchor', () => {
  it('is local noon the same day once noon has passed', () => {
    const anchor = clockAnchor(new Date(2026, 8, 25, 15, 30));
    expect(anchor).toEqual(new Date(2026, 8, 25, 12, 0, 0, 0));
  });

  it('is exactly now at local noon', () => {
    expect(clockAnchor(new Date(2026, 8, 25, 12, 0, 0, 0))).toEqual(new Date(2026, 8, 25, 12));
  });

  it('is the previous day at noon before local noon, never ahead of now', () => {
    const now = new Date(2026, 8, 25, 11, 59, 59, 999);
    const anchor = clockAnchor(now);
    expect(anchor).toEqual(new Date(2026, 8, 24, 12, 0, 0, 0));
    expect(anchor.getTime()).toBeLessThanOrEqual(now.getTime());
  });

  it('crosses a month end backwards', () => {
    expect(clockAnchor(new Date(2026, 9, 1, 8))).toEqual(new Date(2026, 8, 30, 12));
  });
});

describe('clockAnchorAvoidingLeapDay', () => {
  it('keeps the plain anchor when no offset lands on 29 February', () => {
    const now = new Date(2026, 8, 25, 15);
    expect(clockAnchorAvoidingLeapDay([5, 10, 40], now)).toEqual(clockAnchor(now));
  });

  it('steps back a day when an offset lands on 29 February', () => {
    // 24 Feb 2028 + 5 days is 29 Feb 2028.
    const anchor = clockAnchorAvoidingLeapDay([5, 10, 40], new Date(2028, 1, 24, 13));
    expect(anchor).toEqual(new Date(2028, 1, 23, 12));
    expect(isoDateDaysFromNow(5, anchor)).toBe('2028-02-28');
  });

  it('keeps stepping while adjacent offsets land on 29 February in turn', () => {
    // From 24 Feb 2028, offset 5 is 29 Feb; one step back puts offset 6 there.
    const anchor = clockAnchorAvoidingLeapDay([5, 6], new Date(2028, 1, 24, 13));
    expect(anchor).toEqual(new Date(2028, 1, 22, 12));
    expect(isoDateDaysFromNow(5, anchor)).toBe('2028-02-27');
    expect(isoDateDaysFromNow(6, anchor)).toBe('2028-02-28');
  });
});

describe('isoBirthdayDaysFromNow', () => {
  it('moves the date `yearsBack` years earlier, keeping its day and month', () => {
    const anchor = new Date(2026, 8, 25, 12);
    expect(isoBirthdayDaysFromNow(10, 30, anchor)).toBe('1996-10-05');
  });

  it('counts the years from the date it lands on, across a year end', () => {
    // 30 Dec 2026 + 5 days is 4 Jan 2027, so 31 years back is 1996.
    const anchor = new Date(2026, 11, 30, 12);
    expect(isoBirthdayDaysFromNow(5, 31, anchor)).toBe('1996-01-04');
  });

  it('refuses a 29 February birthday', () => {
    const anchor = new Date(2028, 1, 24, 12);
    expect(() => isoBirthdayDaysFromNow(5, 31, anchor)).toThrow(/29 February/);
  });
});

// Explicit `now` values under Vitest's pinned America/New_York, as for `clockAnchor`.
describe('msUntilClearOfDailyTurns', () => {
  it('does not wait on a clear clock', () => {
    expect(msUntilClearOfDailyTurns(new Date(2026, 10, 26, 14), 60_000)).toBe(0);
  });

  it('waits until 10 s past local midnight when the test could cross it', () => {
    const ms = msUntilClearOfDailyTurns(new Date(2026, 10, 26, 23, 59, 30), 60_000);
    expect(ms).toBe(40_000);
    expect(new Date(new Date(2026, 10, 26, 23, 59, 30).getTime() + ms)).toEqual(
      new Date(2026, 10, 27, 0, 0, 10)
    );
  });

  // DW-555: a nudge sent before 08:00 on the partner's clock is held and released from 08:00.
  it('waits until 10 s past 08:00 when the test could cross it', () => {
    const now = new Date(2026, 10, 26, 7, 58, 30);
    const ms = msUntilClearOfDailyTurns(now, 120_000);
    expect(ms).toBe(100_000);
    expect(new Date(now.getTime() + ms)).toEqual(new Date(2026, 10, 26, 8, 0, 10));
  });

  // DW-555: 20:00 went with the nudge slots (story 11.1), so it is no turn any more.
  it('does not wait at 20:00', () => {
    expect(msUntilClearOfDailyTurns(new Date(2026, 10, 26, 19, 58, 30), 120_000)).toBe(0);
    expect(msUntilClearOfDailyTurns(new Date(2026, 10, 26, 20, 0, 4), 60_000)).toBe(0);
  });

  it('still waits just after a turn, until the 10 s mark', () => {
    expect(msUntilClearOfDailyTurns(new Date(2026, 10, 26, 8, 0, 4), 60_000)).toBe(6_000);
    expect(msUntilClearOfDailyTurns(new Date(2026, 10, 27, 0, 0, 4), 60_000)).toBe(6_000);
  });

  it('does not wait once 10 s past a turn', () => {
    expect(msUntilClearOfDailyTurns(new Date(2026, 10, 26, 8, 0, 10), 60_000)).toBe(0);
  });

  it('does not wait for a turn beyond the window', () => {
    expect(msUntilClearOfDailyTurns(new Date(2026, 10, 26, 7, 57), 60_000)).toBe(0);
  });

  it('waits out a second turn that the window reaches once moved past the first', () => {
    // Past midnight to 00:00:10, the window then ends at 08:01:10 and holds 08:00 too.
    const now = new Date(2026, 10, 26, 23, 59, 30);
    const ms = msUntilClearOfDailyTurns(now, 8 * 3_600_000 + 60_000);
    expect(new Date(now.getTime() + ms)).toEqual(new Date(2026, 10, 27, 8, 0, 10));
  });

  it('finds the wall-clock midnight on the spring-forward day', () => {
    // 8 March 2026: 02:00 is skipped in New York, midnight and 08:00 still exist.
    const now = new Date(2026, 2, 7, 23, 59, 30);
    expect(msUntilClearOfDailyTurns(now, 60_000)).toBe(40_000);
    const morning = new Date(2026, 2, 8, 7, 59, 30);
    expect(msUntilClearOfDailyTurns(morning, 60_000)).toBe(40_000);
  });

  it('finds the wall-clock turns on the fall-back day', () => {
    // 1 November 2026 has 25 hours; the turns are still the wall-clock 08:00 and 00:00.
    const morning = new Date(2026, 10, 1, 7, 59, 30);
    expect(msUntilClearOfDailyTurns(morning, 60_000)).toBe(40_000);
    const night = new Date(2026, 10, 1, 23, 59, 30);
    expect(msUntilClearOfDailyTurns(night, 60_000)).toBe(40_000);
  });
});

// DW-542: the live check's bots turn on UTC, whatever zone the host is in. Under the
// pinned America/New_York the host midnight is 04:00 or 05:00 UTC, so a guard that
// read the host clock would miss the UTC turns below.
describe('msUntilClearOfDailyTurns on the UTC clock', () => {
  it('waits until 10 s past UTC midnight when the host is hours behind it', () => {
    // 23:59:30 UTC on the 26th is 18:59:30 in New York, clear on the host clock.
    const now = new Date(Date.UTC(2026, 10, 26, 23, 59, 30));
    expect(msUntilClearOfDailyTurns(now, 60_000)).toBe(0);
    const ms = msUntilClearOfDailyTurns(now, 60_000, 'UTC');
    expect(ms).toBe(40_000);
    expect(new Date(now.getTime() + ms)).toEqual(new Date(Date.UTC(2026, 10, 27, 0, 0, 10)));
  });

  it('waits until 10 s past 08:00 UTC', () => {
    const now = new Date(Date.UTC(2026, 10, 26, 7, 58, 30));
    expect(msUntilClearOfDailyTurns(now, 60_000)).toBe(0);
    const ms = msUntilClearOfDailyTurns(now, 120_000, 'UTC');
    expect(ms).toBe(100_000);
    expect(new Date(now.getTime() + ms)).toEqual(new Date(Date.UTC(2026, 10, 26, 8, 0, 10)));
  });

  it('still waits just after a UTC turn, until the 10 s mark, and not once past it', () => {
    expect(msUntilClearOfDailyTurns(new Date(Date.UTC(2026, 10, 27, 0, 0, 4)), 60_000, 'UTC')).toBe(
      6_000
    );
    expect(
      msUntilClearOfDailyTurns(new Date(Date.UTC(2026, 10, 27, 0, 0, 10)), 60_000, 'UTC')
    ).toBe(0);
  });

  it('ignores a host turn that is not a UTC turn', () => {
    // 23:59:30 New York is 04:59:30 UTC: a host turn, clear on the UTC clock.
    const now = new Date(2026, 10, 26, 23, 59, 30);
    expect(msUntilClearOfDailyTurns(now, 60_000)).toBe(40_000);
    expect(msUntilClearOfDailyTurns(now, 60_000, 'UTC')).toBe(0);
  });

  it('measures a window that spans the host fall-back in real elapsed time', () => {
    // 05:30 UTC on 1 November 2026 is 01:30 EDT, half an hour before New York falls
    // back (06:00 UTC); the next UTC turn, 08:00, is 2.5 hours of real time away.
    const now = new Date(Date.UTC(2026, 10, 1, 5, 30));
    const ms = msUntilClearOfDailyTurns(now, 15 * 3_600_000, 'UTC');
    expect(ms).toBe(Date.UTC(2026, 10, 1, 8, 0, 10) - now.getTime());
    expect(ms).toBe(2.5 * 3_600_000 + 10_000);
  });
});

// The live spec reaches the UTC clock only through this forwarding, and runs only
// post-deploy on a UTC runner, where the host and UTC turns coincide.
describe('waitClearOfDailyTurns', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout'] });
    // 23:59:30 UTC on the 26th is 18:59:30 in New York: clear on the host clock only.
    vi.setSystemTime(new Date(Date.UTC(2026, 10, 26, 23, 59, 30)));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes the time zone on, sleeping past a UTC turn and extending the timeout', async () => {
    const testInfo = { timeout: 60_000, setTimeout: vi.fn() };
    let done = false;
    const waited = waitClearOfDailyTurns(testInfo as unknown as TestInfo, 'UTC').then(() => {
      done = true;
    });
    expect(testInfo.setTimeout).toHaveBeenCalledWith(100_000);
    await vi.advanceTimersByTimeAsync(39_999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await waited;
    expect(done).toBe(true);
  });

  it('reads the host clock when no time zone is given', async () => {
    const testInfo = { timeout: 60_000, setTimeout: vi.fn() };
    await waitClearOfDailyTurns(testInfo as unknown as TestInfo);
    expect(testInfo.setTimeout).not.toHaveBeenCalled();
  });
});

// DW-528: the live `daily-reminders` job ticks every five minutes, and only its host-clock
// ticks at 20:00 to 20:25 insert a reminder (a person's clock must read 20:00 to 20:30).
describe('msUntilClearOfReminderTicks', () => {
  it('does not wait outside the evening window', () => {
    expect(msUntilClearOfReminderTicks(new Date(2026, 10, 26, 14), 60_000)).toBe(0);
    // 08:00 releases held nudges and inserts no reminder.
    expect(msUntilClearOfReminderTicks(new Date(2026, 10, 26, 7, 59, 30), 60_000)).toBe(0);
  });

  it('waits until 10 s past the 20:00 tick when the test could cross it', () => {
    const now = new Date(2026, 10, 26, 19, 59, 30);
    const ms = msUntilClearOfReminderTicks(now, 60_000);
    expect(ms).toBe(40_000);
    expect(new Date(now.getTime() + ms)).toEqual(new Date(2026, 10, 26, 20, 0, 10));
  });

  it('waits for each tick in the window, 20:25 included, and not for 20:30', () => {
    expect(msUntilClearOfReminderTicks(new Date(2026, 10, 26, 20, 12, 30), 60_000)).toBe(0);
    expect(msUntilClearOfReminderTicks(new Date(2026, 10, 26, 20, 14, 30), 60_000)).toBe(40_000);
    expect(msUntilClearOfReminderTicks(new Date(2026, 10, 26, 20, 25, 4), 60_000)).toBe(6_000);
    expect(msUntilClearOfReminderTicks(new Date(2026, 10, 26, 20, 25, 10), 60_000)).toBe(0);
    expect(msUntilClearOfReminderTicks(new Date(2026, 10, 26, 20, 29, 30), 60_000)).toBe(0);
  });

  it('walks on through the later ticks a long window reaches once moved', () => {
    const now = new Date(2026, 10, 26, 20, 4, 55);
    const ms = msUntilClearOfReminderTicks(now, 6 * 60_000);
    expect(new Date(now.getTime() + ms)).toEqual(new Date(2026, 10, 26, 20, 25, 10));
  });

  it('reads the wall clock on the fall-back day', () => {
    // 1 November 2026 has 25 hours; the evening ticks are still the wall-clock ones.
    expect(msUntilClearOfReminderTicks(new Date(2026, 10, 1, 19, 59, 30), 60_000)).toBe(40_000);
  });
});

describe('waitClearOfReminderTicks', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout'] });
    vi.setSystemTime(new Date(2026, 10, 26, 19, 59, 30));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sleeps past the tick and extends the timeout by the wait', async () => {
    const testInfo = { timeout: 60_000, setTimeout: vi.fn() };
    let done = false;
    const waited = waitClearOfReminderTicks(testInfo as unknown as TestInfo).then(() => {
      done = true;
    });
    expect(testInfo.setTimeout).toHaveBeenCalledWith(100_000);
    await vi.advanceTimersByTimeAsync(39_999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await waited;
    expect(done).toBe(true);
  });
});
