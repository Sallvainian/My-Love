import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventDateFrom } from '../../support/factories/events';
import {
  clockAnchor,
  clockAnchorAvoidingLeapDay,
  isoBirthdayDaysFromNow,
  isoDateDaysFromNow,
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

  it('keeps one-argument calls relative to the current local day', () => {
    vi.setSystemTime(new Date('2026-08-19T23:59:59-04:00'));

    expect(isoDateDaysFromNow(-1)).toBe('2026-08-18');
    expect(isoDateDaysFromNow(0)).toBe('2026-08-19');
    expect(isoDateDaysFromNow(1)).toBe('2026-08-20');

    vi.setSystemTime(new Date('2026-08-20T00:00:01-04:00'));

    expect(isoDateDaysFromNow(-1)).toBe('2026-08-19');
    expect(isoDateDaysFromNow(0)).toBe('2026-08-20');
    expect(isoDateDaysFromNow(1)).toBe('2026-08-21');
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
    expect(isoDateDaysFromNow(dayOffset)).toBe(expected);
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
    execFileSync(
      process.execPath,
      [
        '--import',
        'tsx',
        '--input-type=module',
        '--eval',
        `
          import assert from 'node:assert/strict';
          import { eventDateFrom } from './tests/support/factories/events.ts';
          import { isoDateDaysFromNow } from './tests/support/helpers/events.ts';

          const anchor = new Date(2026, 2, 27, 23, 30);
          const anchorTimestamp = anchor.getTime();
          assert.equal(process.env.TZ, 'America/Nuuk');
          assert.equal(anchor.toISOString(), '2026-03-28T01:30:00.000Z');

          // The following evening's 23:30 is skipped to March 29 at 00:30.
          const skippedHour = new Date(2026, 2, 28, 23, 30);
          assert.deepEqual(
            [skippedHour.getDate(), skippedHour.getHours(), skippedHour.getMinutes()],
            [29, 0, 30]
          );
          assert.equal(skippedHour.getTimezoneOffset(), 60);

          assert.equal(eventDateFrom(anchor, ${dayOffset}), ${JSON.stringify(expected)});
          assert.equal(anchor.getTime(), anchorTimestamp);
          assert.equal(isoDateDaysFromNow(${dayOffset}, anchor), ${JSON.stringify(expected)});
          assert.equal(anchor.getTime(), anchorTimestamp);
        `,
      ],
      {
        cwd: resolve(import.meta.dirname, '../../..'),
        env: { ...process.env, TZ: 'America/Nuuk' },
        encoding: 'utf8',
        timeout: 10_000,
      }
    );

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
