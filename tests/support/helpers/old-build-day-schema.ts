/**
 * The day-snapshot schema of an installed build from before story 11.1,
 * frozen as it stood at `e4326eba` (`src/api/validation/dailyQuestionSchemas.ts`):
 * a plain `z.object` that strips unknown keys, with `nudge { slot, spent }`
 * optional and `slot` limited to `after_pick | evening | null`.
 *
 * If the server's answer parses under it, that build loads and shows the day,
 * with no `nudge`, so no nudge prompt and a greyed button until it takes the
 * live update (criterion 18, R4). Removing or renaming `slot` or `spent`, or
 * giving `slot` a new value, makes it fail and Daily will not load there.
 *
 * Do not edit this copy to match a new schema: it is the old build.
 */
import { z } from 'zod/v4';

const OldChoice = z.enum(['this', 'that']);

export const OldBuildSnapshotSchema = z.object({
  day_id: z.string().min(1),
  day: z.string().min(1),
  question: z.object({ this: z.string().min(1), that: z.string().min(1) }),
  state: z.enum(['none', 'me', 'partner', 'both']),
  my_choice: OldChoice.nullable(),
  my_picked_at: z.string().nullable(),
  partner_choice: OldChoice.nullable(),
  same: z.boolean().nullable(),
  write: z.object({
    mine: z.boolean(),
    done: z.boolean(),
    target_day: z.string().optional(),
  }),
  nudge: z
    .object({
      slot: z.enum(['after_pick', 'evening']).nullable(),
      spent: z.boolean(),
    })
    .optional(),
});

export const OldBuildAnswerSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), snapshot: OldBuildSnapshotSchema }),
  z.object({ status: z.literal('unlinked') }),
]);
