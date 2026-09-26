/**
 * eventsService — the date parse and the read path
 *
 * One thing here cannot be caught by the type system, and it is the reason
 * this file exists:
 *
 * `database.types.ts` types `event_date` as a plain `string`, so
 * `new Date(row.event_date)` typechecks and builds. It is also wrong: that is
 * ECMA-262's date-only form, parsed as UTC midnight, so every viewer west of
 * UTC renders the previous day. The parse assertions below are written to
 * hold in EVERY timezone — run the file under `TZ=America/New_York` and
 * `TZ=Europe/Berlin` and the results must be identical.
 *
 * The Supabase client is faked per file — `tests/setup.ts` installs no Supabase
 * mock — over a tiny in-memory backend, so the chained PostgREST builder is
 * exercised rather than asserted on.
 *
 * The backend and its builder live in `./fakeEventsBackend.ts`; the writes are
 * covered in `./eventsService.writes.test.ts`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  PAGE_SIZE,
  PARTNER_ID,
  USER_ID,
  backend,
  eventsQuery,
  permissionDenied,
  row,
  setOnline,
} from './fakeEventsBackend';

vi.mock('@/api/supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      backend.fromCalls += 1;
      if (table !== 'events') throw new Error(`unmodelled table ${table}`);
      return eventsQuery();
    },
  },
}));

import { eventsService, isEventIcon, parseEventDate } from '@/services/eventsService';

describe('eventsService', () => {
  beforeEach(() => {
    backend.reset();
    setOnline(true);
    // The catch tail logs through logSupabaseError; the thrown error is what is
    // under test, not the noise.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setOnline(true);
  });

  // ==========================================================================
  // The parse — the one bug the type system cannot catch
  // ==========================================================================

  describe('parseEventDate', () => {
    it('reads "YYYY-MM-DD" as LOCAL midnight in every timezone', () => {
      // The TZ pin in vitest.config.ts is what gives the assertions below their
      // failure power; under UTC the broken new Date('2026-09-12') form passes
      // all of them. This asserts the pin actually took effect.
      expect(new Date(2026, 8, 12).getTimezoneOffset()).not.toBe(0);

      const parsed = parseEventDate('2026-09-12');
      if (!parsed) throw new Error('expected a parsed date');

      // Deliberately local getters. `new Date('2026-09-12')` is UTC midnight,
      // which is 8pm on the 11th in New York — and identical to this under UTC,
      // which is why `vitest.config.ts` pins a negative-offset zone. Measured:
      // without that pin the broken form passes every assertion here.
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(8); // September, zero-based
      expect(parsed.getDate()).toBe(12);
      expect(parsed.getHours()).toBe(0);
      expect(parsed.getMinutes()).toBe(0);
    });

    it('keeps the year, unlike the countdownService split it is modelled on', () => {
      expect(parseEventDate('2027-01-01')?.getFullYear()).toBe(2027);
    });

    it('keeps a year below 100 instead of mapping it into the 1900s', () => {
      // `new Date(99, 0, 1)` is 1999 — the two-digit-year mapping. Left in, a
      // year-0099 row would silently claim to be 1999.
      expect(parseEventDate('0099-01-01')?.getFullYear()).toBe(99);
    });

    it('refuses anything that is not a bare calendar date', () => {
      // A `date` column accepts `infinity`, and PostgREST returns it as the
      // literal string. Everything here used to produce an Invalid Date.
      expect(parseEventDate('infinity')).toBeNull();
      expect(parseEventDate('-infinity')).toBeNull();
      expect(parseEventDate('')).toBeNull();
      expect(parseEventDate('not-a-date')).toBeNull();
      expect(parseEventDate('2026/09/12')).toBeNull();
      expect(parseEventDate('2026-09-12T00:00:00Z')).toBeNull();
    });

    it('refuses a date that would roll over rather than accepting the roll', () => {
      // `new Date(2026, 1, 30)` is March 2, not a failure.
      expect(parseEventDate('2026-02-30')).toBeNull();
      expect(parseEventDate('2026-13-01')).toBeNull();
      expect(parseEventDate('2026-00-10')).toBeNull();
      // The real leap day still parses.
      expect(parseEventDate('2028-02-29')?.getDate()).toBe(29);
    });
  });

  describe('isEventIcon', () => {
    it('accepts exactly the three the CHECK constraint allows', () => {
      expect(isEventIcon('ring')).toBe(true);
      expect(isEventIcon('plane')).toBe(true);
      expect(isEventIcon('calendar')).toBe(true);
      expect(isEventIcon('star')).toBe(false);
      expect(isEventIcon('')).toBe(false);
    });
  });

  // ==========================================================================
  // getEvents
  // ==========================================================================

  describe('getEventsPage', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 8, 12, 23, 59));
    });
    afterEach(() => vi.useRealTimers());

    // Empty, exactly one page, and one row past it.
    const WINDOW_SIZES = [0, PAGE_SIZE, PAGE_SIZE + 1];
    it.each(WINDOW_SIZES)('returns truthful raw continuation for %i rows in each window', async (count) => {
      backend.rows = ['2026-09-11', '2026-09-12'].flatMap((date, side) =>
        Array.from({ length: count }, (_, index) => row({
          id: `${side}-${String(index).padStart(3, '0')}`, event_date: date,
        }))
      );
      const page = await eventsService.getEventsPage();
      expect(page.events).toHaveLength(Math.min(count, PAGE_SIZE) * 2);
      expect(page.pagination.upcoming.hasMore).toBe(count > PAGE_SIZE);
      expect(page.pagination.past.hasMore).toBe(count > PAGE_SIZE);
      expect(backend.queries).toHaveLength(2);
      for (const query of backend.queries) {
        // PostgREST's range is inclusive, so `to: PAGE_SIZE` is the one-row lookahead.
        expect(query.range).toEqual({ from: 0, to: PAGE_SIZE });
        expect(query.orderings.map((order) => order.column)).toEqual(['event_date', 'created_at', 'id']);
      }
      expect(backend.filters).toEqual([]);
      expect(page.pagination.todayISO).toBe('2026-09-12');
    });

    it('continues only unfinished windows, with fixed local today across midnight', async () => {
      backend.rows = Array.from({ length: 2 * PAGE_SIZE + 1 }, (_, index) => row({
        id: `past-${String(index).padStart(3, '0')}`, event_date: '2026-09-11',
      })).concat(row({ id: 'upcoming', event_date: '2026-09-12' }));
      const first = await eventsService.getEventsPage();
      vi.setSystemTime(new Date(2026, 8, 13, 1));
      const second = await eventsService.getEventsPage(first.pagination);
      const last = await eventsService.getEventsPage(second.pagination);
      const all = [...first.events, ...second.events, ...last.events];
      expect(all).toHaveLength(2 * PAGE_SIZE + 2);
      expect(new Set(all.map((event) => event.id)).size).toBe(2 * PAGE_SIZE + 2);
      expect(second.events).toHaveLength(PAGE_SIZE);
      expect(last.events).toHaveLength(1);
      expect(last.pagination.past.hasMore).toBe(false);
      expect(backend.queries).toHaveLength(4);
      expect(backend.queries.slice(2).every((query) =>
        query.bounds[0].op === 'lt' && query.bounds[0].value === '2026-09-12'
      )).toBe(true);
      await eventsService.getEventsPage(last.pagination);
      expect(backend.queries).toHaveLength(4);
    });

    it.each([
      ['2026-09-11', 'past', 'upcoming'],
      ['2026-09-12', 'upcoming', 'past'],
    ] as const)('preserves microseconds and ID ties across the %s boundary', async (eventDate, window, otherWindow) => {
      backend.rows = Array.from({ length: 103 }, (_, index) => row({
        id: `event-${String(index).padStart(3, '0')}`,
        event_date: eventDate,
        // Deliberately repeat instants, while all rows share one JS millisecond.
        created_at: `2026-08-18T00:00:00.123${String(Math.floor(index / 2)).padStart(3, '0')}+00:00`,
      })).reverse();
      const first = await eventsService.getEventsPage();
      expect(first.pagination.todayISO).toBe('2026-09-12');
      expect(first.pagination[otherWindow]).toMatchObject({ hasMore: false, cursor: null });
      const cursor = first.pagination[window].cursor!;
      expect(cursor.created_at).toMatch(/\.123\d{3}\+00:00/);
      const second = await eventsService.getEventsPage(first.pagination);
      const third = await eventsService.getEventsPage(second.pagination);
      const ids = [...first.events, ...second.events, ...third.events].map((event) => event.id);
      expect(ids).toHaveLength(103);
      expect(new Set(ids).size).toBe(103);
      expect(backend.queries[2].or).toContain(`created_at.eq.${cursor.created_at},id.`);
    });

    it('does not shift a page after a previously read row is deleted', async () => {
      backend.rows = Array.from({ length: PAGE_SIZE + 1 }, (_, index) => row({
        id: `event-${String(index).padStart(3, '0')}`, event_date: '2026-09-11',
      }));
      const first = await eventsService.getEventsPage();
      backend.rows = backend.rows.filter((event) => event.id !== first.events[0].id);
      const second = await eventsService.getEventsPage(first.pagination);
      expect(second.events.map((event) => event.id)).toEqual(['event-000']);
    });

    it('advances raw cursors even when an entire page cannot convert', async () => {
      backend.rows = Array.from({ length: PAGE_SIZE + 1 }, (_, index) => row({
        id: `event-${String(index).padStart(3, '0')}`, event_date: 'infinity',
      }));
      const first = await eventsService.getEventsPage();
      expect(first.events).toEqual([]);
      expect(first.pagination.upcoming.hasMore).toBe(true);
      expect(first.pagination.upcoming.cursor?.event_date).toBe('infinity');
      const last = await eventsService.getEventsPage(first.pagination);
      expect(last.events).toEqual([]);
      expect(last.pagination.upcoming.hasMore).toBe(false);
      expect(console.error).toHaveBeenCalledTimes(PAGE_SIZE + 1);
    });

    it('keeps lookahead truthful before cross-window deduplication', async () => {
      backend.nextData = Array.from({ length: PAGE_SIZE + 1 }, (_, index) => row({ id: String(index) }));
      const page = await eventsService.getEventsPage();
      expect(page.events).toHaveLength(PAGE_SIZE);
      expect(new Set(page.events.map((event) => event.id)).size).toBe(PAGE_SIZE);
      expect(page.pagination.past.hasMore).toBe(true);
      expect(page.pagination.upcoming.hasMore).toBe(true);
    });

    it.each(['gte', 'lt'] as const)('retries both unfinished windows after the %s window fails', async (bound) => {
      backend.rows = ['2026-09-11', '2026-09-12'].flatMap((eventDate, side) =>
        Array.from({ length: PAGE_SIZE + 1 }, (_, index) => row({
          id: `event-${side}-${index}`, event_date: eventDate,
        }))
      );
      const first = await eventsService.getEventsPage();
      const originalPagination = structuredClone(first.pagination);
      expect(first.pagination.upcoming.hasMore).toBe(true);
      expect(first.pagination.past.hasMore).toBe(true);
      backend.errorForBound = bound;
      backend.nextError = new Error('page disconnected');
      // Upcoming completes first in this fake: failing gte covers failure
      // before the other success, and failing lt covers success before failure.
      await expect(eventsService.getEventsPage(first.pagination)).rejects.toThrow('page disconnected');
      const failedQueries = backend.queries.slice(-2);
      expect(failedQueries).toHaveLength(2);
      expect(first.pagination).toEqual(originalPagination);
      backend.nextError = null;
      const retry = await eventsService.getEventsPage(first.pagination);
      expect(backend.queries.slice(-2)).toEqual(failedQueries);
      expect(retry.events).toHaveLength(2);
      expect(retry.pagination.upcoming.hasMore).toBe(false);
      expect(retry.pagination.past.hasMore).toBe(false);
    });

    it('does not query offline', async () => {
      setOnline(false);
      await expect(eventsService.getEventsPage()).rejects.toThrow('Events need a connection to load');
      expect(backend.fromCalls).toBe(0);
    });
  });

  describe('getEvents', () => {
    // The read now cuts its window at the viewer's own calendar day, so every
    // test below states a date RELATIVE to a pinned today. Without the pin the
    // fixtures would silently change meaning — '2026-09-12' is upcoming today
    // and already-passed next year — and the suite would rot into a pass.
    // Noon local, so the day is the same in every timezone this file must hold
    // in (see the header).
    const TODAY = new Date(2026, 7, 19, 12, 0, 0);
    /** `YYYY-MM-DD` `days` away from the pinned today, in local time. */
    const dateFromToday = (days: number): string => {
      const d = new Date(2026, 7, 19 + days, 12, 0, 0);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    /** The window sent for one side of today, or undefined if that side was never read. */
    const windowFor = (op: 'gte' | 'lt') =>
      backend.queries.find((q) => q.bounds.some((b) => b.op === op));

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(TODAY);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns the couple’s events soonest-first, each date at local midnight', async () => {
      backend.rows = [
        row({ id: 'later', user_id: PARTNER_ID, event_date: '2026-12-25', label: 'Christmas' }),
        row({ id: 'sooner', event_date: '2026-09-12', label: 'Anniversary' }),
      ];

      const events = await eventsService.getEvents();

      // No user_id filter is applied: the events_select policy already scopes
      // the read to the caller and their partner.
      expect(events.map((e) => e.id)).toEqual(['sooner', 'later']);

      // Two windows, cut at today, each capped at the default 50 rows. The
      // upcoming side reads ascending so the SOONEST events survive the cap;
      // the past side reads descending so the MOST RECENT ones do. Asserted per
      // window rather than off the flat order log, which cannot tell them apart.
      expect(windowFor('gte')).toEqual({
        bounds: [{ column: 'event_date', op: 'gte', value: '2026-08-19' }],
        orderings: [
          { column: 'event_date', ascending: true },
          // The created_at tiebreak: Postgres leaves same-day order unspecified.
          { column: 'created_at', ascending: true },
        ],
        range: { from: 0, to: PAGE_SIZE - 1 },
      });
      expect(windowFor('lt')).toEqual({
        bounds: [{ column: 'event_date', op: 'lt', value: '2026-08-19' }],
        orderings: [
          { column: 'event_date', ascending: false },
          { column: 'created_at', ascending: false },
        ],
        range: { from: 0, to: PAGE_SIZE - 1 },
      });
      // Exactly two, and only two. `windowFor` uses `.find`, so without this a
      // regression that added a third — an unbounded `.select('*')` alongside
      // the two windows — would satisfy every other assertion here while
      // undoing the one thing DW-9 asked for.
      expect(backend.queries).toHaveLength(2);
      expect(backend.fromCalls).toBe(2);
      // Load-bearing: adding `.eq('user_id', ...)` here would drop the partner's
      // half of the couple's list — the whole point of the events_select policy
      // — and every other assertion in this file would still pass. Date bounds
      // are recorded in `queries`, so this stays a pure equality-filter log.
      expect(backend.filters).toEqual([]);

      const [sooner] = events;
      expect(sooner.date.getFullYear()).toBe(2026);
      expect(sooner.date.getMonth()).toBe(8);
      expect(sooner.date.getDate()).toBe(12);
      expect(sooner.userId).toBe(USER_ID);
      expect(sooner.label).toBe('Anniversary');
      expect(sooner.description).toBeNull();
    });

    it('returns both sides of today in one ascending list', async () => {
      backend.rows = [
        row({ id: 'upcoming-2', event_date: dateFromToday(9) }),
        row({ id: 'past-3', event_date: dateFromToday(-30) }),
        row({ id: 'upcoming-1', event_date: dateFromToday(4) }),
        row({ id: 'past-1', event_date: dateFromToday(-2) }),
        row({ id: 'past-2', event_date: dateFromToday(-11) }),
      ];

      const events = await eventsService.getEvents();

      // Past events still reach the caller — Settings shows the unfiltered list
      // so a mistyped date stays editable — and the two pages concatenate into
      // one globally ascending list with no client-side comparator.
      expect(events.map((e) => e.id)).toEqual([
        'past-3',
        'past-2',
        'past-1',
        'upcoming-1',
        'upcoming-2',
      ]);
    });

    it('caps each side of today at the limit, keeping the nearest events on both', async () => {
      backend.rows = [
        row({ id: 'past-far', event_date: dateFromToday(-40) }),
        row({ id: 'past-mid', event_date: dateFromToday(-20) }),
        row({ id: 'past-near', event_date: dateFromToday(-1) }),
        row({ id: 'upcoming-near', event_date: dateFromToday(1) }),
        row({ id: 'upcoming-mid', event_date: dateFromToday(20) }),
        row({ id: 'upcoming-far', event_date: dateFromToday(40) }),
      ];

      const events = await eventsService.getEvents(2);

      // Two from each side, and specifically the two NEAREST on each side: the
      // deep past and the distant future are what a cap may drop.
      expect(events.map((e) => e.id)).toEqual([
        'past-mid',
        'past-near',
        'upcoming-near',
        'upcoming-mid',
      ]);
      expect(windowFor('gte')?.range).toEqual({ from: 0, to: 1 });
      expect(windowFor('lt')?.range).toEqual({ from: 0, to: 1 });
    });

    it('never lets accumulated history hide the next event', async () => {
      // The regression this whole two-window shape exists to prevent. Every
      // event eventually becomes a past event, so a single ascending
      // `.range(0, limit - 1)` over the couple's whole history eventually
      // returns nothing but past rows — and Home, which filters those out,
      // shows its "No upcoming events yet." placeholder while a real event is
      // days away. Five past rows against a limit of 2 is that state.
      backend.rows = [
        row({ id: 'past-1', event_date: dateFromToday(-50) }),
        row({ id: 'past-2', event_date: dateFromToday(-40) }),
        row({ id: 'past-3', event_date: dateFromToday(-30) }),
        row({ id: 'past-4', event_date: dateFromToday(-20) }),
        row({ id: 'past-5', event_date: dateFromToday(-10) }),
        row({ id: 'the-next-one', event_date: dateFromToday(3) }),
      ];

      const events = await eventsService.getEvents(2);

      expect(events.map((e) => e.id)).toContain('the-next-one');
      // And it is still the first upcoming one in the list the caller gets.
      // The boundary is derived from the pin rather than re-typed, so moving
      // TODAY cannot leave this assertion silently comparing against a
      // different day.
      const todayMidnight = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
      expect(events.filter((e) => e.date >= todayMidnight).map((e) => e.id)).toEqual([
        'the-next-one',
      ]);
    });

    it('pages outward from today on both sides', async () => {
      backend.rows = [
        row({ id: 'past-1', event_date: dateFromToday(-1) }),
        row({ id: 'past-2', event_date: dateFromToday(-2) }),
        row({ id: 'past-3', event_date: dateFromToday(-3) }),
        row({ id: 'past-4', event_date: dateFromToday(-4) }),
        row({ id: 'upcoming-1', event_date: dateFromToday(1) }),
        row({ id: 'upcoming-2', event_date: dateFromToday(2) }),
        row({ id: 'upcoming-3', event_date: dateFromToday(3) }),
        row({ id: 'upcoming-4', event_date: dateFromToday(4) }),
      ];

      const events = await eventsService.getEvents(2, 2);

      // Page two on each side: the 3rd and 4th event out from today, in either
      // direction, still merged ascending.
      expect(events.map((e) => e.id)).toEqual([
        'past-4',
        'past-3',
        'upcoming-3',
        'upcoming-4',
      ]);
      expect(windowFor('gte')?.range).toEqual({ from: 2, to: 3 });
      expect(windowFor('lt')?.range).toEqual({ from: 2, to: 3 });
    });

    it('clamps a nonsense limit or offset instead of sending a backwards range', async () => {
      // `.range(0, -1)` is what `limit = 0` builds unclamped, and PostgREST
      // answers it with a 400 the user sees as a failed load. Clamped, the
      // caller gets the smallest sane page instead.
      backend.rows = [
        row({ id: 'past', event_date: dateFromToday(-2) }),
        row({ id: 'upcoming', event_date: dateFromToday(2) }),
      ];

      const events = await eventsService.getEvents(0, -5);

      expect(windowFor('gte')?.range).toEqual({ from: 0, to: 0 });
      expect(windowFor('lt')?.range).toEqual({ from: 0, to: 0 });
      expect(events.map((e) => e.id)).toEqual(['past', 'upcoming']);
    });

    it.each([
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
    ])('falls back to the default page size when limit is %s', async (_label, limit) => {
      // A `Math.max`/`Math.floor` clamp alone does NOT catch these:
      // `Math.max(1, Math.floor(NaN))` is NaN and `Math.floor(Infinity)` is
      // Infinity, so both reach `.range()` and produce exactly the PostgREST
      // 400 the clamp exists to prevent. Drop the finiteness check and this
      // fails on the range assertion.
      backend.rows = [row({ id: 'upcoming', event_date: dateFromToday(2) })];

      const events = await eventsService.getEvents(limit);

      expect(windowFor('gte')?.range).toEqual({ from: 0, to: PAGE_SIZE - 1 });
      expect(windowFor('lt')?.range).toEqual({ from: 0, to: PAGE_SIZE - 1 });
      expect(events.map((e) => e.id)).toEqual(['upcoming']);
    });

    it('falls back to offset zero when offset is not finite', async () => {
      backend.rows = [row({ id: 'upcoming', event_date: dateFromToday(2) })];

      const events = await eventsService.getEvents(10, Number.NaN);

      expect(windowFor('gte')?.range).toEqual({ from: 0, to: 9 });
      expect(events.map((e) => e.id)).toEqual(['upcoming']);
    });

    it('issues both windows concurrently, not one after the other', async () => {
      // Read synchronously, before either response can have been handled. With
      // `Promise.all` the array literal builds BOTH chains — and so makes both
      // `from()` calls — before the first `await`. Rewritten as two sequential
      // `await`s, every other assertion in this file still passes (the fake
      // records the same two queries either way) and only this one goes red,
      // which is what makes the "costs one extra PARALLEL request" claim in the
      // JSDoc and the Design Notes load-bearing rather than decorative.
      backend.rows = [row({ id: 'upcoming', event_date: dateFromToday(2) })];

      const pending = eventsService.getEvents();
      expect(backend.fromCalls).toBe(2);

      await pending;
    });

    it('counts an event dated today as upcoming, not past', async () => {
      // The `gte` boundary, matching Home's own `getCalendarDaysDiff(...) >= 0`
      // filter. Tightened to `gt`, this row falls into the past window and Home
      // stops showing an event happening today.
      backend.rows = [row({ id: 'today', event_date: dateFromToday(0) })];

      const events = await eventsService.getEvents();

      expect(events.map((e) => e.id)).toEqual(['today']);
      expect(windowFor('gte')?.bounds).toEqual([
        { column: 'event_date', op: 'gte', value: '2026-08-19' },
      ]);
    });

    it('breaks same-day ties on creation time, so reloads cannot reshuffle', async () => {
      backend.rows = [
        row({ id: 'second', event_date: '2026-09-12', created_at: '2026-08-18T12:00:00+00:00' }),
        row({ id: 'first', event_date: '2026-09-12', created_at: '2026-08-18T09:00:00+00:00' }),
      ];

      const events = await eventsService.getEvents();

      expect(events.map((e) => e.id)).toEqual(['first', 'second']);
      // The domain model carries the instant so the slice can apply the same
      // tiebreak locally.
      expect(events[0].createdAt).toEqual(new Date('2026-08-18T09:00:00+00:00'));
    });

    it('breaks same-day ties on creation time in the PAST window too', async () => {
      // The past page is read `created_at` DESCENDING and then reversed, which
      // is the one genuinely new ordering mechanism here. The upcoming-side
      // tiebreak test cannot reach it: its rows are dated after today. Drop the
      // past window's `created_at` order and this pair can swap between loads.
      backend.rows = [
        row({
          id: 'second',
          event_date: dateFromToday(-4),
          created_at: '2026-08-10T12:00:00+00:00',
        }),
        row({
          id: 'first',
          event_date: dateFromToday(-4),
          created_at: '2026-08-10T09:00:00+00:00',
        }),
      ];

      const events = await eventsService.getEvents();

      expect(events.map((e) => e.id)).toEqual(['first', 'second']);
    });

    it('drops the stale copy when a row lands in both windows mid-read', async () => {
      // Two requests, not one snapshot: a row whose date is edited across today
      // between them comes back in both pages. Keeping both would hand Home's
      // map a duplicate React key and render the same event twice.
      backend.rows = [
        row({ id: 'moved', event_date: dateFromToday(-3), label: 'Stale' }),
        row({ id: 'moved', event_date: dateFromToday(3), label: 'Fresh' }),
      ];

      const events = await eventsService.getEvents();

      expect(events.map((e) => e.id)).toEqual(['moved']);
      // The upcoming copy is the one kept — it carries the newer date.
      expect(events[0].label).toBe('Fresh');
    });

    it.each([
      ['late evening, west of UTC', new Date(2026, 7, 19, 23, 30, 0)],
      ['just after midnight, east of UTC', new Date(2026, 7, 19, 0, 30, 0)],
    ])('cuts the window on the LOCAL calendar day (%s)', async (_label, instant) => {
      // `toISOString().split('T')[0]` would compile and read plausibly here, and
      // at noon it is indistinguishable from formatDateISO. These two instants
      // are the ones where the UTC day differs from the local day — the first
      // for viewers west of UTC, the second for viewers east — so between them
      // the UTC form lands on the wrong date in every timezone.
      vi.setSystemTime(instant);
      backend.rows = [row({ id: 'today', event_date: dateFromToday(0) })];

      const events = await eventsService.getEvents();

      expect(events.map((e) => e.id)).toEqual(['today']);
      expect(windowFor('gte')?.bounds).toEqual([
        { column: 'event_date', op: 'gte', value: dateFromToday(0) },
      ]);
    });

    it('keeps a row whose icon is outside the union, falling back to the column default', async () => {
      backend.rows = [row({ id: 'odd', icon: 'star' })];

      const events = await eventsService.getEvents();

      expect(events).toHaveLength(1);
      expect(events[0].icon).toBe('calendar');
    });

    it('returns an empty list rather than throwing when the couple has no events', async () => {
      await expect(eventsService.getEvents()).resolves.toEqual([]);
    });

    it('drops a row whose date cannot be read, and still orders the rest', async () => {
      // One Invalid Date makes the comparator return NaN, which leaves the bad
      // row and its immediate neighbor unpredictably placed (measured; see the
      // parseEventDate doc) — so the row is dropped rather than carried into
      // the sort.
      backend.rows = [
        row({ id: 'later', event_date: '2026-12-25' }),
        row({ id: 'unreadable', event_date: 'infinity' }),
        row({ id: 'sooner', event_date: '2026-09-12' }),
      ];

      const events = await eventsService.getEvents();

      expect(events.map((e) => e.id)).toEqual(['sooner', 'later']);
      expect(events.every((e) => !Number.isNaN(e.date.getTime()))).toBe(true);
    });

    it('throws without issuing a request when the device is offline', async () => {
      setOnline(false);

      await expect(eventsService.getEvents()).rejects.toThrow('You are offline. Events need a connection to load.');
      expect(backend.fromCalls).toBe(0);
    });

    it('throws the mapped message when the query is rejected', async () => {
      backend.nextError = permissionDenied();

      await expect(eventsService.getEvents()).rejects.toThrow(
        /Permission denied - check Row Level Security policies/
      );
    });

    it.each([
      ['upcoming', 'gte'],
      ['already-passed', 'lt'],
    ] as const)(
      'surfaces a rejection from the %s window even when the other window succeeds',
      async (_side, bound) => {
        // Each window is checked on its own. With only a combined-failure test,
        // deleting either window's `if (error) throw` would leave its error
        // silently swallowed and its half of the list quietly missing.
        backend.rows = [
          row({ id: 'past', event_date: dateFromToday(-5) }),
          row({ id: 'upcoming', event_date: dateFromToday(5) }),
        ];
        backend.errorForBound = bound;
        backend.nextError = permissionDenied();

        await expect(eventsService.getEvents()).rejects.toThrow(
          /Permission denied - check Row Level Security policies/
        );
      }
    );

    it('does not promise a sync when a load fails mid-flight — reads have no queue', async () => {
      // A dropped socket rejects with a plain TypeError, not a PostgREST
      // error. handleNetworkError would append "Your changes will be synced
      // when you're back online" — there are no changes and there is no queue,
      // so the catch tail builds its own message. Pinned with toBe: a
      // substring match could pass with the false promise still attached.
      backend.nextError = new TypeError('fetch failed');

      const failure = await eventsService.getEvents().then(
        () => null,
        (error: Error) => error
      );

      expect(failure?.message).toBe(
        '[EventsService.getEvents] Network error: fetch failed. Check your internet connection.'
      );
    });
  });
});
