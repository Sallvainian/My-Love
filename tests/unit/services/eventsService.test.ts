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
  /** Injected instead of running the query — models a rejected request. */
  nextError: null as FakePostgrestError | null,
  /** Every `.update()` / `.insert()` payload the service sent, in order. */
  payloads: [] as Record<string, unknown>[],
  /** Every `.order()` call, so the ascending read can be asserted. */
  orders: [] as { column: string; ascending: boolean }[],
  /** Every `.eq()` the service applied, so an added user_id filter is caught. */
  filters: [] as { column: string; value: unknown }[],
  /** Bumped on every `from()` — an offline guard must leave this at 0. */
  fromCalls: 0,
  reset() {
    this.rows = [];
    this.nextError = null;
    this.payloads = [];
    this.orders = [];
    this.filters = [];
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
  let orderColumn: string | null = null;
  let ascending = true;

  const matches = (candidate: EventRow): boolean =>
    filters.every((f) => (candidate as unknown as Record<string, unknown>)[f.column] === f.value);

  const run = (): { data: EventRow[] | null; error: FakePostgrestError | null } => {
    if (backend.nextError) return { data: null, error: backend.nextError };

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
    if (orderColumn) {
      const column = orderColumn;
      found.sort((a, b) => {
        const left = String((a as unknown as Record<string, unknown>)[column]);
        const right = String((b as unknown as Record<string, unknown>)[column]);
        return ascending ? left.localeCompare(right) : right.localeCompare(left);
      });
    }
    return { data: found, error: null };
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
    order: (column: string, options?: { ascending?: boolean }) => {
      orderColumn = column;
      ascending = options?.ascending ?? true;
      backend.orders.push({ column, ascending });
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
    it('returns the couple’s events soonest-first, each date at local midnight', async () => {
      backend.rows = [
        row({ id: 'later', user_id: PARTNER_ID, event_date: '2026-12-25', label: 'Christmas' }),
        row({ id: 'sooner', event_date: '2026-09-12', label: 'Anniversary' }),
      ];

      const events = await eventsService.getEvents();

      // No user_id filter is applied: the events_select policy already scopes
      // the read to the caller and their partner.
      expect(events.map((e) => e.id)).toEqual(['sooner', 'later']);
      expect(backend.orders).toEqual([{ column: 'event_date', ascending: true }]);
      // Load-bearing: adding `.eq('user_id', ...)` here would drop the partner's
      // half of the couple's list — the whole point of the events_select policy
      // — and every other assertion in this file would still pass.
      expect(backend.filters).toEqual([]);

      const [sooner] = events;
      expect(sooner.date.getFullYear()).toBe(2026);
      expect(sooner.date.getMonth()).toBe(8);
      expect(sooner.date.getDate()).toBe(12);
      expect(sooner.userId).toBe(USER_ID);
      expect(sooner.label).toBe('Anniversary');
      expect(sooner.description).toBeNull();
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

      await expect(eventsService.getEvents()).rejects.toThrow(/Network error/);
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
      ).rejects.toThrow(/Network error/);
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
        /Network error/
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

      await expect(eventsService.deleteEvent('event-1')).rejects.toThrow(/Network error/);
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
