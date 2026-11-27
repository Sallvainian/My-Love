/**
 * Installed builds keep their streak row (story 11.3, criterion 6), over the wire against the
 * shared local stack.
 *
 * A shell installed before the story has not taken the live update, so it parses
 * `get_couple_streak` with the schema frozen in `tests/support/helpers/old-build-streak-schema.ts`:
 * `week` is exactly seven dates with the states done, missed or open. The server this story builds
 * answers a `calendar_week` beside it, with a state the old schema does not know (`upcoming`), so
 * the answer must parse there and the old row, the last seven dates, must stay as it was.
 *
 * Speaks as this worker's own pool user (`supabaseAsUser`, a real JWT, so RLS and grants apply) and
 * seeds nothing: the pool pair is linked, and whatever days its rows hold, the shape is the same.
 * The viewer's date is the server's (the viewer's stored zone, UTC with no row), so it is read from
 * `week`'s last date, never from this machine's clock.
 */
import { OldBuildStreakAnswerSchema } from '../support/helpers/old-build-streak-schema';
import { test, expect } from '../support/merged-fixtures';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A `YYYY-MM-DD` as a UTC day count, so date arithmetic never meets a local zone. */
const dayNumber = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / DAY_MS;

/** 0 Sunday .. 6 Saturday. */
const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();

test.describe('An installed build before story 11.3 still reads the streak', () => {
  test('[P0] the answer parses under the old schema, week is the last seven dates and calendar_week is Sunday to Saturday', async ({
    supabaseAsUser,
  }) => {
    // WHEN the signed-in pool user reads the streak
    const { data, error } = await supabaseAsUser.rpc('get_couple_streak');
    expect(error).toBeNull();

    // THEN the old build's schema accepts the answer
    const old = OldBuildStreakAnswerSchema.safeParse(data);
    expect(old.success, old.error?.message).toBe(true);
    if (!old.success || old.data.status !== 'ok') {
      throw new Error(`the pool pair is not linked: ${JSON.stringify(data)}`);
    }

    // AND its row is seven consecutive dates ending on the viewer's date, oldest first
    const { week } = old.data.streak;
    const today = week[6].day;
    expect(week.map((entry) => dayNumber(entry.day))).toEqual(
      Array.from({ length: 7 }, (_, index) => dayNumber(today) - 6 + index)
    );

    // AND the new answer's calendar week is Sunday to Saturday of the week holding that date
    const answer = data as { streak: { calendar_week?: { day: string; state: string }[] } };
    const calendar = answer.streak.calendar_week;
    expect(calendar).toHaveLength(7);
    const sunday = dayNumber(today) - weekday(today);
    expect(calendar!.map((entry) => dayNumber(entry.day))).toEqual(
      Array.from({ length: 7 }, (_, index) => sunday + index)
    );
    expect(weekday(calendar![0].day)).toBe(0);
    expect(weekday(calendar![6].day)).toBe(6);

    // AND a date after the viewer's date is upcoming, and none before or on it is
    for (const entry of calendar!) {
      if (dayNumber(entry.day) > dayNumber(today)) {
        expect(entry.state).toBe('upcoming');
      } else {
        expect(['done', 'missed', 'open']).toContain(entry.state);
      }
    }

    // AND every date both fields hold has the same state in each
    for (const entry of week) {
      const same = calendar!.find((candidate) => candidate.day === entry.day);
      if (same) expect(same.state).toBe(entry.state);
    }
  });
});
