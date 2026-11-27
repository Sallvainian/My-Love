/**
 * Story 11.2, criterion 8: the stored reminders of the removed kinds are gone. pgTAP runs only
 * against a database built from the whole migration set, so it cannot show how
 * `20261127010000_three_daily_pushes.sql` treats rows an earlier schema left behind: an 8 AM
 * `morning` reminder and an 8 PM `evening_partner` reminder go (with the `push_requests` rows
 * recorded for them), a stored `evening_self` reminder stays unchanged, and the kind check
 * afterwards allows `evening_self` alone.
 *
 * These tests put `daily_reminders_kind_check` back to the three-kind check of
 * `20261125000000`, seed rows of all three kinds, apply the committed migration file byte for
 * byte, read the result and roll back (`replayMigrationInRollback`), so the live table is
 * untouched and no other worker or pgTAP run can see the seeded rows. The seeded accounts are
 * placeholders at `example.com`; nothing here is a real person or credential.
 */
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../support/merged-fixtures';
import { replayMigrationInRollback } from '../support/helpers/migration-replay';

const MIGRATION = '20261127010000_three_daily_pushes.sql';

const PERSON_A = '00000000-0000-4000-8000-0000000c0001';
const PERSON_B = '00000000-0000-4000-8000-0000000c0002';

// The reminders the old shape holds, by what the migration must make of them.
const MORNING = '00000000-0000-4000-8000-0000000d0001'; // A, 8 AM -> deleted
const EVENING_PARTNER = '00000000-0000-4000-8000-0000000d0002'; // B, 8 PM, told the partner has not picked -> deleted
const EVENING_SELF = '00000000-0000-4000-8000-0000000d0003'; // A, 8 PM, not picked -> kept unchanged

const ALL = [MORNING, EVENING_PARTNER, EVENING_SELF].map((id) => `'${id}'`).join(', ');

/** Puts the kind check back to the three kinds of 20261125000000 and seeds the rows above. */
const before = [
  `INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, email_confirmed_at, created_at, updated_at, confirmation_token)
   VALUES ('${PERSON_A}', '00000000-0000-0000-0000-000000000000', 'reminder-replay-a@example.com', 'x', 'authenticated', 'authenticated', now(), now(), now(), ''),
          ('${PERSON_B}', '00000000-0000-0000-0000-000000000000', 'reminder-replay-b@example.com', 'x', 'authenticated', 'authenticated', now(), now(), now(), '');`,
  `INSERT INTO public.users (id, email, display_name) VALUES ('${PERSON_A}', 'reminder-replay-a@example.com', 'Replay A'), ('${PERSON_B}', 'reminder-replay-b@example.com', 'Replay B') ON CONFLICT (id) DO NOTHING;`,
  `ALTER TABLE public.daily_reminders DROP CONSTRAINT daily_reminders_kind_check;`,
  `ALTER TABLE public.daily_reminders ADD CONSTRAINT daily_reminders_kind_check CHECK (kind IN ('morning', 'evening_self', 'evening_partner'));`,
  `SELECT (public.assign_couple_day(least('${PERSON_A}'::uuid, '${PERSON_B}'::uuid), greatest('${PERSON_A}'::uuid, '${PERSON_B}'::uuid), date '2030-01-01')).day;`,
  `INSERT INTO public.daily_reminders (id, user_id, kind, local_date, day_id, created_at)
   SELECT v.id::uuid, v.user_id::uuid, v.kind, date '2030-01-01', cd.id, timestamptz '2030-01-01 12:00:00+00'
     FROM (VALUES
       ('${MORNING}', '${PERSON_A}', 'morning'),
       ('${EVENING_PARTNER}', '${PERSON_B}', 'evening_partner'),
       ('${EVENING_SELF}', '${PERSON_A}', 'evening_self')
     ) AS v(id, user_id, kind)
     JOIN public.couple_days cd ON cd.user_a = least('${PERSON_A}'::uuid, '${PERSON_B}'::uuid)
      AND cd.user_b = greatest('${PERSON_A}'::uuid, '${PERSON_B}'::uuid) AND cd.day = date '2030-01-01';`,
  `INSERT INTO public.push_requests (daily_reminder_id, token, environment, payload, delivery)
   SELECT r.id, 'replay-token', 'sandbox', '{}'::jsonb, 'recorded' FROM public.daily_reminders r WHERE r.id IN (${ALL});`,
  `SELECT count(*) FROM public.daily_reminders WHERE id IN (${ALL});`,
  `SELECT count(*) FROM public.push_requests WHERE daily_reminder_id IN (${ALL});`,
  `SELECT '--seeded--';`,
];

const after = [
  `SELECT '--after--';`,
  `SELECT id || ' ' || user_id || ' ' || kind || ' ' || slot || ' ' || local_date::text || ' ' || created_at::text FROM public.daily_reminders WHERE id IN (${ALL}) ORDER BY id;`,
  `SELECT count(*) FROM public.push_requests WHERE daily_reminder_id IN (${ALL});`,
  `SELECT daily_reminder_id FROM public.push_requests WHERE daily_reminder_id IN (${ALL});`,
  `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.daily_reminders'::regclass AND conname = 'daily_reminders_kind_check';`,
  `SELECT string_agg(conname, ',' ORDER BY conname) FROM pg_constraint WHERE conrelid = 'public.daily_reminders'::regclass AND contype IN ('u', 'c');`,
];

/** The lines of the result after the marker the `after` statements print. */
function afterLines(lines: string[]): string[] {
  const start = lines.indexOf('--after--');
  expect(start, 'the after marker').toBeGreaterThan(-1);
  return lines.slice(start + 1, lines.lastIndexOf('ROLLBACK'));
}

const EXPECTED = [
  `${EVENING_SELF} ${PERSON_A} evening_self evening 2030-01-01 2030-01-01 12:00:00+00`,
  '1',
  EVENING_SELF,
  "CHECK ((kind = 'evening_self'::text))",
  'daily_reminders_kind_check,daily_reminders_user_date_slot_key',
];

test.describe('story 11.2 forward migration: reminders stored before the epic', () => {
  test('[P0] 11.2-INT-001 deletes the stored morning and evening_partner reminders and keeps the evening_self one unchanged', async ({
    supabaseAdmin,
  }) => {
    // GIVEN one stored reminder of each of the three kinds, each with a recorded push request.
    await log.step(`Seed the three-kind shape, apply ${MIGRATION}, read the result, roll back`);
    const { lines } = await replayMigrationInRollback({ migration: MIGRATION, before, after });

    // The seed went in: three reminders and three requests, before the migration ran.
    const seeded = lines.indexOf('--seeded--');
    expect(lines.slice(seeded - 2, seeded)).toEqual(['3', '3']);

    // WHEN the migration has run, THEN only the evening_self reminder remains, with its own row
    // unchanged and its push request kept, and the kind check allows evening_self alone.
    expect(afterLines(lines)).toEqual(EXPECTED);

    // AND the rollback held: the live table has none of the seeded rows.
    await log.step('Confirm the live table is unchanged after the rollback');
    const live = await supabaseAdmin
      .from('daily_reminders')
      .select('id')
      .in('id', [MORNING, EVENING_PARTNER, EVENING_SELF]);
    expect(live.error).toBeNull();
    expect(live.data).toEqual([]);
  });

  test('[P1] 11.2-INT-002 applied twice in one transaction, the second run changes nothing and does not fail', async () => {
    await log.step(`Apply ${MIGRATION} twice over the three-kind shape`);
    const { lines } = await replayMigrationInRollback({ migration: MIGRATION, times: 2, before, after });

    expect(afterLines(lines)).toEqual(EXPECTED);
  });
});
