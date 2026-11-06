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
 * Here: loadMoreEvents and the Load more depth a refresh keeps. The rest is in
 * `eventsSlice.test.ts` and `eventsSlice.writes.test.ts`.
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
import { createTestStore, deferred, event, pagination } from './eventsSliceFixture';

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
  // loadMoreEvents
  // ==========================================================================

  describe('loadMoreEvents', () => {
    it('merges unique IDs in global date, raw timestamp, and ID order', async () => {
      const store = createTestStore();
      const saved = event('saved', '1900-01-01');
      store.setState({ events: [event('future', '2026-12-01'), saved], eventsPagination: pagination() });
      getEventsPage.mockResolvedValue({
        events: [
          event('z', '2026-08-01', { createdAtRaw: '2026-01-01T00:00:00.000001Z' }),
          event('a', '2026-08-01', { createdAtRaw: '2026-01-01T00:00:00.000002Z' }),
          event('b', '2026-08-01', { createdAtRaw: '2026-01-01T00:00:00.000002Z' }),
          saved,
        ],
        pagination: pagination(false),
      });
      expect(await store.getState().loadMoreEvents()).toEqual({ status: 'success' });
      expect(getEventsPage).toHaveBeenCalledWith(pagination());
      expect(store.getState().events.map((event) => event.id)).toEqual(['saved', 'z', 'a', 'b', 'future']);
      expect(store.getState().eventsPagination).toEqual(pagination(false));
    });

    /** Loads one event and a next-page cursor, then fails the next history page. */
    async function failFirstHistoryPage() {
      const store = createTestStore();
      const initialEvents = [event('current', '2026-09-12')];
      const initialPagination = pagination();
      store.setState({ events: initialEvents, eventsPagination: initialPagination });
      getEventsPage.mockRejectedValueOnce(new Error('history failed'));
      const result = await store.getState().loadMoreEvents();
      return { store, initialEvents, initialPagination, result };
    }

    it('keeps rows and cursors on a failed page and reports it as the history error', async () => {
      const { store, initialEvents, initialPagination, result } = await failFirstHistoryPage();
      expect(result).toEqual({ status: 'failure', error: 'history failed' });
      expect(store.getState().events).toBe(initialEvents);
      expect(store.getState().eventsPagination).toBe(initialPagination);
      expect(store.getState().eventsError).toBeNull();
      expect(store.getState().eventsHistoryError).toBe('history failed');
    });

    it('a failed write does not touch the history error', async () => {
      const { store } = await failFirstHistoryPage();
      createEvent.mockRejectedValue(new Error('write failed'));
      await store.getState().addEvent({ label: 'deep', eventDate: '1900-01-01' });
      expect(store.getState().eventsHistoryError).toBe('history failed');
    });

    it('retries the same page after a failure and clears the history error', async () => {
      const { store, initialPagination } = await failFirstHistoryPage();
      getEventsPage.mockResolvedValueOnce({ events: [event('older', '1900-01-01')], pagination: pagination(false) });
      await store.getState().loadMoreEvents();
      expect(getEventsPage.mock.calls).toEqual([[initialPagination], [initialPagination]]);
      expect(store.getState().eventsHistoryError).toBeNull();
      expect(store.getState().eventsIsLoadingMore).toBe(false);
    });

    it('does nothing without pagination metadata', async () => {
      const store = createTestStore();
      expect(await store.getState().loadMoreEvents()).toEqual({ status: 'stale' });
      expect(getEventsPage).not.toHaveBeenCalled();
    });

    /** Starts a history page that stays in flight until `pending` settles; the page is the last. */
    function startLastPage() {
      const store = createTestStore();
      store.setState({ eventsPagination: pagination() });
      const pending = deferred<EventsPage>();
      getEventsPage.mockReturnValueOnce(pending.promise);
      const inFlight = store.getState().loadMoreEvents();
      const finish = async () => {
        pending.resolve({ events: [], pagination: pagination(false) });
        await inFlight;
      };
      return { store, finish };
    }

    it('refuses a second activation while a page is in flight', async () => {
      const { store, finish } = startLastPage();
      expect(store.getState().eventsIsLoadingMore).toBe(true);
      expect(await store.getState().loadMoreEvents()).toEqual({ status: 'stale' });
      expect(getEventsPage).toHaveBeenCalledTimes(1);
      await finish();
    });

    it('stops without another request once the last page has loaded', async () => {
      const { store, finish } = startLastPage();
      await finish();
      expect(await store.getState().loadMoreEvents()).toEqual({ status: 'success' });
      expect(getEventsPage).toHaveBeenCalledTimes(1);
    });

    const replayOriginal = event('target', '2026-08-01');
    const replaySaved = event('target', '1900-01-01', { label: 'Saved deep date' });

    it.each([
      ['add', (store: ReturnType<typeof createTestStore>) => {
        createEvent.mockResolvedValueOnce(replaySaved);
        return store.getState().addEvent({ label: replaySaved.label, eventDate: '1900-01-01' });
      }, [replaySaved]],
      ['edit', (store: ReturnType<typeof createTestStore>) => {
        updateEvent.mockResolvedValueOnce(replaySaved);
        return store.getState().editEvent(replayOriginal.id, { eventDate: '1900-01-01' });
      }, [replaySaved]],
      ['delete', (store: ReturnType<typeof createTestStore>) => {
        deleteEvent.mockResolvedValueOnce(undefined);
        return store.getState().removeEvent(replayOriginal.id);
      }, []],
    ] as const)('replays a completed %s over the page snapshot without duplicate IDs', async (_kind, perform, expectedEvents) => {
      const store = createTestStore();
      store.setState({ events: [replayOriginal], eventsPagination: pagination() });
      const pending = deferred<EventsPage>();
      getEventsPage.mockReturnValueOnce(pending.promise);
      const inFlight = store.getState().loadMoreEvents();
      expect(await perform(store)).toEqual({ success: true });
      pending.resolve({ events: [replayOriginal, replayOriginal], pagination: pagination(false) });
      expect(await inFlight).toEqual({ status: 'success' });
      expect(store.getState().events).toEqual(expectedEvents);
    });

    it.each(['success', 'failure'] as const)('a refresh supersedes page %s and owns its loading state and metadata', async (outcome) => {
      const store = createTestStore();
      store.setState({ events: [event('last-good', '2026-09-12')], eventsPagination: pagination() });
      const page = deferred<EventsPage>();
      const refresh = deferred<EventsPage>();
      getEventsPage.mockReturnValueOnce(page.promise).mockReturnValueOnce(refresh.promise);
      const oldLoad = store.getState().loadMoreEvents();
      const newLoad = store.getState().loadEvents();
      expect(store.getState().eventsIsLoadingMore).toBe(false);
      expect(await store.getState().loadMoreEvents()).toEqual({ status: 'stale' });
      const loading = store.getState();
      if (outcome === 'success') page.resolve({ events: [], pagination: pagination(false) });
      else page.reject(new Error('old page failed'));
      expect(await oldLoad).toEqual({ status: 'stale' });
      expect(store.getState()).toBe(loading);
      refresh.resolve({ events: [event('nearest', '2026-09-12')], pagination: pagination() });
      expect(await newLoad).toEqual({ status: 'success' });
      expect(store.getState().events.map((event) => event.id)).toEqual(['nearest']);
      expect(getEventsPage.mock.calls[1]).toEqual([undefined, 1]);
    });

    it('preserves a saved deep row during a failed refresh without changing its write result', async () => {
      const store = createTestStore();
      const saved = event('saved', '1900-01-01');
      createEvent.mockResolvedValueOnce(saved);
      const result = await store.getState().addEvent({ label: saved.label, eventDate: '1900-01-01' });
      getEventsPage.mockRejectedValueOnce(new Error('refresh failed'));
      await store.getState().loadEvents();
      expect(result).toEqual({ success: true });
      expect(store.getState().events).toEqual([saved]);
    });

    it('does not indefinitely pin saved rows through a successful refresh', async () => {
      const store = createTestStore();
      createEvent.mockResolvedValueOnce(event('saved', '1900-01-01'));
      await store.getState().addEvent({ label: 'saved', eventDate: '1900-01-01' });
      getEventsPage.mockResolvedValueOnce({ events: [], pagination: pagination() });
      await store.getState().loadEvents();
      expect(store.getState().events).toEqual([]);
      expect(store.getState().eventsPagination?.past.hasMore).toBe(true);
    });

    it.each(['add', 'edit', 'delete'] as const)('does not apply or replay an old-session %s into a new same-user page', async (kind) => {
      const store = createTestStore();
      const pendingMutation = deferred<CoupleEvent>();
      createEvent.mockReturnValueOnce(pendingMutation.promise);
      updateEvent.mockReturnValueOnce(pendingMutation.promise);
      deleteEvent.mockReturnValueOnce(pendingMutation.promise);
      const write = kind === 'add'
        ? store.getState().addEvent({ label: 'target', eventDate: '1900-01-01' })
        : kind === 'edit' ? store.getState().editEvent('target', {}) : store.getState().removeEvent('target');
      store.setState({ authSessionVersion: 2, events: [], eventsPagination: pagination() });
      const pendingPage = deferred<EventsPage>();
      getEventsPage.mockReturnValueOnce(pendingPage.promise);
      const page = store.getState().loadMoreEvents();
      pendingMutation.resolve(event('target', '1900-01-01'));
      expect(await write).toEqual({ success: true });
      expect(store.getState().events).toEqual([]);
      const current = event('target', '2026-09-12', { label: 'Current session value' });
      pendingPage.resolve({ events: [current], pagination: pagination(false) });
      await page;
      expect(store.getState().events).toEqual([current]);
    });
  });

  // ==========================================================================
  // A refresh keeps the Load more depth
  // ==========================================================================

  describe('refresh depth', () => {
    /** Every read answers an empty page that has more, with a fresh pagination object. */
    function answerWithMore() {
      getEventsPage.mockReset().mockImplementation(async () => ({
        events: [],
        pagination: pagination(),
      }));
    }

    it('reads as many pages per side as one refresh and two Load more reached, and continues from its cursor', async () => {
      answerWithMore();
      const store = createTestStore();
      await store.getState().loadEvents();
      await store.getState().loadMoreEvents();
      await store.getState().loadMoreEvents();
      expect(getEventsPage.mock.calls.map((call) => call[1])).toEqual([1, undefined, undefined]);

      expect(await store.getState().loadEvents()).toEqual({ status: 'success' });
      expect(getEventsPage).toHaveBeenLastCalledWith(undefined, 3);

      // The refresh's own cursors are what the next Load more continues from.
      const refreshed = store.getState().eventsPagination;
      await store.getState().loadMoreEvents();
      expect(getEventsPage).toHaveBeenLastCalledWith(refreshed);

      // ...and the depth went on growing: the refresh after that asks for four.
      await store.getState().loadEvents();
      expect(getEventsPage).toHaveBeenLastCalledWith(undefined, 4);
    });

    it('replaces the list with the server\'s rows at that depth', async () => {
      answerWithMore();
      const store = createTestStore();
      await store.getState().loadEvents();
      await store.getState().loadMoreEvents();
      const serverRows = [event('a', '2026-08-01'), event('b', '2026-08-02'), event('c', '2026-09-13')];
      getEventsPage.mockResolvedValueOnce({ events: serverRows, pagination: pagination() });
      await store.getState().loadEvents();
      expect(getEventsPage).toHaveBeenLastCalledWith(undefined, 2);
      expect(store.getState().events).toEqual(serverRows);
    });

    it('asks for one page with no traversal, on a fresh start and after sign-out nulls it', async () => {
      answerWithMore();
      const store = createTestStore();
      await store.getState().loadEvents();
      expect(getEventsPage).toHaveBeenLastCalledWith(undefined, 1);
      await store.getState().loadMoreEvents();
      // What signedOutState() does to the pagination.
      store.setState({ eventsPagination: null, events: [] });
      await store.getState().loadEvents();
      expect(getEventsPage).toHaveBeenLastCalledWith(undefined, 1);
    });

    it('asks for one page when a new pagination was set against the counted one', async () => {
      answerWithMore();
      const store = createTestStore();
      await store.getState().loadEvents();
      await store.getState().loadMoreEvents();
      store.setState({ eventsPagination: pagination() });
      await store.getState().loadEvents();
      expect(getEventsPage).toHaveBeenLastCalledWith(undefined, 1);
    });

    it('keeps rows, cursors and the depth when a refresh at depth fails', async () => {
      answerWithMore();
      const store = createTestStore();
      await store.getState().loadEvents();
      await store.getState().loadMoreEvents();
      await store.getState().loadMoreEvents();
      const rows = [event('kept', '2026-08-01')];
      store.setState({ events: rows });
      const cursors = store.getState().eventsPagination;

      getEventsPage.mockRejectedValueOnce(new Error('refresh failed'));
      expect(await store.getState().loadEvents()).toEqual({ status: 'failure', error: 'refresh failed' });
      expect(getEventsPage).toHaveBeenLastCalledWith(undefined, 3);
      expect(store.getState().events).toBe(rows);
      expect(store.getState().eventsPagination).toBe(cursors);
      expect(store.getState().eventsError).toBe('refresh failed');

      // The retry reads the same depth.
      await store.getState().loadEvents();
      expect(getEventsPage).toHaveBeenLastCalledWith(undefined, 3);
    });

    it('does not count a Load more that failed', async () => {
      answerWithMore();
      const store = createTestStore();
      await store.getState().loadEvents();
      getEventsPage.mockRejectedValueOnce(new Error('page failed'));
      await store.getState().loadMoreEvents();
      await store.getState().loadEvents();
      expect(getEventsPage).toHaveBeenLastCalledWith(undefined, 1);
    });

    it('does not count a refresh that a newer load superseded', async () => {
      answerWithMore();
      const store = createTestStore();
      await store.getState().loadEvents();
      await store.getState().loadMoreEvents();
      const old = deferred<EventsPage>();
      getEventsPage.mockReturnValueOnce(old.promise);
      const superseded = store.getState().loadEvents();
      getEventsPage.mockRejectedValueOnce(new Error('newer failed'));
      await store.getState().loadEvents();
      old.resolve({ events: [], pagination: pagination() });
      expect(await superseded).toEqual({ status: 'stale' });
      // The stale answer's cursors were never committed, so the depth still
      // belongs to the pagination on screen.
      await store.getState().loadEvents();
      expect(getEventsPage).toHaveBeenLastCalledWith(undefined, 2);
    });
  });
});
