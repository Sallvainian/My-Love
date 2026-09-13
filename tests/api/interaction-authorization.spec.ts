/**
 * F4/F5 (CAP-4/CAP-5): the interactions authorization boundary, over the wire.
 *
 * These cases run against real PostgREST with real user JWTs, because that is
 * the only place the guarantee actually lives:
 *
 * - CAP-4 is `interactions_sender_to_partner_insert`, which requires the caller
 *   to be the sender AND the recipient to be `public.get_my_partner_id()`.
 * - CAP-5 is the column grant: `authenticated` holds `UPDATE (viewed)` and no
 *   table-level UPDATE, so every other column is immutable.
 *
 * Both are in `supabase/migrations/20260912020000_partner_only_immutable_interactions.sql`.
 * `supabase/tests/database/24_interactions_partner_only.sql` pins the same rules
 * in pgTAP; this file proves they survive the PostgREST layer the app speaks to.
 *
 * Every rejection is followed by a read through the admin client. A refused
 * request that nevertheless wrote, or a silent zero-row update, would otherwise
 * pass on the status code alone.
 *
 * The outsider is a throwaway account from `createOutsiderClient`, never another
 * worker's: worker pairs are pre-linked by global-setup, so no worker account is
 * ever a stranger, and this spec links, unlinks and resets nothing.
 */
import { randomUUID } from 'node:crypto';
import { log } from '@seontechnologies/playwright-utils';
import type { SupabaseInteractionRecord } from '../../src/api/interactionService';
import { createOutsiderClient } from '../support/helpers/rls-security';
import { resolveOwnPair } from '../support/helpers/events';
import { test, expect } from '../support/merged-fixtures';

/** PostgREST maps SQLSTATE 42501 — RLS denial and privilege denial alike — to 403. */
const DENIED_HTTP_STATUS = 403;
/**
 * The same denial reaches an *anonymous* caller as 401, not 403 — measured
 * against this stack. The SQLSTATE in the body is 42501 either way, which is
 * why both are asserted on the code as well as the status.
 */
const ANON_DENIED_HTTP_STATUS = 401;
const DENIED_CODE = '42501';

type ErrorEnvelope = { code?: string; message?: string };

test.describe('Interaction authorization boundary', () => {
  test('[P0] the insert boundary accepts only the caller and their current partner', async ({
    apiRequest,
    authToken,
    supabaseAdmin,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    const outsider = await createOutsiderClient(supabaseAdmin, 'interaction-insert-outsider');
    const { data: outsiderSession } = await outsider.client.auth.getSession();
    const outsiderToken = outsiderSession.session?.access_token;
    expect(outsiderToken, 'the outsider account must hold a session').toBeTruthy();

    const acceptedIds = [randomUUID(), randomUUID()];
    const refusedIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    const failures: unknown[] = [];

    const send = (token: string, body: Record<string, unknown>) =>
      apiRequest<ErrorEnvelope>({
        method: 'POST',
        path: '/rest/v1/interactions',
        headers: { Authorization: `Bearer ${token}` },
        body,
        retryConfig: { maxRetries: 0 },
      });

    try {
      await log.step('A linked partner can send both interaction types');
      for (const [index, type] of (['poke', 'kiss'] as const).entries()) {
        const { status } = await send(authToken, {
          id: acceptedIds[index],
          type,
          from_user_id: userId,
          to_user_id: partnerId,
        });
        expect(status, `${type} to the current partner`).toBe(201);
      }

      await log.step('Self, stranger and spoofed-sender inserts are all refused');
      const refusals = [
        { label: 'self-targeting', id: refusedIds[0], token: authToken, body: {
          from_user_id: userId, to_user_id: userId,
        } },
        { label: 'targeting a stranger', id: refusedIds[1], token: authToken, body: {
          from_user_id: userId, to_user_id: outsider.userId,
        } },
        { label: 'spoofing the sender', id: refusedIds[2], token: authToken, body: {
          from_user_id: partnerId, to_user_id: userId,
        } },
        { label: 'an unlinked outsider sending', id: refusedIds[3], token: outsiderToken!, body: {
          from_user_id: outsider.userId, to_user_id: userId,
        } },
      ];

      for (const refusal of refusals) {
        const { status, body } = await send(refusal.token, {
          id: refusal.id,
          type: 'poke',
          ...refusal.body,
        });
        expect(status, refusal.label).toBe(DENIED_HTTP_STATUS);
        expect(body.code, refusal.label).toBe(DENIED_CODE);
      }

      await log.step('Only the two legitimate rows reached the table');
      const { data: persisted, error } = await supabaseAdmin
        .from('interactions')
        .select('id')
        .in('id', [...acceptedIds, ...refusedIds]);
      expect(error).toBeNull();
      expect((persisted ?? []).map((row) => row.id).sort()).toEqual([...acceptedIds].sort());
    } catch (error) {
      failures.push(error);
    }

    try {
      const { status } = await apiRequest({
        method: 'DELETE',
        path: `/rest/v1/interactions?id=in.(${[...acceptedIds, ...refusedIds].join(',')})`,
        headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
      });
      expect(status).toBe(204);
      const { error: cleanupError } = await outsider.cleanup();
      expect(cleanupError).toBeNull();
    } catch (error) {
      failures.push(error);
    }

    if (failures.length > 0) {
      throw new AggregateError(failures, 'Interaction insert-boundary assertion or cleanup failed');
    }
  });

  test('[P0] a received interaction is viewed-only for its recipient', async ({
    apiRequest,
    authToken,
    partnerAuthToken,
    supabaseAdmin,
  }) => {
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    const outsider = await createOutsiderClient(supabaseAdmin, 'interaction-update-outsider');
    const { data: outsiderSession } = await outsider.client.auth.getSession();
    const outsiderToken = outsiderSession.session?.access_token;
    expect(outsiderToken, 'the outsider account must hold a session').toBeTruthy();

    // Two legitimate rows: one to mark viewed, one kept unviewed so the combined
    // patch below can be shown to change nothing at all.
    const viewedRowId = randomUUID();
    const untouchedRowId = randomUUID();
    // Bound, not inlined: if column immutability ever regresses, this id names a
    // real row and the cleanup below has to be able to reach it.
    const forgedRowId = randomUUID();
    const failures: unknown[] = [];

    const patch = (token: string, id: string, body: Record<string, unknown>) =>
      apiRequest<ErrorEnvelope>({
        method: 'PATCH',
        path: `/rest/v1/interactions?id=eq.${id}`,
        headers: { Authorization: `Bearer ${token}` },
        body,
        retryConfig: { maxRetries: 0 },
      });

    const readRow = async (id: string) => {
      const { data, error } = await supabaseAdmin
        .from('interactions')
        .select('*')
        .eq('id', id)
        .single<SupabaseInteractionRecord>();
      expect(error).toBeNull();
      return data!;
    };

    try {
      await log.step('The linked sender creates two interactions');
      for (const id of [viewedRowId, untouchedRowId]) {
        const { status } = await apiRequest({
          method: 'POST',
          path: '/rest/v1/interactions',
          headers: { Authorization: `Bearer ${authToken}` },
          body: { id, type: 'poke', from_user_id: userId, to_user_id: partnerId },
          retryConfig: { maxRetries: 0 },
        });
        expect(status).toBe(201);
      }

      await log.step('The recipient can mark one viewed, and it persists');
      const { status: viewedStatus } = await patch(partnerAuthToken, viewedRowId, { viewed: true });
      expect(viewedStatus).toBe(204);
      expect((await readRow(viewedRowId)).viewed).toBe(true);

      await log.step('Every other column is refused, and nothing moves');
      const before = await readRow(viewedRowId);
      const forgeries = [
        { label: 'type', body: { type: 'kiss' } },
        { label: 'sender', body: { from_user_id: outsider.userId } },
        { label: 'recipient', body: { to_user_id: outsider.userId } },
        { label: 'id', body: { id: forgedRowId } },
        { label: 'creation metadata', body: { created_at: '2020-01-01T00:00:00.000Z' } },
      ];

      for (const forgery of forgeries) {
        const { status, body } = await patch(partnerAuthToken, viewedRowId, forgery.body);
        expect(status, forgery.label).toBe(DENIED_HTTP_STATUS);
        expect(body.code, forgery.label).toBe(DENIED_CODE);
        expect(await readRow(viewedRowId), forgery.label).toEqual(before);
      }

      await log.step('A combined viewed-plus-forgery patch is refused whole');
      const { status: combinedStatus, body: combinedBody } = await patch(
        partnerAuthToken,
        untouchedRowId,
        { viewed: true, type: 'kiss' }
      );
      expect(combinedStatus).toBe(DENIED_HTTP_STATUS);
      expect(combinedBody.code).toBe(DENIED_CODE);
      // The discriminator: `viewed` is the one column the recipient may write,
      // so a patch applied column-by-column would have flipped it.
      const afterCombined = await readRow(untouchedRowId);
      expect(afterCombined.viewed).toBe(false);
      expect(afterCombined.type).toBe('poke');

      await log.step('Neither the sender nor an outsider can mark it viewed');
      // No error: RLS hides the row from both, so the UPDATE matches nothing.
      for (const [label, token] of [
        ['the sender', authToken],
        ['an outsider', outsiderToken!],
      ] as const) {
        const { status } = await patch(token, untouchedRowId, { viewed: true });
        expect(status, label).toBe(204);
        expect((await readRow(untouchedRowId)).viewed, label).toBe(false);
      }

      await log.step('The recipient cannot delete a received interaction either');
      const { status: deleteStatus } = await apiRequest<ErrorEnvelope>({
        method: 'DELETE',
        path: `/rest/v1/interactions?id=eq.${untouchedRowId}`,
        headers: { Authorization: `Bearer ${partnerAuthToken}` },
        retryConfig: { maxRetries: 0 },
      });
      expect(deleteStatus).toBe(DENIED_HTTP_STATUS);
      expect((await readRow(untouchedRowId)).id).toBe(untouchedRowId);

      await log.step('The anon key reaches the table not at all');
      // pgTAP proves anon holds no privilege; this proves PostgREST's role
      // mapping still puts an unauthenticated caller in that role.
      for (const [method, body] of [
        ['GET', undefined],
        ['POST', { type: 'poke', from_user_id: userId, to_user_id: partnerId }],
        ['PATCH', { viewed: true }],
      ] as const) {
        const { status, body: denial } = await apiRequest<ErrorEnvelope>({
          method,
          path:
            method === 'POST'
              ? '/rest/v1/interactions'
              : `/rest/v1/interactions?id=eq.${untouchedRowId}`,
          // No Authorization header: the apikey alone speaks as anon.
          body,
          retryConfig: { maxRetries: 0 },
        });
        expect(status, `anon ${method}`).toBe(ANON_DENIED_HTTP_STATUS);
        expect(denial.code, `anon ${method}`).toBe(DENIED_CODE);
      }
      expect((await readRow(untouchedRowId)).viewed).toBe(false);

      await log.step('An outsider reads none of the couple traffic');
      const { status: readStatus, body: outsiderRows } = await apiRequest<unknown[]>({
        method: 'GET',
        path: `/rest/v1/interactions?id=in.(${viewedRowId},${untouchedRowId})&select=*`,
        headers: { Authorization: `Bearer ${outsiderToken}` },
      });
      expect(readStatus).toBe(200);
      expect(outsiderRows).toEqual([]);
    } catch (error) {
      failures.push(error);
    }

    try {
      const { status } = await apiRequest({
        method: 'DELETE',
        path: `/rest/v1/interactions?id=in.(${viewedRowId},${untouchedRowId},${forgedRowId})`,
        headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
      });
      expect(status).toBe(204);
      const { error: cleanupError } = await outsider.cleanup();
      expect(cleanupError).toBeNull();
    } catch (error) {
      failures.push(error);
    }

    if (failures.length > 0) {
      throw new AggregateError(failures, 'Interaction immutability assertion or cleanup failed');
    }
  });
});
