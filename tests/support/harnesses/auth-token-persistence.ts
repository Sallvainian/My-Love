import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { openDB, unwrap } from 'idb';
import { signIn, signOut } from '../../../src/api/auth/actionService';
import { onAuthStateChange } from '../../../src/api/auth/sessionService';
import { supabase } from '../../../src/api/supabaseClient';
import {
  DB_NAME,
  DB_VERSION,
  STORE_NAMES,
  upgradeDb,
  type MyLoveDBSchema,
  type StoredAuthToken,
} from '../../../src/services/dbSchema';
import { getAuthToken } from '../../../src/sw-db';
import { createAuthBootstrapSession } from '../factories/auth-bootstrap-notification-order';

export type PersistenceScenario =
  | 'sequential'
  | 'local-actions'
  | 'stale-clear'
  | 'stale-overwrite'
  | 'stale-resurrection'
  | 'same-owner-refresh';
type TokenLabel = { owner: 'A' | 'B'; version: 'v1' | 'v2' };
type Origin = {
  actor: string;
  source: 'listener' | 'action' | 'read' | 'blocker';
  method: 'put' | 'delete' | 'get' | 'hold';
  token: TokenLabel | null;
  event?: AuthChangeEvent;
};
export type PersistenceTraceEntry = Origin & {
  sequence: number;
  phase: string;
  operation?: number;
  transaction?: number;
};
export type PersistenceEvidence = {
  scenario: PersistenceScenario;
  trace: PersistenceTraceEntry[];
  checkpoints: Array<{ name: string; token: TokenLabel | null }>;
  finalToken: TokenLabel | null;
  errors: string[];
  cleanup: { drained: boolean; restored: boolean; databaseDeleted: boolean };
};
type AuthCallback = (event: AuthChangeEvent, session: Session | null) => void | Promise<void>;
type Action = { origin: Origin; session: Session | null; dispatched: boolean };
type Operation = { origin: Origin; id: number; transaction?: number };

declare global {
  interface Window {
    __authTokenPersistence?: { run: (scenario: PersistenceScenario) => Promise<PersistenceEvidence> };
  }
}

/**
 * A fresh browser context and dedicated origin are mandatory. Only the SDK
 * response/subscription boundary is controlled; sw-db and installed idb run as is.
 * The native wrappers observe calls and events without delaying open successes,
 * requests, completions, or production promises.
 */
async function run(scenario: PersistenceScenario): Promise<PersistenceEvidence> {
  if ((await indexedDB.databases()).some(({ name }) => name === DB_NAME)) {
    throw new Error('Harness requires an empty isolated database origin');
  }
  if (localStorage.length !== 0) throw new Error('Harness requires empty local storage');
  const initial = await supabase.auth.getSession();
  if (initial.error || initial.data.session) throw new Error('Harness requires an anonymous SDK');

  // Initialize with the shared production schema before observing the schedules.
  const setup = await openDB<MyLoveDBSchema>(DB_NAME, DB_VERSION, { upgrade: upgradeDb });
  const blockerDatabase = unwrap(setup);
  const original = {
    open: IDBFactory.prototype.open,
    transaction: IDBDatabase.prototype.transaction,
    close: IDBDatabase.prototype.close,
    put: IDBObjectStore.prototype.put,
    delete: IDBObjectStore.prototype.delete,
    get: IDBObjectStore.prototype.get,
    signIn: supabase.auth.signInWithPassword,
    signOut: supabase.auth.signOut,
    subscribe: supabase.auth.onAuthStateChange,
    consoleError: console.error,
  };
  const trace: PersistenceTraceEntry[] = [];
  const errors: string[] = [];
  const pending: Promise<unknown>[] = [];
  const transactions: Promise<void>[] = [];
  const connections = new Map<IDBDatabase, Operation>();
  const operations = new WeakMap<IDBTransaction, Operation>();
  const activeActions = new Map<'put' | 'delete', Action>();
  const waiters = new Set<() => void>();
  const listenerWrites: Origin[] = [];
  const checkpoints: PersistenceEvidence['checkpoints'] = [];
  const cleanup = { drained: false, restored: false, databaseDeleted: false };
  const sessions = [
    { label: { owner: 'A', version: 'v1' } as const, session: createAuthBootstrapSession({ userId: 'owner-A' }) },
    { label: { owner: 'B', version: 'v1' } as const, session: createAuthBootstrapSession({ userId: 'owner-B' }) },
    { label: { owner: 'A', version: 'v2' } as const, session: createAuthBootstrapSession({ userId: 'owner-A' }) },
  ];
  const [a, b, refreshed] = sessions;
  let synchronousOrigin: Origin | undefined;
  let callback: AuthCallback | undefined;
  let unsubscribe = () => {};
  let releaseBlocker: (() => void) | undefined;
  let nextOperation = 0;
  let nextTransaction = 0;
  let finalToken: TokenLabel | null;

  const record = (phase: string, origin: Origin, operation?: Operation) => {
    trace.push({
      sequence: trace.length + 1,
      phase,
      ...origin,
      ...(operation ? { operation: operation.id, transaction: operation.transaction } : {}),
    });
    waiters.forEach((wake) => wake());
  };
  const fail = (code: string) => { errors.push(code); };
  const track = <T>(promise: Promise<T>): Promise<T> => {
    pending.push(promise);
    // Mark the promise handled even when a later phase fails before awaiting it.
    void promise.catch(() => fail('operation-rejected'));
    return promise;
  };
  const scoped = <T>(origin: Origin, work: () => T): T => {
    const previous = synchronousOrigin;
    synchronousOrigin = origin;
    try { return work(); } finally { synchronousOrigin = previous; }
  };
  const tokenLabel = (token: StoredAuthToken | null): TokenLabel | null => {
    if (!token) return null;
    const known = sessions.find(({ session }) =>
      session.user.id === token.userId && session.access_token === token.accessToken &&
      session.refresh_token === token.refreshToken && session.expires_at === token.expiresAt
    );
    if (!known || token.id !== 'current') throw new Error('Unrecognized stored token');
    return { ...known.label };
  };
  const sessionLabel = (session: Session | null) => session
    ? tokenLabel({
        id: 'current', userId: session.user.id, accessToken: session.access_token,
        refreshToken: session.refresh_token, expiresAt: session.expires_at ?? 0,
      })
    : null;

  const waitFor = (actor: string, phase: string) => {
    const found = () => trace.some((entry) => entry.actor === actor && entry.phase === phase);
    if (found()) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const wake = () => {
        if (!found()) return;
        clearTimeout(timeout);
        waiters.delete(wake);
        resolve();
      };
      const timeout = window.setTimeout(() => {
        waiters.delete(wake);
        reject(new Error('Missing native phase: ' + actor + '/' + phase));
      }, 10_000);
      waiters.add(wake);
    });
  };

  const observeTransaction = (tx: IDBTransaction, operation: Operation) => {
    operation.transaction = ++nextTransaction;
    operations.set(tx, operation);
    record('transaction-created', operation.origin, operation);
    transactions.push(new Promise<void>((resolve) => {
      tx.addEventListener('complete', () => {
        record('native-complete', operation.origin, operation);
        resolve();
      }, { once: true });
      tx.addEventListener('abort', () => {
        fail('native-abort');
        record('native-abort', operation.origin, operation);
        resolve();
      }, { once: true });
      tx.addEventListener('error', () => fail('native-transaction-error'));
    }));
  };

  const observeRequest = (
    store: IDBObjectStore, method: 'put' | 'delete' | 'get', request: IDBRequest,
    key: unknown, value?: StoredAuthToken
  ) => {
    const operation = operations.get(store.transaction);
    if (!operation || operation.origin.source === 'blocker') return;
    if (key !== 'current' || method !== operation.origin.method) fail('request-provenance-mismatch');
    if (value && JSON.stringify(tokenLabel(value)) !== JSON.stringify(operation.origin.token)) {
      fail('put-token-mismatch');
    }
    record('request-dispatched', operation.origin, operation);
    request.addEventListener('success', () => record('request-success', operation.origin, operation), { once: true });
    request.addEventListener('error', () => fail('native-request-error'), { once: true });
  };

  const notify = (actor: string, event: AuthChangeEvent, session: Session | null) => {
    if (!callback) throw new Error('Missing real sessionService subscription');
    const origin: Origin = {
      actor, source: 'listener', event, method: session ? 'put' : 'delete', token: sessionLabel(session),
    };
    record('notification-dispatched', origin);
    // The listener's write now runs on its subscription queue after the
    // callback returns, outside this synchronous scope. Drain it separately.
    listenerWrites.push(origin);
    track(waitFor(actor, 'connection-closed'));
    const delivered = scoped(origin, () => callback!(event, session));
    return track(Promise.resolve(delivered).then(() => { record('notification-complete', origin); }));
  };

  const sdkResponse = async (method: 'put' | 'delete') => {
    const action = activeActions.get(method);
    if (!action) throw new Error('Unexpected SDK action');
    record('sdk-called', action.origin);
    // The installed SDK awaits its own notification before returning. Keep that
    // causal edge even while independent notifications/actions are in flight.
    await notify(action.origin.actor + '-listener', method === 'put' ? 'SIGNED_IN' : 'SIGNED_OUT', action.session);
    record('sdk-response', action.origin);
    return action;
  };

  const startAction = (actor: string, session: Session | null) => {
    const method = session ? 'put' : 'delete';
    if (activeActions.has(method)) throw new Error('Only one active action per method is supported');
    const action: Action = {
      origin: { actor, source: 'action', method, token: sessionLabel(session) }, session, dispatched: false,
    };
    activeActions.set(method, action);
    record('action-started', action.origin);
    const result = session
      ? signIn({ email: session.user.email!, password: 'synthetic-harness-password' }).then((response) => {
          if (response.error || response.session !== session) throw new Error('Sign-in service failed');
        })
      : signOut();
    return track(result.then(() => {
      record('action-complete', action.origin);
      activeActions.delete(method);
    }));
  };

  const hold = () => {
    const origin: Origin = { actor: 'blocker', source: 'blocker', method: 'hold', token: null };
    const operation: Operation = { origin, id: ++nextOperation };
    const tx = original.transaction.call(blockerDatabase, STORE_NAMES.SW_AUTH, 'readwrite');
    observeTransaction(tx, operation);
    let released = false;
    releaseBlocker = () => {
      if (released) return;
      released = true;
      record('blocker-released', origin, operation);
    };
    const store = tx.objectStore(STORE_NAMES.SW_AUTH);
    // Always enqueue the next native read during the preceding success event.
    // This keeps the readwrite lock alive without stalling the JS event loop.
    const pump = () => {
      const request = original.get.call(store, 'current');
      request.addEventListener('success', () => { if (!released) pump(); }, { once: true });
    };
    pump();
  };

  const read = async (name: string) => {
    const origin: Origin = { actor: name, source: 'read', method: 'get', token: null };
    const token = tokenLabel(await scoped(origin, getAuthToken));
    // idb convenience reads await request success, unlike writes. Drain their
    // native completion too before publishing the checkpoint.
    await Promise.all(transactions);
    record('storage-observed', { ...origin, token });
    checkpoints.push({ name, token });
    return token;
  };

  try {
    IDBFactory.prototype.open = function (name, version) {
      if (name !== DB_NAME) return original.open.call(this, name, version);
      let origin = synchronousOrigin;
      if (!origin) {
        // This synchronous stack is inspected locally and never exported. It
        // identifies the real caller module. Listener writes then take the
        // oldest delivered notification: sessionService's queue is FIFO by
        // design, and observeRequest still checks each one's method and token.
        const stack = new Error().stack ?? '';
        if (/\/src\/api\/auth\/sessionService\.ts:/.test(stack)) {
          origin = listenerWrites.shift();
          if (!origin) throw new Error('Unattributed listener persistence dispatch');
        } else {
          const method = /at signIn .*\/src\/api\/auth\/actionService\.ts:/.test(stack) ? 'put'
            : /at signOut .*\/src\/api\/auth\/actionService\.ts:/.test(stack) ? 'delete' : undefined;
          const action = method ? activeActions.get(method) : undefined;
          if (!action || action.dispatched) throw new Error('Unattributed production persistence dispatch');
          action.dispatched = true;
          origin = action.origin;
        }
      }
      const operation: Operation = { origin, id: ++nextOperation };
      record('persistence-dispatched', origin, operation);
      const request = original.open.call(this, name, version);
      request.addEventListener('success', () => {
        connections.set(request.result, operation);
        record('open-success', operation.origin, operation);
      }, { once: true });
      request.addEventListener('error', () => fail('native-open-error'), { once: true });
      request.addEventListener('blocked', () => fail('unexpected-open-blocked'), { once: true });
      return request;
    };
    IDBDatabase.prototype.transaction = function (names, mode, options) {
      const tx = original.transaction.call(this, names, mode, options);
      const operation = connections.get(this);
      if (operation) {
        if (operation.transaction || !tx.objectStoreNames.contains(STORE_NAMES.SW_AUTH)) {
          fail('unexpected-transaction-scope');
        }
        observeTransaction(tx, operation);
      }
      return tx;
    };
    IDBDatabase.prototype.close = function () {
      original.close.call(this);
      const operation = connections.get(this);
      if (operation) record('connection-closed', operation.origin, operation);
      connections.delete(this);
    };
    IDBObjectStore.prototype.put = function (value: StoredAuthToken, key) {
      const request = original.put.call(this, value, key);
      observeRequest(this, 'put', request, value.id, value);
      return request;
    };
    IDBObjectStore.prototype.delete = function (key) {
      const request = original.delete.call(this, key);
      observeRequest(this, 'delete', request, key);
      return request;
    };
    IDBObjectStore.prototype.get = function (key) {
      const request = original.get.call(this, key);
      observeRequest(this, 'get', request, key);
      return request;
    };
    console.error = () => { fail('service-console-error'); };
    // playwright-utils deviation: HTTP interception cannot control local SDK callback completion.
    // Substitute this boundary only; actionService, sessionService and sw-db stay untouched.
    supabase.auth.onAuthStateChange = (listener) => {
      callback = listener;
      return { data: { subscription: {
        id: 'synthetic-subscription', callback: listener, unsubscribe: () => { callback = undefined; },
      } } };
    };
    supabase.auth.signInWithPassword = async () => {
      const { session } = await sdkResponse('put');
      if (!session) throw new Error('Missing controlled sign-in session');
      return { data: { user: session.user, session }, error: null };
    };
    supabase.auth.signOut = async () => {
      await sdkResponse('delete');
      return { error: null };
    };
    unsubscribe = onAuthStateChange((session) => {
      if (!synchronousOrigin) throw new Error('Unattributed session delivery');
      record('identity-delivered', { ...synchronousOrigin, token: sessionLabel(session) });
    });

    if (scenario === 'sequential') {
      await startAction('sign-in-A', a.session);
      await read('after-sign-in');
      await startAction('sign-out', null);
    } else {
      if (scenario === 'local-actions' || scenario === 'stale-clear') {
        await notify('seed-A', 'SIGNED_IN', a.session);
        await read('before-overlap');
      }
      hold();
      const older = scenario === 'local-actions' || scenario === 'stale-clear'
        ? startAction('sign-out', null) : startAction('sign-in-A', a.session);
      const olderActor = scenario === 'local-actions' || scenario === 'stale-clear'
        ? 'sign-out' : 'sign-in-A';
      await waitFor(olderActor + '-listener', 'transaction-created');
      // The SDK response no longer waits for the listener's commit, so the
      // older action's own write also queues behind the blocker first.
      await waitFor(olderActor, 'transaction-created');
      const newer = scenario === 'local-actions'
        ? startAction('sign-in-B', b.session)
        : scenario === 'same-owner-refresh'
          ? notify('refresh-A-v2', 'TOKEN_REFRESHED', refreshed.session)
          : scenario === 'stale-resurrection'
            ? notify('independent-sign-out', 'SIGNED_OUT', null)
            : notify('independent-B', 'SIGNED_IN', b.session);
      const newerActor = scenario === 'local-actions' ? 'sign-in-B-listener'
        : scenario === 'same-owner-refresh' ? 'refresh-A-v2'
          : scenario === 'stale-resurrection' ? 'independent-sign-out' : 'independent-B';
      // The newer notification is delivered at once, but its write waits on the
      // subscription queue behind the held listener write, so it cannot open
      // a transaction before release. A newer action's own write can.
      await waitFor(newerActor, 'identity-delivered');
      if (scenario === 'local-actions') await waitFor('sign-in-B', 'transaction-created');
      releaseBlocker!();
      await Promise.all([older, newer]);
    }
    await Promise.all(pending);
    finalToken = await read('final');
  } finally {
    // Keep observers and SDK controls installed until every dispatched action,
    // notification and native transaction has settled, including on failures.
    releaseBlocker?.();
    try {
      const results = await Promise.allSettled(pending);
      if (results.some((result) => result.status === 'rejected')) fail('drain-rejected');
      await Promise.all(transactions);
      cleanup.drained = true;
      if (connections.size !== 0) fail('production-connection-not-closed');
    } finally {
      unsubscribe();
      connections.forEach((_operation, db) => original.close.call(db));
      original.close.call(blockerDatabase);
      IDBFactory.prototype.open = original.open;
      IDBDatabase.prototype.transaction = original.transaction;
      IDBDatabase.prototype.close = original.close;
      IDBObjectStore.prototype.put = original.put;
      IDBObjectStore.prototype.delete = original.delete;
      IDBObjectStore.prototype.get = original.get;
      supabase.auth.signInWithPassword = original.signIn;
      supabase.auth.signOut = original.signOut;
      supabase.auth.onAuthStateChange = original.subscribe;
      console.error = original.consoleError;
      cleanup.restored = true;
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(DB_NAME);
        request.addEventListener('success', () => resolve(), { once: true });
        request.addEventListener('error', () => reject(new Error('Isolated database cleanup failed')), { once: true });
        request.addEventListener('blocked', () => reject(new Error('Isolated database cleanup blocked')), { once: true });
      });
      cleanup.databaseDeleted = !(await indexedDB.databases()).some(({ name }) => name === DB_NAME);
      delete window.__authTokenPersistence;
    }
  }
  return { scenario, trace, checkpoints, finalToken, errors, cleanup };
}

window.__authTokenPersistence = { run };
