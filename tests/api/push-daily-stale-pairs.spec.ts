/**
 * A Kathmandu throwaway pair that a killed run of `push-daily-reminders.spec.ts` or
 * `push-daily-nudge-held.spec.ts` left behind (DW-530), against the local stack. A killed
 * run never reaches its teardown, so its pair stays linked with its devices and its stored
 * Kathmandu zone, and `otherAccountsDueAt` counts it at both specs' instants: every later
 * run stopped at the guard until someone deleted the accounts by hand.
 *
 * Asserted: such a pair, older than `STALE_PAIR_AGE_MINUTES`, is due at the reminders
 * spec's 20:25 instant; `deleteStaleKathmanduPairs` deletes both its accounts and nothing
 * else of the kind that is fresh (another lane's live test may own a fresh one), after
 * which the guard no longer finds it.
 *
 * Throwaway accounts only. The leftover's `created_at` is moved back through psql, as no
 * API sets it. Requires `supabase start`; the `api` project runs one worker.
 */
import type { TypedSupabaseClient } from '../support/factories';
import {
  KATHMANDU_OFFSET_MINUTES,
  KATHMANDU_ZONE,
  STALE_PAIR_AGE_MINUTES,
  deleteStaleKathmanduPairs,
  kathmanduInstant,
  kathmanduYesterday,
  otherAccountsDueAt,
  storeZone,
} from '../support/helpers/daily-clock';
import { runPsql } from '../support/helpers/migration-replay';
import { createParty, link, registerDevice, type Party } from '../support/helpers/push-requests';
import { createOutsiderClient } from '../support/helpers/rls-security';
import { test, expect } from '../support/merged-fixtures';
import type { Cleanup } from '../support/fixtures/cleanup';

test.describe('A Kathmandu pair a killed run left behind', () => {
  /**
   * A linked Kathmandu pair with a device each, as a killed run leaves it. Its teardown
   * tolerates an account already gone, since deleting it is what the test is for.
   */
  async function leftBehindPair(supabaseAdmin: TypedSupabaseClient, cleanup: Cleanup): Promise<Party[]> {
    const parties: Party[] = [];
    for (const role of ['a', 'b']) {
      const account = await createOutsiderClient(supabaseAdmin, `dailyrem-${role}`);
      cleanup.defer(`delete the left-behind account ${role} if still there`, async () => {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(account.userId);
        expect([undefined, 404]).toContain(error?.status);
      });
      parties.push({ ...account, name: `Left ${role.toUpperCase()}` });
    }
    await link(supabaseAdmin, parties[0], parties[1]);
    for (const party of parties) {
      await registerDevice(party, 'sandbox');
      await storeZone(party.userId, KATHMANDU_ZONE, KATHMANDU_OFFSET_MINUTES);
    }
    const ids = parties.map((party) => `'${party.userId}'`).join(', ');
    const aged = await runPsql(
      `update auth.users set created_at = now() - interval '${STALE_PAIR_AGE_MINUTES + 50} minutes' where id in (${ids});\n`
    );
    expect(aged.code, aged.stderr).toBe(0);
    return parties;
  }

  async function emailsOf(supabaseAdmin: TypedSupabaseClient, parties: Party[]) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('email')
      .in(
        'id',
        parties.map((party) => party.userId)
      )
      .order('email');
    expect(error).toBeNull();
    return (data ?? []).map((row) => row.email);
  }

  test('[P1] is deleted before the next run makes its pair, a fresh pair is kept, and the guard no longer finds it', async ({
    supabaseAdmin,
    cleanup,
  }) => {
    const leftover = await leftBehindPair(supabaseAdmin, cleanup);
    const fresh = [
      await createParty(supabaseAdmin, cleanup, 'dailyheld', 'Held', 'a'),
      await createParty(supabaseAdmin, cleanup, 'dailyheld', 'Held', 'b'),
    ];
    await link(supabaseAdmin, fresh[0], fresh[1]);
    const own = fresh.map((party) => party.userId);
    const eveningAt = kathmanduInstant(kathmanduYesterday(), '20:25');
    const leftoverEmails = await emailsOf(supabaseAdmin, leftover);
    expect(leftoverEmails).toHaveLength(2);

    // The defect: the leftover is due at the reminders spec's instant, so its guard stops.
    expect(await otherAccountsDueAt(eveningAt, own)).toEqual(expect.arrayContaining(leftoverEmails));

    const deleted = await deleteStaleKathmanduPairs(supabaseAdmin);
    expect(deleted).toEqual(expect.arrayContaining(leftover.map((party) => party.userId)));
    expect(deleted).not.toContain(fresh[0].userId);
    expect(deleted).not.toContain(fresh[1].userId);

    // Both leftover accounts are gone, the fresh pair is still there, and the guard skips the leftover.
    expect(await emailsOf(supabaseAdmin, leftover)).toEqual([]);
    expect(await emailsOf(supabaseAdmin, fresh)).toHaveLength(2);
    const due = await otherAccountsDueAt(eveningAt, own);
    for (const email of leftoverEmails) expect(due).not.toContain(email);
  });
});
