/**
 * P0 Unit: Date Formatting Utilities
 *
 * Critical path: Date display must be correct across the app.
 * Covers formatDateISO, the local-calendar YYYY-MM-DD key used for daily
 * messages. The suite runs under TZ=America/New_York (vitest.config.ts), so
 * a UTC-based implementation shows up as the wrong day in the evening and
 * around the DST transitions below.
 */
import { describe, it, expect } from 'vitest';
import { formatDateISO } from '@/utils/dateUtils';

describe('Date Formatting', () => {
  it('[P0] should format dates consistently', () => {
    // GIVEN: Known local dates, one zero-padded and one late in the evening
    // WHEN: Formatted as an ISO calendar date
    // THEN: The local wall-clock date is returned as YYYY-MM-DD
    expect(formatDateISO(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(formatDateISO(new Date(2026, 8, 25, 23, 30))).toBe('2026-09-25');
  });

  it('[P0] should handle edge case dates (midnight, DST transitions)', () => {
    // GIVEN: Instants around local midnight and both 2026 DST transitions
    // WHEN: Formatted as an ISO calendar date
    // THEN: Each instant maps to its New York calendar date, not the UTC one
    // Last millisecond of 7 March (EST) and the local midnight that follows.
    expect(formatDateISO(new Date('2026-03-08T04:59:59.999Z'))).toBe('2026-03-07');
    expect(formatDateISO(new Date('2026-03-08T05:00:00Z'))).toBe('2026-03-08');
    // 03:00 EDT, just after the spring-forward gap.
    expect(formatDateISO(new Date('2026-03-08T07:00:00Z'))).toBe('2026-03-08');
    // 01:30 EDT and 01:30 EST: the repeated hour on fall-back day.
    expect(formatDateISO(new Date('2026-11-01T05:30:00Z'))).toBe('2026-11-01');
    expect(formatDateISO(new Date('2026-11-01T06:30:00Z'))).toBe('2026-11-01');
  });
});
