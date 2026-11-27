/**
 * Installed builds from before story 11.3 still read the streak (criterion 6,
 * R5). The frozen copy of their schema is
 * `tests/support/helpers/old-build-streak-schema.ts`: if the server's answer
 * parses under it, an old build loads the streak and shows its last seven days
 * until it takes the live update.
 */
import { describe, expect, it } from 'vitest';
import { CoupleStreakAnswerSchema } from '../../../src/api/validation/dailyQuestionSchemas';
import {
  OldBuildStreakAnswerSchema,
  OldBuildStreakSchema,
} from '../../support/helpers/old-build-streak-schema';
import { calendarWeek, coupleStreak } from '../stores/dailyQuestionFixture';

/** What the new server sends, as JSON. */
const wire = (overrides: Parameters<typeof coupleStreak>[0] = {}) =>
  JSON.parse(JSON.stringify({ status: 'ok', streak: coupleStreak(overrides) })) as {
    status: 'ok';
    streak: Record<string, unknown>;
  };

describe('an installed build from before story 11.3 reading the streak the new server answers', () => {
  it('parses an answer with a calendar week, strips it and keeps the week as it was', () => {
    const answer = wire({ calendar_week: calendarWeek(4, { 1: 'done' }) });
    expect(answer.streak).toHaveProperty('calendar_week');

    const old = OldBuildStreakAnswerSchema.safeParse(answer);

    expect(old.success).toBe(true);
    if (old.data?.status !== 'ok') throw new Error('expected an ok answer');
    expect(old.data.streak).not.toHaveProperty('calendar_week');
    expect(old.data.streak.week).toEqual(answer.streak.week);
    expect(old.data.streak).toMatchObject({ held: 1, run: 1, today_state: 'orange' });
  });

  it('parses an unlinked answer', () => {
    expect(OldBuildStreakAnswerSchema.safeParse({ status: 'unlinked' }).success).toBe(true);
  });

  it('would fail on a state it does not know in week, which is why upcoming is a new field', () => {
    const answer = wire();
    (answer.streak.week as { state: string }[])[6].state = 'upcoming';

    expect(OldBuildStreakSchema.safeParse(answer.streak).success).toBe(false);
  });

  it('is read by the new schema too, with or without the calendar week', () => {
    expect(CoupleStreakAnswerSchema.safeParse(wire()).success).toBe(true);
    const saved = wire();
    delete saved.streak.calendar_week;
    expect(CoupleStreakAnswerSchema.safeParse(saved).success).toBe(true);
  });
});
