import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventDateFrom } from '../../support/factories/events';
import { isoDateDaysFromNow } from '../../support/helpers/events';

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
