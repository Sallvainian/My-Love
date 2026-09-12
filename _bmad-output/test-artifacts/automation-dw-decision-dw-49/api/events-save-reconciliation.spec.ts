/**
 * DW-49: server preconditions for reconciling an uncertain event save.
 *
 * Provider evidence: src/services/eventsService.ts createEvent uses
 * .insert(...).select().single(); updateEvent uses .update(...).eq(...).select().
 * supabase/migrations/20260818000002_create_events_table.sql defines the row,
 * authenticated owner writes/couple reads, and client-maintained updated_at.
 * The installed postgrest-js PostgrestTransformBuilder.single sets the vendor
 * object Accept header; select appends Prefer: return=representation.
 *
 * No response schema exists for /rest/v1/events; generated database types and
 * assertions cover the representation, saved values, identity and timestamp.
 * Browser cases own response corruption and the no-resubmission UI contract.
 * coupleEvents clears this worker pair before and after each case.
 */
import { log } from '@seontechnologies/playwright-utils';
import type { Database } from '../../../../src/types/database.types';
import { test, expect } from '../../../../tests/support/merged-fixtures';
import { makeSaveInput } from '../fixtures/uncertain-events';

type EventRow = Database['public']['Tables']['events']['Row'];

test.describe('DW-49 event save reconciliation API', () => {
  test('[P2] DW49-API-001 single-object create remains exactly one row across reconciliation reads', async ({
    request,
    apiRequest,
    authToken,
    coupleEvents,
  }) => {
    const input = makeSaveInput(coupleEvents.userId, coupleEvents.anchor);

    await log.step('Commit one POST using the production single-object representation');
    // playwright-utils deviation: apiRequest only parses application/json and
    // discards application/vnd.pgrst.object+json; use the raw request and parse
    // only this POST to preserve the production .single() wire negotiation.
    const response = await request.post('/rest/v1/events?select=*', {
      headers: {
        Authorization: `Bearer ${authToken}`,
        Accept: 'application/vnd.pgrst.object+json',
        Prefer: 'return=representation',
      },
      data: input,
      maxRetries: 0,
    });
    expect(response.status()).toBe(201);
    expect(response.headers()['content-type']).toContain('application/vnd.pgrst.object+json');
    // playwright-utils deviation: parse the vendor JSON body apiRequest drops.
    const committed: EventRow = await response.json();
    expect(Array.isArray(committed)).toBe(false);
    expect(committed).toMatchObject({
      user_id: input.user_id,
      label: input.label,
      event_date: input.event_date,
      description: input.description,
      icon: input.icon,
    });
    expect(committed.id).toEqual(expect.any(String));
    expect(committed.updated_at).toEqual(expect.any(String));

    // These are two completed reads, not eventual-consistency polling. The
    // response above is awaited before either read and no POST is repeated.
    for (const attempt of [1, 2]) {
      await log.step(`Reconciliation read ${attempt} returns the same committed row`);
      const reconciliation = await apiRequest<EventRow[]>({
        method: 'GET',
        path: '/rest/v1/events',
        params: { select: '*' },
        headers: { Authorization: `Bearer ${authToken}`, Accept: 'application/json' },
      });
      expect(reconciliation.status).toBe(200);
      expect(reconciliation.body).toEqual([committed]);
    }
  });

  test('[P2] DW49-API-002 array update preserves identity and timestamp across reconciliation reads', async ({
    apiRequest,
    authToken,
    coupleEvents,
  }) => {
    const input = makeSaveInput(coupleEvents.userId, coupleEvents.anchor);
    const [seeded] = await coupleEvents.seed([{
      label: input.label,
      dayOffset: 10,
      description: 'Before uncertain update',
      icon: 'calendar',
    }]);
    const headers = { Authorization: `Bearer ${authToken}`, Accept: 'application/json' };
    const original = await apiRequest<EventRow[]>({
      method: 'GET',
      path: '/rest/v1/events',
      params: { select: '*' },
      headers,
    });
    expect(original.status).toBe(200);
    expect(original.body).toHaveLength(1);
    expect(original.body[0].id).toBe(seeded.id);

    // A distinct client-maintained timestamp derived from the saved baseline
    // makes a write observable without sleeps or same-millisecond races.
    const updatedAt = new Date(Date.parse(original.body[0].updated_at) + 1000).toISOString();
    const edited = makeSaveInput(coupleEvents.userId, coupleEvents.anchor, {
      description: 'Saved once; reconciled through reads',
      icon: 'plane',
    });
    const updates = {
      label: edited.label,
      event_date: edited.event_date,
      description: edited.description,
      icon: edited.icon,
      updated_at: updatedAt,
    };

    await log.step('Commit one PATCH using the production array representation');
    const patched = await apiRequest<EventRow[]>({
      method: 'PATCH',
      path: '/rest/v1/events',
      params: { id: `eq.${seeded.id}`, select: '*' },
      headers: { ...headers, Prefer: 'return=representation' },
      body: updates,
      retryConfig: { maxRetries: 0 },
    });
    expect(patched.status).toBe(200);
    expect(Array.isArray(patched.body)).toBe(true);
    expect(patched.body).toHaveLength(1);
    expect(patched.body[0]).toMatchObject({
      id: seeded.id,
      user_id: coupleEvents.userId,
      label: edited.label,
      event_date: edited.event_date,
      description: edited.description,
      icon: edited.icon,
      created_at: original.body[0].created_at,
    });
    // PostgreSQL's offset formatting can differ from the sent ISO string.
    expect(Date.parse(patched.body[0].updated_at)).toBe(Date.parse(updatedAt));
    expect(patched.body[0].updated_at).not.toBe(original.body[0].updated_at);

    for (const attempt of [1, 2]) {
      await log.step(`Reconciliation read ${attempt} retains the update without another write`);
      const reconciliation = await apiRequest<EventRow[]>({
        method: 'GET',
        path: '/rest/v1/events',
        params: { select: '*' },
        headers,
      });
      expect(reconciliation.status).toBe(200);
      expect(reconciliation.body).toEqual(patched.body);
    }
  });
});
