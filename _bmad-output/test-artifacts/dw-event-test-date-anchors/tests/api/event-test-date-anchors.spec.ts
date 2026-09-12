/**
 * DW-61/64/69: a shared setup anchor survives a midnight crossing at the wire.
 *
 * Provider evidence: public.events in
 * supabase/migrations/20260818000002_create_events_table.sql:17-26 stores
 * event_date as date and created_at as timestamptz. Its INSERT policy requires
 * the owning user's bearer; SELECT admits both halves of the worker pair.
 * tests/api/events-wire-contract.spec.ts confirms POST 201 + an array with
 * return=representation and GET 200 ordered by event_date then created_at.
 */
import { log } from '@seontechnologies/playwright-utils';
import { z } from 'zod';
import { test, expect } from '../support/merged-fixtures';
import { createDateAnchorBatch } from '../support/factories/event-test-date-anchors';

// Test-local schema for the exact select projection, matching the table above.
const EventRowsSchema = z.array(z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  label: z.string().max(100),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  created_at: z.string(),
}));
type EventRows = z.infer<typeof EventRowsSchema>;
const EVENT_PROJECTION = 'id,user_id,label,event_date,created_at';

// Deliberately oppose request order with fixed instants one second apart.
// They control only the created_at tiebreak, independently of event dates.
const EARLIER_CREATED_AT = '2000-01-01T00:00:00.000Z';
const LATER_CREATED_AT = '2000-01-01T00:00:01.000Z';

test('[P1] DW.DATE-API-001 one anchor keeps own and partner dates tied across setup midnight', async ({
  apiRequest,
  authToken,
  partnerAuthToken,
  coupleEvents,
}) => {
  // GIVEN: offset zero is calculated before and after simulated local midnight.
  // The factory restores Node Date synchronously, before these network awaits.
  // coupleEvents owns checked cleanup before and after this test, even on failure.
  const batch = createDateAnchorBatch();

  await log.step('Create the own row first with the later tiebreak timestamp');
  const own = await apiRequest<EventRows>({
    method: 'POST',
    path: `/rest/v1/events?select=${EVENT_PROJECTION}`,
    headers: { Authorization: `Bearer ${authToken}`, Prefer: 'return=representation' },
    // These are non-idempotent writes; retrying an ambiguous 5xx could insert twice.
    retryConfig: { maxRetries: 0 },
    body: {
      user_id: coupleEvents.userId,
      label: batch.before.label,
      event_date: batch.before.date,
      created_at: LATER_CREATED_AT,
    },
  }).validateSchema<EventRows>(EventRowsSchema);
  expect(own.status).toBe(201);
  expect(own.body).toHaveLength(1);
  expect(own.body[0]).toMatchObject({
    user_id: coupleEvents.userId,
    label: batch.before.label,
    event_date: batch.expectedSameDate,
  });

  await log.step('Create the partner row using the date calculated after midnight');
  const partner = await apiRequest<EventRows>({
    method: 'POST',
    path: `/rest/v1/events?select=${EVENT_PROJECTION}`,
    headers: { Authorization: `Bearer ${partnerAuthToken}`, Prefer: 'return=representation' },
    retryConfig: { maxRetries: 0 },
    body: {
      user_id: coupleEvents.partnerId,
      label: batch.after.label,
      event_date: batch.after.date,
      created_at: EARLIER_CREATED_AT,
    },
  }).validateSchema<EventRows>(EventRowsSchema);
  expect(partner.status).toBe(201);
  expect(partner.body).toHaveLength(1);
  expect(partner.body[0]).toMatchObject({
    user_id: coupleEvents.partnerId,
    label: batch.after.label,
    event_date: batch.expectedSameDate,
  });

  // WHEN: read committed rows with the signed-in creator's real bearer.
  // No user_id filter: this also proves the partner row reaches the shared read.
  await log.step('Read the persisted equal dates in created_at order');
  const listed = await apiRequest<EventRows>({
    method: 'GET',
    path: `/rest/v1/events?select=${EVENT_PROJECTION}&order=event_date.asc,created_at.asc`,
    headers: { Authorization: `Bearer ${authToken}` },
  }).validateSchema<EventRows>(EventRowsSchema);

  // THEN: the later request sorts first because both dates remain December 31.
  // Re-reading Date during the batch instead would put the partner on January 1.
  expect(listed.status).toBe(200);
  expect(listed.body.map(({ id, user_id, label, event_date }) => ({
    id, user_id, label, event_date,
  }))).toEqual([
    {
      id: partner.body[0].id,
      user_id: coupleEvents.partnerId,
      label: batch.after.label,
      event_date: batch.expectedSameDate,
    },
    {
      id: own.body[0].id,
      user_id: coupleEvents.userId,
      label: batch.before.label,
      event_date: batch.expectedSameDate,
    },
  ]);
  expect(listed.body.map((row) => new Date(row.created_at).getTime())).toEqual([
    new Date(EARLIER_CREATED_AT).getTime(),
    new Date(LATER_CREATED_AT).getTime(),
  ]);
});
