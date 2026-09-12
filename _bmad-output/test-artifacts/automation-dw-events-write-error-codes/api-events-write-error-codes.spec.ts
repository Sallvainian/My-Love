/**
 * P1 API contract for coded event-write failures.
 *
 * Target path once activated: `tests/api/events-write-error-codes.spec.ts`.
 *
 * DWEW-API-001 and DWEW-API-002 pin the successful zero-row response that
 * EventsService converts to EventWriteError code not-found. The partner can
 * read the creator row through events_select, but creator-only UPDATE/DELETE
 * policies filter the write to zero affected rows.
 *
 * The historical skipped Story 5 ATDD scaffold measured the same premise.
 * These active cases supersede it and use the current shared eventWriteHarness
 * for checked pair-scoped setup, observation, and cleanup.
 *
 * No JSON Schema, Zod schema, or OpenAPI schema exists for the zero-row events
 * representation. The tests therefore assert HTTP status, array shape, zero
 * length, and the checked database state that the wire response claims.
 */
import { log } from '@seontechnologies/playwright-utils';
import { test, expect } from '../support/fixtures/events-write-errors';

type EmptyEventRepresentation = unknown[];

test.describe('Events write error-code API contract', () => {
  test('[P1] DWEW-API-001 partner PATCH returns 200 [] and leaves the creator event unchanged', async ({
    apiRequest,
    eventWriteHarness,
  }) => {
    const seeded = await eventWriteHarness.seed({
      owner: 'creator',
      label: 'Write Error API Patch Seed',
      dayOffset: 30,
      description: 'Creator-owned row for the RLS-filtered PATCH contract',
      icon: 'calendar',
    });

    await log.step('PATCH the creator event as its partner with the service representation header');
    const { status, body } = await apiRequest<EmptyEventRepresentation>({
      method: 'PATCH',
      path: '/rest/v1/events?id=eq.' + seeded.id,
      headers: {
        Authorization: 'Bearer ' + eventWriteHarness.partner.token,
        Prefer: 'return=representation',
      },
      body: {
        label: 'Write Error API Partner Overwrite',
        updated_at: '2035-01-02T03:04:05.000Z',
      },
    });

    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);

    await log.step('Verify the creator row still exists with its original values');
    const after = await eventWriteHarness.find(seeded.id);

    expect(after).toMatchObject({
      id: seeded.id,
      user_id: eventWriteHarness.creator.id,
      label: seeded.label,
      event_date: seeded.eventDate,
    });
  });

  test('[P1] DWEW-API-002 partner DELETE returns 200 [] and leaves the creator event present', async ({
    apiRequest,
    eventWriteHarness,
  }) => {
    const seeded = await eventWriteHarness.seed({
      owner: 'creator',
      label: 'Write Error API Delete Seed',
      dayOffset: 45,
      description: 'Creator-owned row for the RLS-filtered DELETE contract',
      icon: 'calendar',
    });

    await log.step('DELETE the creator event as its partner with the service representation header');
    const { status, body } = await apiRequest<EmptyEventRepresentation>({
      method: 'DELETE',
      path: '/rest/v1/events?id=eq.' + seeded.id,
      headers: {
        Authorization: 'Bearer ' + eventWriteHarness.partner.token,
        Prefer: 'return=representation',
      },
    });

    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);

    await log.step('Verify the creator row survived the filtered delete');
    const after = await eventWriteHarness.find(seeded.id);

    expect(after).toMatchObject({
      id: seeded.id,
      user_id: eventWriteHarness.creator.id,
      label: seeded.label,
      event_date: seeded.eventDate,
    });
  });
});
