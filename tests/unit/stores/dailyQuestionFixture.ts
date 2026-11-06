/**
 * Daily Question snapshots for unit tests: the AD-16 shape `get_daily_day` and
 * `submit_daily_pick` answer, with the pair's question fixed.
 */
import type { DailyDaySnapshot } from '../../../src/api/validation/dailyQuestionSchemas';

export const DAY_ID = '00000000-0000-4000-8000-0000000000d1';

export const QUESTION = { this: 'Beach day', that: 'Mountain day' } as const;

/** A day nobody has picked on; override any field. */
export function dailySnapshot(overrides: Partial<DailyDaySnapshot> = {}): DailyDaySnapshot {
  return {
    day_id: DAY_ID,
    day: '2026-11-05',
    question: { ...QUESTION },
    state: 'none',
    my_choice: null,
    my_picked_at: null,
    partner_choice: null,
    same: null,
    write: { mine: false, done: false },
    ...overrides,
  };
}

/** The viewer picked `my_choice`, the partner has not. */
export function waitingSnapshot(
  myChoice: 'this' | 'that' = 'this',
  pickedAt = '2026-11-05T15:45:00.000Z'
): DailyDaySnapshot {
  return dailySnapshot({ state: 'me', my_choice: myChoice, my_picked_at: pickedAt });
}

/** Both picked: the reveal. */
export function revealSnapshot(
  myChoice: 'this' | 'that',
  partnerChoice: 'this' | 'that'
): DailyDaySnapshot {
  return dailySnapshot({
    state: 'both',
    my_choice: myChoice,
    my_picked_at: '2026-11-05T15:45:00.000Z',
    partner_choice: partnerChoice,
    same: myChoice === partnerChoice,
  });
}
