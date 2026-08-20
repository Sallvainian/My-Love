/**
 * Events Service — couple-shared countdown events (`public.events`)
 *
 * The single place two decisions are made for this feature:
 *
 * 1. **The date parse.** `event_date` is a Postgres `date` and PostgREST hands it
 *    back as a bare `"YYYY-MM-DD"` string, which `database.types.ts` types as a
 *    plain `string`. `new Date("2026-09-12")` therefore typechecks, builds, and
 *    is still wrong: that is ECMA-262's date-only form, parsed as UTC midnight,
 *    so every viewer west of UTC renders the previous day. The split-and-rebuild
 *    below is this feature's only conversion — `src/utils/countdownService.ts:83`
 *    does the same thing for recurring anniversaries — and the slice above it
 *    holds a real `Date`, so no renderer is ever handed the string to misparse.
 *    Going the other way, the `<input type="date">` value is written through
 *    untouched (or built with `formatDateISO`); never
 *    `toISOString().split('T')[0]`, which `src/utils/dateUtils.ts:126-128`
 *    records as the same trap in reverse.
 *
 * 2. **The error convention.** This file THROWS, following `src/api/moodApi.ts`:
 *    offline guard, `if (error) throw error`, and a catch tail that routes
 *    through `handleSupabaseError` or a truthful local network error — never
 *    `handleNetworkError`, whose message promises a sync (see
 *    `networkFailure`). It deliberately does
 *    NOT follow `photoService`'s `return []` / `return false` / `return null`,
 *    which loses the reason a write failed — and the reason is exactly what the
 *    creating user has to be told (CAP-7).
 *
 * Every write failure carries an `EventWriteErrorCode` beside its message, so a
 * caller can distinguish a stale row from an offline or transport failure
 * without matching English prose. A write that matches zero rows also throws.
 * RLS filters a non-creator's UPDATE or DELETE silently — no error, no rows —
 * so without this the UI would report success for a no-op.
 *
 * No realtime, no IndexedDB mirror: events are Supabase-only, and freshness is
 * reload-based (see `integration-points.md` §8).
 *
 * @module services/eventsService
 */

import {
  handleSupabaseError,
  isOnline,
  isPostgrestError,
  logSupabaseError,
} from '../api/errorHandlers';
import type { Database } from '../api/supabaseClient';
import { supabase } from '../api/supabaseClient';
import { formatDateISO } from '../utils/dateUtils';
import { logger } from '../utils/logger';

/**
 * Supabase event record type (from database schema)
 */
export type SupabaseEventRecord = Database['public']['Tables']['events']['Row'];

/**
 * The icon set the `events.icon` CHECK constraint allows
 * (`20260818000002_create_events_table.sql:22`).
 *
 * Structurally identical to `IconType` in
 * `src/components/RelationshipTimers/EventCountdown.tsx:14`, which is not
 * exported — a structural match is assignable, so the component stays a leaf.
 */
export type EventIcon = 'ring' | 'plane' | 'calendar';

/**
 * A countdown event as the app uses it: `date` is a real local-midnight `Date`,
 * so nothing downstream has to know the row carried a string.
 */
export interface CoupleEvent {
  id: string;
  userId: string;
  label: string;
  date: Date;
  /** Server insert instant, used ONLY as the same-day tiebreak — never for calendar display. */
  createdAt: Date;
  description: string | null;
  icon: EventIcon;
}

/**
 * Fields for a new event. `eventDate` is the `<input type="date">` value
 * verbatim — a `"YYYY-MM-DD"` string — never a `Date` run through
 * `toISOString()`.
 */
export interface EventCreateInput {
  userId: string;
  label: string;
  eventDate: string;
  description?: string | null;
  icon?: EventIcon;
}

/** Fields an edit may change. Anything left `undefined` is not written. */
export interface EventUpdateInput {
  label?: string;
  eventDate?: string;
  description?: string | null;
  icon?: EventIcon;
}

/**
 * Machine-readable reason a write failed. Store-only failures extend this with
 * `auth`, because a signed-out call is refused before this service is reached.
 */
export type EventWriteErrorCode =
  | 'offline'
  | 'validation'
  | 'not-found'
  | 'invalid-response'
  | 'transport';

/**
 * A write failure with presentation text and a stable control-flow code.
 *
 * Exported so the store can preserve the code instead of inferring it from the
 * message. Deliberately re-thrown untouched by write catch tails. PostgREST
 * failures keep the mapped Supabase error as `cause`, preserving its metadata
 * without replacing this feature-level code.
 */
export class EventWriteError extends Error {
  constructor(
    public readonly code: EventWriteErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'EventWriteError';
  }
}

/**
 * A mid-flight failure that is not a PostgREST error — DNS, a timeout, a
 * dropped socket. NOT `handleNetworkError`: its message promises the change
 * "will be synced when you're back online" (`errorHandlers.ts:95`), and events
 * sync in neither direction, so every catch tail here builds its own truthful
 * message instead. Rewording the shared helper is cross-feature work — its
 * promise is TRUE for the offline-first mood callers — and is tracked as
 * deferred work against `errorHandlers.ts`.
 */
function networkFailure(context: string, error: unknown): Error {
  const detail = error instanceof Error ? error.message : 'Unknown network error';
  return new Error(`[${context}] Network error: ${detail}. Check your internet connection.`);
}

/** Preserve the truthful write-network message while adding its stable code. */
function writeTransportFailure(context: string, error: unknown): EventWriteError {
  return new EventWriteError('transport', networkFailure(context, error).message);
}

/** Preserve the existing friendly PostgREST message while adding its stable code. */
function writePostgrestFailure(
  context: string,
  error: Parameters<typeof handleSupabaseError>[0]
): EventWriteError {
  const mappedError = handleSupabaseError(error, context);
  return new EventWriteError('transport', mappedError.message, { cause: mappedError });
}

/**
 * Narrow the `icon` column (typed `string` by the generated types) to the union.
 *
 * Shape copied from `isValidInteractionType` (`interactionValidation.ts:40`).
 * A row outside the union can only come from a schema that has moved on, so it
 * falls back to the column default rather than dropping the event.
 */
export function isEventIcon(icon: string): icon is EventIcon {
  return icon === 'ring' || icon === 'plane' || icon === 'calendar';
}

/** A bare calendar date, and nothing else. Anchors both ends of the parse. */
const EVENT_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse a bare `"YYYY-MM-DD"` as LOCAL midnight, or `null` if it is not one.
 *
 * THE one conversion. `new Date(eventDate)` is UTC midnight and lands a day
 * early west of UTC; this builds from local components, so each partner's card
 * flips at their own local midnight — which is what the feature asks for. Same
 * split idiom as `src/utils/countdownService.ts:83-86`, but keeping the year:
 * that helper resolves a recurring anniversary onto the current year, whereas an
 * event is one absolute calendar day.
 *
 * Three ways the naive split goes wrong, all of them silent, which is why this
 * returns `null` rather than a `Date` nobody checks:
 * - A `date` column accepts `infinity`, and `'infinity'.split('-')` yields
 *   `[NaN]` — an Invalid Date whose `getTime()` is `NaN`. If that ever reached
 *   `eventsSlice`'s client-side `sortByDate`, a `NaN` comparator result gives
 *   `Array.prototype.sort` no ordering guarantee for the affected element(s)
 *   (measured: NOT "every element" scrambles — only the `NaN` row and its
 *   immediate neighbor land unpredictably; the rest of a realistic-sized list
 *   still sorts correctly). Dropping the row here keeps it out of that array
 *   entirely, rather than relying on the sort to cope.
 * - `new Date(99, 0, 1)` is 1999, not the year 99 — the two-digit-year mapping.
 *   `setFullYear` undoes it.
 * - `new Date(2026, 1, 30)` rolls forward to March 2 instead of failing.
 */
export function parseEventDate(eventDate: string): Date | null {
  const match = EVENT_DATE_PATTERN.exec(eventDate);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const parsed = new Date(year, month - 1, day);
  parsed.setFullYear(year);

  // Read the components back: anything that rolled over is not the date asked for.
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

/**
 * Row → domain, or `null` when the row's date cannot be read.
 *
 * The only place a `SupabaseEventRecord` becomes a `CoupleEvent`. An unreadable
 * date drops the row rather than poisoning the list it would be sorted into;
 * an unknown icon keeps it, because the icon has a sensible default and a date
 * does not.
 */
function toCoupleEvent(row: SupabaseEventRecord): CoupleEvent | null {
  const date = parseEventDate(row.event_date);
  if (!date) {
    console.error('[EventsService] Skipping event with unreadable event_date:', row.id);
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    date,
    // An absolute instant compared ordinally, so `new Date(iso)` is safe here —
    // the calendar-date trap above applies only to `event_date`.
    createdAt: new Date(row.created_at),
    description: row.description,
    icon: isEventIcon(row.icon) ? row.icon : 'calendar',
  };
}

/**
 * Rows read from each side of today when the caller names no page size.
 *
 * Also the fallback for a non-finite `limit`, so the two cannot drift apart:
 * a caller that passes nothing and a caller that passes `NaN` get the same
 * window rather than one getting a malformed range.
 */
const DEFAULT_EVENTS_PAGE_SIZE = 50;

/**
 * Events Service Class
 *
 * Responsibilities:
 * - Read the couple's events (own + partner's, via the SELECT policy)
 * - Create, update and delete the signed-in user's own events
 * - Convert every row to the `CoupleEvent` domain type
 */
class EventsService {
  /**
   * Fetch the couple's events in a bounded window centred on today.
   *
   * No `user_id` filter: the `events_select` policy already scopes the read to
   * the caller and their partner via `get_my_partner_id()`. Adding one would
   * silently drop the partner's half of the couple's list, so the tests assert
   * that this query carries no equality filter at all.
   *
   * **Two reads, one window.** The returned array is still `event_date`
   * ascending with a `created_at` ascending tiebreak — the contract
   * `eventsSlice.sortByDate` mirrors — but the rows come from two bounded
   * pages, one on each side of today. A single page cannot be bounded safely
   * here, because one array serves two screens: Home wants the soonest
   * upcoming events, Settings wants the whole list *including* past ones so a
   * mistyped date stays editable (`EventsSettings.tsx`).
   *
   * - One ascending page keeps the OLDEST rows. Every event eventually becomes
   *   a past event, so given enough history that page holds nothing but past
   *   events and Home shows its empty placeholder while real events exist.
   * - One descending page keeps the FARTHEST-FUTURE rows, so it hides the next
   *   event as soon as the couple has more than `limit` future events.
   *
   * Anchoring at today is the only arrangement where the cap can never drop
   * the soonest upcoming event, and it costs one extra parallel request.
   *
   * Neither sort is index-backed: `idx_events_user_event_date` leads on
   * `user_id`, and with no equality predicate on that column Postgres cannot
   * walk the index in `event_date` order. It sorts. That is fine at a couple's
   * scale, and the index still serves the RLS predicate's `user_id` lookups.
   *
   * **What the cap drops, and where that shows.** Past `limit` events on a
   * side, the far ends go: the most distant future and the OLDEST past. The
   * oldest-past end is the one with a consumer — `EventsSettings` lists the
   * array unfiltered so a mistyped year can be corrected there, and a year
   * typed wrong into the deep past is exactly such a row. At the default 50 a
   * couple reaches that only after 50 past events; there is no "load more"
   * control, so beyond it those rows are reachable only by passing a larger
   * `limit` or a non-zero `offset`. Callers that must show everything have to
   * page; today's single caller does not.
   *
   * @param limit - Maximum rows read from EACH side of today: up to `limit`
   *   upcoming (today included) and up to `limit` already-passed, so a call can
   *   return up to `2 × limit` rows — the per-side meaning is the intended
   *   contract, not photoService's whole-result cap. Mirrors
   *   `photoService.getPhotos(limit = 50, offset = 0)` in signature only.
   *   Clamped to at least 1, and to {@link DEFAULT_EVENTS_PAGE_SIZE} when not
   *   finite: `limit = 0` would otherwise build the backwards range `(0, -1)`.
   * @param offset - How far past the first page to start, applied to both
   *   sides, so paging walks outward from today in both directions. Note this
   *   is NOT photoService's paging: successive pages walk in opposite
   *   directions, so page 1's past rows sort BEFORE page 0's rather than after.
   * @returns Events in date order, each with a local-midnight `Date`
   * @throws an accurate offline or mid-flight network error, or
   *   {SupabaseServiceError} if the query fails
   */
  async getEvents(
    limit: number = DEFAULT_EVENTS_PAGE_SIZE,
    offset: number = 0
  ): Promise<CoupleEvent[]> {
    if (!isOnline()) {
      // NOT handleNetworkError: its message promises the change "will be
      // synced when you're back online", and events have no sync path in
      // either direction. Accurate and user-facing instead.
      throw new Error('You are offline. Events need a connection to load.');
    }

    // The viewer's own calendar day, so the cut lands where Home's
    // `getCalendarDaysDiff(...) >= 0` filter already puts it. Built with
    // `formatDateISO` and never `toISOString().split('T')[0]`, which
    // `src/utils/dateUtils.ts` records as the same UTC trap in reverse.
    const todayISO = formatDateISO(new Date());
    // Clamped before the range is built, in the same spirit as the write paths
    // that refuse bad input before issuing a request: `limit = 0` yields
    // `.range(0, -1)` and a fractional limit yields a fractional bound, and
    // PostgREST answers both with a 400 that surfaces as a failed load.
    //
    // The finiteness check is not redundant: `Math.max(1, Math.floor(NaN))` is
    // NaN and `Math.floor(Infinity)` is Infinity, so a `Math.max` clamp alone
    // passes both straight through into `.range()` and produces exactly the 400
    // it is here to prevent. Non-finite falls back to the documented defaults
    // rather than throwing, because a bad page size is never worth denying the
    // caller their events.
    const pageSize = Number.isFinite(limit)
      ? Math.max(1, Math.floor(limit))
      : DEFAULT_EVENTS_PAGE_SIZE;
    const firstRow = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;
    const lastRow = firstRow + pageSize - 1;

    try {
      const [upcoming, past] = await Promise.all([
        supabase
          .from('events')
          .select('*')
          .gte('event_date', todayISO)
          .order('event_date', { ascending: true })
          // Tiebreak same-day events on creation time: Postgres leaves ties
          // unspecified, so without this two same-day cards can swap position
          // between loads (DW-10).
          .order('created_at', { ascending: true })
          .range(firstRow, lastRow),
        supabase
          .from('events')
          .select('*')
          .lt('event_date', todayISO)
          // Descending so the page holds the MOST RECENT past events — the
          // ones a wrong date is still worth correcting. Reversed below.
          .order('event_date', { ascending: false })
          .order('created_at', { ascending: false })
          .range(firstRow, lastRow),
      ]);

      if (upcoming.error) {
        throw upcoming.error;
      }
      if (past.error) {
        throw past.error;
      }

      // Reversing an already-ordered page is not a client-side re-sort: it is
      // exact, and it turns `event_date` DESC / `created_at` DESC back into the
      // ascending pair. Every past date sorts before every upcoming one, so the
      // concatenation is globally ascending with no comparator involved.
      //
      // The two pages are two requests, not one snapshot. A row whose date is
      // edited across today while they are in flight has three possible fates,
      // and only the first is handled here:
      //
      // 1. It comes back in BOTH pages. Handled: one copy is dropped, because
      //    keeping both would put a duplicate React key into Home's map and
      //    render the same event twice. The upcoming copy is the one kept — an
      //    arbitrary but stable choice, so the list never flickers between two
      //    renderings of the same row.
      // 2. It comes back in NEITHER, when the past page is answered before the
      //    edit and the upcoming page after it (or the reverse). The row is
      //    simply absent until the next load.
      // 3. It comes back in both and the copy kept is the pre-edit one, so an
      //    already-passed event renders as upcoming until the next load.
      //
      // 2 and 3 are left alone deliberately: both need a partner editing an
      // event across today's boundary during a load, both correct themselves on
      // the next `loadEvents()`, and closing them means abandoning the
      // two-window read for a single request — the shape this design chose
      // against, and a decision above this function's pay grade. Recorded as a
      // deferred item on the story rather than patched here.
      const upcomingRows = upcoming.data ?? [];
      const upcomingIds = new Set(upcomingRows.map((row) => row.id));
      const rows = [...(past.data ?? [])]
        .reverse()
        .filter((row) => !upcomingIds.has(row.id))
        .concat(upcomingRows);

      // A row whose date cannot be read is dropped, not carried. Both pages are
      // ordered by Postgres, so no JS comparator runs here — dropping the row
      // instead keeps an Invalid Date out of the domain model before it can
      // reach a later client-side re-sort (`eventsSlice.sortByDate`).
      const events = rows
        .map(toCoupleEvent)
        .filter((event): event is CoupleEvent => event !== null);
      logger.debug('[EventsService] Fetched events:', events.length);
      return events;
    } catch (error) {
      logSupabaseError('EventsService.getEvents', error);

      if (isPostgrestError(error)) {
        throw handleSupabaseError(error, 'EventsService.getEvents');
      }

      throw networkFailure('EventsService.getEvents', error);
    }
  }

  /**
   * Create an event owned by `input.userId`.
   *
   * No retry and no idempotency key: `public.events` has neither an
   * `idempotency_key` column nor a UNIQUE constraint to key an upsert on, so a
   * silent retry would risk a duplicate row. A failure surfaces to the user,
   * who retries deliberately.
   *
   * @returns The created event
   * @throws {EventWriteError} if `eventDate` is not a real calendar date — a
   *   `date` column would accept `infinity`, and one unreadable row leaves the
   *   whole list unsorted, so the value is refused here rather than stored
   * @throws {EventWriteError} if offline — no queue exists, so the write is lost
   * @throws {EventWriteError} with `transport` if the request fails mid-flight
   *   or PostgREST rejects it (RLS rejects a `user_id` that is not the caller
   *   with 42501)
   */
  async createEvent(input: EventCreateInput): Promise<CoupleEvent> {
    if (!isOnline()) {
      // NOT handleNetworkError: no offline queue exists, so its "will be
      // synced when you're back online" promise is the opposite of the truth.
      throw new EventWriteError(
        'offline',
        'You are offline. Events need a connection to save.'
      );
    }

    const parsedInput = parseEventDate(input.eventDate);
    if (!parsedInput) {
      throw new EventWriteError(
        'validation',
        `Not a valid calendar date: ${input.eventDate}`
      );
    }

    try {
      const payload: Database['public']['Tables']['events']['Insert'] = {
        user_id: input.userId,
        label: input.label,
        // Written through untouched — see the module header.
        event_date: input.eventDate,
        description: input.description ?? null,
        ...(input.icon ? { icon: input.icon } : {}),
      };

      const { data, error } = await supabase.from('events').insert(payload).select().single();

      if (error) {
        throw error;
      }

      if (!data) {
        // Not a network problem, so it must not be dressed as one: the catch
        // tail would otherwise promise a sync that no queue exists to perform.
        throw new EventWriteError('invalid-response', 'The event was not created');
      }

      const created = toCoupleEvent(data);
      if (!created) {
        throw new EventWriteError(
          'invalid-response',
          'The event was saved but its date could not be read'
        );
      }

      logger.debug('[EventsService] Created event:', created.id);
      return created;
    } catch (error) {
      if (error instanceof EventWriteError) {
        throw error;
      }

      logSupabaseError('EventsService.createEvent', error);

      if (isPostgrestError(error)) {
        throw writePostgrestFailure('EventsService.createEvent', error);
      }

      throw writeTransportFailure('EventsService.createEvent', error);
    }
  }

  /**
   * Update one of the signed-in user's own events.
   *
   * `updated_at` is set on every write: the migration comment at
   * `20260818000002_create_events_table.sql:38-41` records that the column is
   * client-maintained and has deliberately no trigger.
   *
   * The payload is typed with the generated `Update` row rather than a
   * `Record<string, unknown>`: postgrest-js wraps `.update()` payloads in
   * `RejectExcessProperties`, which resolves an index signature to `never`
   * (recorded at `scriptureReadingService.ts:270-275`).
   *
   * @returns The updated event
   * @throws {EventWriteError} if the update matched no row — RLS filters a
   *   non-creator's write silently, so zero rows is the only signal there is
   * @throws {EventWriteError} if offline — no queue exists, so the write is lost
   * @throws {EventWriteError} with `transport` if the request fails mid-flight
   *   or PostgREST rejects it
   */
  async updateEvent(eventId: string, updates: EventUpdateInput): Promise<CoupleEvent> {
    if (!isOnline()) {
      // NOT handleNetworkError: no offline queue exists, so its "will be
      // synced when you're back online" promise is the opposite of the truth.
      throw new EventWriteError(
        'offline',
        'You are offline. Events need a connection to save.'
      );
    }

    // Same refusal as createEvent: an unreadable date must not reach the column.
    if (updates.eventDate !== undefined && !parseEventDate(updates.eventDate)) {
      throw new EventWriteError(
        'validation',
        `Not a valid calendar date: ${updates.eventDate}`
      );
    }

    try {
      const payload: Database['public']['Tables']['events']['Update'] = {
        updated_at: new Date().toISOString(),
      };
      if (updates.label !== undefined) payload.label = updates.label;
      if (updates.eventDate !== undefined) payload.event_date = updates.eventDate;
      if (updates.description !== undefined) payload.description = updates.description;
      if (updates.icon !== undefined) payload.icon = updates.icon;

      // `.select()` so the affected rows come back: a partner's UPDATE is
      // filtered by RLS into a zero-row success, with no error to read.
      const { data, error } = await supabase
        .from('events')
        .update(payload)
        .eq('id', eventId)
        .select();

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        throw new EventWriteError('not-found', 'Event not found or not yours to edit');
      }

      const updated = toCoupleEvent(data[0]);
      if (!updated) {
        throw new EventWriteError(
          'invalid-response',
          'The event was saved but its date could not be read'
        );
      }

      logger.debug('[EventsService] Updated event:', eventId);
      return updated;
    } catch (error) {
      if (error instanceof EventWriteError) {
        throw error;
      }

      logSupabaseError('EventsService.updateEvent', error);

      if (isPostgrestError(error)) {
        throw writePostgrestFailure('EventsService.updateEvent', error);
      }

      throw writeTransportFailure('EventsService.updateEvent', error);
    }
  }

  /**
   * Delete one of the signed-in user's own events.
   *
   * @throws {EventWriteError} if the delete matched no row (same silent RLS
   *   filter as `updateEvent`)
   * @throws {EventWriteError} if offline — no queue exists, so the write is lost
   * @throws {EventWriteError} with `transport` if the request fails mid-flight
   *   or PostgREST rejects it
   */
  async deleteEvent(eventId: string): Promise<void> {
    if (!isOnline()) {
      // NOT handleNetworkError: no offline queue exists, so its "will be
      // synced when you're back online" promise is the opposite of the truth.
      throw new EventWriteError(
        'offline',
        'You are offline. Events need a connection to save.'
      );
    }

    try {
      const { data, error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId)
        .select();

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        throw new EventWriteError('not-found', 'Event not found or not yours to delete');
      }

      logger.debug('[EventsService] Deleted event:', eventId);
    } catch (error) {
      if (error instanceof EventWriteError) {
        throw error;
      }

      logSupabaseError('EventsService.deleteEvent', error);

      if (isPostgrestError(error)) {
        throw writePostgrestFailure('EventsService.deleteEvent', error);
      }

      throw writeTransportFailure('EventsService.deleteEvent', error);
    }
  }
}

/**
 * Singleton instance of EventsService
 * Use this instance throughout the app for event operations
 */
export const eventsService = new EventsService();
