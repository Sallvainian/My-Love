/**
 * Target path once activated: `tests/api/events-load-mutation-contract.spec.ts`.
 *
 * P1 API contract for event mutation-journal inputs.
 *
 * DWEA-API-001 pins the singular row returned by the same PostgREST headers as
 * eventsService.createEvent().select().single(). Every column is required by the
 * client-side upsert journal: stable identity/ownership, display fields, and
 * server timestamps.
 *
 * DWEA-API-002 pins the creator-delete durability boundary before the store
 * records a tombstone. It mirrors deleteEvent().select(): the DELETE must return
 * a one-row collection containing exactly the row that disappeared, and a
 * subsequent authenticated collection read by id must return no rows.
 *
 * No response Zod schema, JSON Schema, or OpenAPI document exists for events.
 * EventRow therefore comes from the generated database type, while the explicit
 * assertions below cover only the response fields under test.
 */
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../support/fixtures/events-load-concurrency';
import type { Database } from '../../src/types/database.types';

type EventRow = Database['public']['Tables']['events']['Row'];

const SINGULAR_REPRESENTATION_HEADERS = {
  Prefer: 'return=representation',
  Accept: 'application/vnd.pgrst.object+json',
} as const;

const EVENT_ROW_REQUIRED_KEYS = [
  'created_at',
  'description',
  'event_date',
  'icon',
  'id',
  'label',
  'updated_at',
  'user_id',
];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test.describe('Events load-concurrency mutation boundary over PostgREST', () => {
  test('[P1] DWEA-API-001 creator POST returns one complete row for mutation-journal upsert', async ({
    request,
    eventApiHarness,
  }) => {
    const label = eventApiHarness.label('API create journal payload');
    const eventDate = eventApiHarness.date(30);
    const description = 'Complete row returned for the concurrent-load upsert journal';

    await log.step('POST /rest/v1/events as the current worker creator');
    // playwright-utils deviation: apiRequest only parses media types containing
    // `application/json`, so it turns PostgREST's required singular vendor
    // representation into `null`. Raw response parsing is the subject here.
    const response = await request.post('/rest/v1/events?select=*', {
      headers: {
        Authorization: 'Bearer ' + eventApiHarness.creator.token,
        ...SINGULAR_REPRESENTATION_HEADERS,
      },
      data: {
        user_id: eventApiHarness.creator.id,
        label,
        event_date: eventDate,
        description,
        icon: 'plane',
      },
    });
    const status = response.status();
    const body = (await response.json()) as EventRow;

    expect(status).toBe(201);
    expect(Array.isArray(body)).toBe(false);
    expect(Object.keys(body)).toEqual(expect.arrayContaining(EVENT_ROW_REQUIRED_KEYS));
    expect(body).toMatchObject({
      user_id: eventApiHarness.creator.id,
      label,
      event_date: eventDate,
      description,
      icon: 'plane',
    });
    expect(body.id).toMatch(UUID_PATTERN);
    expect(Number.isNaN(Date.parse(body.created_at))).toBe(false);
    expect(Number.isNaN(Date.parse(body.updated_at))).toBe(false);

    await log.step('Confirm the returned upsert payload is the durable event row');
    const persisted = await eventApiHarness.find(body.id);
    expect(persisted).toEqual(body);
  });

  test('[P1] DWEA-API-002 creator DELETE returns a one-row collection before a follow-up GET returns none', async ({
    apiRequest,
    eventApiHarness,
  }) => {
    const seeded = await eventApiHarness.seed({
      owner: 'creator',
      label: eventApiHarness.label('API delete tombstone boundary'),
      dayOffset: 45,
      description: 'Creator row deleted before the client records its tombstone',
      icon: 'calendar',
    });
    const beforeDelete = await eventApiHarness.find(seeded.id);
    expect(beforeDelete).not.toBeNull();

    await log.step('DELETE /rest/v1/events by id as the current worker creator');
    const deleted = await apiRequest<EventRow[]>({
      method: 'DELETE',
      path: '/rest/v1/events?id=eq.' + seeded.id + '&select=*',
      headers: {
        Authorization: 'Bearer ' + eventApiHarness.creator.token,
        Prefer: 'return=representation',
      },
    });

    expect(deleted.status).toBe(200);
    expect(Array.isArray(deleted.body)).toBe(true);
    expect(deleted.body).toHaveLength(1);
    expect(Object.keys(deleted.body[0])).toEqual(expect.arrayContaining(EVENT_ROW_REQUIRED_KEYS));
    expect(deleted.body[0]).toEqual(beforeDelete);
    expect(deleted.body[0]).toMatchObject({
      id: seeded.id,
      user_id: eventApiHarness.creator.id,
      label: seeded.label,
      event_date: seeded.eventDate,
    });

    await log.step('GET the deleted event by id as the same authenticated creator');
    const afterDelete = await apiRequest<EventRow[]>({
      method: 'GET',
      path: '/rest/v1/events?id=eq.' + seeded.id + '&select=*',
      headers: {
        Authorization: 'Bearer ' + eventApiHarness.creator.token,
      },
    });

    expect(afterDelete.status).toBe(200);
    expect(Array.isArray(afterDelete.body)).toBe(true);
    expect(afterDelete.body).toEqual([]);
    expect(await eventApiHarness.find(seeded.id)).toBeNull();
  });
});
