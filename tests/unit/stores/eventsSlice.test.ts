/**
 * eventsSlice — what the caller of a write is told, and what the list looks like after
 *
 * `eventsService` throws, so every action here has a reason to report. The two
 * things worth pinning:
 *
 * 1. **A write returns its own outcome.** Reading `eventsError` back off the
 *    store after an await races every other write in the app, so a failed save
 *    hands the message straight back to the caller as well as parking it in
 *    `eventsError`. That is what lets the create form tell the user THIS event
 *    did not save (CAP-7) instead of showing whatever the shared key holds.
 * 2. **The list stays in date order.** Reads come back `event_date` ascending;
 *    an added or re-dated event has to land in the right place, not at the end.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { create, type StateCreator } from 'zustand';

const getEvents = vi.fn();
const createEvent = vi.fn();
const updateEvent = vi.fn();
const deleteEvent = vi.fn();

vi.mock('../../../src/services/eventsService', () => ({
  eventsService: {
    getEvents: () => getEvents(),
    createEvent: (input: unknown) => createEvent(input),
    updateEvent: (eventId: string, updates: unknown) => updateEvent(eventId, updates),
    deleteEvent: (eventId: string) => deleteEvent(eventId),
  },
}));

import type { CoupleEvent } from '../../../src/services/eventsService';
import { createEventsSlice, type EventsSlice } from '../../../src/stores/slices/eventsSlice';

const USER_ID = 'USER-A-ID';

type TestStore = EventsSlice & { userId: string | null };

function createTestStore() {
  const store = create<TestStore>()(createEventsSlice as unknown as StateCreator<TestStore>);
  store.setState({ userId: USER_ID });
  return store;
}

function event(id: string, isoDate: string, overrides: Partial<CoupleEvent> = {}): CoupleEvent {
  const [year, month, day] = isoDate.split('-').map(Number);
  return {
    id,
    userId: USER_ID,
    label: id,
    date: new Date(year, month - 1, day),
    createdAt: new Date(2026, 0, 1),
    description: null,
    icon: 'calendar',
    ...overrides,
  };
}

describe('eventsSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('starts with an empty list, not loading, and no error', () => {
    const store = createTestStore();
    const state = store.getState();

    expect(state.events).toEqual([]);
    expect(state.eventsIsLoading).toBe(false);
    expect(state.eventsError).toBeNull();
  });

  // ==========================================================================
  // loadEvents
  // ==========================================================================

  describe('loadEvents', () => {
    it('fills the list and releases the flag', async () => {
      const loaded = [event('sooner', '2026-09-12'), event('later', '2026-12-25')];
      getEvents.mockResolvedValue(loaded);
      const store = createTestStore();

      await store.getState().loadEvents();

      expect(store.getState().events).toEqual(loaded);
      expect(store.getState().eventsIsLoading).toBe(false);
      expect(store.getState().eventsError).toBeNull();
    });

    it('raises the flag while the request is open', async () => {
      let settle: (value: CoupleEvent[]) => void = () => {};
      getEvents.mockReturnValue(
        new Promise<CoupleEvent[]>((resolve) => {
          settle = resolve;
        })
      );
      const store = createTestStore();

      const inFlight = store.getState().loadEvents();
      expect(store.getState().eventsIsLoading).toBe(true);

      settle([]);
      await inFlight;
      expect(store.getState().eventsIsLoading).toBe(false);
    });

    it('reports the failure, keeps the last-good list and releases the flag', async () => {
      const message =
        'You are offline. Events need a connection to load.';
      getEvents.mockRejectedValue(new Error(message));
      const store = createTestStore();
      store.setState({ events: [event('stale', '2026-09-12')] });

      await store.getState().loadEvents();

      // Supabase-only means there is no mirror to repopulate from, so a failed
      // refresh must NOT blank a list the user is already looking at.
      expect(store.getState().events).toEqual([event('stale', '2026-09-12')]);
      expect(store.getState().eventsError).toBe(message);
      expect(store.getState().eventsIsLoading).toBe(false);
    });

    it('clears a previous error when it starts', async () => {
      getEvents.mockResolvedValue([]);
      const store = createTestStore();
      store.setState({ eventsError: 'an older failure' });

      await store.getState().loadEvents();

      expect(store.getState().eventsError).toBeNull();
    });

    it('lets the newer of two overlapping same-user loads win, whatever the order', async () => {
      // A mount effect plus a manual refresh can overlap for the SAME user, so
      // the identity guard sees nothing wrong with either. The request token is
      // what keeps the older resolution from clearing the newer load's spinner
      // or overwriting its result with staler data.
      let settleFirst: (value: CoupleEvent[]) => void = () => {};
      let settleSecond: (value: CoupleEvent[]) => void = () => {};
      getEvents
        .mockReturnValueOnce(
          new Promise<CoupleEvent[]>((resolve) => {
            settleFirst = resolve;
          })
        )
        .mockReturnValueOnce(
          new Promise<CoupleEvent[]>((resolve) => {
            settleSecond = resolve;
          })
        );
      const store = createTestStore();

      const first = store.getState().loadEvents();
      const second = store.getState().loadEvents();

      settleFirst([event('stale', '2026-09-12')]);
      await first;

      // The stale resolution changed nothing: the second load still owns both
      // the flag and the list.
      expect(store.getState().eventsIsLoading).toBe(true);
      expect(store.getState().events).toEqual([]);

      settleSecond([event('fresh', '2026-12-25')]);
      await second;

      expect(store.getState().events.map((e) => e.id)).toEqual(['fresh']);
      expect(store.getState().eventsIsLoading).toBe(false);
    });

    it('drops a stale same-user failure instead of parking its error over a live load', async () => {
      // Same overlap, but the older request fails. Its catch must not raise an
      // error banner (or drop the spinner) over a refresh that may yet succeed.
      let rejectFirst: (reason: Error) => void = () => {};
      let settleSecond: (value: CoupleEvent[]) => void = () => {};
      getEvents
        .mockReturnValueOnce(
          new Promise<CoupleEvent[]>((_resolve, reject) => {
            rejectFirst = reject;
          })
        )
        .mockReturnValueOnce(
          new Promise<CoupleEvent[]>((resolve) => {
            settleSecond = resolve;
          })
        );
      const store = createTestStore();

      const first = store.getState().loadEvents();
      const second = store.getState().loadEvents();

      rejectFirst(new Error('the older request failed'));
      await first;

      expect(store.getState().eventsError).toBeNull();
      expect(store.getState().eventsIsLoading).toBe(true);

      settleSecond([]);
      await second;

      expect(store.getState().eventsError).toBeNull();
      expect(store.getState().eventsIsLoading).toBe(false);
    });
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

      await store.getState().addEvent({ label: 'second-of-day', eventDate: '2026-10-31' });

      expect(store.getState().events.map((e) => e.id)).toEqual(['first-of-day', 'second-of-day']);
    });

    it('passes the signed-in user as the creator', async () => {
      const store = createTestStore();
      createEvent.mockResolvedValue(event('new', '2026-10-31'));

      await store.getState().addEvent({ label: 'new', eventDate: '2026-10-31' });

      expect(createEvent).toHaveBeenCalledWith({
        userId: USER_ID,
        label: 'new',
        eventDate: '2026-10-31',
      });
    });

    it('hands the reason back to the caller AND parks it, leaving the list alone', async () => {
      const store = createTestStore();
      const existing = [event('sooner', '2026-09-12')];
      store.setState({ events: existing });
      createEvent.mockRejectedValue(
        new Error('[EventsService.createEvent] Permission denied - check Row Level Security policies')
      );

      const result = await store.getState().addEvent({ label: 'x', eventDate: '2026-10-31' });

      expect(result.success).toBe(false);
      expect(result).toEqual({
        success: false,
        error: '[EventsService.createEvent] Permission denied - check Row Level Security policies',
      });
      expect(store.getState().eventsError).toBe(
        '[EventsService.createEvent] Permission denied - check Row Level Security policies'
      );
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
      createEvent.mockRejectedValue(new Error(OFFLINE_MESSAGE));

      const result = await store.getState().addEvent({ label: 'x', eventDate: '2026-10-31' });

      expect(result).toEqual({ success: false, error: OFFLINE_MESSAGE });
      expect(store.getState().eventsError).toBe(OFFLINE_MESSAGE);
      expect(store.getState().events).toEqual([]);
    });

    it('refuses without a signed-in user and never reaches the service', async () => {
      const store = createTestStore();
      store.setState({ userId: null });

      const result = await store.getState().addEvent({ label: 'x', eventDate: '2026-10-31' });

      expect(result).toEqual({ success: false, error: 'You must be signed in to add an event' });
      expect(store.getState().eventsError).toBe('You must be signed in to add an event');
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

    it('reports a zero-row write as a failure and leaves the list untouched', async () => {
      // RLS filters a non-creator's UPDATE silently — the service turns that
      // into a throw, and the list must not pretend the edit landed.
      const store = createTestStore();
      const existing = [event('partners-event', '2026-09-12')];
      store.setState({ events: existing });
      updateEvent.mockRejectedValue(new Error('Event not found or not yours to edit'));

      const result = await store.getState().editEvent('partners-event', { label: 'mine now' });

      expect(result).toEqual({ success: false, error: 'Event not found or not yours to edit' });
      expect(store.getState().eventsError).toBe('Event not found or not yours to edit');
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

    it('reports a zero-row delete as a failure and keeps the event on screen', async () => {
      const store = createTestStore();
      const existing = [event('partners-event', '2026-09-12')];
      store.setState({ events: existing });
      deleteEvent.mockRejectedValue(new Error('Event not found or not yours to delete'));

      const result = await store.getState().removeEvent('partners-event');

      expect(result).toEqual({ success: false, error: 'Event not found or not yours to delete' });
      expect(store.getState().eventsError).toBe('Event not found or not yours to delete');
      expect(store.getState().events).toEqual(existing);
    });
  });

  // ==========================================================================
  // clearEventsError
  // ==========================================================================

  describe('clearEventsError', () => {
    it('clears a dismissed banner without touching the list', async () => {
      const store = createTestStore();
      const existing = [event('a', '2026-09-12')];
      store.setState({ events: existing, eventsError: 'something failed' });

      store.getState().clearEventsError();

      expect(store.getState().eventsError).toBeNull();
      expect(store.getState().events).toEqual(existing);
    });
  });
});
