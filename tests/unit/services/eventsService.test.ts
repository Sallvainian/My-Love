/**
 * eventsService — the date parse and the failure surface
 *
 * Two things here cannot be caught by the type system, and both are the reason
 * this file exists:
 *
 * 1. `database.types.ts` types `event_date` as a plain `string`, so
 *    `new Date(row.event_date)` typechecks and builds. It is also wrong: that is
 *    ECMA-262's date-only form, parsed as UTC midnight, so every viewer west of
 *    UTC renders the previous day. The parse assertions below are written to
 *    hold in EVERY timezone — run the file under `TZ=America/New_York` and
 *    `TZ=Europe/Berlin` and the results must be identical.
 *
 * 2. RLS filters a non-creator's UPDATE or DELETE into a zero-row success with
 *    no error attached. A service that only checked `error` would report that
 *    write as having worked, and the UI would tell the user their edit saved.
 *
 * The Supabase client is faked per file — `tests/setup.ts` installs no Supabase
 * mock — over a tiny in-memory backend, so the chained PostgREST builder is
 * exercised rather than asserted on.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const USER_ID = 'USER-A-ID';
const PARTNER_ID = 'USER-B-ID';

interface EventRow {
  id: string;
  user_id: string;
  label: string;
  event_date: string;
  description: string | null;
  icon: string;
  created_at: string;
  updated_at: string;
}

interface FakePostgrestError {
  code: string;
  message: string;
  details: string;
  hint: string;
}

const backend = {
  rows: [] as EventRow[],
  /** Injected instead of running the query — a PostgREST error object, or a
   *  plain Error standing in for a mid-flight network failure. */
  nextError: null as FakePostgrestError | Error | null,
  /** Which side of `getEvents`' two-window read `nextError` applies to. `null`
   *  fails every query, which is what every write test wants; naming one bound
   *  fails only the window carrying it, so each window's own error check is
   *  reachable on its own. */
  errorForBound: null as 'gte' | 'lt' | null,
  /** Every `.update()` / `.insert()` payload the service sent, in order. */
  payloads: [] as Record<string, unknown>[],
  /** Every `.eq()` the service applied, so an added user_id filter is caught.
   *  Date bounds live in `queries` instead, so this stays a pure equality log
   *  and `expect(backend.filters).toEqual([])` keeps its whole meaning. */
  filters: [] as { column: string; value: unknown }[],
  /** One entry per query actually RUN, in run order: its date bounds, its
   *  orderings and its row window. The two-sided read is asserted from here
   *  rather than from a flat order log, which cannot say which window a
   *  given `.order()` belonged to. */
  queries: [] as {
    bounds: { column: string; op: 'gte' | 'lt'; value: string }[];
    orderings: { column: string; ascending: boolean }[];
    range: { from: number; to: number } | null;
  }[],
  /** Bumped on every `from()` — an offline guard must leave this at 0. */
  fromCalls: 0,
  reset() {
    this.rows = [];
    this.nextError = null;
    this.errorForBound = null;
    this.payloads = [];
    this.filters = [];
    this.queries = [];
    this.fromCalls = 0;
  },
};

function row(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: 'event-1',
    user_id: USER_ID,
    label: 'Anniversary',
    event_date: '2026-09-12',
    description: null,
    icon: 'calendar',
    created_at: '2026-08-18T00:00:00.000Z',
    updated_at: '2026-08-18T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * The PostgREST builder is chainable and thenable: every method returns itself,
 * and awaiting it runs the query.
 */
function eventsQuery() {
  let operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
  let payload: Record<string, unknown> = {};
  const filters: { column: string; value: unknown }[] = [];
  const orderings: { column: string; ascending: boolean }[] = [];
  const bounds: { column: string; op: 'gte' | 'lt'; value: string }[] = [];
  let range: { from: number; to: number } | null = null;

  const matches = (candidate: EventRow): boolean => {
    const record = candidate as unknown as Record<string, unknown>;
    if (!filters.every((f) => record[f.column] === f.value)) return false;
    // `event_date` is a Postgres `date`, so its "YYYY-MM-DD" text compares the
    // same way lexicographically as it does chronologically — which is what
    // lets this stand in for a real range predicate.
    return bounds.every((b) => {
      const value = String(record[b.column]);
      return b.op === 'gte' ? value >= b.value : value < b.value;
    });
  };

  const run = (): { data: EventRow[] | null; error: FakePostgrestError | Error | null } => {
    if (operation === 'select') {
      backend.queries.push({ bounds: [...bounds], orderings: [...orderings], range });
    }
    const errorApplies =
      backend.errorForBound === null || bounds.some((b) => b.op === backend.errorForBound);
    if (backend.nextError && errorApplies) return { data: null, error: backend.nextError };

    if (operation === 'insert') {
      const inserted: EventRow = {
        ...row({ id: `event-${backend.rows.length + 1}` }),
        ...payload,
      } as EventRow;
      backend.rows.push(inserted);
      return { data: [inserted], error: null };
    }

    if (operation === 'update') {
      const hits = backend.rows.filter(matches);
      hits.forEach((hit) => Object.assign(hit, payload));
      return { data: hits, error: null };
    }

    if (operation === 'delete') {
      const hits = backend.rows.filter(matches);
      backend.rows = backend.rows.filter((candidate) => !hits.includes(candidate));
      return { data: hits, error: null };
    }

    const found = backend.rows.filter(matches);
    if (orderings.length) {
      found.sort((a, b) => {
        for (const { column, ascending } of orderings) {
          const left = String((a as unknown as Record<string, unknown>)[column]);
          const right = String((b as unknown as Record<string, unknown>)[column]);
          const cmp = ascending ? left.localeCompare(right) : right.localeCompare(left);
          if (cmp !== 0) return cmp;
        }
        return 0;
      });
    }
    // PostgREST's `.range(from, to)` is inclusive at both ends.
    return { data: range ? found.slice(range.from, range.to + 1) : found, error: null };
  };

  const builder: Record<string, unknown> = {
    select: () => builder,
    insert: (values: Record<string, unknown>) => {
      operation = 'insert';
      payload = values;
      backend.payloads.push(values);
      return builder;
    },
    update: (values: Record<string, unknown>) => {
      operation = 'update';
      payload = values;
      backend.payloads.push(values);
      return builder;
    },
    delete: () => {
      operation = 'delete';
      return builder;
    },
    eq: (column: string, value: unknown) => {
      filters.push({ column, value });
      backend.filters.push({ column, value });
      return builder;
    },
    gte: (column: string, value: string) => {
      bounds.push({ column, op: 'gte', value });
      return builder;
    },
    lt: (column: string, value: string) => {
      bounds.push({ column, op: 'lt', value });
      return builder;
    },
    range: (from: number, to: number) => {
      range = { from, to };
      return builder;
    },
    order: (column: string, options?: { ascending?: boolean }) => {
      const ascending = options?.ascending ?? true;
      orderings.push({ column, ascending });
      return builder;
    },
    single: async () => {
      const result = run();
      return { data: result.data?.[0] ?? null, error: result.error };
    },
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(run()).then(onFulfilled, onRejected),
  };
  return builder;
}

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

function setOnline(online: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
}

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
        range: { from: 0, to: 49 },
      });
      expect(windowFor('lt')).toEqual({
        bounds: [{ column: 'event_date', op: 'lt', value: '2026-08-19' }],
        orderings: [
          { column: 'event_date', ascending: false },
          { column: 'created_at', ascending: false },
        ],
        range: { from: 0, to: 49 },
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

      expect(windowFor('gte')?.range).toEqual({ from: 0, to: 49 });
      expect(windowFor('lt')?.range).toEqual({ from: 0, to: 49 });
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
      backend.nextError = {
        code: '42501',
        message: 'permission denied',
        details: '',
        hint: '',
      };

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
        backend.nextError = {
          code: '42501',
          message: 'permission denied',
          details: '',
          hint: '',
        };

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

  // ==========================================================================
  // createEvent
  // ==========================================================================

  describe('createEvent', () => {
    it('writes the input date string through untouched and returns the created event', async () => {
      const created = await eventsService.createEvent({
        userId: USER_ID,
        label: 'Flight home',
        eventDate: '2026-09-12',
        description: 'Landing at 6pm',
        icon: 'plane',
      });

      // The <input type="date"> value reaches the column verbatim — no
      // toISOString() round trip, which would shift the day.
      expect(backend.payloads[0]).toMatchObject({
        user_id: USER_ID,
        label: 'Flight home',
        event_date: '2026-09-12',
        description: 'Landing at 6pm',
        icon: 'plane',
      });

      expect(created.label).toBe('Flight home');
      expect(created.icon).toBe('plane');
      expect(created.date.getDate()).toBe(12);
      expect(created.date.getMonth()).toBe(8);
      expect(backend.rows).toHaveLength(1);
    });

    it('omits icon so the column default applies when the caller does not choose one', async () => {
      await eventsService.createEvent({
        userId: USER_ID,
        label: 'Something',
        eventDate: '2026-10-01',
      });

      expect(backend.payloads[0]).not.toHaveProperty('icon');
      expect(backend.payloads[0]).toMatchObject({ description: null });
    });

    it('throws before any request when the device is offline', async () => {
      setOnline(false);

      await expect(
        eventsService.createEvent({ userId: USER_ID, label: 'x', eventDate: '2026-10-01' })
      ).rejects.toThrow('You are offline. Events need a connection to save.');
      expect(backend.fromCalls).toBe(0);
      expect(backend.rows).toEqual([]);
    });

    it('refuses an unreadable date before issuing any request', async () => {
      await expect(
        eventsService.createEvent({ userId: USER_ID, label: 'x', eventDate: 'infinity' })
      ).rejects.toThrow('Not a valid calendar date: infinity');
      expect(backend.fromCalls).toBe(0);
      expect(backend.rows).toEqual([]);
    });

    it('surfaces the reason when the insert is rejected', async () => {
      backend.nextError = {
        code: '42501',
        message: 'new row violates row-level security policy',
        details: '',
        hint: '',
      };

      await expect(
        eventsService.createEvent({ userId: PARTNER_ID, label: 'x', eventDate: '2026-10-01' })
      ).rejects.toThrow(/Permission denied - check Row Level Security policies/);
    });

    it('does not promise a sync when the insert fails mid-flight — writes have no queue either', async () => {
      // Same trap as the read path: the write may or may not have landed, and
      // nothing will retry it, so the message must not claim a queue will.
      backend.nextError = new TypeError('fetch failed');

      const failure = await eventsService
        .createEvent({ userId: USER_ID, label: 'x', eventDate: '2026-10-01' })
        .then(
          () => null,
          (error: Error) => error
        );

      expect(failure?.message).toBe(
        '[EventsService.createEvent] Network error: fetch failed. Check your internet connection.'
      );
    });
  });

  // ==========================================================================
  // updateEvent
  // ==========================================================================

  describe('updateEvent', () => {
    it('stamps updated_at on every write and returns the updated event', async () => {
      backend.rows = [row({ id: 'event-1' })];

      const updated = await eventsService.updateEvent('event-1', {
        label: 'Renamed',
        eventDate: '2026-11-03',
      });

      // Client-maintained by design: the migration installs no trigger and
      // PostgREST does not set it.
      const payload = backend.payloads[0];
      expect(typeof payload.updated_at).toBe('string');
      expect(Number.isNaN(Date.parse(payload.updated_at as string))).toBe(false);
      expect(payload).toMatchObject({ label: 'Renamed', event_date: '2026-11-03' });

      expect(updated.label).toBe('Renamed');
      expect(updated.date.getDate()).toBe(3);
      expect(updated.date.getMonth()).toBe(10);
    });

    it('writes only the fields the caller supplied', async () => {
      backend.rows = [row({ id: 'event-1', description: 'keep me' })];

      await eventsService.updateEvent('event-1', { icon: 'ring' });

      expect(backend.payloads[0]).not.toHaveProperty('label');
      expect(backend.payloads[0]).not.toHaveProperty('event_date');
      expect(backend.payloads[0]).not.toHaveProperty('description');
      expect(backend.rows[0].description).toBe('keep me');
    });

    it('accepts an explicit null description', async () => {
      backend.rows = [row({ id: 'event-1', description: 'drop me' })];

      await eventsService.updateEvent('event-1', { description: null });

      expect(backend.payloads[0]).toMatchObject({ description: null });
    });

    it('throws when the update matched no row — an RLS filter is silent', async () => {
      // A partner's UPDATE comes back `{ data: [], error: null }`. Reporting
      // success here is what would tell the user their edit saved.
      backend.rows = [row({ id: 'someone-elses' })];

      await expect(eventsService.updateEvent('event-1', { label: 'x' })).rejects.toThrow(
        'Event not found or not yours to edit'
      );
    });

    it('does not dress a zero-row write up as a network problem', async () => {
      // The catch tail would otherwise promise the user their change "will be
      // synced when you're back online", which is the opposite of what happened.
      await expect(eventsService.updateEvent('missing', { label: 'x' })).rejects.toThrow(
        /^Event not found or not yours to edit$/
      );
    });

    it('throws before any request when the device is offline', async () => {
      setOnline(false);

      await expect(eventsService.updateEvent('event-1', { label: 'x' })).rejects.toThrow(
        'You are offline. Events need a connection to save.'
      );
      expect(backend.fromCalls).toBe(0);
    });

    it('refuses an unreadable date before issuing any request', async () => {
      backend.rows = [row({ id: 'event-1' })];

      await expect(
        eventsService.updateEvent('event-1', { eventDate: '2026-02-30' })
      ).rejects.toThrow('Not a valid calendar date: 2026-02-30');
      expect(backend.fromCalls).toBe(0);
    });

    it('surfaces the reason when the update is rejected', async () => {
      backend.rows = [row({ id: 'event-1' })];
      backend.nextError = { code: '42501', message: 'permission denied', details: '', hint: '' };

      await expect(eventsService.updateEvent('event-1', { label: 'x' })).rejects.toThrow(
        /Permission denied - check Row Level Security policies/
      );
    });
  });

  // ==========================================================================
  // deleteEvent
  // ==========================================================================

  describe('deleteEvent', () => {
    it('removes the row', async () => {
      backend.rows = [row({ id: 'event-1' }), row({ id: 'event-2' })];

      await eventsService.deleteEvent('event-1');

      expect(backend.rows.map((r) => r.id)).toEqual(['event-2']);
    });

    it('throws when the delete matched no row — the same silent RLS filter', async () => {
      backend.rows = [row({ id: 'someone-elses' })];

      await expect(eventsService.deleteEvent('event-1')).rejects.toThrow(
        'Event not found or not yours to delete'
      );
      expect(backend.rows).toHaveLength(1);
    });

    it('throws before any request when the device is offline', async () => {
      setOnline(false);

      await expect(eventsService.deleteEvent('event-1')).rejects.toThrow('You are offline. Events need a connection to save.');
      expect(backend.fromCalls).toBe(0);
    });

    it('surfaces the reason when the delete is rejected', async () => {
      backend.nextError = { code: '42501', message: 'permission denied', details: '', hint: '' };

      await expect(eventsService.deleteEvent('event-1')).rejects.toThrow(
        /Permission denied - check Row Level Security policies/
      );
    });
  });
});
