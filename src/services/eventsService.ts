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
 *    through `handleSupabaseError`/`handleNetworkError`. It deliberately does
 *    NOT follow `photoService`'s `return []` / `return false` / `return null`,
 *    which loses the reason a write failed — and the reason is exactly what the
 *    creating user has to be told (CAP-7).
 *
 * A write that matches zero rows also throws. RLS filters a non-creator's UPDATE
 * or DELETE silently — no error, no rows — so without this the UI would report
 * success for a no-op.
 *
 * No realtime, no IndexedDB mirror: events are Supabase-only, and freshness is
 * reload-based (see `integration-points.md` §8).
 *
 * @module services/eventsService
 */

import {
  handleNetworkError,
  handleSupabaseError,
  isOnline,
  isPostgrestError,
  logSupabaseError,
} from '../api/errorHandlers';
import type { Database } from '../api/supabaseClient';
import { supabase } from '../api/supabaseClient';
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
 * A write that reached the database and changed nothing.
 *
 * Not exported and deliberately re-thrown untouched by the catch tail: routing
 * it through `handleNetworkError` would tell the user their change "will be
 * synced when you're back online", which is the opposite of what happened.
 * Same shape as `moodApi`'s `ApiValidationError` (`moodApi.ts:30-37,104-107`).
 */
class EventWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventWriteError';
  }
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
    description: row.description,
    icon: isEventIcon(row.icon) ? row.icon : 'calendar',
  };
}

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
   * Fetch every event visible to the signed-in user.
   *
   * No `user_id` filter: the `events_select` policy already scopes the read to
   * the caller and their partner via `get_my_partner_id()`. Adding one would
   * silently drop the partner's half of the couple's list, so the tests assert
   * that this query carries no filter at all.
   *
   * Ordered `event_date` ascending — soonest first. Note this sort is NOT
   * index-backed: `idx_events_user_event_date` leads on `user_id`, and with no
   * equality predicate on that column Postgres cannot walk the index in
   * `event_date` order. It sorts. That is fine at a couple's scale, and the
   * index still serves the RLS predicate's `user_id` lookups.
   *
   * @returns Events in date order, each with a local-midnight `Date`
   * @throws {SupabaseServiceError} if offline or the query fails
   */
  async getEvents(): Promise<CoupleEvent[]> {
    if (!isOnline()) {
      throw handleNetworkError(new Error('Device is offline'), 'EventsService.getEvents');
    }

    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true });

      if (error) {
        throw error;
      }

      // A row whose date cannot be read is dropped, not carried. This read is
      // ordered by Postgres (`.order()` above), so no JS comparator runs here —
      // dropping the row instead keeps an Invalid Date out of the domain model
      // before it can reach a later client-side re-sort (`eventsSlice.sortByDate`).
      const events = (data ?? [])
        .map(toCoupleEvent)
        .filter((event): event is CoupleEvent => event !== null);
      logger.debug('[EventsService] Fetched events:', events.length);
      return events;
    } catch (error) {
      logSupabaseError('EventsService.getEvents', error);

      if (isPostgrestError(error)) {
        throw handleSupabaseError(error, 'EventsService.getEvents');
      }

      throw handleNetworkError(error, 'EventsService.getEvents');
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
   * @throws {SupabaseServiceError} if offline or the insert fails (RLS rejects a
   *   `user_id` that is not the caller with 42501)
   */
  async createEvent(input: EventCreateInput): Promise<CoupleEvent> {
    if (!isOnline()) {
      throw handleNetworkError(new Error('Device is offline'), 'EventsService.createEvent');
    }

    const parsedInput = parseEventDate(input.eventDate);
    if (!parsedInput) {
      throw new EventWriteError(`Not a valid calendar date: ${input.eventDate}`);
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
        throw new EventWriteError('The event was not created');
      }

      const created = toCoupleEvent(data);
      if (!created) {
        throw new EventWriteError('The event was saved but its date could not be read');
      }

      logger.debug('[EventsService] Created event:', created.id);
      return created;
    } catch (error) {
      if (error instanceof EventWriteError) {
        throw error;
      }

      logSupabaseError('EventsService.createEvent', error);

      if (isPostgrestError(error)) {
        throw handleSupabaseError(error, 'EventsService.createEvent');
      }

      throw handleNetworkError(error, 'EventsService.createEvent');
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
   * @throws {SupabaseServiceError} if offline or the update fails
   */
  async updateEvent(eventId: string, updates: EventUpdateInput): Promise<CoupleEvent> {
    if (!isOnline()) {
      throw handleNetworkError(new Error('Device is offline'), 'EventsService.updateEvent');
    }

    // Same refusal as createEvent: an unreadable date must not reach the column.
    if (updates.eventDate !== undefined && !parseEventDate(updates.eventDate)) {
      throw new EventWriteError(`Not a valid calendar date: ${updates.eventDate}`);
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
        throw new EventWriteError('Event not found or not yours to edit');
      }

      const updated = toCoupleEvent(data[0]);
      if (!updated) {
        throw new EventWriteError('The event was saved but its date could not be read');
      }

      logger.debug('[EventsService] Updated event:', eventId);
      return updated;
    } catch (error) {
      if (error instanceof EventWriteError) {
        throw error;
      }

      logSupabaseError('EventsService.updateEvent', error);

      if (isPostgrestError(error)) {
        throw handleSupabaseError(error, 'EventsService.updateEvent');
      }

      throw handleNetworkError(error, 'EventsService.updateEvent');
    }
  }

  /**
   * Delete one of the signed-in user's own events.
   *
   * @throws {EventWriteError} if the delete matched no row (same silent RLS
   *   filter as `updateEvent`)
   * @throws {SupabaseServiceError} if offline or the delete fails
   */
  async deleteEvent(eventId: string): Promise<void> {
    if (!isOnline()) {
      throw handleNetworkError(new Error('Device is offline'), 'EventsService.deleteEvent');
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
        throw new EventWriteError('Event not found or not yours to delete');
      }

      logger.debug('[EventsService] Deleted event:', eventId);
    } catch (error) {
      if (error instanceof EventWriteError) {
        throw error;
      }

      logSupabaseError('EventsService.deleteEvent', error);

      if (isPostgrestError(error)) {
        throw handleSupabaseError(error, 'EventsService.deleteEvent');
      }

      throw handleNetworkError(error, 'EventsService.deleteEvent');
    }
  }
}

/**
 * Singleton instance of EventsService
 * Use this instance throughout the app for event operations
 */
export const eventsService = new EventsService();
