/**
 * DW-41: production keyset service against the worker's real PostgREST API.
 * Provider evidence: src/services/eventsService.ts:285-359 (50 + lookahead,
 * raw date/timestamp/ID cursor); events table and creator-only DELETE policy in
 * supabase/migrations/20260818000002_create_events_table.sql:17-26,96-101.
 *
 * The reader loads the real service through Vite SSR and replaces only its
 * client singleton with supabaseAsUser. No query or paging algorithm is copied.
 * No reusable events response schema exists; assertions cover paging, ordering,
 * ownership and DELETE fields under test. Existing event wire tests own shape.
 * coupleEvents owns batch setup and cleanup for this worker's pair only.
 */
import { log } from '@seontechnologies/playwright-utils';
import type { EventsPagination } from '../../../../src/services/eventsService';
import type { EventSpec } from '../../../../tests/support/factories/events';
import { formatDateISO } from '../../../../src/utils/dateUtils';
import { test, expect } from '../../../../tests/support/merged-fixtures';
import { createEventsPageReader } from '../fixtures/events-page-reader';

/** Fix the read boundary to the same local calendar day as the seed factory. */
function startingAt(anchor: Date): EventsPagination {
  return {
    todayISO: formatDateISO(anchor),
    upcoming: { cursor: null, hasMore: true },
    past: { cursor: null, hasMore: true },
  };
}

test.describe('DW-41 history keyset API', () => {
  for (const direction of [
    { window: 'upcoming', other: 'past', sign: 1, testId: 'DW-41-API-001' },
    { window: 'past', other: 'upcoming', sign: -1, testId: 'DW-41-API-002' },
  ] as const) {
    test(`[P1] ${direction.testId} ${direction.window} continuation keeps every unread row after consumed-row deletion`, async ({
      apiRequest,
      authToken,
      coupleEvents,
      supabaseAsUser,
    }) => {
      await log.step(`Seed three ${direction.window} pages for this worker pair`);
      const seeded = await coupleEvents.seed(Array.from({ length: 103 }, (_, index) => ({
        label: `DW41 ${direction.window} deletion ${index}`,
        dayOffset: direction.sign * (index + 1),
        owner: index % 2 ? 'partner' as const : 'self' as const,
      })));
      const displayIds = (from: number, to: number) => {
        const ids = seeded.slice(from, to).map((row) => row.id);
        return direction.sign === 1 ? ids : ids.reverse();
      };
      // playwright-utils deviation: the production service uses the authenticated
      // Supabase SDK so its actual keyset query and serialization are exercised.
      const reader = await createEventsPageReader(supabaseAsUser);
      try {
        const first = await reader.getEventsPage(startingAt(coupleEvents.anchor));
        expect(first.events.map((event) => event.id)).toEqual(displayIds(0, 50));
        expect(first.pagination[direction.window]).toMatchObject({
          hasMore: true,
          cursor: { id: seeded[49].id, event_date: seeded[49].eventDate },
        });
        expect(first.pagination[direction.other]).toEqual({ cursor: null, hasMore: false });
        const savedPagination = structuredClone(first.pagination);
        const consumed = seeded[10];
        expect(consumed.ownerId).toBe(coupleEvents.userId);

        await log.step('Delete an already-consumed own row before the next page');
        const deletion = await apiRequest<{ id: string }[]>({
          method: 'DELETE',
          path: `/rest/v1/events?id=eq.${consumed.id}&select=id`,
          headers: { Authorization: `Bearer ${authToken}`, Prefer: 'return=representation' },
        });
        expect(deletion.status).toBe(200);
        expect(deletion.body).toEqual([{ id: consumed.id }]);

        await log.step('Continue using the original cursor through both remaining pages');
        const second = await reader.getEventsPage(first.pagination);
        expect(first.pagination).toEqual(savedPagination);
        expect(second.events.map((event) => event.id)).toEqual(displayIds(50, 100));
        expect(second.pagination[direction.window]).toMatchObject({
          hasMore: true,
          cursor: { id: seeded[99].id },
        });
        expect(second.pagination[direction.other]).toEqual(first.pagination[direction.other]);

        const third = await reader.getEventsPage(second.pagination);
        expect(third.events.map((event) => event.id)).toEqual(displayIds(100, 103));
        expect(third.pagination[direction.window]).toMatchObject({
          hasMore: false,
          cursor: { id: seeded[102].id },
        });
        expect(third.pagination.todayISO).toBe(first.pagination.todayISO);
        expect(third.pagination[direction.other]).toEqual(first.pagination[direction.other]);
        const unreadIds = [...second.events, ...third.events].map((event) => event.id);
        expect(new Set(unreadIds).size).toBe(53);
        expect(unreadIds).not.toContain(consumed.id);
        expect(new Set([...second.events, ...third.events].map((event) => event.userId)))
          .toEqual(new Set([coupleEvents.userId, coupleEvents.partnerId]));
      } finally {
        await reader.close();
      }
    });
  }

  test('[P1] DW-41-API-003 raw microseconds and ID ties cross both page boundaries without dropping partner rows', async ({
    apiRequest,
    authToken,
    coupleEvents,
    supabaseAsUser,
  }) => {
    await log.step('Seed tied pairs within one JavaScript millisecond in both date windows');
    // At 54 rows per side, the 50-row ascending boundary cuts the pair at
    // indexes 49/50; descending cuts indexes 3/4. Each tail also contains rows
    // with different microseconds, requiring the created_at cursor branch.
    const specs: EventSpec[] = Array.from({ length: 108 }, (_, index) => ({
      label: `DW41 precision ${index}`,
      dayOffset: index < 54 ? -10 : 10,
      createdAt: `2026-01-01T12:00:00.123${String(Math.floor(((index % 54) + 1) / 2)).padStart(3, '0')}Z`,
      owner: index % 2 ? 'partner' : 'self',
    }));
    const seeded = await coupleEvents.seed(specs);
    const expected = seeded.map((row, index) => ({ ...row, createdAt: specs[index].createdAt! }))
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate) ||
        a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    const past = expected.slice(0, 54);
    const upcoming = expected.slice(54);
    const firstIds = [...past.slice(4), ...upcoming.slice(0, 50)].map((row) => row.id);
    const remaining = [...past.slice(0, 4), ...upcoming.slice(50)];
    // playwright-utils deviation: exercise production Supabase serialization;
    // direct apiRequest below remains the HTTP client for the DELETE operation.
    const reader = await createEventsPageReader(supabaseAsUser);
    try {
      const first = await reader.getEventsPage(startingAt(coupleEvents.anchor));
      expect(first.events.map((event) => event.id)).toEqual(firstIds);
      expect(first.pagination.upcoming).toMatchObject({
        hasMore: true,
        cursor: { id: upcoming[49].id, event_date: upcoming[49].eventDate },
      });
      expect(first.pagination.past).toMatchObject({
        hasMore: true,
        cursor: { id: past[4].id, event_date: past[4].eventDate },
      });
      expect(first.pagination.upcoming.cursor!.created_at.replace(/\+00:00$/, 'Z'))
        .toBe(upcoming[49].createdAt);
      expect(first.pagination.past.cursor!.created_at.replace(/\+00:00$/, 'Z'))
        .toBe(past[4].createdAt);
      expect(upcoming[49].createdAt).toBe(upcoming[50].createdAt);
      expect(past[3].createdAt).toBe(past[4].createdAt);

      await log.step('A partner-owned unread row rejects DELETE and remains discoverable');
      const partnerTail = remaining.find((row) => row.ownerId === coupleEvents.partnerId)!;
      expect(partnerTail).toBeDefined();
      const refused = await apiRequest<{ id: string }[]>({
        method: 'DELETE',
        path: `/rest/v1/events?id=eq.${partnerTail.id}&select=id`,
        headers: { Authorization: `Bearer ${authToken}`, Prefer: 'return=representation' },
      });
      // PostgREST filters a forbidden creator-only DELETE to a successful empty
      // representation; the later page provides the unchanged-row witness.
      expect(refused.status).toBe(200);
      expect(refused.body).toEqual([]);

      await log.step('Read both tails in exact server order and exhaust both windows');
      const second = await reader.getEventsPage(first.pagination);
      expect(second.events.map((event) => event.id)).toEqual(remaining.map((row) => row.id));
      expect(second.events.find((event) => event.id === partnerTail.id)).toMatchObject({
        userId: coupleEvents.partnerId,
        label: partnerTail.label,
      });
      expect(second.pagination.upcoming.hasMore).toBe(false);
      expect(second.pagination.past.hasMore).toBe(false);
      expect(new Set([...first.events, ...second.events].map((event) => event.id)).size).toBe(108);
    } finally {
      await reader.close();
    }
  });
});
