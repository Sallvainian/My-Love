/**
 * interactionsSlice — the `interactions` local copy (unified data storage, story 7)
 *
 * `loadInteractionHistory` shows the account's saved poke/kiss list at once,
 * then replaces state and copy with the server's list. A failed read changes
 * nothing; an empty answer saves `[]`. Every confirmed change (incoming row,
 * confirmed send, confirmed mark-as-viewed) rewrites the copy. A result raised
 * for one account or session is never shown or saved under another.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { create, type StateCreator } from 'zustand';

const getInteractionHistory = vi.fn();
const sendPoke = vi.fn();
const sendKiss = vi.fn();
const markAsViewed = vi.fn();

vi.mock('../../../src/api/interactionService', () => ({
  InteractionService: class {
    getInteractionHistory = (userId: string, limit: number) => getInteractionHistory(userId, limit);
    sendPoke = (userId: string) => sendPoke(userId);
    sendKiss = (userId: string) => sendKiss(userId);
    markAsViewed = (id: string) => markAsViewed(id);
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

import type { Interaction, SupabaseInteractionRecord } from '../../../src/api/interactionService';
import { createInteractionRecord } from '../../support/factories/interaction-record-ownership';
import {
  createInteractionsSlice,
  INTERACTIONS_COPY_KIND,
  type InteractionsSlice,
} from '../../../src/stores/slices/interactionsSlice';

const USER_A = 'USER-A-ID';
const PARTNER = 'PARTNER-ID';
const USER_B = 'USER-B-ID';
const OFFLINE_MESSAGE = 'You are offline. A poke needs a connection to send.';

type TestStore = InteractionsSlice & { userId: string | null; authSessionVersion: number };

function createTestStore() {
  const store = create<TestStore>()(
    createInteractionsSlice as unknown as StateCreator<TestStore>
  );
  store.setState({ userId: USER_A, authSessionVersion: 1, interactionPartnerId: PARTNER });
  return store;
}

function interaction(id: string, overrides: Partial<Interaction> = {}): Interaction {
  return {
    id,
    type: 'poke',
    fromUserId: PARTNER,
    toUserId: USER_A,
    viewed: false,
    createdAt: new Date('2026-09-20T12:00:00.000Z'),
    ...overrides,
  };
}

/** The saved form: plain data, exactly what the slice writes. */
function saved(i: Interaction) {
  return {
    id: i.id,
    type: i.type,
    fromUserId: i.fromUserId,
    toUserId: i.toUserId,
    viewed: i.viewed,
    createdAt: i.createdAt.toISOString(),
  };
}

const INCOMING_AT = '2026-09-21T08:00:00.000Z';

/** A server row, by default an unviewed poke from PARTNER to USER_A. */
function record(id: string, overrides: Partial<SupabaseInteractionRecord> = {}) {
  return createInteractionRecord({
    id,
    from_user_id: PARTNER,
    to_user_id: USER_A,
    created_at: INCOMING_AT,
    ...overrides,
  });
}

const key = (userId: string) => `${userId}|${INTERACTIONS_COPY_KIND}`;

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
 * The copy read `loadInteractionHistory` started, as the promise it awaits. The
 * slice registers its own `await` on it first, so a test awaiting it next
 * resumes only after the slice has acted on the saved copy.
 */
const copyReadSettled = (call = 0) => readLocalCopy.mock.results[call].value as Promise<unknown>;

describe('interactionsSlice local copy', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    savedCopies.clear();
    setOnline(true);
    readLocalCopy.mockImplementation(async (userId: string, kind: string) =>
      savedCopies.has(`${userId}|${kind}`) ? savedCopies.get(`${userId}|${kind}`) : null
    );
    writeLocalCopy.mockImplementation(async (userId: string, kind: string, value: unknown) => {
      savedCopies.set(`${userId}|${kind}`, value);
    });
    // Mirrors the real service: offline the read fails.
    getInteractionHistory.mockImplementation(async () => {
      if (!navigator.onLine) throw new Error('Failed to fetch');
      return [];
    });
    sendPoke.mockImplementation(async () => {
      if (!navigator.onLine) throw new Error(OFFLINE_MESSAGE);
      return record('sent-poke', { from_user_id: USER_A, to_user_id: PARTNER });
    });
    sendKiss.mockImplementation(async () =>
      record('sent-kiss', { type: 'kiss', from_user_id: USER_A, to_user_id: PARTNER })
    );
    markAsViewed.mockImplementation(async () => {
      if (!navigator.onLine) throw new Error('offline');
    });
  });

  describe('loadInteractionHistory', () => {
    it('offline with a copy: shows the saved rows and their unviewed badge, keeps the copy', async () => {
      const rows = [
        interaction('in-1'),
        interaction('in-2', { viewed: true }),
        interaction('out-1', { fromUserId: USER_A, toUserId: PARTNER }),
      ];
      savedCopies.set(key(USER_A), rows.map(saved));
      setOnline(false);
      const store = createTestStore();

      await store.getState().loadInteractionHistory();

      expect(store.getState().interactions).toEqual(rows);
      // Received and unviewed only: the outgoing row is never a notification.
      expect(store.getState().unviewedCount).toBe(1);
      expect(writeLocalCopy).not.toHaveBeenCalled();
      expect(savedCopies.get(key(USER_A))).toEqual(rows.map(saved));
    });

    it('offline with no copy: behaves as today (empty list, badge 0)', async () => {
      setOnline(false);
      const store = createTestStore();

      await store.getState().loadInteractionHistory();

      expect(store.getState().interactions).toEqual([]);
      expect(store.getState().unviewedCount).toBe(0);
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });

    it('online: shows the copy first, then the server list replaces and is saved', async () => {
      savedCopies.set(key(USER_A), [saved(interaction('old'))]);
      const server = deferred<Interaction[]>();
      getInteractionHistory.mockReturnValue(server.promise);
      const store = createTestStore();

      const inFlight = store.getState().loadInteractionHistory(100);
      await vi.waitFor(() => expect(store.getState().interactions).toEqual([interaction('old')]));
      expect(store.getState().unviewedCount).toBe(1);

      const fresh = [interaction('new-1'), interaction('new-2'), interaction('old', { viewed: true })];
      server.resolve(fresh);
      await inFlight;

      expect(getInteractionHistory).toHaveBeenCalledWith(USER_A, 100);
      expect(store.getState().interactions).toEqual(fresh);
      expect(store.getState().unviewedCount).toBe(2);
      expect(writeLocalCopy).toHaveBeenCalledWith(USER_A, INTERACTIONS_COPY_KIND, fresh.map(saved));
    });

    it('saves the copy as plain data with createdAt as an ISO string', async () => {
      getInteractionHistory.mockResolvedValue([interaction('a')]);
      const store = createTestStore();

      await store.getState().loadInteractionHistory();

      const copy = savedCopies.get(key(USER_A)) as Array<Record<string, unknown>>;
      expect(copy).toEqual([saved(interaction('a'))]);
      expect(typeof copy[0].createdAt).toBe('string');
    });

    it('a failed server read keeps both the copy and state', async () => {
      const rows = [interaction('kept')];
      savedCopies.set(key(USER_A), rows.map(saved));
      getInteractionHistory.mockRejectedValue(new Error('500'));
      const store = createTestStore();

      await store.getState().loadInteractionHistory();

      expect(store.getState().interactions).toEqual(rows);
      expect(store.getState().unviewedCount).toBe(1);
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });

    it('a failed read after an earlier success leaves the shown list alone', async () => {
      getInteractionHistory.mockResolvedValueOnce([interaction('a')]);
      const store = createTestStore();
      await store.getState().loadInteractionHistory();
      writeLocalCopy.mockClear();

      getInteractionHistory.mockRejectedValueOnce(new Error('network'));
      await store.getState().loadInteractionHistory();

      expect(store.getState().interactions).toEqual([interaction('a')]);
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });

    it('an empty server answer is saved as []', async () => {
      savedCopies.set(key(USER_A), [saved(interaction('gone'))]);
      getInteractionHistory.mockResolvedValue([]);
      const store = createTestStore();

      await store.getState().loadInteractionHistory();

      expect(store.getState().interactions).toEqual([]);
      expect(store.getState().unviewedCount).toBe(0);
      expect(savedCopies.get(key(USER_A))).toEqual([]);
    });

    it('does not read or apply the copy once this session has a server answer', async () => {
      getInteractionHistory.mockResolvedValueOnce([interaction('server')]);
      const store = createTestStore();
      await store.getState().loadInteractionHistory();
      readLocalCopy.mockClear();

      getInteractionHistory.mockReturnValueOnce(new Promise(() => {}));
      void store.getState().loadInteractionHistory();

      // The load ran (the server request goes out synchronously), and the copy
      // read would have been started synchronously beside it.
      expect(getInteractionHistory).toHaveBeenCalledTimes(2);
      expect(readLocalCopy).not.toHaveBeenCalled();
      expect(store.getState().interactions).toEqual([interaction('server')]);
    });

    it('never lays the copy over a list already on screen', async () => {
      savedCopies.set(key(USER_A), [saved(interaction('copy'))]);
      getInteractionHistory.mockReturnValue(new Promise(() => {}));
      const store = createTestStore();
      store.setState({ interactions: [interaction('live')], unviewedCount: 1 });

      void store.getState().loadInteractionHistory();
      expect(readLocalCopy).toHaveBeenCalledWith(USER_A, INTERACTIONS_COPY_KIND);
      await copyReadSettled();

      expect(store.getState().interactions).toEqual([interaction('live')]);
    });

    it('ignores a malformed copy whole, logs it, and still reads the server', async () => {
      savedCopies.set(key(USER_A), [
        saved(interaction('good')),
        { ...saved(interaction('bad')), createdAt: 'not a date' },
      ]);
      const server = deferred<Interaction[]>();
      getInteractionHistory.mockReturnValue(server.promise);
      const store = createTestStore();

      const inFlight = store.getState().loadInteractionHistory();
      await vi.waitFor(() =>
        expect(console.error).toHaveBeenCalledWith(
          '[InteractionsSlice] Ignoring a malformed interactions copy'
        )
      );
      expect(store.getState().interactions).toEqual([]);

      server.resolve([interaction('server')]);
      await inFlight;
      expect(store.getState().interactions).toEqual([interaction('server')]);
      expect(savedCopies.get(key(USER_A))).toEqual([saved(interaction('server'))]);
    });

    it.each([
      ['not an array', { rows: [] }],
      ['an unknown type', [{ ...saved(interaction('x')), type: 'hug' }]],
      ['a non-boolean viewed', [{ ...saved(interaction('x')), viewed: 'no' }]],
      ['a Date createdAt', [{ ...saved(interaction('x')), createdAt: new Date() }]],
    ])('ignores a copy with %s', async (_label, value) => {
      savedCopies.set(key(USER_A), value);
      setOnline(false);
      const store = createTestStore();

      await store.getState().loadInteractionHistory();

      expect(store.getState().interactions).toEqual([]);
      expect(store.getState().unviewedCount).toBe(0);
    });
  });

  describe('stale sessions', () => {
    it('drops a server read that resolves after another account signs in', async () => {
      const server = deferred<Interaction[]>();
      getInteractionHistory.mockReturnValue(server.promise);
      const store = createTestStore();

      const inFlight = store.getState().loadInteractionHistory();
      // Past the (empty) copy read, so the load is waiting on the server read.
      await copyReadSettled();
      store.setState({ userId: USER_B, authSessionVersion: 2, interactions: [], unviewedCount: 0 });
      server.resolve([interaction('a-only')]);
      await inFlight;

      expect(store.getState().interactions).toEqual([]);
      expect(store.getState().unviewedCount).toBe(0);
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });

    it('drops a server read that resolves after a same-account re-login', async () => {
      const server = deferred<Interaction[]>();
      getInteractionHistory.mockReturnValue(server.promise);
      const store = createTestStore();

      const inFlight = store.getState().loadInteractionHistory();
      await copyReadSettled();
      store.setState({ authSessionVersion: 2, interactions: [], unviewedCount: 0 });
      server.resolve([interaction('old-session')]);
      await inFlight;

      expect(store.getState().interactions).toEqual([]);
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });

    it('drops a copy read that resolves after another account signs in', async () => {
      const copyRead = deferred<unknown>();
      readLocalCopy.mockReturnValue(copyRead.promise);
      getInteractionHistory.mockReturnValue(new Promise(() => {}));
      const store = createTestStore();

      const inFlight = store.getState().loadInteractionHistory();
      store.setState({ userId: USER_B, authSessionVersion: 2, interactions: [], unviewedCount: 0 });
      copyRead.resolve([saved(interaction('a-copy'))]);
      await inFlight;

      expect(readLocalCopy).toHaveBeenCalledWith(USER_A, INTERACTIONS_COPY_KIND);
      expect(store.getState().interactions).toEqual([]);
      expect(store.getState().unviewedCount).toBe(0);
    });

    it('drops a copy read that resolves after a same-account re-login', async () => {
      const copyRead = deferred<unknown>();
      readLocalCopy.mockReturnValue(copyRead.promise);
      getInteractionHistory.mockReturnValue(new Promise(() => {}));
      const store = createTestStore();

      const inFlight = store.getState().loadInteractionHistory();
      store.setState({ authSessionVersion: 2 });
      copyRead.resolve([saved(interaction('old-session'))]);
      await inFlight;

      expect(store.getState().interactions).toEqual([]);
    });

    it('drops a confirmed mark-viewed that lands after an account switch', async () => {
      const server = deferred<void>();
      markAsViewed.mockReturnValue(server.promise);
      const store = createTestStore();
      store.setState({ interactions: [interaction('a')], unviewedCount: 1 });

      const inFlight = store.getState().markInteractionViewed('a');
      store.setState({ userId: USER_B, authSessionVersion: 2, interactions: [], unviewedCount: 0 });
      server.resolve();
      await inFlight;

      expect(store.getState().interactions).toEqual([]);
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });

    it('drops a confirmed send that lands after a same-account re-login', async () => {
      const server = deferred<SupabaseInteractionRecord>();
      sendPoke.mockReturnValue(server.promise);
      const store = createTestStore();

      const inFlight = store.getState().sendPoke();
      store.setState({ authSessionVersion: 2 });
      server.resolve(record('late', { from_user_id: USER_A, to_user_id: PARTNER }));

      // The caller still learns the true outcome of its own send.
      await expect(inFlight).resolves.toMatchObject({ id: 'late' });
      expect(store.getState().interactions).toEqual([]);
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });
  });

  describe('refresher', () => {
    it('registers loadInteractionHistory(100) as the kind refresher', async () => {
      const store = createTestStore();
      const [kind, refresh] = registerLocalCopy.mock.calls.at(-1) as [string, () => Promise<void>];
      expect(kind).toBe(INTERACTIONS_COPY_KIND);

      // Reconnect: the partner poked while offline; the refresh brings it in.
      getInteractionHistory.mockResolvedValue([interaction('while-offline')]);
      await refresh();

      expect(getInteractionHistory).toHaveBeenCalledWith(USER_A, 100);
      expect(store.getState().interactions).toEqual([interaction('while-offline')]);
      expect(store.getState().unviewedCount).toBe(1);
      expect(savedCopies.get(key(USER_A))).toEqual([saved(interaction('while-offline'))]);
    });

    it('does nothing when signed out', async () => {
      const store = createTestStore();
      store.setState({ userId: null });
      const [, refresh] = registerLocalCopy.mock.calls.at(-1) as [string, () => Promise<void>];

      await expect(refresh()).resolves.toBeUndefined();
      expect(getInteractionHistory).not.toHaveBeenCalled();
    });
  });

  describe('confirmed changes rewrite the copy', () => {
    it('an incoming Realtime row is added to state, then the whole list is saved', async () => {
      getInteractionHistory.mockResolvedValue([interaction('earlier', { viewed: true })]);
      const store = createTestStore();
      await store.getState().loadInteractionHistory();

      store.getState().addIncomingInteraction(record('rt-1'));

      const expected = [
        interaction('rt-1', { createdAt: new Date(INCOMING_AT) }),
        interaction('earlier', { viewed: true }),
      ];
      await vi.waitFor(() => expect(savedCopies.get(key(USER_A))).toEqual(expected.map(saved)));
      expect(store.getState().interactions).toEqual(expected);
      expect(store.getState().unviewedCount).toBe(1);
    });

    it('a rejected or duplicate incoming row writes nothing', async () => {
      const store = createTestStore();
      store.getState().addIncomingInteraction(record('stranger', { from_user_id: 'SOMEONE-ELSE' }));
      store.setState({ interactions: [interaction('dup')] });
      store.getState().addIncomingInteraction(record('dup'));

      // A copy save starts synchronously inside `addIncomingInteraction`.
      expect(writeLocalCopy).not.toHaveBeenCalled();

      // Positive control: an accepted row does start one.
      store.getState().addIncomingInteraction(record('fresh'));
      expect(writeLocalCopy).toHaveBeenCalledTimes(1);
    });

    it('logs a failed copy write for an incoming row and keeps the row in state', async () => {
      writeLocalCopy.mockRejectedValue(new Error('quota'));
      const store = createTestStore();

      store.getState().addIncomingInteraction(record('rt-1'));

      await vi.waitFor(() =>
        expect(console.error).toHaveBeenCalledWith(
          '[InteractionsSlice] Failed to save the interactions copy:',
          expect.any(Error)
        )
      );
      expect(store.getState().interactions.map((i) => i.id)).toEqual(['rt-1']);
    });

    it.each([
      ['sendPoke', 'sent-poke'],
      ['sendKiss', 'sent-kiss'],
    ] as const)(
      'a confirmed %s is in state and in the copy',
      async (action, sentId) => {
        const store = createTestStore();
        store.setState({ interactions: [interaction('earlier')] });

        await store.getState()[action]();

        expect(store.getState().interactions.map((i) => i.id)).toEqual([sentId, 'earlier']);
        const copy = savedCopies.get(key(USER_A)) as Array<{ id: string }>;
        expect(copy.map((row) => row.id)).toEqual([sentId, 'earlier']);
      }
    );

    it('offline, a poke is refused and neither state nor copy changes', async () => {
      savedCopies.set(key(USER_A), [saved(interaction('earlier'))]);
      setOnline(false);
      const store = createTestStore();
      await store.getState().loadInteractionHistory();

      await expect(store.getState().sendPoke()).rejects.toThrow(OFFLINE_MESSAGE);

      expect(store.getState().interactions).toEqual([interaction('earlier')]);
      expect(writeLocalCopy).not.toHaveBeenCalled();
      expect(savedCopies.get(key(USER_A))).toEqual([saved(interaction('earlier'))]);
    });

    it('a server-confirmed mark-viewed shows viewed: true in state and copy', async () => {
      const store = createTestStore();
      store.setState({ interactions: [interaction('a'), interaction('b')], unviewedCount: 2 });

      await store.getState().markInteractionViewed('a');

      expect(markAsViewed).toHaveBeenCalledWith('a');
      expect(store.getState().interactions[0].viewed).toBe(true);
      expect(store.getState().unviewedCount).toBe(1);
      expect(savedCopies.get(key(USER_A))).toEqual([
        saved(interaction('a', { viewed: true })),
        saved(interaction('b')),
      ]);
    });

    it('recounts the badge from the list when a refresh already marked the row viewed', async () => {
      const server = deferred<void>();
      markAsViewed.mockReturnValue(server.promise);
      const store = createTestStore();
      store.setState({ interactions: [interaction('a'), interaction('b')], unviewedCount: 2 });

      const inFlight = store.getState().markInteractionViewed('a');
      // A refresh lands first and already carries `a` as viewed.
      store.setState({
        interactions: [interaction('a', { viewed: true }), interaction('b')],
        unviewedCount: 1,
      });
      server.resolve();
      await inFlight;

      expect(store.getState().unviewedCount).toBe(1);
    });

    it('offline, mark-viewed changes nothing locally', async () => {
      setOnline(false);
      const store = createTestStore();
      store.setState({ interactions: [interaction('a')], unviewedCount: 1 });

      await expect(store.getState().markInteractionViewed('a')).rejects.toThrow();

      expect(store.getState().interactions[0].viewed).toBe(false);
      expect(store.getState().unviewedCount).toBe(1);
      expect(writeLocalCopy).not.toHaveBeenCalled();
    });

    it('a confirmed change marks the session fresh, so a late copy never replaces it', async () => {
      const copyRead = deferred<unknown>();
      readLocalCopy.mockReturnValueOnce(copyRead.promise);
      getInteractionHistory.mockReturnValue(new Promise(() => {}));
      const store = createTestStore();

      void store.getState().loadInteractionHistory();
      await store.getState().sendPoke();
      store.setState({ interactions: [] });
      copyRead.resolve([saved(interaction('stale-copy'))]);
      await copyRead.promise;

      expect(store.getState().interactions).toEqual([]);
    });
  });
});
