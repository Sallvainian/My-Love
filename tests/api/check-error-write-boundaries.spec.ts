/**
 * DW-38: extend wire coverage to the three newly mapped tables.
 * Existing check-constraint-error-mapping.spec.ts owns moods/events/interactions;
 * unit/component tests own mapped presentation, wrappers and account races.
 *
 * Source evidence: 20251203190800_create_photos_table.sql (caption <=500),
 * 20251206024345_remote_schema.sql (note content 1..1000, no_self_requests,
 * sender-only INSERT RLS), 20260727000000_love_notes_idempotency.sql.
 * Partner self INSERT satisfies sender RLS and fails no_self_requests; no
 * INSERT trigger links users. Never invoke the accept RPC or change users.
 * Runtime envelope expectations are UNVERIFIED for these tables until local
 * Supabase is available; the shared envelope was measured on sibling tables.
 */
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../support/merged-fixtures';
import { throwCollected } from '../support/helpers/collected-failures';
import { getWorkerPairEmails } from '../support/auth/worker-pool';
import { checkViolation, type PostgrestErrorEnvelope } from '../support/check-constraint-envelopes';
import {
  CHECK_WRITE_CASES,
  createCheckWritePayload,
} from '../support/factories/check-write-payloads';

test.describe('DW-38 CHECK write boundaries', () => {
  for (const scenario of CHECK_WRITE_CASES) {
    test(`[P1] DW38-API-${scenario.table} rejects ${scenario.constraint} without committing a row`, async ({
      apiRequest,
      authToken,
    }) => {
      const pair = getWorkerPairEmails();
      if (!pair) throw new Error('DW-38 requires TEST_WORKER_INDEX from the worker pool');
      const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!adminKey) throw new Error('DW-38 requires the local service role key for exact-row cleanup');
      const headers = { Authorization: `Bearer ${authToken}` };

      await log.step('Resolve this worker identity and recipient through authenticated APIs');
      const own = await apiRequest<{ id: string }>({ method: 'GET', path: '/auth/v1/user', headers });
      expect(own.status).toBe(200);
      const partner = await apiRequest<{ id: string }[]>({
        method: 'GET',
        path: `/rest/v1/users?select=id&email=eq.${encodeURIComponent(pair.user2Email)}`,
        headers,
      });
      expect(partner.status).toBe(200);
      expect(partner.body).toHaveLength(1);
      const overrides = scenario.table === 'photos'
        ? { caption: 'x'.repeat(501) }
        : scenario.table === 'love_notes'
          ? { content: 'x'.repeat(1001) }
          : { to_user_id: own.body.id };
      const payload = createCheckWritePayload(scenario.table, own.body.id, partner.body[0].id, overrides);
      const query = scenario.conflict ? `?on_conflict=${scenario.conflict}` : '';
      const failures: unknown[] = [];

      try {
        await log.step(`Reject an invalid ${scenario.table} write with the production conflict policy`);
        const rejected = await apiRequest<PostgrestErrorEnvelope>({
          method: 'POST',
          path: `/rest/v1/${scenario.table}${query}`,
          headers: {
            ...headers,
            Prefer: scenario.conflict
              ? 'resolution=ignore-duplicates,return=representation'
              : 'return=representation',
          },
          body: payload,
        });
        expect(rejected.status).toBe(400);
        // No response schema exists for these PostgREST errors; assert the
        // exact fields consumed by isPostgrestError and the CHECK-only mapper.
        expect(rejected.body).toEqual(checkViolation({
          message: `new row for relation "${scenario.table}" violates check constraint "${scenario.constraint}"`,
        }));

        await log.step('Confirm the rejected UUID is absent through an authorized read');
        const read = await apiRequest<{ id: string }[]>({
          method: 'GET',
          path: `/rest/v1/${scenario.table}?select=id&id=eq.${payload.id}`,
          headers,
        });
        expect(read.status).toBe(200);
        expect(read.body).toEqual([]);
      } catch (error) {
        failures.push(error);
      }

      // Collected rather than asserted in a `finally`, so a cleanup failure is
      // reported beside the test's own error instead of replacing it.
      try {
        // Some tables lack authenticated DELETE. Admin is used only for this
        // test-generated UUID, including when a regression accepts the write.
        const cleanup = await apiRequest({
          method: 'DELETE',
          path: `/rest/v1/${scenario.table}?id=eq.${payload.id}`,
          headers: { apikey: adminKey, Authorization: `Bearer ${adminKey}` },
        });
        expect(cleanup.status).toBe(204);
      } catch (error) {
        failures.push(error);
      }

      throwCollected(failures, `DW-38 ${scenario.table} assertion or cleanup failed`);
    });
  }

  test('[P2] DW38-API-photo-limit accepts a 500-character caption as the positive boundary control', async ({
    apiRequest,
    authToken,
  }) => {
    const headers = { Authorization: `Bearer ${authToken}` };
    const own = await apiRequest<{ id: string }>({ method: 'GET', path: '/auth/v1/user', headers });
    expect(own.status).toBe(200);
    const payload = createCheckWritePayload('photos', own.body.id, own.body.id, {
      caption: 'x'.repeat(500),
    });
    const failures: unknown[] = [];

    try {
      await log.step('Accept photo metadata at the caption limit');
      const created = await apiRequest<{ id: string; caption: string }[]>({
        method: 'POST',
        path: '/rest/v1/photos?on_conflict=storage_path',
        headers: { ...headers, Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: payload,
      });
      expect(created.status).toBe(201);
      expect(created.body).toHaveLength(1);
      expect(created.body[0]).toMatchObject({ id: payload.id, caption: payload.caption });
      const read = await apiRequest<{ id: string; caption: string }[]>({
        method: 'GET',
        path: `/rest/v1/photos?select=id,caption&id=eq.${payload.id}`,
        headers,
      });
      expect(read.status).toBe(200);
      expect(read.body).toEqual([{ id: payload.id, caption: payload.caption }]);
    } catch (error) {
      failures.push(error);
    }

    // Collected rather than asserted in a `finally`, so a cleanup failure is
    // reported beside the test's own error instead of replacing it.
    try {
      // Metadata has no FK to storage.objects; this test creates no blob.
      const cleanup = await apiRequest({
        method: 'DELETE',
        path: `/rest/v1/photos?id=eq.${payload.id}`,
        headers,
      });
      expect(cleanup.status).toBe(204);
    } catch (error) {
      failures.push(error);
    }

    throwCollected(failures, 'DW-38 caption-limit assertion or cleanup failed');
  });
});
