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

import type {
  CoupleEvent,
  EventWriteErrorCode,
} from '../../../src/services/eventsService';
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

function codedWriteError(code: EventWriteErrorCode, message: string): Error {
  return Object.assign(new Error(message), { code });
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
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

      const result = await store.getState().loadEvents();

      expect(result).toEqual({ status: 'success' });
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

      const result = await store.getState().loadEvents();

      // Supabase-only means there is no mirror to repopulate from, so a failed
      // refresh must NOT blank a list the user is already looking at.
      expect(store.getState().events).toEqual([event('stale', '2026-09-12')]);
      expect(store.getState().eventsError).toBe(message);
      expect(store.getState().eventsIsLoading).toBe(false);
      expect(result).toEqual({ status: 'failure', error: message });
    });

    it('clears a previous error when it starts', async () => {
      getEvents.mockResolvedValue([]);
      const store = createTestStore();
      store.setState({ eventsError: 'an older failure' });

      await store.getState().loadEvents();

      expect(store.getState().eventsError).toBeNull();
    });

    it('does nothing without a signed-in user, so no flag can strand', async () => {
      // The null -> signed-in transition never passes through signedOutState()
      // (authSlice resets only on an account switch or a sign-out), so a load
      // captured at null that resolved after sign-in would have left
      // eventsIsLoading stuck true with nothing due to clear it. Bailing
      // before the flag is raised closes the only path into that state.
      const store = createTestStore();
      store.setState({ userId: null });

      const result = await store.getState().loadEvents();

      expect(result).toEqual({ status: 'stale' });
      expect(getEvents).not.toHaveBeenCalled();
      expect(store.getState().eventsIsLoading).toBe(false);
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
      expect(await first).toEqual({ status: 'stale' });

      // The stale resolution changed nothing: the second load still owns both
      // the flag and the list.
      expect(store.getState().eventsIsLoading).toBe(true);
      expect(store.getState().events).toEqual([]);

      settleSecond([event('fresh', '2026-12-25')]);
      expect(await second).toEqual({ status: 'success' });

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
      expect(await first).toEqual({ status: 'stale' });

      expect(store.getState().eventsError).toBeNull();
      expect(store.getState().eventsIsLoading).toBe(true);

      settleSecond([]);
      expect(await second).toEqual({ status: 'success' });

      expect(store.getState().eventsError).toBeNull();
      expect(store.getState().eventsIsLoading).toBe(false);
    });

    it('returns stale and touches no owned state when the account changes', async () => {
      const pendingLoad = deferred<CoupleEvent[]>();
      getEvents.mockReturnValue(pendingLoad.promise);
      const store = createTestStore();
      const inFlight = store.getState().loadEvents();

      const successorEvents = [event('successor', '2026-12-25', { userId: 'USER-B-ID' })];
      store.setState({
        userId: 'USER-B-ID',
        events: successorEvents,
        eventsIsLoading: false,
        eventsError: 'successor owns this',
      });
      pendingLoad.resolve([event('previous-account', '2026-09-12')]);

      expect(await inFlight).toEqual({ status: 'stale' });
      expect(store.getState().events).toEqual(successorEvents);
      expect(store.getState().eventsIsLoading).toBe(false);
      expect(store.getState().eventsError).toBe('successor owns this');
    });

    it("does not replay account A's completed add into account B's active load", async () => {
      const pendingAdd = deferred<CoupleEvent>();
      createEvent.mockReturnValue(pendingAdd.promise);
      const store = createTestStore();

      const accountAAdd = store
        .getState()
        .addEvent({ label: 'account-a', eventDate: '2026-10-31' });

      const pendingAccountBLoad = deferred<CoupleEvent[]>();
      store.setState({
        userId: 'USER-B-ID',
        events: [],
        eventsIsLoading: false,
        eventsError: null,
      });
      getEvents.mockReturnValue(pendingAccountBLoad.promise);
      const accountBLoad = store.getState().loadEvents();

      const accountAEvent = event('account-a', '2026-10-31');
      pendingAdd.resolve(accountAEvent);
      expect(await accountAAdd).toEqual({ success: true });

      const accountBEvent = event('account-b', '2026-12-25', { userId: 'USER-B-ID' });
      pendingAccountBLoad.resolve([accountBEvent]);
      expect(await accountBLoad).toEqual({ status: 'success' });
      expect(store.getState().events).toEqual([accountBEvent]);
    });

    it("does not replay account A's completed edit into account B's active load", async () => {
      const pendingEdit = deferred<CoupleEvent>();
      updateEvent.mockReturnValue(pendingEdit.promise);
      const store = createTestStore();

      const accountAEdit = store.getState().editEvent('account-a-event', {
        label: 'account-a-edited',
      });

      const pendingAccountBLoad = deferred<CoupleEvent[]>();
      store.setState({
        userId: 'USER-B-ID',
        events: [],
        eventsIsLoading: false,
        eventsError: null,
      });
      getEvents.mockReturnValue(pendingAccountBLoad.promise);
      const accountBLoad = store.getState().loadEvents();

      pendingEdit.resolve(
        event('account-a-event', '2026-10-31', {
          label: 'account-a-edited',
        })
      );
      expect(await accountAEdit).toEqual({ success: true });

      const accountBEvent = event('account-b', '2026-12-25', { userId: 'USER-B-ID' });
      pendingAccountBLoad.resolve([accountBEvent]);
      expect(await accountBLoad).toEqual({ status: 'success' });
      expect(store.getState().events).toEqual([accountBEvent]);
    });

    it('keeps a completed add for the newer same-user load after the older load settles stale', async () => {
      const firstLoad = deferred<CoupleEvent[]>();
      const secondLoad = deferred<CoupleEvent[]>();
      getEvents.mockReturnValueOnce(firstLoad.promise).mockReturnValueOnce(secondLoad.promise);
      const added = event('added-after-second-started', '2026-10-31');
      createEvent.mockResolvedValue(added);
      const store = createTestStore();

      const first = store.getState().loadEvents();
      const second = store.getState().loadEvents();
      await store
        .getState()
        .addEvent({ label: 'added-after-second-started', eventDate: '2026-10-31' });

      firstLoad.resolve([event('superseded', '2026-09-12')]);
      expect(await first).toEqual({ status: 'stale' });

      const fetched = event('fetched', '2026-12-25');
      secondLoad.resolve([fetched]);
      expect(await second).toEqual({ status: 'success' });
      expect(store.getState().events).toEqual([added, fetched]);
      expect(store.getState().events.filter((item) => item.id === added.id)).toHaveLength(1);
    });

    it('replays a completed add omitted by the older fetched list', async () => {
      const pendingLoad = deferred<CoupleEvent[]>();
      getEvents.mockReturnValue(pendingLoad.promise);
      const created = event('added', '2026-10-31');
      createEvent.mockResolvedValue(created);
      const store = createTestStore();

      const inFlight = store.getState().loadEvents();
      await store.getState().addEvent({ label: 'added', eventDate: '2026-10-31' });
      pendingLoad.resolve([]);

      expect(await inFlight).toEqual({ status: 'success' });
      expect(store.getState().events).toEqual([created]);
    });

    it('does not duplicate an add already installed by the load before create resumes', async () => {
      const pendingLoad = deferred<CoupleEvent[]>();
      const pendingCreate = deferred<CoupleEvent>();
      getEvents.mockReturnValue(pendingLoad.promise);
      createEvent.mockReturnValue(pendingCreate.promise);
      const created = event('already-observed', '2026-10-31');
      const store = createTestStore();

      const inFlight = store.getState().loadEvents();
      const add = store
        .getState()
        .addEvent({ label: 'already-observed', eventDate: '2026-10-31' });
      pendingLoad.resolve([created]);
      expect(await inFlight).toEqual({ status: 'success' });
      pendingCreate.resolve(created);
      expect(await add).toEqual({ success: true });

      expect(store.getState().events).toEqual([created]);
    });

    it('upserts an edited row omitted by a load that settles before the edit resumes', async () => {
      const pendingLoad = deferred<CoupleEvent[]>();
      const pendingEdit = deferred<CoupleEvent>();
      getEvents.mockReturnValue(pendingLoad.promise);
      updateEvent.mockReturnValue(pendingEdit.promise);
      const oldEdited = event('edited', '2026-12-25');
      const resident = event('resident', '2026-10-31');
      const updated = event('edited', '2026-09-12', { label: 'Restored edit' });
      const store = createTestStore();
      store.setState({ events: [resident, oldEdited] });

      const load = store.getState().loadEvents();
      const edit = store.getState().editEvent('edited', { eventDate: '2026-09-12' });

      pendingLoad.resolve([resident]);
      expect(await load).toEqual({ status: 'success' });
      expect(store.getState().events).toEqual([resident]);

      pendingEdit.resolve(updated);
      expect(await edit).toEqual({ success: true });
      expect(store.getState().events).toEqual([updated, resident]);
    });

    it('replays add then delete in completion order without resurrecting the transient row', async () => {
      const pendingLoad = deferred<CoupleEvent[]>();
      getEvents.mockReturnValue(pendingLoad.promise);
      const transient = event('transient', '2026-10-31');
      createEvent.mockResolvedValue(transient);
      deleteEvent.mockResolvedValue(undefined);
      const store = createTestStore();

      const inFlight = store.getState().loadEvents();
      await store.getState().addEvent({ label: 'transient', eventDate: '2026-10-31' });
      await store.getState().removeEvent('transient');
      // The request captured the row after its add but before its delete. Only
      // ordered replay of the delete tombstone can remove it from this stale
      // response; endpoint-only start/current snapshots both see it absent.
      pendingLoad.resolve([transient]);

      expect(await inFlight).toEqual({ status: 'success' });
      expect(store.getState().events).toEqual([]);
    });

    it('replays an edit over the older row and restores date order', async () => {
      const pendingLoad = deferred<CoupleEvent[]>();
      getEvents.mockReturnValue(pendingLoad.promise);
      const oldEdited = event('edited', '2026-09-12');
      const resident = event('resident', '2026-10-31');
      const updated = event('edited', '2026-12-25', { label: 'Updated' });
      updateEvent.mockResolvedValue(updated);
      const store = createTestStore();
      store.setState({ events: [oldEdited, resident] });

      const inFlight = store.getState().loadEvents();
      await store.getState().editEvent('edited', { eventDate: '2026-12-25' });
      pendingLoad.resolve([oldEdited, resident]);

      expect(await inFlight).toEqual({ status: 'success' });
      expect(store.getState().events).toEqual([resident, updated]);
    });

    it('replays a delete tombstone so an older response cannot resurrect the row', async () => {
      const pendingLoad = deferred<CoupleEvent[]>();
      getEvents.mockReturnValue(pendingLoad.promise);
      deleteEvent.mockResolvedValue(undefined);
      const deleted = event('deleted', '2026-09-12');
      const kept = event('kept', '2026-10-31');
      const store = createTestStore();
      store.setState({ events: [deleted, kept] });

      const inFlight = store.getState().loadEvents();
      await store.getState().removeEvent('deleted');
      pendingLoad.resolve([deleted, kept]);

      expect(await inFlight).toEqual({ status: 'success' });
      expect(store.getState().events).toEqual([kept]);
    });

    it('keeps all write failures out of a successful load outcome and error channel', async () => {
      const pendingLoad = deferred<CoupleEvent[]>();
      getEvents.mockReturnValue(pendingLoad.promise);
      createEvent.mockRejectedValue(codedWriteError('transport', 'add failed'));
      updateEvent.mockRejectedValue(codedWriteError('transport', 'edit failed'));
      deleteEvent.mockRejectedValue(codedWriteError('transport', 'delete failed'));
      const store = createTestStore();

      const inFlight = store.getState().loadEvents();
      expect(
        await store.getState().addEvent({ label: 'x', eventDate: '2026-10-31' })
      ).toMatchObject({ success: false, error: 'add failed' });
      expect(await store.getState().editEvent('x', { label: 'changed' })).toMatchObject({
        success: false,
        error: 'edit failed',
      });
      expect(await store.getState().removeEvent('x')).toMatchObject({
        success: false,
        error: 'delete failed',
      });
      expect(store.getState().eventsError).toBeNull();

      const loaded = [event('loaded', '2026-12-25')];
      pendingLoad.resolve(loaded);
      expect(await inFlight).toEqual({ status: 'success' });
      expect(store.getState().events).toEqual(loaded);
      expect(store.getState().eventsError).toBeNull();
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

    it('hands the reason back without changing the load error, leaving the list alone', async () => {
      const store = createTestStore();
      const existing = [event('sooner', '2026-09-12')];
      store.setState({ events: existing, eventsError: 'the current load failed' });
      createEvent.mockRejectedValue(
        Object.assign(
          new Error(
            '[EventsService.createEvent] Permission denied - check Row Level Security policies'
          ),
          { code: '42501' }
        )
      );

      const result = await store.getState().addEvent({ label: 'x', eventDate: '2026-10-31' });

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

      const result = await store.getState().addEvent({ label: 'x', eventDate: '2026-10-31' });

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

        const result = await store.getState().addEvent({
          label: 'x',
          eventDate: '2026-10-31',
        });

        expect(result).toEqual({ success: false, code, error: 'The returned message' });
        expect(store.getState().events).toEqual(existing);
      }
    );

    it('refuses without a signed-in user and never reaches the service', async () => {
      const store = createTestStore();
      store.setState({ userId: null });

      const result = await store.getState().addEvent({ label: 'x', eventDate: '2026-10-31' });

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

    it('reports a zero-row write as a failure and leaves the list untouched', async () => {
      // RLS filters a non-creator's UPDATE silently — the service turns that
      // into a throw, and the list must not pretend the edit landed.
      const store = createTestStore();
      const existing = [event('partners-event', '2026-09-12')];
      store.setState({ events: existing });
      updateEvent.mockRejectedValue(
        codedWriteError('not-found', 'Event not found or not yours to edit')
      );

      const result = await store.getState().editEvent('partners-event', { label: 'mine now' });

      expect(result).toEqual({
        success: false,
        code: 'not-found',
        error: 'Event not found or not yours to edit',
      });
      expect(store.getState().eventsError).toBeNull();
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

    it('reports a zero-row delete as a failure and keeps the event on screen', async () => {
      const store = createTestStore();
      const existing = [event('partners-event', '2026-09-12')];
      store.setState({ events: existing });
      deleteEvent.mockRejectedValue(
        codedWriteError('not-found', 'Event not found or not yours to delete')
      );

      const result = await store.getState().removeEvent('partners-event');

      expect(result).toEqual({
        success: false,
        code: 'not-found',
        error: 'Event not found or not yours to delete',
      });
      expect(store.getState().eventsError).toBeNull();
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
