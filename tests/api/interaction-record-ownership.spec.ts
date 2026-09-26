/**
 * DW-75 supporting API contract: the real persisted incoming-record shape.
 *
 * Provider evidence:
 * - src/api/interactionService.ts:166-179 inserts and selects one interaction.
 * - supabase/migrations/20251203000001_create_base_schema.sql:149-156 defines
 *   UUID identity/participants, viewed=false and created_at=now() defaults.
 * - supabase/migrations/20251206024345_remote_schema.sql:89-91,228-243
 *   allows poke/kiss, authenticates the sender and permits receiver reads.
 * - src/types/database.types.ts:88-127 supplies the generated wire types.
 *
 * This test proves a live PostgREST record contract. Retired callback ownership
 * is exercised by the store and browser tests, not by this HTTP round trip.
 */
import { log } from '@seontechnologies/playwright-utils';
import { z } from 'zod';
import type { SupabaseInteractionRecord } from '../../src/api/interactionService';
import { createInteractionRecord } from '../support/factories/interaction-record-ownership';
import { resolveOwnPair } from '../support/helpers/events';
import { test, expect } from '../support/merged-fixtures';

// No production response schema exists for interactions. This local schema
// validates the non-null defaults of the successful INSERT under test.
const IncomingRecordSchema = z.object({
  id: z.uuid(),
  type: z.enum(['poke', 'kiss']),
  from_user_id: z.uuid(),
  to_user_id: z.uuid(),
  viewed: z.boolean(),
  created_at: z.iso.datetime({ offset: true }),
});
const IncomingRecordsSchema = z.array(IncomingRecordSchema);

test.describe('Interaction record contract', () => {
  test('[P1] DW-75-API-001 returns the persisted partner record to its authenticated receiver', async ({
    apiRequest,
    authToken,
    partnerAuthToken,
    supabaseAdmin,
    cleanup,
  }) => {
    // Given this worker's linked sender and receiver.
    const { userId, partnerId } = await resolveOwnPair(supabaseAdmin);
    const record = createInteractionRecord({
      from_user_id: userId,
      to_user_id: partnerId,
      type: 'kiss',
      viewed: false,
    });
    const insert = {
      id: record.id,
      type: record.type,
      from_user_id: record.from_user_id,
      to_user_id: record.to_user_id,
      viewed: record.viewed,
    };
    // Deferred before the INSERT: the row is deleted even if the request
    // committed but its response or a contract assertion failed.
    cleanup.defer('delete the interaction row', async () => {
      const { status } = await apiRequest({
        method: 'DELETE',
        path: '/rest/v1/interactions?id=eq.' + record.id,
        headers: { Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY },
      });
      expect(status).toBe(204);
    });

    // When the sender creates a partner interaction through PostgREST.
    await log.step('Insert a partner interaction as the authenticated sender');
    // Standard JSON keeps the utility's response parser on its supported media type;
    // PostgREST represents a single inserted row as a one-element array here.
    const { status: insertStatus, body: inserted } = await apiRequest<SupabaseInteractionRecord[]>({
      method: 'POST',
      path: '/rest/v1/interactions',
      headers: {
        Authorization: 'Bearer ' + authToken,
        Prefer: 'return=representation',
      },
      // Omit created_at to verify the server supplies the timestamp.
      body: insert,
      // A failed non-idempotent INSERT must not be retried automatically.
      retryConfig: { maxRetries: 0 },
    }).validateSchema<z.infer<typeof IncomingRecordsSchema>>(IncomingRecordsSchema);

    expect(insertStatus).toBe(201);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject(insert);

    // Then the authenticated receiver reads the exact persisted wire record.
    await log.step('Read that exact record using the receiving partner token');
    const { status: readStatus, body: received } = await apiRequest<SupabaseInteractionRecord[]>({
      method: 'GET',
      path: '/rest/v1/interactions?id=eq.' + record.id + '&select=*',
      headers: { Authorization: 'Bearer ' + partnerAuthToken },
    }).validateSchema<z.infer<typeof IncomingRecordsSchema>>(IncomingRecordsSchema);

    expect(readStatus).toBe(200);
    expect(received).toEqual(inserted);
  });
});
