/**
 * API coverage for fresh Settings event reads after server-side state changes.
 *
 * Target path once activated: `tests/api/events-settings-load-retry.spec.ts`.
 * Each logical Settings load issues the same two bounded PostgREST reads as
 * EventsService.getEvents(): upcoming from today ascending and past before today
 * descending. The tests repeat those exact authenticated paths around a checked
 * server-side transition, proving a mounted client can receive a fresh list or
 * the truthful empty state without changing the read contract.
 *
 * No Zod, JSON Schema, or OpenAPI response schema exists for public.events.
 * EventRow therefore comes from the generated database type and assertions cover
 * only the status, collection shape, identity, ownership, label, and date that
 * make each state transition observable.
 */
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../support/fixtures/events-settings-load-retry';
import type { Database } from '../../src/types/database.types';

type EventRow = Database['public']['Tables']['events']['Row'];

test.describe('Settings event-load freshness over PostgREST', () => {
  test('[P2] DWER-API-001 identical Settings reads expose a newly seeded event', async ({
    apiRequest,
    eventsLoadRetryHarness,
  }) => {
    await log.step('Start with a checked empty state for this worker pair');
    await eventsLoadRetryHarness.clear();

    const { upcoming, past } = eventsLoadRetryHarness.readPaths;

    await log.step('Issue the first authenticated Settings two-window read');
    const [initialUpcoming, initialPast] = await Promise.all([
      apiRequest<EventRow[]>({
        method: 'GET',
        path: upcoming,
        headers: { Authorization: `Bearer ${eventsLoadRetryHarness.token}` },
      }),
      apiRequest<EventRow[]>({
        method: 'GET',
        path: past,
        headers: { Authorization: `Bearer ${eventsLoadRetryHarness.token}` },
      }),
    ]);

    expect(initialUpcoming.status).toBe(200);
    expect(initialPast.status).toBe(200);
    expect(initialUpcoming.body).toEqual([]);
    expect(initialPast.body).toEqual([]);

    await log.step('Seed one upcoming event after the first read has settled');
    const [seeded] = await eventsLoadRetryHarness.seed([
      {
        dayOffset: 7,
        label: 'Settings Retry Fresh Upcoming API',
        description: 'Created between two identical Settings reads',
        icon: 'calendar',
      },
    ]);
    expect(seeded).toBeDefined();

    await log.step('Repeat the exact authenticated Settings two-window read');
    const [freshUpcoming, freshPast] = await Promise.all([
      apiRequest<EventRow[]>({
        method: 'GET',
        path: upcoming,
        headers: { Authorization: `Bearer ${eventsLoadRetryHarness.token}` },
      }),
      apiRequest<EventRow[]>({
        method: 'GET',
        path: past,
        headers: { Authorization: `Bearer ${eventsLoadRetryHarness.token}` },
      }),
    ]);

    expect(freshUpcoming.status).toBe(200);
    expect(freshPast.status).toBe(200);
    expect(freshPast.body).toEqual([]);
    expect(freshUpcoming.body).toHaveLength(1);
    expect(freshUpcoming.body[0]).toMatchObject({
      id: seeded.id,
      user_id: eventsLoadRetryHarness.userId,
      label: seeded.label,
      event_date: seeded.eventDate,
    });
    expect([...freshUpcoming.body, ...freshPast.body].map((row) => row.id)).toEqual([
      seeded.id,
    ]);
  });

  test('[P2] DWER-API-002 identical Settings reads become truthfully empty after checked removal', async ({
    apiRequest,
    eventsLoadRetryHarness,
  }) => {
    await log.step('Seed one uniquely identified past event for this worker pair');
    const [seeded] = await eventsLoadRetryHarness.seed([
      {
        dayOffset: -3,
        label: 'Settings Retry Removed Past API',
        description: 'Removed between two identical Settings reads',
        icon: 'calendar',
      },
    ]);
    expect(seeded).toBeDefined();

    const { upcoming, past } = eventsLoadRetryHarness.readPaths;

    await log.step('Issue the first authenticated Settings two-window read');
    const [populatedUpcoming, populatedPast] = await Promise.all([
      apiRequest<EventRow[]>({
        method: 'GET',
        path: upcoming,
        headers: { Authorization: `Bearer ${eventsLoadRetryHarness.token}` },
      }),
      apiRequest<EventRow[]>({
        method: 'GET',
        path: past,
        headers: { Authorization: `Bearer ${eventsLoadRetryHarness.token}` },
      }),
    ]);

    expect(populatedUpcoming.status).toBe(200);
    expect(populatedPast.status).toBe(200);
    expect(populatedUpcoming.body).toEqual([]);
    expect(populatedPast.body).toHaveLength(1);
    expect(populatedPast.body[0]).toMatchObject({
      id: seeded.id,
      user_id: eventsLoadRetryHarness.userId,
      label: seeded.label,
      event_date: seeded.eventDate,
    });
    expect([...populatedUpcoming.body, ...populatedPast.body].map((row) => row.id)).toEqual([
      seeded.id,
    ]);

    await log.step('Remove and verify all events owned by this worker pair');
    await eventsLoadRetryHarness.clear();

    await log.step('Repeat the exact authenticated Settings two-window read');
    const [emptyUpcoming, emptyPast] = await Promise.all([
      apiRequest<EventRow[]>({
        method: 'GET',
        path: upcoming,
        headers: { Authorization: `Bearer ${eventsLoadRetryHarness.token}` },
      }),
      apiRequest<EventRow[]>({
        method: 'GET',
        path: past,
        headers: { Authorization: `Bearer ${eventsLoadRetryHarness.token}` },
      }),
    ]);

    expect(emptyUpcoming.status).toBe(200);
    expect(emptyPast.status).toBe(200);
    expect(emptyUpcoming.body).toEqual([]);
    expect(emptyPast.body).toEqual([]);
  });
});
