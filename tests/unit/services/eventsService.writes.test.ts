/**
 * eventsService — the write failure surface
 *
 * One thing here cannot be caught by the type system, and it is the reason
 * this file exists:
 *
 * RLS filters a non-creator's UPDATE or DELETE into a zero-row success with
 * no error attached. A service that only checked `error` would report that
 * write as having worked, and the UI would tell the user their edit saved.
 *
 * The Supabase client is faked per file — `tests/setup.ts` installs no Supabase
 * mock — over a tiny in-memory backend, so the chained PostgREST builder is
 * exercised rather than asserted on.
 *
 * The backend and its builder live in `./fakeEventsBackend.ts`; the date parse
 * and the reads are covered in `./eventsService.test.ts`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
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

import {
  EventWriteError,
  eventsService,
  type EventCreateInput,
} from '@/services/eventsService';

function eventInput(overrides: Partial<EventCreateInput> = {}): EventCreateInput {
  return { userId: USER_ID, label: 'x', eventDate: '2026-10-01', ...overrides };
}

async function eventWriteFailure(promise: Promise<unknown>): Promise<EventWriteError> {
  const failure = await promise.then(
    () => null,
    (error: unknown) => error
  );
  expect(failure).toBeInstanceOf(EventWriteError);
  return failure as EventWriteError;
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

      const failure = await eventWriteFailure(
        eventsService.createEvent(eventInput())
      );
      expect(failure).toMatchObject({
        code: 'offline',
        message: 'You are offline. Events need a connection to save.',
      });
      expect(backend.fromCalls).toBe(0);
      expect(backend.rows).toEqual([]);
    });

    it('refuses an unreadable date before issuing any request', async () => {
      const failure = await eventWriteFailure(
        eventsService.createEvent(eventInput({ eventDate: 'infinity' }))
      );
      expect(failure).toMatchObject({
        code: 'validation',
        message: 'Not a valid calendar date: infinity',
      });
      expect(backend.fromCalls).toBe(0);
      expect(backend.rows).toEqual([]);
    });

    it('codes an empty successful insert response without changing its message', async () => {
      backend.nextData = null;

      const failure = await eventWriteFailure(
        eventsService.createEvent(eventInput())
      );

      expect(failure).toMatchObject({
        code: 'invalid-response',
        message: 'The event was not created',
      });
    });

    it('codes an unreadable created row as an invalid response', async () => {
      backend.nextData = [row({ event_date: 'infinity' })];

      const failure = await eventWriteFailure(
        eventsService.createEvent(eventInput())
      );

      expect(failure).toMatchObject({
        code: 'invalid-response',
        message: 'The event was saved but its date could not be read',
      });
    });

    it('surfaces the reason when the insert is rejected', async () => {
      backend.nextError = permissionDenied('new row violates row-level security policy');

      const failure = await eventWriteFailure(
        eventsService.createEvent(eventInput({ userId: PARTNER_ID }))
      );
      expect(failure.code).toBe('transport');
      expect(failure.message).toMatch(/Permission denied - check Row Level Security policies/);
    });

    it('does not promise a sync when the insert fails mid-flight — writes have no queue either', async () => {
      // Same trap as the read path: the write may or may not have landed, and
      // nothing will retry it, so the message must not claim a queue will.
      const originalError = Object.assign(new TypeError('fetch failed'), { code: 'ECONNRESET' });
      const originalStack = originalError.stack;
      backend.nextError = originalError;

      const failure = await eventWriteFailure(
        eventsService.createEvent(eventInput())
      );

      expect(failure.message).toBe(
        '[EventsService.createEvent] Network error: fetch failed. Check your internet connection.'
      );
      expect(failure.code).toBe('transport');
      expect(failure.cause).toBe(originalError);
      expect(failure.cause).toMatchObject({ stack: originalStack, code: 'ECONNRESET' });
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

      const failure = await eventWriteFailure(
        eventsService.updateEvent('event-1', { label: 'x' })
      );
      expect(failure).toMatchObject({
        code: 'not-found',
        message: 'Event not found or not yours to edit',
      });
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

      const failure = await eventWriteFailure(
        eventsService.updateEvent('event-1', { label: 'x' })
      );
      expect(failure).toMatchObject({
        code: 'offline',
        message: 'You are offline. Events need a connection to save.',
      });
      expect(backend.fromCalls).toBe(0);
    });

    it('refuses an unreadable date before issuing any request', async () => {
      backend.rows = [row({ id: 'event-1' })];

      const failure = await eventWriteFailure(
        eventsService.updateEvent('event-1', { eventDate: '2026-02-30' })
      );
      expect(failure).toMatchObject({
        code: 'validation',
        message: 'Not a valid calendar date: 2026-02-30',
      });
      expect(backend.fromCalls).toBe(0);
    });

    it('codes an unreadable updated row as an invalid response', async () => {
      backend.rows = [row({ id: 'event-1', event_date: 'infinity' })];

      const failure = await eventWriteFailure(
        eventsService.updateEvent('event-1', { label: 'Renamed' })
      );

      expect(failure).toMatchObject({
        code: 'invalid-response',
        message: 'The event was saved but its date could not be read',
      });
    });

    it('surfaces the reason when the update is rejected', async () => {
      backend.rows = [row({ id: 'event-1' })];
      backend.nextError = permissionDenied();

      const failure = await eventWriteFailure(
        eventsService.updateEvent('event-1', { label: 'x' })
      );
      expect(failure.code).toBe('transport');
      expect(failure.message).toMatch(/Permission denied - check Row Level Security policies/);
    });

    it('codes a mid-flight network failure as transport', async () => {
      const originalError = Object.assign(new TypeError('fetch failed'), { code: 'ECONNRESET' });
      const originalStack = originalError.stack;
      backend.nextError = originalError;

      const failure = await eventWriteFailure(
        eventsService.updateEvent('event-1', { label: 'x' })
      );

      expect(failure).toMatchObject({
        code: 'transport',
        message:
          '[EventsService.updateEvent] Network error: fetch failed. Check your internet connection.',
      });
      expect(failure.cause).toBe(originalError);
      expect(failure.cause).toMatchObject({ stack: originalStack, code: 'ECONNRESET' });
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

      const failure = await eventWriteFailure(eventsService.deleteEvent('event-1'));
      expect(failure).toMatchObject({
        code: 'not-found',
        message: 'Event not found or not yours to delete',
      });
      expect(backend.rows).toHaveLength(1);
    });

    it('throws before any request when the device is offline', async () => {
      setOnline(false);

      const failure = await eventWriteFailure(eventsService.deleteEvent('event-1'));
      expect(failure).toMatchObject({
        code: 'offline',
        message: 'You are offline. Events need a connection to delete.',
      });
      expect(backend.fromCalls).toBe(0);
    });

    it('surfaces the reason when the delete is rejected', async () => {
      backend.nextError = permissionDenied();

      const failure = await eventWriteFailure(eventsService.deleteEvent('event-1'));
      expect(failure.code).toBe('transport');
      expect(failure.message).toMatch(/Permission denied - check Row Level Security policies/);
    });

    it('codes a mid-flight network failure as transport', async () => {
      const originalError = Object.assign(new TypeError('fetch failed'), { code: 'ECONNRESET' });
      const originalStack = originalError.stack;
      backend.nextError = originalError;

      const failure = await eventWriteFailure(eventsService.deleteEvent('event-1'));

      expect(failure).toMatchObject({
        code: 'transport',
        message:
          '[EventsService.deleteEvent] Network error: fetch failed. Check your internet connection.',
      });
      expect(failure.cause).toBe(originalError);
      expect(failure.cause).toMatchObject({ stack: originalStack, code: 'ECONNRESET' });
    });
  });

  describe.each([
    ['createEvent', () => eventsService.createEvent(eventInput())],
    ['updateEvent', () => eventsService.updateEvent('event-1', { label: 'x' })],
    ['deleteEvent', () => eventsService.deleteEvent('event-1')],
  ] as const)('%s transport rejections', (operation, write) => {
    it('preserves a rejected TypeError and its diagnostics as the cause', async () => {
      const originalError = Object.assign(new TypeError('fetch failed'), { code: 'ECONNRESET' });
      const originalStack = originalError.stack;
      backend.nextRejection = { reason: originalError };

      const failure = await eventWriteFailure(write());

      expect(failure.code).toBe('transport');
      expect(failure.message).toBe(
        `[EventsService.${operation}] Network error: fetch failed. Check your internet connection.`
      );
      expect(failure.cause).toBe(originalError);
      expect(failure.cause).toMatchObject({ stack: originalStack, code: 'ECONNRESET' });
    });

    it.each([
      ['object', { message: 'socket closed', retryable: true }],
      ['string', 'socket closed'],
      ['number', 0],
      ['boolean', false],
      ['null', null],
      ['undefined', undefined],
    ])('preserves a thrown %s as the cause with the fallback message', async (_kind, reason) => {
      backend.nextRejection = { reason };

      const failure = await eventWriteFailure(write());

      expect(failure.code).toBe('transport');
      expect(failure.message).toBe(
        `[EventsService.${operation}] Network error: Unknown network error. Check your internet connection.`
      );
      expect(failure).toHaveProperty('cause');
      expect(failure.cause).toBe(reason);
    });
  });
});
