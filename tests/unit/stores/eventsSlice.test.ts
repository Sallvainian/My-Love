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
 * Here: the initial state, loadEvent, loadEvents and clearEventsError. Paging
 * is in `eventsSlice.paging.test.ts`, the writes in `eventsSlice.writes.test.ts`.
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

import type { CoupleEvent, EventsPage } from '../../../src/services/eventsService';
import {
  USER_ID,
  createTestStore,
  event,
  eventInput,
  pagination,
  codedWriteError,
  deferred,
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

  it('starts with an empty list, not loading, and no error', () => {
    const store = createTestStore();
    const state = store.getState();

    expect(state.events).toEqual([]);
    expect(state.eventsIsLoading).toBe(false);
    expect(state.eventsError).toBeNull();
  });

  // ==========================================================================
  // loadEvent
  // ==========================================================================

  describe('loadEvent', () => {
    it('adds a found event in date order, saves the copy, and leaves the load state alone', async () => {
      const store = createTestStore();
      const existing = event('later', '2026-12-25');
      const deep = event('deep', '2024-01-01');
      store.setState({ events: [existing] });
      getEvent.mockResolvedValueOnce(deep);

      expect(await store.getState().loadEvent('deep')).toEqual({ status: 'success' });
      expect(getEvent).toHaveBeenCalledWith('deep');
      expect(store.getState().events).toEqual([deep, existing]);
      expect(store.getState().eventsError).toBeNull();
      expect(store.getState().eventsIsLoading).toBe(false);
      expect(savedCopies.get(`${USER_ID}|events`)).toHaveLength(2);
    });

    it('answers success with no request when the list already holds the event', async () => {
      const store = createTestStore();
      const rows = [event('same', '2026-09-12')];
      store.setState({ events: rows });
      expect(await store.getState().loadEvent('same')).toEqual({ status: 'success' });
      expect(getEvent).not.toHaveBeenCalled();
      expect(store.getState().events).toBe(rows);
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });

    it('holds one copy when a load lists the row it found during the read', async () => {
      const store = createTestStore();
      const pending = deferred<CoupleEvent | null>();
      getEvent.mockReturnValueOnce(pending.promise);
      const read = store.getState().loadEvent('same');
      store.setState({ events: [event('same', '2026-09-12')] });
      const fresh = event('same', '2026-09-12', { label: 'Renamed elsewhere' });
      pending.resolve(fresh);
      expect(await read).toEqual({ status: 'success' });
      expect(store.getState().events).toEqual([fresh]);
    });

    it('answers success and changes nothing when there is no such event', async () => {
      const store = createTestStore();
      const rows = [event('a', '2026-09-12')];
      store.setState({ events: rows });
      getEvent.mockResolvedValueOnce(null);
      expect(await store.getState().loadEvent('gone')).toEqual({ status: 'success' });
      expect(store.getState().events).toBe(rows);
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });

    it('returns a failure without touching eventsError, the list or the copy', async () => {
      const store = createTestStore();
      const rows = [event('a', '2026-09-12')];
      store.setState({ events: rows });
      getEvent.mockRejectedValueOnce(new Error('read failed'));
      expect(await store.getState().loadEvent('x')).toEqual({ status: 'failure', error: 'read failed' });
      expect(store.getState().events).toBe(rows);
      expect(store.getState().eventsError).toBeNull();
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });

    it('does nothing without a signed-in user', async () => {
      const store = createTestStore();
      store.setState({ userId: null });
      expect(await store.getState().loadEvent('x')).toEqual({ status: 'stale' });
      expect(getEvent).not.toHaveBeenCalled();
    });

    it.each([
      ['sign-out', { userId: null }],
      ['a same-account sign-in', { authSessionVersion: 2 }],
      ['another account', { userId: 'USER-B-ID', authSessionVersion: 2 }],
    ] as const)('writes nothing when %s happens during the read', async (_name, change) => {
      const store = createTestStore();
      const pending = deferred<CoupleEvent | null>();
      getEvent.mockReturnValueOnce(pending.promise);
      const read = store.getState().loadEvent('deep');
      store.setState(change);
      pending.resolve(event('deep', '2024-01-01'));
      expect(await read).toEqual({ status: 'stale' });
      expect(store.getState().events).toEqual([]);
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });

    it('reports a stale result, not a failure, when the account changed during a failed read', async () => {
      const store = createTestStore();
      const pending = deferred<CoupleEvent | null>();
      getEvent.mockReturnValueOnce(pending.promise);
      const read = store.getState().loadEvent('deep');
      store.setState({ authSessionVersion: 2 });
      pending.reject(new Error('read failed'));
      expect(await read).toEqual({ status: 'stale' });
    });

    it('is replayed by a load already in flight, so the open page keeps its event', async () => {
      const store = createTestStore();
      const pending = deferred<EventsPage>();
      getEventsPage.mockReturnValueOnce(pending.promise);
      const load = store.getState().loadEvents();
      const deep = event('deep', '2024-01-01');
      getEvent.mockResolvedValueOnce(deep);
      await store.getState().loadEvent('deep');
      pending.resolve({ events: [event('near', '2026-09-12')], pagination: pagination() });
      expect(await load).toEqual({ status: 'success' });
      expect(store.getState().events.map((e) => e.id)).toEqual(['deep', 'near']);
    });
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

      // A failed refresh must NOT blank a list the user is already looking at
      // (online here; offline with a saved copy is eventsSlice.localCopy.test).
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

      const accountAAdd = store.getState().addEvent(eventInput('account-a'));

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
      await store.getState().addEvent(eventInput('added-after-second-started'));

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
      await store.getState().addEvent(eventInput('added'));
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
      const add = store.getState().addEvent(eventInput('already-observed'));
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
      await store.getState().addEvent(eventInput('transient'));
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
      expect(await store.getState().addEvent(eventInput())).toMatchObject({
        success: false,
        error: 'add failed',
      });
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
