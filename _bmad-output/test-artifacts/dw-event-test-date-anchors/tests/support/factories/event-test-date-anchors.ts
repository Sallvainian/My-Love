import { mock } from 'node:test';
import { faker } from '@faker-js/faker';
import { isoDateDaysFromNow } from '../helpers/events';

/** One local year boundary, with real time restored before any async work. */
export function createDateAnchorBatch(options: { year?: number; labelPrefix?: string } = {}) {
  // Next year's boundary stays ahead of real today in every browser timezone.
  // The fixed month/day and offsets are the regression inputs, not random data.
  const year = options.year ?? new Date().getFullYear() + 1;
  const prefix = options.labelPrefix ?? 'date-anchor';
  const identity = faker.string.uuid();
  const beforeMidnight = new Date(year, 11, 31, 23, 59, 59);
  const afterMidnight = new Date(year + 1, 0, 1, 0, 0, 1);

  mock.timers.enable({ apis: ['Date'], now: beforeMidnight });
  try {
    const anchor = new Date();
    const before = isoDateDaysFromNow(0, anchor);
    mock.timers.setTime(afterMidnight.getTime());
    const after = isoDateDaysFromNow(0, anchor);
    const next = isoDateDaysFromNow(1, anchor);

    return {
      before: { label: `${prefix}-${identity}-before`, date: before },
      after: { label: `${prefix}-${identity}-after`, date: after },
      next: { label: `${prefix}-${identity}-next`, date: next },
      // Independent oracles: do not derive expectations with the changed helper.
      expectedSameDate: `${year}-12-31`,
      expectedNextDate: `${year + 1}-01-01`,
      expectedSameLongDate: `December 31, ${year}`,
      expectedNextLongDate: `January 1, ${year + 1}`,
    };
  } finally {
    mock.timers.reset();
  }
}
