/**
 * The streak schema of an installed build from before story 11.3, frozen as it
 * stood at `aa5c6073` (`CoupleStreakSchema` and `CoupleStreakAnswerSchema` in
 * `src/api/validation/dailyQuestionSchemas.ts`): plain `z.object`s that strip
 * unknown keys, with `week` exactly seven entries whose state is `done`,
 * `missed` or `open`.
 *
 * If the server's answer parses under it, that build loads the streak and shows
 * its last seven days, as before, until it takes the live update. A new state in
 * `week` would fail it and the streak would not load there, which is why the
 * calendar week is a new field beside `week`.
 *
 * Do not edit this copy to match a new schema: it is the old build.
 */
import { z } from 'zod/v4';

const OldCount = z.number().int().nonnegative();

export const OldBuildStreakSchema = z.object({
  held: OldCount,
  run: OldCount,
  today_state: z.enum(['grey', 'orange', 'blue']),
  milestones: OldCount,
  same: OldCount,
  done: OldCount,
  missed: OldCount,
  week: z
    .array(
      z.object({
        day: z.iso.date(),
        state: z.enum(['done', 'missed', 'open']),
      })
    )
    .length(7),
});

export const OldBuildStreakAnswerSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), streak: OldBuildStreakSchema }),
  z.object({ status: z.literal('unlinked') }),
]);
