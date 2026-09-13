/**
 * F1 / DW-85: the forward migration that removes the once-committed bot
 * password row is only ever applied by `supabase db reset` to a database whose
 * seed migration no longer inserts that row, so pgTAP
 * supabase/tests/database/22_claude_bot_config_no_secret.sql proves a fresh
 * replay's end state and nothing about the DELETE itself. Production, and any
 * database migrated before the fix, still holds the row until deploy.yml runs
 * `supabase db push` — the state this migration was written for.
 *
 * These tests seed exactly that state inside a transaction, apply the
 * committed migration file byte for byte, read the result, and roll back. The
 * live table is never changed, so no other worker, spec or pgTAP run can see
 * the seeded row. The seeded value is a placeholder, not a secret, and the
 * only values that ever reach the report are row counts and key names.
 *
 * Measured 2026-09-12 against the local stack, the exact psql line sequence
 * asserted below: BEGIN / INSERT 0 1 / 1 / DELETE 1 / 0 / partner_email,test_email / ROLLBACK.
 */
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../support/merged-fixtures';
import { replayMigrationInRollback } from '../support/helpers/migration-replay';

const MIGRATION = '20260912000000_remove_claude_bot_password_row.sql';

// The key the migration deletes, and the two identifier keys the story keeps.
// Named because each is a domain literal the assertions hinge on.
const PASSWORD_KEY = 'test_password';
const IDENTIFIER_KEYS = ['partner_email', 'test_email'];

// Placeholder for the pre-fix row. Not a credential: the point is that a row
// under this key exists before the migration and does not after.
const PLACEHOLDER_VALUE = 'placeholder-not-a-secret';

const seedPasswordRow = `INSERT INTO public.claude_bot_config (key, value) VALUES ('${PASSWORD_KEY}', '${PLACEHOLDER_VALUE}');`;
const countPasswordRows = `SELECT count(*) FROM public.claude_bot_config WHERE key = '${PASSWORD_KEY}';`;
const listKeys = `SELECT string_agg(key, ',' ORDER BY key) FROM public.claude_bot_config;`;

test.describe('F1 forward migration: remove the committed bot password row', () => {
  test('[P1] F1-INT-001 deletes a pre-seeded test_password row and leaves the identifier rows alone', async ({
    supabaseAdmin,
  }) => {
    // GIVEN: the pre-fix state — one test_password row — seeded inside the
    // transaction, and its presence read back before the migration runs so
    // the later 0 cannot be the count of a row that was never there.
    await log.step(`Seed the pre-fix row, apply ${MIGRATION}, read the result, roll back`);
    const { lines } = await replayMigrationInRollback({
      migration: MIGRATION,
      before: [seedPasswordRow, countPasswordRows],
      after: [countPasswordRows, listKeys],
    });

    // WHEN the migration is applied, THEN the DELETE removes exactly one row,
    // the count goes 1 -> 0, and only the two identifier rows remain.
    expect(lines).toEqual([
      'BEGIN',
      'INSERT 0 1',
      '1',
      'DELETE 1',
      '0',
      IDENTIFIER_KEYS.join(','),
      'ROLLBACK',
    ]);

    // AND the rollback held: the live table still has exactly the two
    // identifier rows and no test_password row. This is the outcome check on
    // the side that can observe it; the psql exit code alone only proves the
    // script ran.
    await log.step('Confirm the live table is unchanged after the rollback');
    const { data, error } = await supabaseAdmin.from('claude_bot_config').select('key').order('key');
    expect(error).toBeNull();
    expect(data).toEqual(IDENTIFIER_KEYS.map((key) => ({ key })));
  });

  test('[P1] F1-INT-002 applied twice in one transaction, the second run deletes nothing and does not fail', async () => {
    // GIVEN: the same pre-fix state. WHEN the migration file runs twice in
    // one transaction (the header claims "a second run deletes nothing"),
    // THEN the tags read DELETE 1 then DELETE 0 and psql exits 0 under
    // ON_ERROR_STOP, so the claim is measured rather than asserted in prose.
    await log.step(`Seed the pre-fix row and apply ${MIGRATION} twice`);
    const { lines } = await replayMigrationInRollback({
      migration: MIGRATION,
      times: 2,
      before: [seedPasswordRow],
      after: [countPasswordRows, listKeys],
    });

    expect(lines).toEqual([
      'BEGIN',
      'INSERT 0 1',
      'DELETE 1',
      'DELETE 0',
      '0',
      IDENTIFIER_KEYS.join(','),
      'ROLLBACK',
    ]);
  });
});
