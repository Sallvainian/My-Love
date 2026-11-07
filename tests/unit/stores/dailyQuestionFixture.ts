/**
 * Daily Question snapshots for unit tests: the AD-16 shape `get_daily_day` and
 * `submit_daily_pick` answer, with the pair's question fixed.
 */
import type { CoupleStreak, DailyDaySnapshot } from '../../../src/api/validation/dailyQuestionSchemas';

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

/** The viewer is the day's writer and picked `myChoice`: the turn to write is open (or `done`). */
export function writerSnapshot(
  myChoice: 'this' | 'that' = 'this',
  overrides: Partial<DailyDaySnapshot> = {}
): DailyDaySnapshot {
  return {
    ...waitingSnapshot(myChoice),
    write: { mine: true, done: false },
    ...overrides,
  };
}

/** The seven dates ending 2030-03-07, oldest first, all `open` unless `states` overrides the newest ones. */
function streakWeek(states: CoupleStreak['week'][number]['state'][] = []): CoupleStreak['week'] {
  const padded = [...Array<'open'>(7 - states.length).fill('open'), ...states];
  return padded.map((state, index) => ({ day: `2030-03-0${index + 1}`, state }));
}

/** The streak `get_couple_streak` answers; override any field. Defaults to one done day, orange. */
export function coupleStreak(overrides: Partial<CoupleStreak> = {}): CoupleStreak {
  return {
    held: 1,
    run: 1,
    today_state: 'orange',
    milestones: 0,
    same: 1,
    done: 1,
    missed: 0,
    week: streakWeek(['done']),
    ...overrides,
  };
}
