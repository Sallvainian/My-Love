/**
 * eventsSlice — the `events` local copy (unified data storage, story 5)
 *
 * `loadEvents` shows the account's saved copy at once, then replaces state and
 * copy with the server's first page when online. Offline with a copy it
 * succeeds without an error; offline with nothing it fails as before. Every
 * successful load and confirmed write saves the shown list. A result raised for
 * one account is never shown or saved under another.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { create, type StateCreator } from 'zustand';

const getEventsPage = vi.fn();
const createEvent = vi.fn();
const updateEvent = vi.fn();
const deleteEvent = vi.fn();

vi.mock('../../../src/services/eventsService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/services/eventsService')>()),
  eventsService: {
    getEventsPage: (pagination: unknown) => getEventsPage(pagination),
    createEvent: (input: unknown) => createEvent(input),
    updateEvent: (eventId: string, updates: unknown) => updateEvent(eventId, updates),
    deleteEvent: (eventId: string) => deleteEvent(eventId),
  },
}));

const savedCopies = new Map<string, unknown>();
const readLocalCopy = vi.fn();
const writeLocalCopy = vi.fn();
const registerLocalCopy = vi.fn();

vi.mock('../../../src/services/localCopy', () => ({
  readLocalCopy: (userId: string, kind: string) => readLocalCopy(userId, kind),
  writeLocalCopy: (userId: string, kind: string, value: unknown) =>
    writeLocalCopy(userId, kind, value),
  registerLocalCopy: (kind: string, refresh: () => Promise<void>) =>
    registerLocalCopy(kind, refresh),
}));

import type { CoupleEvent, EventsPagination } from '../../../src/services/eventsService';
import {
  createEventsSlice,
  EVENTS_COPY_KIND,
  type EventsSlice,
} from '../../../src/stores/slices/eventsSlice';

const USER_A = 'USER-A-ID';
const USER_B = 'USER-B-ID';
const OFFLINE_MESSAGE = 'You are offline. Events need a connection to load.';

type TestStore = EventsSlice & {
  userId: string | null;
  authSessionVersion: number;
  currentView?: string;
};

function createTestStore() {
  const store = create<TestStore>()(createEventsSlice as unknown as StateCreator<TestStore>);
  store.setState({ userId: USER_A, authSessionVersion: 1 });
  return store;
}

function event(id: string, isoDate: string, overrides: Partial<CoupleEvent> = {}): CoupleEvent {
  const [year, month, day] = isoDate.split('-').map(Number);
  return {
    id,
    userId: USER_A,
    label: id,
    date: new Date(year, month - 1, day),
    createdAt: new Date('2026-01-01T00:00:00.123Z'),
    createdAtRaw: '2026-01-01T00:00:00.123456+00:00',
    description: null,
    icon: 'calendar',
    ...overrides,
  };
}

/** The saved form: plain strings, exactly what the slice writes. */
function saved(e: CoupleEvent) {
  const [y, m, d] = [e.date.getFullYear(), e.date.getMonth() + 1, e.date.getDate()];
  const row: Record<string, unknown> = {
    id: e.id,
    userId: e.userId,
    label: e.label,
    date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    createdAt: e.createdAt.toISOString(),
    description: e.description,
    icon: e.icon,
  };
  if (e.createdAtRaw !== undefined) row.createdAtRaw = e.createdAtRaw;
  return row;
}

const key = (userId: string) => `${userId}|${EVENTS_COPY_KIND}`;

function pagination(): EventsPagination {
  return {
    todayISO: '2026-09-23',
    upcoming: { cursor: null, hasMore: false },
    past: { cursor: null, hasMore: false },
  };
}

function page(events: CoupleEvent[]) {
  return { events, pagination: pagination() };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

/**
 * The copy read `loadEvents` started, as the promise it awaits. The slice
 * registers its own `await` on it first, so a test awaiting it next resumes
 * only after the slice has acted on the saved copy.
 */
const copyReadSettled = (call = 0) => readLocalCopy.mock.results[call].value as Promise<unknown>;

describe('eventsSlice local copy', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    savedCopies.clear();
    setOnline(true);
    readLocalCopy.mockImplementation(async (userId: string, kind: string) =>
      savedCopies.has(`${userId}|${kind}`) ? savedCopies.get(`${userId}|${kind}`) : null
    );
    writeLocalCopy.mockImplementation(async (userId: string, kind: string, value: unknown) => {
      savedCopies.set(`${userId}|${kind}`, value);
    });
    // Mirrors the real service: offline it rejects before any request.
    getEventsPage.mockImplementation(async () => {
      if (!navigator.onLine) throw new Error(OFFLINE_MESSAGE);
      return page([]);
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    setOnline(true);
  });

  it('registers a refresher that loads events outside Home and Settings', async () => {
    const store = createTestStore();
    store.setState({ currentView: 'mood' });
    const call = registerLocalCopy.mock.calls.find(([kind]) => kind === EVENTS_COPY_KIND);
    expect(call).toBeDefined();
    getEventsPage.mockResolvedValue(page([event('e1', '2026-10-01')]));

    await call![1]();

    expect(getEventsPage).toHaveBeenCalledTimes(1);
    expect(store.getState().events.map((e) => e.id)).toEqual(['e1']);
  });

  it.each(['home', 'settings'])(
    'the refresher skips the load on %s, which loads on its own',
    async (view) => {
      const store = createTestStore();
      store.setState({ currentView: view });
      const call = registerLocalCopy.mock.calls.find(([kind]) => kind === EVENTS_COPY_KIND);

      await call![1]();

      expect(getEventsPage).not.toHaveBeenCalled();
      expect(readLocalCopy).not.toHaveBeenCalled();
      expect(store.getState().events).toEqual([]);
    }
  );

  describe('offline', () => {
    it('with a copy: lists the saved events, succeeds, and raises no error', async () => {
      const a = event('a', '2026-10-01');
      const b = event('b', '2026-09-01', { description: 'note', icon: 'plane' });
      savedCopies.set(key(USER_A), [saved(b), saved(a)]);
      setOnline(false);
      const store = createTestStore();

      const result = await store.getState().loadEvents();

      expect(result).toEqual({ status: 'success' });
      expect(store.getState().events).toEqual([b, a]);
      expect(store.getState().eventsError).toBeNull();
      expect(store.getState().eventsIsLoading).toBe(false);
      expect(store.getState().eventsPagination).toBeNull();
    });

    it('reads the saved date back as a local calendar date', async () => {
      savedCopies.set(key(USER_A), [saved(event('a', '2026-10-01'))]);
      setOnline(false);
      const store = createTestStore();

      await store.getState().loadEvents();

      const [shown] = store.getState().events;
      expect([shown.date.getFullYear(), shown.date.getMonth(), shown.date.getDate()]).toEqual([
        2026, 9, 1,
      ]);
      expect(shown.createdAtRaw).toBe('2026-01-01T00:00:00.123456+00:00');
    });

    it('with a saved empty list: shows nothing and succeeds', async () => {
      savedCopies.set(key(USER_A), []);
      setOnline(false);
      const store = createTestStore();

      expect(await store.getState().loadEvents()).toEqual({ status: 'success' });
      expect(store.getState().events).toEqual([]);
      expect(store.getState().eventsError).toBeNull();
    });

    it('without a copy: fails as before', async () => {
      setOnline(false);
      const store = createTestStore();

      const result = await store.getState().loadEvents();

      expect(result).toEqual({ status: 'failure', error: OFFLINE_MESSAGE });
      expect(store.getState().eventsError).toBe(OFFLINE_MESSAGE);
      expect(store.getState().events).toEqual([]);
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });

    it('ignores a copy that fails its shape check', async () => {
      savedCopies.set(key(USER_A), [saved(event('a', '2026-10-01')), { id: 'broken' }]);
      setOnline(false);
      const store = createTestStore();

      const result = await store.getState().loadEvents();

      expect(result).toEqual({ status: 'failure', error: OFFLINE_MESSAGE });
      expect(store.getState().events).toEqual([]);
    });

    it('ignores a copy with an impossible date', async () => {
      savedCopies.set(key(USER_A), [{ ...saved(event('a', '2026-10-01')), date: '2026-02-30' }]);
      setOnline(false);
      const store = createTestStore();

      expect((await store.getState().loadEvents()).status).toBe('failure');
      expect(store.getState().events).toEqual([]);
    });

    it("keeps this session's server list without an error after going offline", async () => {
      const store = createTestStore();
      getEventsPage.mockResolvedValueOnce(page([event('a', '2026-10-01')]));
      await store.getState().loadEvents();
      setOnline(false);
      readLocalCopy.mockClear();

      const result = await store.getState().loadEvents();

      expect(result).toEqual({ status: 'success' });
      expect(store.getState().events.map((e) => e.id)).toEqual(['a']);
      expect(store.getState().eventsError).toBeNull();
      // Fresh in this session: the copy is not re-read over newer state.
      expect(readLocalCopy).not.toHaveBeenCalled();
    });

    it('load more after the copy is shown asks nothing and keeps the list', async () => {
      savedCopies.set(key(USER_A), [saved(event('a', '2026-10-01'))]);
      setOnline(false);
      const store = createTestStore();
      await store.getState().loadEvents();
      getEventsPage.mockClear();

      const result = await store.getState().loadMoreEvents();

      // No cursors are saved, so there is nothing to continue from.
      expect(result).toEqual({ status: 'stale' });
      expect(getEventsPage).not.toHaveBeenCalled();
      expect(store.getState().events.map((e) => e.id)).toEqual(['a']);
      expect(store.getState().eventsHistoryError).toBeNull();
    });
  });

  describe('online', () => {
    it('shows the copy first, then replaces state and copy with the server page', async () => {
      const old = event('old', '2026-10-01');
      const fresh = event('fresh', '2026-11-01');
      savedCopies.set(key(USER_A), [saved(old)]);
      const server = deferred<ReturnType<typeof page>>();
      getEventsPage.mockReturnValue(server.promise);
      const store = createTestStore();

      const load = store.getState().loadEvents();
      await vi.waitFor(() => expect(store.getState().events).toEqual([old]));
      expect(store.getState().eventsIsLoading).toBe(true);

      server.resolve(page([fresh]));
      expect(await load).toEqual({ status: 'success' });

      expect(store.getState().events).toEqual([fresh]);
      expect(savedCopies.get(key(USER_A))).toEqual([saved(fresh)]);
    });

    it('saves an empty list when the server says there are none', async () => {
      savedCopies.set(key(USER_A), [saved(event('gone', '2026-10-01'))]);
      getEventsPage.mockResolvedValue(page([]));
      const store = createTestStore();

      await store.getState().loadEvents();

      expect(store.getState().events).toEqual([]);
      expect(savedCopies.get(key(USER_A))).toEqual([]);
    });

    it('keeps the copy shown and saved when the server read fails', async () => {
      const old = event('old', '2026-10-01');
      savedCopies.set(key(USER_A), [saved(old)]);
      getEventsPage.mockRejectedValue(new Error('boom'));
      const store = createTestStore();

      const result = await store.getState().loadEvents();

      expect(result).toEqual({ status: 'failure', error: 'boom' });
      expect(store.getState().events).toEqual([old]);
      expect(savedCopies.get(key(USER_A))).toEqual([saved(old)]);
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });

    it('never lays the copy over a list already on screen', async () => {
      savedCopies.set(key(USER_A), [saved(event('old', '2026-10-01'))]);
      const server = deferred<ReturnType<typeof page>>();
      getEventsPage.mockReturnValue(server.promise);
      const store = createTestStore();
      const shown = [event('shown', '2026-12-01')];
      store.setState({ events: shown });

      const load = store.getState().loadEvents();
      expect(readLocalCopy).toHaveBeenCalledWith(USER_A, EVENTS_COPY_KIND);
      await copyReadSettled();
      expect(store.getState().events).toEqual(shown);

      server.resolve(page([]));
      await load;
    });

    it('saves the copy with the rows "load more" appended', async () => {
      const store = createTestStore();
      getEventsPage.mockResolvedValueOnce({
        events: [event('a', '2026-10-01')],
        pagination: {
          ...pagination(),
          past: { cursor: { event_date: '2026-01-01', created_at: 'x', id: 'y' }, hasMore: true },
        },
      });
      await store.getState().loadEvents();
      getEventsPage.mockResolvedValueOnce(page([event('older', '2025-01-01')]));

      await store.getState().loadMoreEvents();

      expect(savedCopies.get(key(USER_A))).toEqual([
        saved(event('older', '2025-01-01')),
        saved(event('a', '2026-10-01')),
      ]);
    });
  });

  describe('confirmed writes', () => {
    it('add, edit and delete each save the new list', async () => {
      const store = createTestStore();
      const a = event('a', '2026-10-01');
      createEvent.mockResolvedValue(a);

      await store.getState().addEvent({ label: 'a', eventDate: '2026-10-01', icon: 'calendar' });
      expect(savedCopies.get(key(USER_A))).toEqual([saved(a)]);

      const edited = { ...a, label: 'renamed' };
      updateEvent.mockResolvedValue(edited);
      await store.getState().editEvent('a', { label: 'renamed' });
      expect(savedCopies.get(key(USER_A))).toEqual([saved(edited)]);

      deleteEvent.mockResolvedValue(undefined);
      await store.getState().removeEvent('a');
      expect(savedCopies.get(key(USER_A))).toEqual([]);
    });

    it('a failed copy save leaves the write result unchanged', async () => {
      const store = createTestStore();
      createEvent.mockResolvedValue(event('a', '2026-10-01'));
      writeLocalCopy.mockRejectedValue(new Error('quota'));

      const result = await store
        .getState()
        .addEvent({ label: 'a', eventDate: '2026-10-01', icon: 'calendar' });

      expect(result).toEqual({ success: true });
      expect(store.getState().events.map((e) => e.id)).toEqual(['a']);
    });

    it('a write confirmed during a load survives both the copy and the server page', async () => {
      const old = event('old', '2026-10-01');
      savedCopies.set(key(USER_A), [saved(old)]);
      const copyRead = deferred<unknown>();
      readLocalCopy.mockReturnValueOnce(copyRead.promise);
      const server = deferred<ReturnType<typeof page>>();
      getEventsPage.mockReturnValue(server.promise);
      const store = createTestStore();

      const load = store.getState().loadEvents();
      const added = event('added', '2026-11-01');
      createEvent.mockResolvedValue(added);
      await store.getState().addEvent({ label: 'added', eventDate: '2026-11-01', icon: 'calendar' });

      // The copy read lands after the confirmed write: the copy is older.
      copyRead.resolve([saved(old)]);
      await copyRead.promise;
      expect(store.getState().events).toEqual([added]);

      // The server page predates the write; the write is replayed over it.
      server.resolve(page([old]));
      await load;
      expect(store.getState().events).toEqual([old, added]);
      expect(savedCopies.get(key(USER_A))).toEqual([saved(old), saved(added)]);
    });

    it('a delete of the last event during a load is not undone by the copy', async () => {
      const a = event('a', '2026-10-01');
      const store = createTestStore();
      store.setState({ events: [a] });
      savedCopies.set(key(USER_A), [saved(a)]);
      const copyRead = deferred<unknown>();
      readLocalCopy.mockReturnValueOnce(copyRead.promise);
      const server = deferred<ReturnType<typeof page>>();
      getEventsPage.mockReturnValue(server.promise);

      const load = store.getState().loadEvents();
      deleteEvent.mockResolvedValue(undefined);
      await store.getState().removeEvent('a');
      copyRead.resolve([saved(a)]);
      await copyRead.promise;

      expect(store.getState().events).toEqual([]);
      server.resolve(page([a]));
      await load;
      expect(store.getState().events).toEqual([]);
      expect(savedCopies.get(key(USER_A))).toEqual([]);
    });
  });

  describe('account switch', () => {
    it("drops A's copy read that resolves after B signs in", async () => {
      savedCopies.set(key(USER_A), [saved(event('a-private', '2026-10-01'))]);
      const copyRead = deferred<unknown>();
      readLocalCopy.mockReturnValueOnce(copyRead.promise);
      const server = deferred<ReturnType<typeof page>>();
      getEventsPage.mockReturnValue(server.promise);
      const store = createTestStore();

      const load = store.getState().loadEvents();
      store.setState({ userId: USER_B, authSessionVersion: 2, events: [] });
      copyRead.resolve(savedCopies.get(key(USER_A)));

      expect(await load).toEqual({ status: 'stale' });
      expect(store.getState().events).toEqual([]);
      server.resolve(page([event('a-private', '2026-10-01')]));
      await server.promise;
      expect(store.getState().events).toEqual([]);
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });

    it("never saves A's server page, for A or for B, once B has signed in", async () => {
      const server = deferred<ReturnType<typeof page>>();
      getEventsPage.mockReturnValue(server.promise);
      const store = createTestStore();

      const load = store.getState().loadEvents();
      // Past the (empty) copy read, so the load is waiting on the server page.
      await copyReadSettled();
      store.setState({ userId: USER_B, authSessionVersion: 2, events: [] });
      server.resolve(page([event('a-private', '2026-10-01')]));

      expect(await load).toEqual({ status: 'stale' });
      expect(store.getState().events).toEqual([]);
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });

    it("never saves A's confirmed write once B has signed in", async () => {
      const created = deferred<CoupleEvent>();
      createEvent.mockReturnValue(created.promise);
      const store = createTestStore();

      const write = store
        .getState()
        .addEvent({ label: 'a', eventDate: '2026-10-01', icon: 'calendar' });
      store.setState({ userId: USER_B, authSessionVersion: 2, events: [] });
      created.resolve(event('a', '2026-10-01'));

      expect(await write).toEqual({ success: true });
      expect(store.getState().events).toEqual([]);
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });

    it("a same-account re-login does not revive the old session's copy read", async () => {
      savedCopies.set(key(USER_A), [saved(event('a', '2026-10-01'))]);
      const copyRead = deferred<unknown>();
      readLocalCopy.mockReturnValueOnce(copyRead.promise);
      getEventsPage.mockReturnValue(new Promise(() => {}));
      const store = createTestStore();

      const load = store.getState().loadEvents();
      store.setState({ authSessionVersion: 2, events: [] });
      copyRead.resolve(savedCopies.get(key(USER_A)));

      expect(await load).toEqual({ status: 'stale' });
      expect(store.getState().events).toEqual([]);
    });
  });
});
