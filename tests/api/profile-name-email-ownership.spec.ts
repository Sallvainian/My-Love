/**
 * F9 (CAP-9): the profile name is the owner's to set, the email mirror is not.
 *
 * These cases run against real PostgREST with real user JWTs, because that is
 * the layer the app speaks and the only one that can show the guarantee
 * surviving PostgREST's own payload handling:
 *
 * - `authenticated` holds no table-level UPDATE on `public.users`, only
 *   `UPDATE (display_name, updated_at)`, so a PATCH naming `email` is refused
 *   before it reaches a row.
 * - `users_update_self_safe` still scopes every accepted write to the caller's
 *   own row, so a PATCH aimed at the partner matches nothing.
 *
 * Both are in
 * `supabase/migrations/20260912030000_profile_name_email_ownership.sql`, and
 * `supabase/tests/database/25_profile_name_email_ownership.sql` pins the same
 * rules plus the trigger's behaviour in pgTAP. This file proves the privilege
 * half is not something PostgREST quietly works around -- a column the client
 * may not write could plausibly have been dropped from the payload rather than
 * refusing the statement, and only a wire test says which.
 *
 * Every rejection is followed by a read through the admin client. A refused
 * request that nevertheless wrote, or a silent zero-row update, would otherwise
 * pass on the status code alone (remediation.md, F5).
 *
 * Both identities are throwaway accounts from `createOutsiderClient`, created
 * and linked here and deleted at the end. No worker-pool account is read,
 * written, linked or unlinked: those rows are shared, and this spec both
 * mutates a display_name and depends on the exact value it finds.
 */
import { log } from '@seontechnologies/playwright-utils';
import { createOutsiderClient } from '../support/helpers/rls-security';
import { test, expect } from '../support/merged-fixtures';

/** PostgREST maps SQLSTATE 42501 -- RLS denial and privilege denial alike -- to 403. */
const DENIED_HTTP_STATUS = 403;
const DENIED_CODE = '42501';

type ErrorEnvelope = { code?: string; message?: string };
type ProfileRow = { display_name: string | null; email: string | null };

test.describe('Profile name and email ownership', () => {
  test('[P0] the owner sets its own name and cannot rewrite its email mirror', async ({
    apiRequest,
    supabaseAdmin,
  }) => {
    const owner = await createOutsiderClient(supabaseAdmin, 'profile-owner');
    const { data: ownerSession } = await owner.client.auth.getSession();
    const token = ownerSession.session?.access_token;
    expect(token, 'the throwaway account must hold a session').toBeTruthy();

    const seeded = await supabaseAdmin
      .from('users')
      .select('display_name, email')
      .eq('id', owner.userId)
      .single();
    // Premise: the trigger seeded this row from the email, because
    // createOutsiderClient supplies no display_name metadata. Without this the
    // "name changed" assertion below could pass against a row that already read
    // that way.
    expect(seeded.data?.display_name).toBe(seeded.data?.email);
    const seededEmail = seeded.data?.email;

    const patch = (body: Record<string, unknown>) =>
      apiRequest<ErrorEnvelope>({
        method: 'PATCH',
        path: `/rest/v1/users?id=eq.${owner.userId}`,
        headers: { Authorization: `Bearer ${token}`, Prefer: 'return=representation' },
        body,
        retryConfig: { maxRetries: 0 },
      });

    const readBack = () =>
      supabaseAdmin.from('users').select('display_name, email').eq('id', owner.userId).single();

    const failures: unknown[] = [];

    try {
      await log.step('The owner sets its own display name');
      const { status: acceptedStatus, body: accepted } = await apiRequest<ProfileRow[]>({
        method: 'PATCH',
        path: `/rest/v1/users?id=eq.${owner.userId}`,
        headers: { Authorization: `Bearer ${token}`, Prefer: 'return=representation' },
        body: { display_name: 'Chosen Name', updated_at: new Date().toISOString() },
        retryConfig: { maxRetries: 0 },
      });
      expect(acceptedStatus).toBe(200);
      expect(accepted).toHaveLength(1);
      expect(accepted[0].display_name).toBe('Chosen Name');

      const afterAccepted = await readBack();
      expect(afterAccepted.data).toMatchObject({
        display_name: 'Chosen Name',
        email: seededEmail,
      });

      await log.step('The owner cannot rewrite its own email mirror');
      const refusedEmail = await patch({ email: 'hijacked@evil.example' });
      expect(refusedEmail.status).toBe(DENIED_HTTP_STATUS);
      expect(refusedEmail.body.code).toBe(DENIED_CODE);

      const afterEmail = await readBack();
      expect(
        afterEmail.data,
        'a refused email PATCH must leave the stored mirror alone'
      ).toMatchObject({ display_name: 'Chosen Name', email: seededEmail });

      await log.step('A combined name-plus-email PATCH is refused whole');
      // The interesting failure is not "the request 403s" but "PostgREST drops
      // the column it may not write and applies the rest". If that happened the
      // name below would be 'Smuggled Name'.
      const refusedBoth = await patch({
        display_name: 'Smuggled Name',
        email: 'hijacked@evil.example',
      });
      expect(refusedBoth.status).toBe(DENIED_HTTP_STATUS);
      expect(refusedBoth.body.code).toBe(DENIED_CODE);

      const afterBoth = await readBack();
      expect(
        afterBoth.data,
        'a combined PATCH must land neither half, not just drop the email'
      ).toMatchObject({ display_name: 'Chosen Name', email: seededEmail });
    } catch (error) {
      failures.push(error);
    }

    try {
      const { error: cleanupError } = await owner.cleanup();
      expect(cleanupError, `failed to delete the throwaway account: ${cleanupError?.message}`)
        .toBeNull();
    } catch (error) {
      failures.push(error);
    }

    if (failures.length > 0) {
      throw new AggregateError(failures, 'Profile ownership assertion or account cleanup failed');
    }
  });

  test('[P0] the owner cannot write the partner profile row', async ({
    apiRequest,
    supabaseAdmin,
  }) => {
    const owner = await createOutsiderClient(supabaseAdmin, 'profile-pair-a');
    const partner = await createOutsiderClient(supabaseAdmin, 'profile-pair-b');
    const { data: ownerSession } = await owner.client.auth.getSession();
    const token = ownerSession.session?.access_token;
    expect(token, 'the throwaway account must hold a session').toBeTruthy();

    const failures: unknown[] = [];

    try {
      // Linked as accept_partner_request would leave them, so the target really
      // is a partner row -- readable to the caller under the SELECT policy, and
      // therefore a row whose refusal says something.
      const { error: linkError } = await supabaseAdmin
        .from('users')
        .upsert([
          { id: owner.userId, partner_id: partner.userId },
          { id: partner.userId, partner_id: owner.userId },
        ]);
      expect(linkError, `failed to link the throwaway pair: ${linkError?.message}`).toBeNull();

      const before = await supabaseAdmin
        .from('users')
        .select('display_name, email')
        .eq('id', partner.userId)
        .single();
      expect(before.error).toBeNull();

      // Premise: the caller CAN see the row it is about to fail to write, so
      // the empty result below is the UPDATE policy refusing and not the SELECT
      // policy hiding it.
      await log.step('The caller can read its partner profile');
      const { status: readStatus, body: visible } = await apiRequest<ProfileRow[]>({
        method: 'GET',
        path: `/rest/v1/users?id=eq.${partner.userId}&select=display_name,email`,
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(readStatus).toBe(200);
      expect(visible).toHaveLength(1);

      await log.step('The caller cannot rename its partner');
      // Refused by the row policy rather than by the column grant, so this is an
      // empty 200 and not a 403 -- which is exactly why the read-back below is
      // the assertion that matters.
      const { status: refusedStatus, body: refused } = await apiRequest<ProfileRow[]>({
        method: 'PATCH',
        path: `/rest/v1/users?id=eq.${partner.userId}`,
        headers: { Authorization: `Bearer ${token}`, Prefer: 'return=representation' },
        body: { display_name: 'Renamed By Partner' },
        retryConfig: { maxRetries: 0 },
      });
      expect(refusedStatus).toBe(200);
      expect(refused).toHaveLength(0);

      const after = await supabaseAdmin
        .from('users')
        .select('display_name, email')
        .eq('id', partner.userId)
        .single();
      expect(after.data, 'the partner profile must be byte-identical afterwards').toEqual(
        before.data
      );
    } catch (error) {
      failures.push(error);
    }

    for (const account of [owner, partner]) {
      try {
        const { error: cleanupError } = await account.cleanup();
        expect(cleanupError, `failed to delete a throwaway account: ${cleanupError?.message}`)
          .toBeNull();
      } catch (error) {
        failures.push(error);
      }
    }

    if (failures.length > 0) {
      throw new AggregateError(failures, 'Partner-row refusal assertion or account cleanup failed');
    }
  });
});
