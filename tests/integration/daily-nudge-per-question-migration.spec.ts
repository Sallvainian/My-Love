/**
 * Story 11.1, criterion 23: nudges recorded before the epic keep counting. pgTAP runs only
 * against a database built from the whole migration set, so it cannot show how
 * `20261127000000_daily_nudge_per_question.sql` treats rows an earlier schema left behind:
 * a nudge in the `after_pick` slot is the prompt's, one in the `evening` slot the button's,
 * and two rows of one source for one question from one sender (the DW-532 case) leave the
 * earliest.
 *
 * These tests put `daily_nudges` back to the shape of `20261125000000` inside a transaction,
 * seed old-shaped rows, apply the committed migration file byte for byte, read the result
 * and roll back (`replayMigrationInRollback`), so the live table is untouched and no other
 * worker or pgTAP run can see the seeded rows. The seeded accounts are placeholders at
 * `example.com`; nothing here is a real person or credential.
 */
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../support/merged-fixtures';
import { replayMigrationInRollback } from '../support/helpers/migration-replay';

const MIGRATION = '20261127000000_daily_nudge_per_question.sql';

const SENDER = '00000000-0000-4000-8000-0000000a0001';
const RECIPIENT = '00000000-0000-4000-8000-0000000a0002';

// The nudges the old shape holds, by what the migration must make of them.
const AFTER_PICK = '00000000-0000-4000-8000-0000000b0001'; // day 1, after_pick -> prompt
const EVENING = '00000000-0000-4000-8000-0000000b0002'; // day 1, evening -> button
const FIRST_OF_TWO = '00000000-0000-4000-8000-0000000b0003'; // day 2, after_pick, earlier -> kept as prompt
const SECOND_OF_TWO = '00000000-0000-4000-8000-0000000b0004'; // day 2, after_pick, later -> dropped
const BACK = '00000000-0000-4000-8000-0000000b0005'; // the recipient's own, day 1, evening -> button

const ALL = [AFTER_PICK, EVENING, FIRST_OF_TWO, SECOND_OF_TWO, BACK].map((id) => `'${id}'`).join(', ');

/** Puts `daily_nudges` back to the shape of 20261125000000 and seeds the rows above. */
const before = [
  `INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, email_confirmed_at, created_at, updated_at, confirmation_token)
   VALUES ('${SENDER}', '00000000-0000-0000-0000-000000000000', 'nudge-replay-a@example.com', 'x', 'authenticated', 'authenticated', now(), now(), now(), ''),
          ('${RECIPIENT}', '00000000-0000-0000-0000-000000000000', 'nudge-replay-b@example.com', 'x', 'authenticated', 'authenticated', now(), now(), now(), '');`,
  `INSERT INTO public.users (id, email, display_name) VALUES ('${SENDER}', 'nudge-replay-a@example.com', 'Replay A'), ('${RECIPIENT}', 'nudge-replay-b@example.com', 'Replay B') ON CONFLICT (id) DO NOTHING;`,
  `ALTER TABLE public.daily_nudges ADD COLUMN slot text, ADD COLUMN sender_local_date date;`,
  `ALTER TABLE public.daily_nudges DROP CONSTRAINT daily_nudges_sender_day_source_key, DROP CONSTRAINT daily_nudges_source_check;`,
  `ALTER TABLE public.daily_nudges ALTER COLUMN source DROP NOT NULL;`,
  `SELECT (public.assign_couple_day(least('${SENDER}'::uuid, '${RECIPIENT}'::uuid), greatest('${SENDER}'::uuid, '${RECIPIENT}'::uuid), date '2030-01-01')).day;`,
  `SELECT (public.assign_couple_day(least('${SENDER}'::uuid, '${RECIPIENT}'::uuid), greatest('${SENDER}'::uuid, '${RECIPIENT}'::uuid), date '2030-01-02')).day;`,
  `INSERT INTO public.daily_nudges (id, from_user, to_user, day_id, sender_local_date, slot, created_at)
   SELECT v.id::uuid, v.from_user::uuid, v.to_user::uuid, cd.id, v.sender_date::date, v.slot, v.created_at::timestamptz
     FROM (VALUES
       ('${AFTER_PICK}', '${SENDER}', '${RECIPIENT}', date '2030-01-01', '2030-01-01', 'after_pick', '2030-01-01 10:00:00+00'),
       ('${EVENING}', '${SENDER}', '${RECIPIENT}', date '2030-01-01', '2030-01-01', 'evening', '2030-01-01 21:00:00+00'),
       ('${FIRST_OF_TWO}', '${SENDER}', '${RECIPIENT}', date '2030-01-02', '2030-01-02', 'after_pick', '2030-01-02 10:00:00+00'),
       ('${SECOND_OF_TWO}', '${SENDER}', '${RECIPIENT}', date '2030-01-02', '2030-01-03', 'after_pick', '2030-01-03 01:00:00+00'),
       ('${BACK}', '${RECIPIENT}', '${SENDER}', date '2030-01-01', '2030-01-01', 'evening', '2030-01-01 22:00:00+00')
     ) AS v(id, from_user, to_user, day, sender_date, slot, created_at)
     JOIN public.couple_days cd ON cd.user_a = least(v.from_user::uuid, v.to_user::uuid)
      AND cd.user_b = greatest(v.from_user::uuid, v.to_user::uuid) AND cd.day = v.day;`,
  `SELECT count(*) FROM public.daily_nudges WHERE id IN (${ALL});`,
  `SELECT '--seeded--';`,
];

const after = [
  `SELECT '--after--';`,
  `SELECT id || ' ' || source || ' ' || held::text || ' ' || coalesce(released_at::text, 'null') FROM public.daily_nudges WHERE id IN (${ALL}) ORDER BY id;`,
  `SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'daily_nudges' AND column_name IN ('slot', 'sender_local_date');`,
  `SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'daily_nudges' AND column_name IN ('source', 'held', 'released_at');`,
  `SELECT string_agg(conname, ',' ORDER BY conname) FROM pg_constraint WHERE conrelid = 'public.daily_nudges'::regclass AND contype IN ('u', 'c');`,
];

/** The lines of the result after the marker the `after` statements print. */
function afterLines(lines: string[]): string[] {
  const start = lines.indexOf('--after--');
  expect(start, 'the after marker').toBeGreaterThan(-1);
  return lines.slice(start + 1, lines.lastIndexOf('ROLLBACK'));
}

const EXPECTED = [
  `${AFTER_PICK} prompt false null`,
  `${EVENING} button false null`,
  `${FIRST_OF_TWO} prompt false null`,
  `${BACK} button false null`,
  '0',
  'held,released_at,source',
  'daily_nudges_sender_day_source_key,daily_nudges_source_check',
];

test.describe('story 11.1 forward migration: nudges recorded before the epic', () => {
  test('[P0] 11.1-INT-001 maps after_pick to the prompt and evening to the button, and keeps the earliest of a duplicate', async ({
    supabaseAdmin,
  }) => {
    // GIVEN old-shaped rows: both slots, a sender's two after_pick rows for one question, and the partner's own.
    await log.step(`Seed the old shape, apply ${MIGRATION}, read the result, roll back`);
    const { lines } = await replayMigrationInRollback({ migration: MIGRATION, before, after });

    // The seed went in: five rows, before the migration ran.
    expect(lines[lines.indexOf('--seeded--') - 1]).toBe('5');

    // WHEN the migration has run, THEN each row is the source its slot named, the later duplicate is gone,
    // nothing was held or released, and the two old columns are gone with the new ones and keys in place.
    expect(afterLines(lines)).toEqual(EXPECTED);

    // AND the rollback held: the live table has none of the seeded rows and still has the new shape.
    await log.step('Confirm the live table is unchanged after the rollback');
    const live = await supabaseAdmin
      .from('daily_nudges')
      .select('id')
      .in('id', [AFTER_PICK, EVENING, FIRST_OF_TWO, SECOND_OF_TWO, BACK]);
    expect(live.error).toBeNull();
    expect(live.data).toEqual([]);
    const shape = await supabaseAdmin.from('daily_nudges').select('source, held, released_at').limit(1);
    expect(shape.error).toBeNull();
  });

  test('[P1] 11.1-INT-002 applied twice in one transaction, the second run changes nothing and does not fail', async () => {
    await log.step(`Apply ${MIGRATION} twice over the old shape`);
    const { lines } = await replayMigrationInRollback({ migration: MIGRATION, times: 2, before, after });

    expect(afterLines(lines)).toEqual(EXPECTED);
  });
});
