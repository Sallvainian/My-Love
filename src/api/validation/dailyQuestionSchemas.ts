import { z } from 'zod/v4';

/**
 * Wire validation for the Daily Question RPC answers (architecture AD-16).
 *
 * `get_daily_day` and `submit_daily_pick` both return `Json`, so the client
 * parses the day snapshot instead of trusting its shape. A snapshot that does
 * not parse is a failed read, never an `unlinked` answer.
 */

export const DailyChoiceSchema = z.enum(['this', 'that']);

export type DailyChoice = z.infer<typeof DailyChoiceSchema>;

/** `none` < `me` / `partner` < `both`: how far a day has got. */
export const DailyStateSchema = z.enum(['none', 'me', 'partner', 'both']);

export const DailyDaySnapshotSchema = z.object({
  day_id: z.string().min(1),
  day: z.string().min(1),
  question: z.object({
    this: z.string().min(1),
    that: z.string().min(1),
  }),
  state: DailyStateSchema,
  my_choice: DailyChoiceSchema.nullable(),
  my_picked_at: z.string().nullable(),
  partner_choice: DailyChoiceSchema.nullable(),
  same: z.boolean().nullable(),
  write: z.object({
    mine: z.boolean(),
    done: z.boolean(),
    /**
     * The `YYYY-MM-DD` date the question written from this day is asked,
     * or would be if written now (DW-494). Missing from a snapshot saved
     * before the server sent it: read as tomorrow.
     */
    target_day: z.string().optional(),
  }),
});

export type DailyDaySnapshot = z.infer<typeof DailyDaySnapshotSchema>;

export const DailyDayAnswerSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), snapshot: DailyDaySnapshotSchema }),
  z.object({ status: z.literal('unlinked') }),
]);

export type DailyDayAnswer = z.infer<typeof DailyDayAnswerSchema>;

/** One date of the streak's week strip: `done` (both picked), `missed` (closed, not done) or `open`. */
export const CoupleStreakWeekDaySchema = z.object({
  day: z.iso.date(),
  state: z.enum(['done', 'missed', 'open']),
});

const CountSchema = z.number().int().nonnegative();

/**
 * The couple's streak as `get_couple_streak` answers it: the server counts it
 * (AD-7), the client only shows it. `today_state` is orange (the viewer's date
 * is done), blue (a date was missed after the newest done one) or grey.
 */
export const CoupleStreakSchema = z.object({
  held: CountSchema,
  run: CountSchema,
  today_state: z.enum(['grey', 'orange', 'blue']),
  milestones: CountSchema,
  same: CountSchema,
  done: CountSchema,
  missed: CountSchema,
  week: z.array(CoupleStreakWeekDaySchema).length(7),
});

export type CoupleStreak = z.infer<typeof CoupleStreakSchema>;

export const CoupleStreakAnswerSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), streak: CoupleStreakSchema }),
  z.object({ status: z.literal('unlinked') }),
]);

export type CoupleStreakAnswer = z.infer<typeof CoupleStreakAnswerSchema>;

/**
 * `get_daily_history`: the pair's done days as day snapshots, newest first, at
 * most 30 per page. An unlinked caller gets `[]`, not a status.
 */
export const DailyHistorySchema = z.array(DailyDaySnapshotSchema);
