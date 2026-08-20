/**
 * P0/P1 API: the bounded two-window events read, against the real server
 *
 * `eventsService.getEvents(limit = 50, offset = 0)` reads a bounded page on
 * each side of today — upcoming `gte` today ascending, already-passed `lt`
 * today descending — and merges them back into one ascending list (DW-9).
 * `tests/unit/services/eventsService.test.ts` pins that the service BUILDS
 * that chain: its fake records every bound, ordering and range and asserts on
 * them. What the fake cannot say is whether the chain MEANS what the service
 * assumes, because its `.range()` is the test file's own
 * `found.slice(from, to + 1)`.
 *
 * That gap is named in the story's own review log: "what remains unexercised
 * is the Supabase client's own `.range` implementation"
 * (`_bmad-output/implementation-artifacts/spec-dw-9-22-events-read-cap-and-pagination.md`,
 * Review Triage Log, dismissed item "No test crosses the read cap against a
 * real database"). This file closes it. Every read below is issued by
 * `@supabase/supabase-js` — the same client `src/api/supabaseClient.ts` builds
 * — against the running local PostgREST, under a real user's JWT so
 * `events_select` applies.
 *
 * The pairing is deliberate and neither half stands alone:
 * - the unit file proves the service asks for THIS window,
 * - this file proves THIS window behaves as assumed against Postgres.
 *
 * The chain below is therefore a deliberate mirror of
 * `src/services/eventsService.ts:getEvents`. It cannot import the service:
 * `src/api/supabaseClient.ts:20-21` reads `import.meta.env`, which is a Vite
 * build-time substitution with no value under the Playwright runner. A change
 * to the production chain that is not made here shows up as the unit file's
 * `backend.queries` assertions going red, not as a silent pass — those
 * assertions are what pin production's shape.
 *
 * ## Playwright Utils deviation
 *
 * `apiRequest` is the mandated HTTP client, and it is not used here. See the
 * comment on `readEventWindows`.
 *
 * ## Cleanup
 *
 * The `coupleEvents` fixture clears this worker pair's events before and after
 * every test, so nothing seeded here outlives its test.
 */
import { test, expect } from '../support/merged-fixtures';
import type { TypedSupabaseClient } from '../support/factories';
import { formatDateISO } from '../../src/utils/dateUtils';
import type { Database } from '../../src/types/database.types';

type EventRow = Database['public']['Tables']['events']['Row'];

/** The two pages one `getEvents` call reads, exactly as the server returned them. */
interface EventWindows {
  upcoming: EventRow[];
  past: EventRow[];
}

/**
 * Issue the two bounded reads `getEvents` issues, and return both pages raw.
 *
 * The merge (`reverse` → drop the stale duplicate → concat) is NOT reproduced:
 * it is pure client-side logic already covered at unit level, and re-deriving
 * it here would put a second copy of production's algorithm inside its own
 * test. What is under test is the pair of server answers the merge is handed.
 *
 * playwright-utils deviation: `apiRequest` would send a URL this file wrote by
 * hand, so the assertions would rest on a transcription of how postgrest-js
 * serialises `.range()` / `.order()` / `.gte()` rather than on the
 * serialisation itself — and that serialisation is the one thing the unit
 * fake cannot cover, so it is precisely what this file exists to exercise.
 * `.range(from, to)` currently emits `?offset=<from>&limit=<to-from+1>`
 * (`@supabase/postgrest-js/src/PostgrestTransformBuilder.ts:567-573`); an
 * upgrade that moved it back to the `Range` header would break the app and
 * leave a hand-written URL green. Driving the real client is what makes that
 * failure reachable.
 */
async function readEventWindows(
  client: TypedSupabaseClient,
  todayISO: string,
  limit: number,
  offset: number
): Promise<EventWindows> {
  const lastRow = offset + limit - 1;

  const [upcoming, past] = await Promise.all([
    client
      .from('events')
      .select('*')
      .gte('event_date', todayISO)
      .order('event_date', { ascending: true })
      .order('created_at', { ascending: true })
      .range(offset, lastRow),
    client
      .from('events')
      .select('*')
      .lt('event_date', todayISO)
      .order('event_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, lastRow),
  ]);

  if (upcoming.error) {
    throw new Error(`upcoming window failed: ${upcoming.error.message}`);
  }
  if (past.error) {
    throw new Error(`past window failed: ${past.error.message}`);
  }

  return { upcoming: upcoming.data ?? [], past: past.data ?? [] };
}

const labelsOf = (rows: EventRow[]): string[] => rows.map((row) => row.label);

test.describe('The bounded two-window events read', () => {
  test('[P0] caps the upcoming window at the limit, keeping the soonest events', async ({
    coupleEvents,
    supabaseAsUser,
  }) => {
    // Five upcoming against a limit of two. Seeded out of date order so the
    // assertion pins "the two SOONEST" rather than "the first two rows the
    // table happened to hand back".
    await coupleEvents.seed([
      { dayOffset: 12, label: 'Window Fourth API' },
      { dayOffset: 3, label: 'Window First API' },
      { dayOffset: 20, label: 'Window Fifth API' },
      { dayOffset: 9, label: 'Window Third API' },
      { dayOffset: 6, label: 'Window Second API' },
      { dayOffset: -4, label: 'Window Bygone API' },
    ]);

    const { upcoming } = await readEventWindows(
      supabaseAsUser,
      formatDateISO(coupleEvents.anchor),
      2,
      0
    );

    // Exactly two rows came back, so the truncation happened at the server
    // rather than in whatever the caller does next. Five rows match the
    // predicate; a `.range()` the server ignored would return all five.
    expect(upcoming).toHaveLength(2);
    expect(labelsOf(upcoming)).toEqual(['Window First API', 'Window Second API']);
  });

  test('[P0] a past history longer than the limit never crowds the next event out', async ({
    coupleEvents,
    supabaseAsUser,
  }) => {
    // The failure a single ascending `.range(0, limit - 1)` would produce, and
    // the reason the read is split at today at all: past events accumulate
    // forever, so an ascending page eventually holds nothing but past rows
    // while a real event is days away.
    await coupleEvents.seed([
      { dayOffset: -1, label: 'History A API' },
      { dayOffset: -2, label: 'History B API' },
      { dayOffset: -3, label: 'History C API' },
      { dayOffset: -4, label: 'History D API' },
      { dayOffset: -5, label: 'History E API' },
      { dayOffset: -6, label: 'History F API' },
      { dayOffset: 9, label: 'Next Up API' },
    ]);

    const { upcoming, past } = await readEventWindows(
      supabaseAsUser,
      formatDateISO(coupleEvents.anchor),
      2,
      0
    );

    // Six past rows do not consume the upcoming page, because they are not in
    // it: the windows are disjoint by predicate, not by ordering luck.
    expect(labelsOf(upcoming)).toEqual(['Next Up API']);
    expect(labelsOf(past)).toEqual(['History A API', 'History B API']);
  });

  test('[P1] the past window keeps the most recent past events, newest first', async ({
    coupleEvents,
    supabaseAsUser,
  }) => {
    // Descending is what makes the cap keep the rows a wrong date is still
    // worth correcting; `getEvents` reverses this page to rebuild the
    // ascending contract, which only works if the server ordered it this way.
    await coupleEvents.seed([
      { dayOffset: -5, label: 'Recent E API' },
      { dayOffset: -1, label: 'Recent A API' },
      { dayOffset: -3, label: 'Recent C API' },
      { dayOffset: -2, label: 'Recent B API' },
      { dayOffset: -4, label: 'Recent D API' },
    ]);

    const { past } = await readEventWindows(
      supabaseAsUser,
      formatDateISO(coupleEvents.anchor),
      2,
      0
    );

    expect(past).toHaveLength(2);
    expect(labelsOf(past)).toEqual(['Recent A API', 'Recent B API']);
  });

  test('[P1] offset pages outward from today on both sides', async ({
    coupleEvents,
    supabaseAsUser,
  }) => {
    await coupleEvents.seed([
      { dayOffset: 2, label: 'Page Up 1 API' },
      { dayOffset: 4, label: 'Page Up 2 API' },
      { dayOffset: 6, label: 'Page Up 3 API' },
      { dayOffset: 8, label: 'Page Up 4 API' },
      { dayOffset: -2, label: 'Page Back 1 API' },
      { dayOffset: -4, label: 'Page Back 2 API' },
      { dayOffset: -6, label: 'Page Back 3 API' },
      { dayOffset: -8, label: 'Page Back 4 API' },
    ]);

    const todayISO = formatDateISO(coupleEvents.anchor);
    const firstPage = await readEventWindows(supabaseAsUser, todayISO, 2, 0);
    const secondPage = await readEventWindows(supabaseAsUser, todayISO, 2, 2);

    // Page 1 is the next two rows outward on each side — further into the
    // future on one, further into the past on the other. That is what "walks
    // outward from today in both directions" means, and it is why successive
    // pages do not concatenate the way `photoService`'s do.
    expect(labelsOf(secondPage.upcoming)).toEqual(['Page Up 3 API', 'Page Up 4 API']);
    expect(labelsOf(secondPage.past)).toEqual(['Page Back 3 API', 'Page Back 4 API']);

    // And no row is served twice across the two pages: an off-by-one in the
    // inclusive `.range(offset, offset + limit - 1)` would repeat one here.
    const firstIds = new Set([...firstPage.upcoming, ...firstPage.past].map((row) => row.id));
    const secondIds = [...secondPage.upcoming, ...secondPage.past].map((row) => row.id);
    expect(secondIds.filter((id) => firstIds.has(id))).toEqual([]);
  });

  test('[P1] an event dated today lands in the upcoming window, not the past one', async ({
    coupleEvents,
    supabaseAsUser,
  }) => {
    // The `gte` / `lt` boundary over the wire. It has to agree with App's own
    // `getCalendarDaysDiff(...) >= 0` filter: a today-dated row that arrived
    // in the past page would still be filtered as upcoming by Home and would
    // then be a row the cap could drop from the wrong end.
    await coupleEvents.seed([
      { dayOffset: 0, label: 'Boundary Today API' },
      { dayOffset: -1, label: 'Boundary Yesterday API' },
      { dayOffset: 1, label: 'Boundary Tomorrow API' },
    ]);

    const { upcoming, past } = await readEventWindows(
      supabaseAsUser,
      formatDateISO(coupleEvents.anchor),
      50,
      0
    );

    expect(labelsOf(upcoming)).toEqual(['Boundary Today API', 'Boundary Tomorrow API']);
    expect(labelsOf(past)).toEqual(['Boundary Yesterday API']);
  });

  test('[P1] both windows return the partner’s events, since neither filters on user_id', async ({
    coupleEvents,
    supabaseAsUser,
  }) => {
    // `getEvents` applies no `user_id` filter at all — the `events_select`
    // policy scopes the read to the caller and their partner via
    // `get_my_partner_id()`. The upcoming half of that is covered on Home;
    // the past window is new, and nothing above unit level had shown that a
    // partner's row survives it.
    await coupleEvents.seed([
      { dayOffset: 5, label: 'Shared Mine Ahead API', owner: 'self' },
      { dayOffset: 7, label: 'Shared Theirs Ahead API', owner: 'partner' },
      { dayOffset: -5, label: 'Shared Mine Behind API', owner: 'self' },
      { dayOffset: -7, label: 'Shared Theirs Behind API', owner: 'partner' },
    ]);

    const { upcoming, past } = await readEventWindows(
      supabaseAsUser,
      formatDateISO(coupleEvents.anchor),
      50,
      0
    );

    expect(labelsOf(upcoming)).toEqual(['Shared Mine Ahead API', 'Shared Theirs Ahead API']);
    expect(labelsOf(past)).toEqual(['Shared Mine Behind API', 'Shared Theirs Behind API']);

    // Owner-blindness stated directly, so a future `user_id` filter fails here
    // rather than only failing whichever label assertion happened to move.
    const owners = new Set([...upcoming, ...past].map((row) => row.user_id));
    expect(owners).toEqual(new Set([coupleEvents.userId, coupleEvents.partnerId]));
  });

  test('[P2] the past window breaks same-day ties on created_at, newest first', async ({
    coupleEvents,
    supabaseAsUser,
  }) => {
    // `created_at` is written explicitly: two rows seeded in one statement can
    // share `now()`, and a tie the data never actually contains is a tie this
    // test would not be checking. Reversed by `getEvents`, this pair becomes
    // the ascending `created_at` order `eventsSlice.sortByDate` mirrors.
    await coupleEvents.seed([
      {
        dayOffset: -3,
        label: 'Tie Earlier API',
        createdAt: '2026-01-02T00:00:00.000Z',
      },
      {
        dayOffset: -3,
        label: 'Tie Later API',
        createdAt: '2026-01-03T00:00:00.000Z',
      },
    ]);

    const { past } = await readEventWindows(
      supabaseAsUser,
      formatDateISO(coupleEvents.anchor),
      50,
      0
    );

    expect(labelsOf(past)).toEqual(['Tie Later API', 'Tie Earlier API']);
  });
});
