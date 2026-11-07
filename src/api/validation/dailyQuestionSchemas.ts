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
