/**
 * eventsSlice — per-call outcomes and concurrent event reconciliation
 *
 * `eventsService` throws, so every action here has a reason to report. The two
 * things worth pinning:
 *
 * 1. **Every call returns its own outcome.** `eventsError` belongs only to the
 *    active load; writes hand their failure to their own caller without
 *    changing that load channel.
 * 2. **The list stays in date order.** Reads come back `event_date` ascending;
 *    an added or re-dated event has to land in the right place, not at the end.
 * 3. **A load replays writes completed after it began.** Its older response
 *    cannot roll back an add/edit or resurrect a delete.
 *
 * Here: addEvent, editEvent, removeEvent and the dates-changed broadcast. The
 * rest is in `eventsSlice.test.ts` and `eventsSlice.paging.test.ts`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const getEvents = vi.fn();
const getEventsPage = vi.fn();
const getEvent = vi.fn();
const createEvent = vi.fn();
const updateEvent = vi.fn();
const deleteEvent = vi.fn();

vi.mock('../../../src/services/eventsService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/services/eventsService')>()),
  eventsService: {
    getEventsPage: (...args: unknown[]) => getEventsPage(...args),
    getEvent: (eventId: string) => getEvent(eventId),
    createEvent: (input: unknown) => createEvent(input),
    updateEvent: (eventId: string, updates: unknown) => updateEvent(eventId, updates),
    deleteEvent: (eventId: string) => deleteEvent(eventId),
  },
}));

/** In-memory local copies keyed `userId|kind`; reset per test. */
const savedCopies = new Map<string, unknown>();
const readLocalCopy = vi.fn();
const writeLocalCopy = vi.fn();

vi.mock('../../../src/services/localCopy', () => ({
  readLocalCopy: (userId: string, kind: string) => readLocalCopy(userId, kind),
  writeLocalCopy: (userId: string, kind: string, value: unknown) =>
    writeLocalCopy(userId, kind, value),
  registerLocalCopy: () => () => {},
}));

import { moodSyncService } from '../../../src/api/moodSyncService';
import { INSUFFICIENT_PRIVILEGE } from '../../support/sqlstate';
import {
  USER_ID,
  createTestStore,
  event,
  eventInput,
  pagination,
  codedWriteError,
  type TestStore,
} from './eventsSliceFixture';

describe('eventsSlice', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    savedCopies.clear();
    readLocalCopy.mockImplementation(async (userId: string, kind: string) =>
      savedCopies.has(`${userId}|${kind}`) ? savedCopies.get(`${userId}|${kind}`) : null
    );
    writeLocalCopy.mockImplementation(async (userId: string, kind: string, value: unknown) => {
      savedCopies.set(`${userId}|${kind}`, value);
    });
    getEventsPage.mockReset().mockImplementation(async () => ({
      events: await getEvents(),
      pagination: pagination(false),
    }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  // ==========================================================================
  // addEvent
  // ==========================================================================

  describe('addEvent', () => {
    it('inserts the created event in date order and reports success', async () => {
      const store = createTestStore();
      store.setState({
        events: [event('sooner', '2026-09-12'), event('later', '2026-12-25')],
      });
      const created = event('middle', '2026-10-31');
      createEvent.mockResolvedValue(created);

      const result = await store.getState().addEvent({
        label: 'middle',
        eventDate: '2026-10-31',
        icon: 'plane',
      });

      expect(result).toEqual({ success: true });
      expect(store.getState().events.map((e) => e.id)).toEqual(['sooner', 'middle', 'later']);
      expect(store.getState().eventsError).toBeNull();
    });

    it('slots a same-day event after its earlier-created sibling, matching the server order', async () => {
      // getEvents orders event_date ASC, created_at ASC. A just-created event
      // has the greatest created_at of its day, so it must land last among its
      // same-day siblings NOW — or the card jumps position on the next reload.
      const store = createTestStore();
      store.setState({
        events: [event('first-of-day', '2026-10-31', { createdAt: new Date(2026, 0, 1) })],
      });
      createEvent.mockResolvedValue(
        event('second-of-day', '2026-10-31', { createdAt: new Date(2026, 0, 2) })
      );

      await store.getState().addEvent(eventInput('second-of-day'));

      expect(store.getState().events.map((e) => e.id)).toEqual(['first-of-day', 'second-of-day']);
    });

    it('passes the signed-in user as the creator', async () => {
      const store = createTestStore();
      createEvent.mockResolvedValue(event('new', '2026-10-31'));

      await store.getState().addEvent(eventInput('new'));

      expect(createEvent).toHaveBeenCalledWith({
        userId: USER_ID,
        label: 'new',
        eventDate: '2026-10-31',
      });
    });

    it('hands the reason back without changing the load error, leaving the list alone', async () => {
      const store = createTestStore();
      const existing = [event('sooner', '2026-09-12')];
      store.setState({ events: existing, eventsError: 'the current load failed' });
      createEvent.mockRejectedValue(
        Object.assign(
          new Error(
            '[EventsService.createEvent] Permission denied - check Row Level Security policies'
          ),
          { code: INSUFFICIENT_PRIVILEGE }
        )
      );

      const result = await store.getState().addEvent(eventInput());

      expect(result.success).toBe(false);
      expect(result).toEqual({
        success: false,
        code: 'transport',
        error: '[EventsService.createEvent] Permission denied - check Row Level Security policies',
      });
      expect(store.getState().eventsError).toBe('the current load failed');
      expect(store.getState().events).toEqual(existing);
    });

    it('reports an offline create as a failure rather than presenting it as saved', async () => {
      // The service throws before issuing a request when the device is offline.
      // CAP-7 is the whole point: the event must not appear in the list as if it
      // had been saved, and the caller has to be told why.
      //
      // The message is the exact string eventsService's offline guard throws —
      // an EventWriteError that bypasses handleNetworkError precisely so no
      // "will be synced when you're back online" promise is made; events have
      // no offline queue. Copied verbatim rather than invented, because this
      // file mocks the service and a made-up string would pass while
      // documenting a message the app never emits.
      const OFFLINE_MESSAGE = 'You are offline. Events need a connection to save.';
      const store = createTestStore();
      createEvent.mockRejectedValue(codedWriteError('offline', OFFLINE_MESSAGE));

      const result = await store.getState().addEvent(eventInput());

      expect(result).toEqual({ success: false, code: 'offline', error: OFFLINE_MESSAGE });
      expect(store.getState().eventsError).toBeNull();
      expect(store.getState().events).toEqual([]);
    });

    it.each(['validation', 'invalid-response'] as const)(
      'preserves the %s service code and leaves the list unchanged',
      async (code) => {
        const store = createTestStore();
        const existing = [event('existing', '2026-09-12')];
        store.setState({ events: existing });
        createEvent.mockRejectedValue(codedWriteError(code, 'The returned message'));

        const result = await store.getState().addEvent(eventInput());

        expect(result).toEqual({ success: false, code, error: 'The returned message' });
        expect(store.getState().events).toEqual(existing);
      }
    );

    it('refuses without a signed-in user and never reaches the service', async () => {
      const store = createTestStore();
      store.setState({ userId: null });

      const result = await store.getState().addEvent(eventInput());

      expect(result).toEqual({
        success: false,
        code: 'auth',
        error: 'You must be signed in to add an event',
      });
      expect(store.getState().eventsError).toBeNull();
      expect(createEvent).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // editEvent
  // ==========================================================================

  describe('editEvent', () => {
    it('replaces the event and re-sorts, because an edit can move the date', async () => {
      const store = createTestStore();
      store.setState({
        events: [event('a', '2026-09-12'), event('b', '2026-10-31'), event('c', '2026-12-25')],
      });
      updateEvent.mockResolvedValue(event('a', '2026-11-30'));

      const result = await store.getState().editEvent('a', { eventDate: '2026-11-30' });

      expect(result).toEqual({ success: true });
      expect(store.getState().events.map((e) => e.id)).toEqual(['b', 'a', 'c']);
      expect(updateEvent).toHaveBeenCalledWith('a', { eventDate: '2026-11-30' });
    });

    it('orders by creation time when an edit moves a date onto an occupied day', async () => {
      // The moved event keeps its array index, so without the created_at
      // tiebreak the stable sort would place it by position, not server order.
      const store = createTestStore();
      store.setState({
        events: [
          event('moved', '2026-09-12', { createdAt: new Date(2026, 0, 1) }),
          event('resident', '2026-10-31', { createdAt: new Date(2026, 0, 2) }),
        ],
      });
      updateEvent.mockResolvedValue(event('moved', '2026-10-31', { createdAt: new Date(2026, 0, 1) }));

      await store.getState().editEvent('moved', { eventDate: '2026-10-31' });

      // 'moved' was created first, so among same-day rows it comes first —
      // exactly where a reload would put it.
      expect(store.getState().events.map((e) => e.id)).toEqual(['moved', 'resident']);
    });

    it('refuses without a signed-in user and never reaches the service', async () => {
      // Mirrors addEvent's bail: without it the service call would go out
      // signed out despite there being no caller identity for the edit.
      const store = createTestStore();
      store.setState({ userId: null });

      const result = await store.getState().editEvent('a', { label: 'x' });

      expect(result).toEqual({
        success: false,
        code: 'auth',
        error: 'You must be signed in to edit an event',
      });
      expect(store.getState().eventsError).toBeNull();
      expect(updateEvent).not.toHaveBeenCalled();
    });

    it('reports a zero-row write as a failure and drops the event, which the partner deleted', async () => {
      // Both partners may edit any event, so zero rows means the row is gone:
      // the list must stop showing it rather than pretend the edit landed.
      const store = createTestStore();
      store.setState({ events: [event('deleted-by-partner', '2026-09-12'), event('kept', '2026-10-31')] });
      updateEvent.mockRejectedValue(
        codedWriteError('not-found', 'Event not found or not yours to edit')
      );

      const result = await store.getState().editEvent('deleted-by-partner', { label: 'renamed' });

      expect(result).toEqual({
        success: false,
        code: 'not-found',
        error: 'Event not found or not yours to edit',
      });
      expect(store.getState().eventsError).toBeNull();
      expect(store.getState().events.map((e) => e.id)).toEqual(['kept']);
    });

    it('keeps the event on any other failure', async () => {
      const store = createTestStore();
      const existing = [event('a', '2026-09-12')];
      store.setState({ events: existing });
      updateEvent.mockRejectedValue(codedWriteError('transport', 'Network down'));

      const result = await store.getState().editEvent('a', { label: 'renamed' });

      expect(result).toMatchObject({ success: false, code: 'transport' });
      expect(store.getState().events).toEqual(existing);
    });
  });

  // ==========================================================================
  // removeEvent
  // ==========================================================================

  describe('removeEvent', () => {
    it('takes the event out of the list', async () => {
      const store = createTestStore();
      store.setState({ events: [event('a', '2026-09-12'), event('b', '2026-10-31')] });
      deleteEvent.mockResolvedValue(undefined);

      const result = await store.getState().removeEvent('a');

      expect(result).toEqual({ success: true });
      expect(store.getState().events.map((e) => e.id)).toEqual(['b']);
    });

    it('refuses without a signed-in user and never reaches the service', async () => {
      const store = createTestStore();
      store.setState({ userId: null });

      const result = await store.getState().removeEvent('a');

      expect(result).toEqual({
        success: false,
        code: 'auth',
        error: 'You must be signed in to delete an event',
      });
      expect(store.getState().eventsError).toBeNull();
      expect(deleteEvent).not.toHaveBeenCalled();
    });

    it('treats a zero-row delete as done: the partner deleted it first, so it leaves the list', async () => {
      const store = createTestStore();
      store.setState({ events: [event('deleted-by-partner', '2026-09-12'), event('kept', '2026-10-31')] });
      deleteEvent.mockRejectedValue(
        codedWriteError('not-found', 'Event not found or not yours to delete')
      );

      const result = await store.getState().removeEvent('deleted-by-partner');

      expect(result).toEqual({ success: true });
      expect(store.getState().eventsError).toBeNull();
      expect(store.getState().events.map((e) => e.id)).toEqual(['kept']);
    });
  });

  // ==========================================================================
  // Telling the partner's app
  // ==========================================================================

  describe('dates-changed broadcast', () => {
    it('tells the partner after an add, an edit and a delete, and not after a failure', async () => {
      const announce = vi.spyOn(moodSyncService, 'announceDatesChanged').mockResolvedValue();
      const store = createTestStore();
      store.setState({ partner: { id: 'PARTNER-ID' } } as Partial<TestStore>);
      store.setState({ events: [event('a', '2026-09-12')] });
      createEvent.mockResolvedValue(event('b', '2026-10-31'));
      updateEvent.mockResolvedValue(event('a', '2026-09-13'));
      deleteEvent.mockResolvedValue(undefined);

      await store.getState().addEvent({ label: 'b', eventDate: '2026-10-31', icon: 'calendar' });
      await store.getState().editEvent('a', { label: 'renamed' });
      await store.getState().removeEvent('a');
      expect(announce.mock.calls).toEqual([['PARTNER-ID'], ['PARTNER-ID'], ['PARTNER-ID']]);

      updateEvent.mockRejectedValue(codedWriteError('transport', 'Network down'));
      await store.getState().editEvent('b', { label: 'again' });
      expect(announce).toHaveBeenCalledTimes(3);
      announce.mockRestore();
    });
  });
});
