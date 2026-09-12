/**
 * DW-83: installed Unicode limits over authenticated PostgREST.
 * Component tests own the validation permutations; these cases prove real
 * writes preserve exact code points and rejected writes do not change rows.
 * Inputs here are already trimmed, as PostgreSQL does not trim the columns.
 *
 * Provider: supabase/migrations/20260818000002_create_events_table.sql:17-26.
 * Existing events-wire-contract tests establish POST 201, PATCH 200 and
 * CHECK failures as 400 / 23514. Runtime schemas validate shape, not length.
 * coupleEvents checks cleanup before/after for only this worker's couple.
 */
import { randomUUID } from 'node:crypto';
import { log } from '@seontechnologies/playwright-utils';
import type { z } from 'zod';
import { test, expect } from '../../../../tests/support/merged-fixtures';
import { eventDateFrom } from '../../../../tests/support/factories/events';
import {
  EventRowsSchema,
  PostgrestErrorSchema,
  unicodeCases,
  type EventRow,
} from '../support/unicode-events';

type PostgrestError = z.infer<typeof PostgrestErrorSchema>;

const fieldBoundaries = [
  { field: 'label', limit: 100, constraint: 'events_label_check' },
  { field: 'description', limit: 500, constraint: 'events_description_check' },
] as const;
const boundaryCases = unicodeCases.flatMap((unicode) =>
  fieldBoundaries.map((boundary) => ({ ...unicode, ...boundary }))
);

// The untested field stays comfortably below its limit so each failure can
// only come from the field named in the case, including the description CHECK.
const controlText = {
  label: 'DW83 Unicode boundary',
  description: 'Unicode text round trip',
};

test.describe('DW-83 events Unicode API limits', () => {
  for (const [index, boundary] of boundaryCases.entries()) {
    const { key, field, limit, constraint, atLimit, overLimit } = boundary;
    const postId = `DW83-API-${String(index * 2 + 1).padStart(3, '0')}`;
    const patchId = `DW83-API-${String(index * 2 + 2).padStart(3, '0')}`;

    test(`[P1] ${postId} POST preserves ${key} ${field} at ${limit} code points and refuses one more`, async ({
      apiRequest,
      authToken,
      coupleEvents,
    }) => {
      // Given: independent literal limits, an owned row, and unique attempt IDs.
      expect(Array.from(atLimit[field])).toHaveLength(limit);
      expect(Array.from(overLimit[field])).toHaveLength(limit + 1);
      const acceptedId = randomUUID();
      const rejectedId = randomUUID();
      const payload = {
        id: acceptedId,
        user_id: coupleEvents.userId,
        ...controlText,
        [field]: atLimit[field],
        event_date: eventDateFrom(coupleEvents.anchor, 30),
        icon: 'plane',
      };
      const headers = {
        Authorization: `Bearer ${authToken}`,
        Prefer: 'return=representation',
      };

      // When: POST the exact boundary through the installed database guard.
      await log.step(`POST ${key} ${field} at the ${limit}-code-point limit`);
      const accepted = await apiRequest<EventRow[]>({
        method: 'POST',
        path: '/rest/v1/events?select=*',
        headers,
        body: payload,
        retryConfig: { maxRetries: 0 },
      }).validateSchema(EventRowsSchema);

      // Then: the response and authenticated read retain the exact code points.
      expect(accepted.status).toBe(201);
      expect(accepted.body).toEqual([expect.objectContaining(payload)]);
      const persisted = await apiRequest<EventRow[]>({
        method: 'GET',
        path: `/rest/v1/events?id=eq.${acceptedId}&select=*`,
        headers,
      }).validateSchema(EventRowsSchema);
      expect(persisted.status).toBe(200);
      expect(persisted.body).toEqual(accepted.body);

      // When: change only this field to one code point over the boundary.
      await log.step(`POST one extra code point and verify ${constraint}`);
      const refused = await apiRequest<PostgrestError>({
        method: 'POST',
        path: '/rest/v1/events?select=*',
        headers,
        body: { ...payload, id: rejectedId, [field]: overLimit[field] },
        retryConfig: { maxRetries: 0 },
      }).validateSchema(PostgrestErrorSchema);

      // Then: CHECK, rather than auth or transport, refuses this attempt.
      expect(refused.status).toBe(400);
      expect(refused.body.code).toBe('23514');
      expect(refused.body.message).toContain(`"${constraint}"`);
      const remaining = await apiRequest<EventRow[]>({
        method: 'GET',
        path: `/rest/v1/events?id=in.(${acceptedId},${rejectedId})&select=*`,
        headers,
      }).validateSchema(EventRowsSchema);
      expect(remaining.status).toBe(200);
      expect(remaining.body).toEqual(persisted.body);
      expect(remaining.body.map((row) => row.id)).toEqual([acceptedId]);
    });

    test(`[P1] ${patchId} PATCH preserves ${key} ${field} at ${limit} code points and leaves it unchanged after overflow`, async ({
      apiRequest,
      authToken,
      coupleEvents,
    }) => {
      // Given: API-seeded state belongs to this worker, with one anchored date.
      expect(Array.from(atLimit[field])).toHaveLength(limit);
      expect(Array.from(overLimit[field])).toHaveLength(limit + 1);
      const [seeded] = await coupleEvents.seed([
        { label: 'DW83 before Unicode edit', description: 'Before edit', dayOffset: 30 },
      ]);
      const headers = {
        Authorization: `Bearer ${authToken}`,
        Prefer: 'return=representation',
      };
      const path = `/rest/v1/events?id=eq.${seeded.id}&select=*`;
      const edit = { ...controlText, [field]: atLimit[field], icon: 'plane' };

      // When: update through the same installed CHECK used by an Add request.
      await log.step(`PATCH ${key} ${field} at the ${limit}-code-point limit`);
      const accepted = await apiRequest<EventRow[]>({
        method: 'PATCH',
        path,
        headers,
        body: edit,
        retryConfig: { maxRetries: 0 },
      }).validateSchema(EventRowsSchema);

      // Then: the exact new text survives response serialization and readback.
      expect(accepted.status).toBe(200);
      expect(accepted.body).toEqual([
        expect.objectContaining({
          ...edit,
          id: seeded.id,
          user_id: coupleEvents.userId,
          event_date: seeded.eventDate,
        }),
      ]);
      const persisted = await apiRequest<EventRow[]>({
        method: 'GET',
        path,
        headers,
      }).validateSchema(EventRowsSchema);
      expect(persisted.status).toBe(200);
      expect(persisted.body).toEqual(accepted.body);

      // When: attempt an overflowing edit, with all other columns untouched.
      await log.step(`PATCH one extra code point and verify ${constraint}`);
      const refused = await apiRequest<PostgrestError>({
        method: 'PATCH',
        path,
        headers,
        body: { [field]: overLimit[field] },
        retryConfig: { maxRetries: 0 },
      }).validateSchema(PostgrestErrorSchema);

      // Then: refusal is atomic; every persisted column remains unchanged.
      expect(refused.status).toBe(400);
      expect(refused.body.code).toBe('23514');
      expect(refused.body.message).toContain(`"${constraint}"`);
      const unchanged = await apiRequest<EventRow[]>({
        method: 'GET',
        path,
        headers,
      }).validateSchema(EventRowsSchema);
      expect(unchanged.status).toBe(200);
      expect(unchanged.body).toEqual(persisted.body);
    });
  }
});
