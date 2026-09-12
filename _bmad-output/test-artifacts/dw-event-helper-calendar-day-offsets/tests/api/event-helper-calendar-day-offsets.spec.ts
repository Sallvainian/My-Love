/**
 * DW-84: the Nuuk calendar-day result survives persistence and a partner read.
 *
 * Provider evidence: supabase/migrations/20260818000002_create_events_table.sql
 * declares event_date as date, creator-only INSERT and couple-shared SELECT.
 * tests/api/events-wire-contract.spec.ts records POST 201 with an array for
 * return=representation and GET 200 with the same bare YYYY-MM-DD value.
 */
import { log } from '@seontechnologies/playwright-utils';
import { z } from 'zod';
import { test, expect } from '../support/merged-fixtures';
import { createNuukGapCase } from '../support/factories/event-helper-calendar-day-offsets';

// Test-local schema for precisely the table columns selected below.
const EventRowsSchema = z.array(z.strictObject({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  label: z.string().max(100),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}));
type EventRows = z.infer<typeof EventRowsSchema>;
const EVENT_PROJECTION = 'id,user_id,label,event_date';

test('[P1] DW84-API-001 the partner reads March 28 from the Nuuk +1 helper date', async ({
  apiRequest,
  authToken,
  partnerAuthToken,
  coupleEvents,
}) => {
  // GIVEN: actual helper output from local March 27, 2026 at 23:30 in Nuuk.
  // The factory isolates its timezone in a child and returns the computed date;
  // the literal response assertion below is independent of that calculation.
  // coupleEvents owns checked cleanup before and after, including failures.
  const gap = createNuukGapCase();

  await log.step('Create the event using the actual Nuuk helper result');
  const created = await apiRequest<EventRows>({
    method: 'POST',
    path: `/rest/v1/events?select=${EVENT_PROJECTION}`,
    headers: { Authorization: `Bearer ${authToken}`, Prefer: 'return=representation' },
    // INSERT has no idempotency key: an ambiguous 5xx must not duplicate the row.
    retryConfig: { maxRetries: 0 },
    body: {
      user_id: coupleEvents.userId,
      label: gap.label,
      event_date: gap.date,
    },
  }).validateSchema<EventRows>(EventRowsSchema);
  expect(created.status).toBe(201);
  expect(created.body).toHaveLength(1);
  const expectedEvent = {
    id: created.body[0].id,
    user_id: coupleEvents.userId,
    label: gap.label,
    event_date: '2026-03-28',
  };
  expect(created.body).toEqual([expectedEvent]);

  // WHEN: the other half of this worker's couple reads the committed row.
  await log.step('Read the persisted calendar date with the partner bearer');
  const listed = await apiRequest<EventRows>({
    method: 'GET',
    path: `/rest/v1/events?select=${EVENT_PROJECTION}&id=eq.${expectedEvent.id}`,
    headers: { Authorization: `Bearer ${partnerAuthToken}` },
  }).validateSchema<EventRows>(EventRowsSchema);

  // THEN: a separate authenticated read retains the intended calendar day.
  expect(listed.status).toBe(200);
  expect(listed.body).toEqual([expectedEvent]);
});
