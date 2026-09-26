/**
 * Shared Realtime fake for the moodSyncSubscription tests
 * (`moodSyncSubscription*.test.ts`).
 *
 * The mock reproduces the one behaviour that makes channel ownership hard, and
 * that an earlier version of these tests did not model: `supabase.channel(topic)`
 * does NOT mint a fresh object per call. RealtimeClient looks the topic up first
 * and hands back the channel already open under it —
 *
 *   channel(topic, params = { config: {} }) {
 *     const realtimeTopic = `realtime:${topic}`;
 *     const exists = this.getChannels().find((c) => c.topic === realtimeTopic);
 *     if (!exists) { ... } else { return exists; }
 *   }
 *
 * — and both consumers build the identical topic from the signed-in user id. So
 * both hold the same object, and any per-call `removeChannel` closes it under
 * whichever consumer is still mounted. A mock that returns a new channel per
 * call cannot see that, and green-lights a fix that does not hold in production.
 *
 * Each test file keeps its own `vi.mock('@/api/supabaseClient')`, whose factory
 * calls into this module lazily. The collections below are cleared in place by
 * `resetRealtimeFake()` rather than reassigned, because an importer cannot
 * reassign another module's binding.
 */
import { type Mock, vi } from 'vitest';

type BroadcastHandler = (payload: { payload: Record<string, unknown> }) => void;
type StatusHandler = (status: string) => void;

export interface FakeChannel {
  topic: string;
  /** 'closed' | 'joined' | 'leaving', mirroring CHANNEL_STATES */
  state: string;
  /** `new_mood` handlers. */
  broadcastHandlers: BroadcastHandler[];
  /** Handlers for every other broadcast event, by event name. */
  eventHandlers: Map<string, BroadcastHandler[]>;
  statusHandlers: StatusHandler[];
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
}

/** Mirrors RealtimeClient's registry: one channel per topic, live OR leaving. */
export const openChannels: Map<string, FakeChannel> = new Map();
/** Every channel object ever constructed, including ones since removed. */
export const constructedChannels: FakeChannel[] = [];
export const removeChannel: Mock = vi.fn();
/** Resolvers for in-flight leaves, so the server's ack can be timed by a test */
export const leaveQueue: Array<() => void> = [];
/** Every leave `removeChannel` handed the service, so teardown can await them all. */
const leavePromises: Array<Promise<string>> = [];
/** When true, a requested leave is acked at once. Only teardown turns it on. */
let autoAckLeaves = false;

/** A mocked lookup the service awaited, as the promise it was handed. */
type LookupKind = 'session' | 'partner';
const lookupWaiters: Array<{ kind: LookupKind; resolve: (call: { promise: Promise<unknown> }) => void }> = [];

/**
 * Hand the promise a mocked lookup returns to every test waiting for that
 * lookup. The service registers its own `await` on the promise as soon as the
 * mock returns, before any waiter can -- so a test that awaits it next resumes
 * only after the service has acted on the answer.
 */
function recordLookup<T>(kind: LookupKind, promise: Promise<T>): Promise<T> {
  const due = lookupWaiters.filter((waiter) => waiter.kind === kind);
  lookupWaiters.splice(0, lookupWaiters.length, ...lookupWaiters.filter((waiter) => waiter.kind !== kind));
  // Wrapped: resolving with the promise itself would adopt it.
  due.forEach((waiter) => waiter.resolve({ promise }));
  return promise;
}

/**
 * Resolves once the NEXT `kind` lookup has been answered and the service has
 * acted on the answer. Arm it before the trigger.
 */
export async function nextLookupHandled(kind: LookupKind): Promise<void> {
  const { promise } = await new Promise<{ promise: Promise<unknown> }>((resolve) =>
    lookupWaiters.push({ kind, resolve })
  );
  await promise;
}

/**
 * The shared socket. Removing the LAST channel calls `disconnect()`
 * (RealtimeClient.js:217), which parks the socket in 'disconnecting' until
 * onclose or a 100ms fallback timer, and every `connect()` in that window is a
 * silent no-op (RealtimeClient.js:117-122) — so a channel opened there never
 * joins and dies on its own 10s timeout.
 */
export const socket = {
  state: 'connected' as 'connected' | 'disconnecting',
  windowMs: 40,
  /** The pending end of the current disconnecting window, cleared between tests */
  windowTimer: undefined as ReturnType<typeof setTimeout> | undefined,
};

/** Resolvers for pending getSession calls, so resolution order is controllable */
export const sessionQueue: Array<(value: unknown) => void> = [];

/**
 * Config each `channel()` call was given, in call order. `mood-updates:<uuid>`
 * is a private topic now: without `private: true` Realtime runs no policy check
 * and anyone holding the anon key can join and publish on it.
 */
export const channelConfigs: Array<unknown> = [];
/** Order of the calls whose ORDER is load-bearing: setAuth must precede the join. */
export const opOrder: string[] = [];

export const getPartnerId: Mock = vi.fn();
export const getSignedInUserId: Mock = vi.fn();
export const setAuth: Mock = vi.fn();

export const getSession = vi.fn(
  () =>
    new Promise((resolve) => {
      sessionQueue.push(resolve);
    })
);

/**
 * The mocked `resolvePartnerLookupForDelivery`. Derived from the same stub: an
 * id is `linked`, null is `unlinked`, and a rejection is the inconclusive
 * `error` a refresh must not write back.
 */
export function fakeResolvePartnerLookup(...args: unknown[]) {
  return recordLookup(
    'partner',
    (async () => {
      try {
        const partnerId = await getPartnerId(...args);
        return partnerId ? { status: 'linked', partnerId } : { status: 'unlinked' };
      } catch (error) {
        return { status: 'error', reason: error instanceof Error ? error.message : String(error) };
      }
    })()
  );
}

/**
 * The mocked `resolveSignedInUserForDelivery`. `verifyChannelOwner` reads the
 * session through the discriminated lookup so it can tell "signed out" from
 * "the read failed". Derived from the same `getSignedInUserId` mock so the
 * existing setups keep their meaning: a resolved id is `signed-in`, a resolved
 * null is `signed-out`, and a REJECTED promise is the inconclusive `error` case.
 */
export function fakeResolveSignedInUser(...args: unknown[]) {
  return recordLookup(
    'session',
    (async () => {
      try {
        const userId = await getSignedInUserId(...args);
        return userId ? { status: 'signed-in', userId } : { status: 'signed-out' };
      } catch (error) {
        return { status: 'error', reason: error instanceof Error ? error.message : String(error) };
      }
    })()
  );
}

/**
 * The mocked `supabase.channel`. Hands back whatever is registered under the
 * topic, in ANY state — this is the RealtimeClient behaviour a naive mock hides.
 */
export function fakeChannel(topic: string, config?: unknown): FakeChannel {
  channelConfigs.push(config);
  const existing = openChannels.get(topic);
  if (existing) return existing;

  const chan: FakeChannel = {
    topic,
    state: 'closed',
    broadcastHandlers: [],
    eventHandlers: new Map(),
    statusHandlers: [],
    // realtime-js dispatches a broadcast only to the handlers registered for
    // its event, so the fake keeps them apart too.
    on: vi.fn((_type: string, filter: { event?: string } | undefined, handler: BroadcastHandler) => {
      const event = filter?.event ?? 'new_mood';
      if (event === 'new_mood') {
        chan.broadcastHandlers.push(handler);
      } else {
        chan.eventHandlers.set(event, [...(chan.eventHandlers.get(event) ?? []), handler]);
      }
      return chan;
    }),
    // RealtimeChannel.js:127 gates the whole join — and therefore the
    // callback registration — on `state == closed`. Subscribing to a
    // channel that is still leaving silently does nothing.
    subscribe: vi.fn((handler: StatusHandler) => {
      if (chan.state !== 'closed') return chan;
      // subscribe() calls socket.connect(), which returns early while the
      // socket is disconnecting, so the join is never sent.
      if (socket.state === 'disconnecting') {
        chan.state = 'joining';
        return chan;
      }
      opOrder.push(`subscribe:${chan.topic}`);
      chan.state = 'joined';
      chan.statusHandlers.push(handler);
      return chan;
    }),
  };
  openChannels.set(topic, chan);
  constructedChannels.push(chan);
  return chan;
}

/**
 * The mocked `supabase.removeChannel`.
 *
 * RealtimeClient.js:213-219 only awaits `channel.unsubscribe()`, which sets
 * state='leaving' (RealtimeChannel.js:364) and resolves on the server's
 * leave ack. Deregistration happens later still, in the `_onClose` hook
 * (RealtimeChannel.js:81-86). So the topic stays claimed for the whole
 * round-trip.
 */
export function fakeRemoveChannel(chan: FakeChannel): Promise<string> {
  removeChannel(chan);
  // An unsolicited `phx_close` already closed the channel and dropped it
  // from the client (see `serverClosesTopic`). The leave is then a no-op
  // that still has to resolve so `closingMoodChannels` can clear.
  if (chan.state === 'closed' && !openChannels.has(chan.topic)) {
    return Promise.resolve('ok');
  }
  chan.state = 'leaving';
  const leave = new Promise<string>((resolve) => {
    const ack = () => {
      chan.state = 'closed';
      openChannels.delete(chan.topic);
      // RealtimeClient.js:217 — the last channel out takes the socket with it.
      if (openChannels.size === 0) {
        socket.state = 'disconnecting';
        clearTimeout(socket.windowTimer);
        socket.windowTimer = setTimeout(() => {
          socket.state = 'connected';
        }, socket.windowMs);
      }
      resolve('ok');
    };
    if (autoAckLeaves) ack();
    else leaveQueue.push(ack);
  });
  leavePromises.push(leave);
  return leave;
}

const USER_ID = '00000000-0000-4000-8000-000000000001';
export const PARTNER_ID = '00000000-0000-4000-8000-000000000002';
export const OUTSIDER_ID = '00000000-0000-4000-8000-000000000003';
export const TOPIC = `mood-updates:${USER_ID}`;

/**
 * Stable UUID per test label.
 *
 * Broadcast bodies are parsed now, and the schema wants a real UUID for `id`.
 * The tests still read better with names like 'after-reopen', so the label is
 * mapped to a UUID rather than replaced by one.
 */
const moodIds = new Map<string, string>();
export function moodIdFor(label: string): string {
  let id = moodIds.get(label);
  if (!id) {
    id = `00000000-0000-4000-8000-1${String(moodIds.size + 1).padStart(11, '0')}`;
    moodIds.set(label, id);
  }
  return id;
}

/** Resolve the oldest pending getSession with a valid session */
export function resolveNextSession(): void {
  const resolve = sessionQueue.shift();
  if (!resolve) throw new Error('no pending getSession to resolve');
  resolve({ data: { session: { user: { id: USER_ID } } } });
}

/**
 * Deliver a partner mood broadcast to everything attached to the channel.
 *
 * `user_id` is the PARTNER, not the topic owner: the service now drops anything
 * whose sender is not the partner snapshot taken at join.
 */
export function emitMood(
  chan: FakeChannel,
  label: string,
  overrides: Record<string, unknown> = {}
): string {
  const id = moodIdFor(label);
  chan.broadcastHandlers.forEach((handler) =>
    handler({
      payload: {
        id,
        user_id: PARTNER_ID,
        mood_type: 'happy',
        mood_types: ['happy'],
        note: null,
        created_at: '2026-08-03T12:00:00.000Z',
        ...overrides,
      },
    })
  );
  return id;
}

/** Deliver a broadcast of any other event to everything attached to the channel. */
export function emitEvent(
  chan: FakeChannel,
  event: string,
  payload: Record<string, unknown> = {}
): void {
  (chan.eventHandlers.get(event) ?? []).forEach((handler) => handler({ payload }));
}

/** Report a subscription status to everything attached to the channel */
export function emitStatus(chan: FakeChannel, status: string): void {
  chan.statusHandlers.forEach((handler) => handler(status));
}

/**
 * Mirror an SDK `phx_close`: the channel goes `closed`, drops out of the
 * client's registry, and reports `CLOSED`. Without the drop, a mocked reopen
 * would be handed this dying object and `subscribe()` would no-op.
 */
export function serverClosesTopic(chan: FakeChannel): void {
  chan.state = 'closed';
  openChannels.delete(chan.topic);
  emitStatus(chan, 'CLOSED');
}

/** Deliver the server's ack for the oldest in-flight leave */
export function ackNextLeave(): void {
  const ack = leaveQueue.shift();
  if (!ack) throw new Error('no pending leave to ack');
  ack();
}

/**
 * Ack every leave, including any requested from here on, and wait for all of
 * them. Every subscribe a test starts is awaited by that test, so once its
 * leaves have landed nothing of it is left running.
 */
async function settleLeaves(): Promise<void> {
  autoAckLeaves = true;
  while (leaveQueue.length > 0) ackNextLeave();
  await Promise.all(leavePromises);
}

/**
 * The wrapper `beforeEach`. Clears the channel, session, leave, lookup, config
 * and order collections in place, clears `removeChannel`, and re-arms
 * `getPartnerId`, `getSignedInUserId` and `setAuth`. `moodIds` is kept across
 * tests, and `getSession` keeps its implementation.
 */
export function resetRealtimeFake(): void {
  openChannels.clear();
  constructedChannels.length = 0;
  sessionQueue.length = 0;
  leaveQueue.length = 0;
  leavePromises.length = 0;
  autoAckLeaves = false;
  lookupWaiters.length = 0;
  channelConfigs.length = 0;
  opOrder.length = 0;
  removeChannel.mockClear();
  getPartnerId.mockReset();
  getPartnerId.mockResolvedValue(PARTNER_ID);
  getSignedInUserId.mockReset();
  getSignedInUserId.mockResolvedValue(USER_ID);
  setAuth.mockReset();
  setAuth.mockImplementation(async () => {
    opOrder.push('setAuth');
  });
  socket.state = 'connected';
  socket.windowMs = 40;
}

/** The wrapper `afterEach`. */
export async function teardownRealtimeFake(): Promise<void> {
  // The service tracks in-flight leaves on a singleton field. An unacked
  // leave would outlive the test and park the next test's subscribe on a
  // promise whose resolver was thrown away with the queue.
  await settleLeaves();
  // A disconnecting window still open would flip the next test's socket.
  clearTimeout(socket.windowTimer);
  socket.windowTimer = undefined;
  socket.state = 'connected';
  vi.clearAllMocks();
}
