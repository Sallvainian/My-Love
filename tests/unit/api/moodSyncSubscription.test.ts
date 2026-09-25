/**
 * moodSyncService.subscribeMoodUpdates — channel ownership
 *
 * Two consumers subscribe in practice — usePartnerMood (Mood tab) and
 * PartnerMoodView (Partner tab) — and the two views are mutually exclusive, so
 * moving between them unmounts one and mounts the other while both subscribe
 * calls are still in flight.
 *
 * The mock below reproduces the one behaviour that makes this hard, and that an
 * earlier version of this file did not model: `supabase.channel(topic)` does
 * NOT mint a fresh object per call. RealtimeClient looks the topic up first and
 * hands back the channel already open under it —
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
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type BroadcastHandler = (payload: { payload: Record<string, unknown> }) => void;
type StatusHandler = (status: string) => void;

interface FakeChannel {
  topic: string;
  /** 'closed' | 'joined' | 'leaving', mirroring CHANNEL_STATES */
  state: string;
  broadcastHandlers: BroadcastHandler[];
  statusHandlers: StatusHandler[];
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
}

/** Mirrors RealtimeClient's registry: one channel per topic, live OR leaving. */
let openChannels: Map<string, FakeChannel> = new Map();
/** Every channel object ever constructed, including ones since removed. */
let constructedChannels: FakeChannel[] = [];
const removeChannel = vi.fn();
/** Resolvers for in-flight leaves, so the server's ack can be timed by a test */
let leaveQueue: Array<() => void> = [];
/** Every leave `removeChannel` handed the service, so teardown can await them all. */
let leavePromises: Array<Promise<string>> = [];
/** When true, a requested leave is acked at once. Only teardown turns it on. */
let autoAckLeaves = false;

/** A mocked lookup the service awaited, as the promise it was handed. */
type LookupKind = 'session' | 'partner';
let lookupWaiters: Array<{ kind: LookupKind; resolve: (call: { promise: Promise<unknown> }) => void }> = [];

/**
 * Hand the promise a mocked lookup returns to every test waiting for that
 * lookup. The service registers its own `await` on the promise as soon as the
 * mock returns, before any waiter can -- so a test that awaits it next resumes
 * only after the service has acted on the answer.
 */
function recordLookup<T>(kind: LookupKind, promise: Promise<T>): Promise<T> {
  const due = lookupWaiters.filter((waiter) => waiter.kind === kind);
  lookupWaiters = lookupWaiters.filter((waiter) => waiter.kind !== kind);
  // Wrapped: resolving with the promise itself would adopt it.
  due.forEach((waiter) => waiter.resolve({ promise }));
  return promise;
}

/**
 * Resolves once the NEXT `kind` lookup has been answered and the service has
 * acted on the answer. Arm it before the trigger.
 */
async function nextLookupHandled(kind: LookupKind): Promise<void> {
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
const socket = {
  state: 'connected' as 'connected' | 'disconnecting',
  windowMs: 40,
  /** The pending end of the current disconnecting window, cleared between tests */
  windowTimer: undefined as ReturnType<typeof setTimeout> | undefined,
};

/** Resolvers for pending getSession calls, so resolution order is controllable */
let sessionQueue: Array<(value: unknown) => void> = [];

/**
 * Config each `channel()` call was given, in call order. `mood-updates:<uuid>`
 * is a private topic now: without `private: true` Realtime runs no policy check
 * and anyone holding the anon key can join and publish on it.
 */
let channelConfigs: Array<unknown> = [];
/** Order of the calls whose ORDER is load-bearing: setAuth must precede the join. */
let opOrder: string[] = [];

const getPartnerId = vi.fn();
const getSignedInUserId = vi.fn();
const setAuth = vi.fn();

const getSession = vi.fn(
  () =>
    new Promise((resolve) => {
      sessionQueue.push(resolve);
    })
);

vi.mock('@/api/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: () => getSession(),
    },
    // Hands back whatever is registered under the topic, in ANY state — this is
    // the RealtimeClient behaviour a naive mock hides.
    channel: (topic: string, config?: unknown) => {
      channelConfigs.push(config);
      const existing = openChannels.get(topic);
      if (existing) return existing;

      const chan: FakeChannel = {
        topic,
        state: 'closed',
        broadcastHandlers: [],
        statusHandlers: [],
        on: vi.fn((_event: string, _filter: unknown, handler: BroadcastHandler) => {
          chan.broadcastHandlers.push(handler);
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
    },
    // RealtimeClient.js:213-219 only awaits `channel.unsubscribe()`, which sets
    // state='leaving' (RealtimeChannel.js:364) and resolves on the server's
    // leave ack. Deregistration happens later still, in the `_onClose` hook
    // (RealtimeChannel.js:81-86). So the topic stays claimed for the whole
    // round-trip.
    removeChannel: (chan: FakeChannel) => {
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
    },
    realtime: {
      isDisconnecting: () => socket.state === 'disconnecting',
      setAuth: (...args: unknown[]) => setAuth(...args),
    },
  },
  getPartnerId: (...args: unknown[]) => getPartnerId(...args),
  // Both names at one mock: the receive paths read the snapshot through the
  // retrying lookup and the send path through the plain one, but they wrap the
  // same round-trip, so every existing setup in this file keeps its meaning.
  resolvePartnerIdForDelivery: (...args: unknown[]) => getPartnerId(...args),
  // Derived from the same stub: an id is `linked`, null is `unlinked`, and a
  // rejection is the inconclusive `error` a refresh must not write back.
  resolvePartnerLookupForDelivery: (...args: unknown[]) =>
    recordLookup(
      'partner',
      (async () => {
        try {
          const partnerId = await getPartnerId(...args);
          return partnerId ? { status: 'linked', partnerId } : { status: 'unlinked' };
        } catch (error) {
          return { status: 'error', reason: error instanceof Error ? error.message : String(error) };
        }
      })()
    ),
  getSignedInUserId: (...args: unknown[]) => getSignedInUserId(...args),
  // `verifyChannelOwner` reads the session through the discriminated lookup so
  // it can tell "signed out" from "the read failed". Derived from the same
  // `getSignedInUserId` mock so the existing setups keep their meaning: a
  // resolved id is `signed-in`, a resolved null is `signed-out`, and a REJECTED
  // promise is the inconclusive `error` case.
  resolveSignedInUserForDelivery: (...args: unknown[]) =>
    recordLookup(
      'session',
      (async () => {
        try {
          const userId = await getSignedInUserId(...args);
          return userId ? { status: 'signed-in', userId } : { status: 'signed-out' };
        } catch (error) {
          return { status: 'error', reason: error instanceof Error ? error.message : String(error) };
        }
      })()
    ),
}));

import { moodSyncService } from '@/api/moodSyncService';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const PARTNER_ID = '00000000-0000-4000-8000-000000000002';
const OUTSIDER_ID = '00000000-0000-4000-8000-000000000003';
const TOPIC = `mood-updates:${USER_ID}`;

/**
 * Stable UUID per test label.
 *
 * Broadcast bodies are parsed now, and the schema wants a real UUID for `id`.
 * The tests still read better with names like 'after-reopen', so the label is
 * mapped to a UUID rather than replaced by one.
 */
const moodIds = new Map<string, string>();
function moodIdFor(label: string): string {
  let id = moodIds.get(label);
  if (!id) {
    id = `00000000-0000-4000-8000-1${String(moodIds.size + 1).padStart(11, '0')}`;
    moodIds.set(label, id);
  }
  return id;
}

/** Resolve the oldest pending getSession with a valid session */
function resolveNextSession(): void {
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
function emitMood(
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

/** Report a subscription status to everything attached to the channel */
function emitStatus(chan: FakeChannel, status: string): void {
  chan.statusHandlers.forEach((handler) => handler(status));
}

/**
 * Mirror an SDK `phx_close`: the channel goes `closed`, drops out of the
 * client's registry, and reports `CLOSED`. Without the drop, a mocked reopen
 * would be handed this dying object and `subscribe()` would no-op.
 */
function serverClosesTopic(chan: FakeChannel): void {
  chan.state = 'closed';
  openChannels.delete(chan.topic);
  emitStatus(chan, 'CLOSED');
}

/** Deliver the server's ack for the oldest in-flight leave */
function ackNextLeave(): void {
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

describe('subscribeMoodUpdates channel ownership', () => {
  beforeEach(() => {
    openChannels = new Map();
    constructedChannels = [];
    sessionQueue = [];
    leaveQueue = [];
    leavePromises = [];
    autoAckLeaves = false;
    lookupWaiters = [];
    channelConfigs = [];
    opOrder = [];
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
  });

  afterEach(async () => {
    // The service tracks in-flight leaves on a singleton field. An unacked
    // leave would outlive the test and park the next test's subscribe on a
    // promise whose resolver was thrown away with the queue.
    await settleLeaves();
    // A disconnecting window still open would flip the next test's socket.
    clearTimeout(socket.windowTimer);
    socket.windowTimer = undefined;
    socket.state = 'connected';
    vi.clearAllMocks();
  });

  it('two overlapping subscribers share one channel', async () => {
    // Mood tab subscribes, then Partner tab subscribes before the first
    // resolves — one tap apart on adjacent bottom-nav buttons.
    const pendingA = moodSyncService.subscribeMoodUpdates(vi.fn());
    const pendingB = moodSyncService.subscribeMoodUpdates(vi.fn());

    resolveNextSession();
    resolveNextSession();
    const [unsubscribeA, unsubscribeB] = await Promise.all([pendingA, pendingB]);

    // The real client deduped these to one object; opening a second would mean
    // the service is keying on something other than the topic.
    expect(constructedChannels).toHaveLength(1);
    expect(openChannels.get(TOPIC)).toBe(constructedChannels[0]);

    unsubscribeA();
    unsubscribeB();
  });

  it('one subscriber leaving does not tear the channel out from under the other', async () => {
    const onMoodA = vi.fn();
    const onMoodB = vi.fn();

    const pendingA = moodSyncService.subscribeMoodUpdates(onMoodA);
    const pendingB = moodSyncService.subscribeMoodUpdates(onMoodB);
    resolveNextSession();
    resolveNextSession();
    const [unsubscribeA, unsubscribeB] = await Promise.all([pendingA, pendingB]);

    const channel = constructedChannels[0];

    // A's component already unmounted, so its cleanup runs while B is mounted.
    unsubscribeA();

    // The whole defect: this used to remove the shared channel, and B then
    // silently stopped receiving partner moods for the life of the page.
    expect(removeChannel).not.toHaveBeenCalled();
    expect(openChannels.get(TOPIC)).toBe(channel);

    emitMood(channel, 'mood-after-a-left');

    expect(onMoodA).not.toHaveBeenCalled();
    expect(onMoodB).toHaveBeenCalledTimes(1);
    expect(onMoodB).toHaveBeenCalledWith(expect.objectContaining({ id: moodIdFor('mood-after-a-left') }));

    unsubscribeB();
  });

  it('the last subscriber to leave removes the channel', async () => {
    const pendingA = moodSyncService.subscribeMoodUpdates(vi.fn());
    const pendingB = moodSyncService.subscribeMoodUpdates(vi.fn());
    resolveNextSession();
    resolveNextSession();
    const [unsubscribeA, unsubscribeB] = await Promise.all([pendingA, pendingB]);

    const channel = constructedChannels[0];

    unsubscribeA();
    expect(removeChannel).not.toHaveBeenCalled();

    unsubscribeB();
    expect(removeChannel).toHaveBeenCalledTimes(1);
    expect(removeChannel).toHaveBeenCalledWith(channel);

    // The topic is not free yet — the client holds it until the server acks.
    expect(openChannels.get(TOPIC)).toBe(channel);
    expect(channel.state).toBe('leaving');

    ackNextLeave();
    expect(openChannels.has(TOPIC)).toBe(false);
  });

  it('both subscribers receive the same broadcast', async () => {
    const onMoodA = vi.fn();
    const onMoodB = vi.fn();

    const pendingA = moodSyncService.subscribeMoodUpdates(onMoodA);
    const pendingB = moodSyncService.subscribeMoodUpdates(onMoodB);
    resolveNextSession();
    resolveNextSession();
    const [unsubscribeA, unsubscribeB] = await Promise.all([pendingA, pendingB]);

    emitMood(constructedChannels[0], 'shared-mood');

    // Only the first `.on()` handler is registered on the shared channel, so a
    // fan-out that forgot the second consumer would leave B silent.
    expect(onMoodA).toHaveBeenCalledWith(expect.objectContaining({ id: moodIdFor('shared-mood') }));
    expect(onMoodB).toHaveBeenCalledWith(expect.objectContaining({ id: moodIdFor('shared-mood') }));

    unsubscribeA();
    unsubscribeB();
  });

  it('a subscriber that joins an already-open channel is told the current status', async () => {
    const onStatusA = vi.fn();
    const pendingA = moodSyncService.subscribeMoodUpdates(vi.fn(), onStatusA);
    resolveNextSession();
    const unsubscribeA = await pendingA;

    emitStatus(constructedChannels[0], 'SUBSCRIBED');
    expect(onStatusA).toHaveBeenCalledWith('SUBSCRIBED');

    // B attaches after subscribe() already reported. Its connection indicator
    // would otherwise sit on its initial value forever, showing "disconnected"
    // over a live channel.
    const onStatusB = vi.fn();
    const pendingB = moodSyncService.subscribeMoodUpdates(vi.fn(), onStatusB);
    resolveNextSession();
    const unsubscribeB = await pendingB;

    expect(onStatusB).toHaveBeenCalledWith('SUBSCRIBED');

    // And it keeps receiving later transitions.
    emitStatus(constructedChannels[0], 'TIMED_OUT');
    expect(onStatusB).toHaveBeenLastCalledWith('TIMED_OUT');

    unsubscribeA();
    unsubscribeB();
  });

  it('a second call to the same unsubscribe is a no-op', async () => {
    // usePartnerMood can invoke this twice: from its own !isMounted branch and
    // again from the effect cleanup. Calling it twice must not consume the
    // other consumer's registration.
    const onMoodB = vi.fn();
    const pendingA = moodSyncService.subscribeMoodUpdates(vi.fn());
    const pendingB = moodSyncService.subscribeMoodUpdates(onMoodB);
    resolveNextSession();
    resolveNextSession();
    const [unsubscribeA, unsubscribeB] = await Promise.all([pendingA, pendingB]);

    unsubscribeA();
    unsubscribeA();

    expect(removeChannel).not.toHaveBeenCalled();
    emitMood(constructedChannels[0], 'still-delivered');
    expect(onMoodB).toHaveBeenCalledTimes(1);

    unsubscribeB();
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });

  it('two consumers passing the same callback reference unsubscribe independently', async () => {
    // Set-of-callbacks would collapse these into one entry, and the first
    // unsubscribe would then take the channel down under the second.
    const shared = vi.fn();
    const pendingA = moodSyncService.subscribeMoodUpdates(shared);
    const pendingB = moodSyncService.subscribeMoodUpdates(shared);
    resolveNextSession();
    resolveNextSession();
    const [unsubscribeA, unsubscribeB] = await Promise.all([pendingA, pendingB]);

    unsubscribeA();
    expect(removeChannel).not.toHaveBeenCalled();

    unsubscribeB();
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });

  it('a subscriber arriving during the previous leave still gets a working channel', async () => {
    // The Mood tab -> Partner tab swap. React runs the outgoing effect's
    // cleanup and then the incoming effect's setup back to back, so the second
    // subscribe lands inside the first one's leave round-trip.
    const onMoodA = vi.fn();
    const pendingA = moodSyncService.subscribeMoodUpdates(onMoodA);
    resolveNextSession();
    const unsubscribeA = await pendingA;

    unsubscribeA();
    expect(removeChannel).toHaveBeenCalledTimes(1);
    // Still claimed: `supabase.channel(TOPIC)` would hand this dying object back.
    expect(openChannels.get(TOPIC)!.state).toBe('leaving');

    const onMoodB = vi.fn();
    const pendingB = moodSyncService.subscribeMoodUpdates(onMoodB);
    resolveNextSession();
    // B has installed its token, the last step before it looks for the topic.
    await vi.waitFor(() => expect(setAuth).toHaveBeenCalledTimes(2));

    // The defect this guards: B used to take the leaving channel, call
    // subscribe() on it — a no-op, since the join is gated on state 'closed' —
    // and then receive nothing at all for the life of the page. B must instead
    // still be waiting, not holding a channel.
    expect(constructedChannels).toHaveLength(1);

    ackNextLeave();
    const unsubscribeB = await pendingB;

    expect(constructedChannels).toHaveLength(2);
    const reopened = constructedChannels[1];
    expect(reopened).not.toBe(constructedChannels[0]);
    expect(reopened.state).toBe('joined');

    emitMood(reopened, 'after-reopen');
    expect(onMoodB).toHaveBeenCalledWith(expect.objectContaining({ id: moodIdFor('after-reopen') }));
    expect(onMoodA).not.toHaveBeenCalled();

    unsubscribeB();
  });

  it('two subscribers arriving during one leave share a single reopened channel', async () => {
    const pendingA = moodSyncService.subscribeMoodUpdates(vi.fn());
    resolveNextSession();
    const unsubscribeA = await pendingA;
    unsubscribeA();

    // Both arrive while the leave is unacked.
    const pendingB = moodSyncService.subscribeMoodUpdates(vi.fn());
    const pendingC = moodSyncService.subscribeMoodUpdates(vi.fn());
    resolveNextSession();
    resolveNextSession();
    // Both have installed their tokens (A's was the first), so both are
    // waiting on that one leave.
    await vi.waitFor(() => expect(setAuth).toHaveBeenCalledTimes(3));

    ackNextLeave();
    const [unsubscribeB, unsubscribeC] = await Promise.all([pendingB, pendingC]);

    // Exactly one replacement — both waiters must not each open their own.
    expect(constructedChannels).toHaveLength(2);

    unsubscribeB();
    expect(removeChannel).toHaveBeenCalledTimes(1);
    unsubscribeC();
    expect(removeChannel).toHaveBeenCalledTimes(2);
  });

  it("a dead channel's late CLOSED does not pin its replacement to disconnected", async () => {
    // The status callback used to look the entry up by topic when stashing
    // `lastStatus`. A terminal status from a channel that has since been
    // replaced under the same topic therefore landed on its REPLACEMENT, and
    // the replay below handed that stale CLOSED to the next consumer to
    // attach — a live channel reporting itself disconnected, permanently.
    const pendingA = moodSyncService.subscribeMoodUpdates(vi.fn());
    resolveNextSession();
    const unsubscribeA = await pendingA;

    const dead = constructedChannels[0];
    emitStatus(dead, 'SUBSCRIBED');

    unsubscribeA();
    ackNextLeave();

    // A replacement opens under the same topic.
    const pendingB = moodSyncService.subscribeMoodUpdates(vi.fn());
    resolveNextSession();
    const unsubscribeB = await pendingB;

    const live = constructedChannels[1];
    expect(live).not.toBe(dead);
    emitStatus(live, 'SUBSCRIBED');

    // The old channel's terminal callback finally fires, after its replacement
    // is already registered under the topic.
    emitStatus(dead, 'CLOSED');

    // A third consumer attaches to the LIVE channel and gets the replay.
    const onStatusC = vi.fn();
    const pendingC = moodSyncService.subscribeMoodUpdates(vi.fn(), onStatusC);
    resolveNextSession();
    const unsubscribeC = await pendingC;

    expect(onStatusC).toHaveBeenCalledWith('SUBSCRIBED');
    expect(onStatusC).not.toHaveBeenCalledWith('CLOSED');

    unsubscribeB();
    unsubscribeC();
  });

  it('opens the topic as a private channel, with the JWT installed before the join', async () => {
    const pending = moodSyncService.subscribeMoodUpdates(vi.fn());
    resolveNextSession();
    const unsubscribe = await pending;

    // A public join to this topic is readable and writable by anyone holding
    // the project's anon key; `private: true` is what makes the SELECT policy
    // on realtime.messages run at all.
    expect(channelConfigs).toEqual([
      { config: { broadcast: { self: false }, private: true } },
    ]);
    // And the token has to be on the socket first, or the join is evaluated
    // against the anon key and denied.
    expect(opOrder).toEqual(['setAuth', `subscribe:${TOPIC}`]);

    unsubscribe();
  });

  it('drops a broadcast from someone who is not the partner', async () => {
    const onMood = vi.fn();
    const pending = moodSyncService.subscribeMoodUpdates(onMood);
    resolveNextSession();
    const unsubscribe = await pending;

    // The identity check lives in the service, not in each consumer:
    // PartnerMoodView raised a toast for ANY broadcast, so a check that only
    // usePartnerMood performed left that path exposed.
    emitMood(constructedChannels[0], 'forged', { user_id: OUTSIDER_ID });

    expect(onMood).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('drops malformed broadcasts without reaching a subscriber', async () => {
    const onMood = vi.fn();
    const pending = moodSyncService.subscribeMoodUpdates(onMood);
    resolveNextSession();
    const unsubscribe = await pending;

    const channel = constructedChannels[0];

    // A non-array mood_types used to be indexed and mapped straight into three
    // mood views; an unknown mood_type has no MOOD_CONFIG entry; a missing
    // created_at leaves the timeline with no timestamp to sort on.
    emitMood(channel, 'string-moods', { mood_types: 'happy' });
    emitMood(channel, 'number-moods', { mood_types: 7 });
    emitMood(channel, 'unknown-type', { mood_type: 'hangry' });
    emitMood(channel, 'no-created-at', { created_at: undefined });
    channel.broadcastHandlers.forEach((handler) =>
      handler({ payload: 'not an object' } as unknown as { payload: Record<string, unknown> })
    );

    expect(onMood).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('delivers a valid multi-mood broadcast whole', async () => {
    const onMood = vi.fn();
    const pending = moodSyncService.subscribeMoodUpdates(onMood);
    resolveNextSession();
    const unsubscribe = await pending;

    const id = emitMood(constructedChannels[0], 'multi', { mood_types: ['happy', 'tired'] });

    expect(onMood).toHaveBeenCalledWith(
      expect.objectContaining({ id, mood_types: ['happy', 'tired'] })
    );
    // The wire carries no updated_at; the receiver has always used the creation
    // time in its place.
    expect(onMood.mock.calls[0][0]).toMatchObject({ updated_at: '2026-08-03T12:00:00.000Z' });

    unsubscribe();
  });

  it('stops dispatching once the device is signed in as a different account', async () => {
    const onMood = vi.fn();
    const pending = moodSyncService.subscribeMoodUpdates(onMood);
    resolveNextSession();
    const unsubscribe = await pending;

    const channel = constructedChannels[0];
    emitMood(channel, 'before-switch');
    expect(onMood).toHaveBeenCalledTimes(1);

    // Sign-out, or a second account on a shared device, while this channel is
    // still open. The next join re-checks, and the topic no longer belongs to
    // whoever is signed in.
    getSignedInUserId.mockResolvedValue(OUTSIDER_ID);
    const sessionChecked = nextLookupHandled('session');
    emitStatus(channel, 'SUBSCRIBED');
    await sessionChecked;

    emitMood(channel, 'after-switch');
    expect(onMood).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('keeps the join-time snapshot on the FIRST SUBSCRIBED', async () => {
    // `subscribeMoodUpdates` resolved the partner moments before the join and
    // assigned it. Re-taking it here would null a fresh value and re-fetch it
    // over a `users` round-trip, and `parseMoodBroadcast` drops everything for
    // want of a partner id while that is in flight -- so a mood sent as the
    // view opens would be lost, silently and for good.
    const onMood = vi.fn();
    const pending = moodSyncService.subscribeMoodUpdates(onMood);
    resolveNextSession();
    const unsubscribe = await pending;

    const channel = constructedChannels[0];
    const lookupsAfterJoin = getPartnerId.mock.calls.length;
    const sessionReadsAfterJoin = getSignedInUserId.mock.calls.length;

    // Were this SUBSCRIBED to refresh, the mood below would land in the window
    // where the snapshot is null and be dropped.
    const sessionChecked = nextLookupHandled('session');
    emitStatus(channel, 'SUBSCRIBED');
    emitMood(channel, 'immediately-after-join');
    expect(onMood).toHaveBeenCalledTimes(1);

    // The join's only check is the session read; once it has been acted on,
    // the identity check is over.
    await sessionChecked;
    // Exactly one session read. A refresh chained after the check starts with
    // a second one, before this line runs -- and clears the snapshot, so the
    // mood below would be dropped.
    expect(getSignedInUserId.mock.calls.length).toBe(sessionReadsAfterJoin + 1);
    emitMood(channel, 'after-the-check');
    expect(onMood).toHaveBeenCalledTimes(2);
    // And it cost no second round-trip.
    expect(getPartnerId.mock.calls.length).toBe(lookupsAfterJoin);

    unsubscribe();
  });

  it('re-takes the partner snapshot on a RE-join', async () => {
    const onMood = vi.fn();
    const pending = moodSyncService.subscribeMoodUpdates(onMood);
    resolveNextSession();
    const unsubscribe = await pending;

    const channel = constructedChannels[0];

    // The join itself. Everything after this is a re-join.
    const joinChecked = nextLookupHandled('session');
    emitStatus(channel, 'SUBSCRIBED');
    await joinChecked;

    // The relationship ended while the channel was up. RLS is re-evaluated at
    // the re-join, and so is this snapshot.
    getPartnerId.mockResolvedValue(null);
    const refreshed = nextLookupHandled('partner');
    emitStatus(channel, 'SUBSCRIBED');
    await refreshed;

    emitMood(channel, 'after-unlink');
    expect(onMood).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('keeps the partner when a RE-join refresh is inconclusive', async () => {
    // The refresh clears the snapshot BEFORE its round-trips, to close the
    // ex-partner window. So a lookup that fails every attempt and writes its
    // null back leaves the channel muted for the life of the page view:
    // `refreshChannelIdentity` runs only on SUBSCRIBED and a healthy socket
    // emits no further one. An ex-partner cannot exploit the restored value --
    // `couple_broadcast_partner_can_send` pins the send on `get_my_partner_id()`,
    // so after a real unlink the server refuses their insert outright.
    const onMood = vi.fn();
    const pending = moodSyncService.subscribeMoodUpdates(onMood);
    resolveNextSession();
    const unsubscribe = await pending;

    const channel = constructedChannels[0];

    // The join itself. Everything after this is a re-join.
    const joinChecked = nextLookupHandled('session');
    emitStatus(channel, 'SUBSCRIBED');
    await joinChecked;

    // The socket drops and rejoins; the `users` read fails outright.
    getPartnerId.mockRejectedValueOnce(new Error('network down'));
    const refreshed = nextLookupHandled('partner');
    emitStatus(channel, 'SUBSCRIBED');
    await refreshed;

    emitMood(channel, 'after-the-blip');
    expect(onMood).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('a later subscriber re-arms a snapshot a failed refresh had nulled', async () => {
    // The recovery half of the line above: `entry.partnerId = partnerIdAtJoin`
    // runs for EVERY caller, not only the one that opens the channel. Without
    // it, a refresh that resolved null — a failed `users` lookup, or a session
    // read that momentarily reported no account — leaves the entry muted for
    // the life of the page, because `refreshChannelIdentity` only runs on the
    // next SUBSCRIBED and an already-joined channel never emits another.
    const onMoodA = vi.fn();
    const pendingA = moodSyncService.subscribeMoodUpdates(onMoodA);
    resolveNextSession();
    const unsubscribeA = await pendingA;

    const channel = constructedChannels[0];

    // The join, then the re-join whose lookup fails. Only a RE-join refreshes,
    // so the failing lookup has to be the second SUBSCRIBED.
    const joinChecked = nextLookupHandled('session');
    emitStatus(channel, 'SUBSCRIBED');
    await joinChecked;

    getPartnerId.mockResolvedValue(null);
    const refreshed = nextLookupHandled('partner');
    emitStatus(channel, 'SUBSCRIBED');
    await refreshed;

    emitMood(channel, 'while-muted');
    expect(onMoodA).not.toHaveBeenCalled();

    // The Partner tab mounts. Its own lookup succeeds, and that is the only
    // thing that can restore delivery for BOTH consumers.
    getPartnerId.mockResolvedValue(PARTNER_ID);
    const onMoodB = vi.fn();
    const pendingB = moodSyncService.subscribeMoodUpdates(onMoodB);
    resolveNextSession();
    const unsubscribeB = await pendingB;

    expect(constructedChannels).toHaveLength(1);

    emitMood(channel, 'after-rearm');
    expect(onMoodB).toHaveBeenCalledTimes(1);
    expect(onMoodA).toHaveBeenCalledTimes(1);

    unsubscribeA();
    unsubscribeB();
  });

  it('a later subscriber whose lookup fails does not mute a working channel', async () => {
    // The other half of the line above. `entry.partnerId = partnerIdAtJoin`
    // must not run when the lookup FAILED: getPartnerId answers null for a
    // transient `users` error exactly as it does for an unlink, so an
    // unguarded write here lets the second consumer's failed round-trip
    // silently stop partner moods for the first one too — and nothing
    // re-arms it, because refreshChannelIdentity fires only on SUBSCRIBED
    // and an already-joined channel emits no further one.
    const onMoodA = vi.fn();
    const pendingA = moodSyncService.subscribeMoodUpdates(onMoodA);
    resolveNextSession();
    const unsubscribeA = await pendingA;

    const channel = constructedChannels[0];

    emitMood(channel, 'before');
    expect(onMoodA).toHaveBeenCalledTimes(1);

    // The Partner tab mounts while the websocket is healthy, but its `users`
    // round-trip fails.
    getPartnerId.mockResolvedValue(null);
    const onMoodB = vi.fn();
    const pendingB = moodSyncService.subscribeMoodUpdates(onMoodB);
    resolveNextSession();
    const unsubscribeB = await pendingB;

    expect(constructedChannels).toHaveLength(1);

    // Both consumers still receive the partner's mood.
    emitMood(channel, 'after');
    expect(onMoodA).toHaveBeenCalledTimes(2);
    expect(onMoodB).toHaveBeenCalledTimes(1);

    unsubscribeA();
    unsubscribeB();
  });

  it('re-takes the snapshot on the first SUBSCRIBED when the join lookup failed', async () => {
    // Mirror of the love-notes case: `partnerIdAtJoin` is null because the
    // lookup failed, not because the user is unlinked, so the entry must not be
    // marked fresh -- nothing else would re-arm it with one consumer mounted.
    getPartnerId.mockResolvedValue(null);

    const onMood = vi.fn();
    const pending = moodSyncService.subscribeMoodUpdates(onMood);
    resolveNextSession();
    const unsubscribe = await pending;

    const channel = constructedChannels[0];

    // The retry succeeds this time.
    getPartnerId.mockResolvedValue(PARTNER_ID);
    const refreshed = nextLookupHandled('partner');
    emitStatus(channel, 'SUBSCRIBED');
    await refreshed;

    emitMood(channel, 'after-recovery');
    expect(onMood).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('a failed session read at the first SUBSCRIBED does not mute the channel', async () => {
    // `getSignedInUserId` answers null for a FAILED `getSession` exactly as it
    // does for "signed out", so reading that null as an account change muted
    // the channel on a session the user still held -- terminally, because
    // `refreshChannelIdentity` runs only on a later SUBSCRIBED and a healthy
    // socket emits none. The scenario: the access token expires as the channel
    // joins and the refresh hits a network blip.
    const onMood = vi.fn();
    const pending = moodSyncService.subscribeMoodUpdates(onMood);
    resolveNextSession();
    const unsubscribe = await pending;

    const channel = constructedChannels[0];

    getSignedInUserId.mockRejectedValue(new Error('network down'));
    const sessionChecked = nextLookupHandled('session');
    emitStatus(channel, 'SUBSCRIBED');
    await sessionChecked;

    // The read told us nothing, so the join-time snapshot stands.
    emitMood(channel, 'after-inconclusive-read');
    expect(onMood).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('still mutes when the session read conclusively reports another account', async () => {
    // The other side of the line above: a CONCLUSIVE answer naming a different
    // account still stops dispatch on the first SUBSCRIBED.
    const onMood = vi.fn();
    const pending = moodSyncService.subscribeMoodUpdates(onMood);
    resolveNextSession();
    const unsubscribe = await pending;

    const channel = constructedChannels[0];

    getSignedInUserId.mockResolvedValue(OUTSIDER_ID);
    const sessionChecked = nextLookupHandled('session');
    emitStatus(channel, 'SUBSCRIBED');
    await sessionChecked;

    emitMood(channel, 'after-account-change');
    expect(onMood).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('returns a no-op unsubscribe when there is no session', async () => {
    const pending = moodSyncService.subscribeMoodUpdates(vi.fn());
    const resolve = sessionQueue.shift();
    resolve?.({ data: { session: null } });

    const unsubscribe = await pending;
    unsubscribe();

    expect(constructedChannels).toHaveLength(0);
    expect(removeChannel).not.toHaveBeenCalled();
  });

  describe('unsolicited CLOSED reopen', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(async () => {
      await vi.runOnlyPendingTimersAsync();
      vi.useRealTimers();
    });

    async function fireReopen(delayMs = 1000): Promise<void> {
      await vi.advanceTimersByTimeAsync(delayMs);
      while (leaveQueue.length > 0) ackNextLeave();
      await vi.advanceTimersByTimeAsync(socket.windowMs + 20);
      await Promise.resolve();
      await Promise.resolve();
    }

    it('re-arms a join when reopen setAuth rejects after the row is swapped', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const onMood = vi.fn();
      const pending = moodSyncService.subscribeMoodUpdates(onMood);
      resolveNextSession();
      const unsubscribe = await pending;

      expect(constructedChannels).toHaveLength(1);

      setAuth.mockRejectedValueOnce(new Error('token install failed'));
      serverClosesTopic(constructedChannels[0]);
      await fireReopen();

      expect(constructedChannels).toHaveLength(1);
      expect(errorSpy).toHaveBeenCalledWith(
        '[MoodSyncService] Retry setup failed:',
        expect.any(Error)
      );

      await fireReopen(2000);

      expect(constructedChannels).toHaveLength(2);
      emitMood(constructedChannels[1], 'after-setAuth-reject');
      expect(onMood).toHaveBeenCalledWith(
        expect.objectContaining({ id: moodIdFor('after-setAuth-reject') })
      );

      unsubscribe();
      errorSpy.mockRestore();
    });

    it('reopens a live entry on a new channel after an unsolicited CLOSED', async () => {
      const onMood = vi.fn();
      const onStatus = vi.fn();
      const pending = moodSyncService.subscribeMoodUpdates(onMood, onStatus);
      resolveNextSession();
      const unsubscribe = await pending;

      const first = constructedChannels[0];
      serverClosesTopic(first);

      expect(onStatus).toHaveBeenCalledWith('CLOSED');
      expect(constructedChannels).toHaveLength(1);

      await fireReopen();

      expect(constructedChannels).toHaveLength(2);
      const replacement = constructedChannels[1];
      expect(replacement).not.toBe(first);
      expect(replacement.state).toBe('joined');
      expect(opOrder.slice(-2)).toEqual(['setAuth', `subscribe:${TOPIC}`]);

      emitMood(replacement, 'after-unsolicited-close');
      expect(onMood).toHaveBeenCalledWith(
        expect.objectContaining({ id: moodIdFor('after-unsolicited-close') })
      );

      unsubscribe();
    });

    it("does not reopen when last-subscriber teardown reports CLOSED", async () => {
      const pending = moodSyncService.subscribeMoodUpdates(vi.fn());
      resolveNextSession();
      const unsubscribe = await pending;

      const channel = constructedChannels[0];
      unsubscribe();
      emitStatus(channel, 'CLOSED');

      await fireReopen();

      expect(constructedChannels).toHaveLength(1);
    });

    it('cancels a pending reopen when the last subscriber detaches during backoff', async () => {
      const pending = moodSyncService.subscribeMoodUpdates(vi.fn());
      resolveNextSession();
      const unsubscribe = await pending;

      serverClosesTopic(constructedChannels[0]);
      unsubscribe();

      await fireReopen();

      expect(constructedChannels).toHaveLength(1);
    });

    it('restores the CLOSED retry budget when the replacement reports SUBSCRIBED', async () => {
      const pending = moodSyncService.subscribeMoodUpdates(vi.fn());
      resolveNextSession();
      const unsubscribe = await pending;

      serverClosesTopic(constructedChannels[0]);
      await fireReopen();
      expect(constructedChannels).toHaveLength(2);

      emitStatus(constructedChannels[1], 'SUBSCRIBED');

      serverClosesTopic(constructedChannels[1]);
      await fireReopen(1000);

      expect(constructedChannels).toHaveLength(3);

      unsubscribe();
    });

    it("re-takes the partner snapshot on the replacement's first SUBSCRIBED", async () => {
      const onMood = vi.fn();
      const pending = moodSyncService.subscribeMoodUpdates(onMood);
      resolveNextSession();
      const unsubscribe = await pending;

      serverClosesTopic(constructedChannels[0]);
      await fireReopen();

      getPartnerId.mockResolvedValue(null);
      emitStatus(constructedChannels[1], 'SUBSCRIBED');
      await vi.advanceTimersByTimeAsync(0);
      await Promise.resolve();
      await Promise.resolve();

      emitMood(constructedChannels[1], 'after-unlink');
      expect(onMood).not.toHaveBeenCalled();

      unsubscribe();
    });

    it("a released channel's late CLOSED does not notify live consumers or open another join", async () => {
      const onStatus = vi.fn();
      const pending = moodSyncService.subscribeMoodUpdates(vi.fn(), onStatus);
      resolveNextSession();
      const unsubscribe = await pending;

      const first = constructedChannels[0];
      serverClosesTopic(first);
      await fireReopen();
      expect(constructedChannels).toHaveLength(2);

      onStatus.mockClear();
      emitStatus(first, 'CLOSED');
      await fireReopen(30000);

      expect(constructedChannels).toHaveLength(2);
      expect(onStatus).not.toHaveBeenCalledWith('CLOSED');

      unsubscribe();
    });

    it('stops joining once five unsolicited CLOSEs have been spent', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const onStatus = vi.fn();
      const pending = moodSyncService.subscribeMoodUpdates(vi.fn(), onStatus);
      resolveNextSession();
      const unsubscribe = await pending;

      const delays = [1000, 2000, 4000, 8000, 16000];
      for (const delay of delays) {
        serverClosesTopic(constructedChannels[constructedChannels.length - 1]);
        await fireReopen(delay);
      }

      expect(constructedChannels).toHaveLength(6);

      serverClosesTopic(constructedChannels[5]);
      await fireReopen(30000);

      expect(constructedChannels).toHaveLength(6);
      expect(errorSpy).toHaveBeenCalledWith(
        '[MoodSyncService] Max retries (5) exceeded. Giving up.'
      );

      const lateStatus = vi.fn();
      const latePending = moodSyncService.subscribeMoodUpdates(vi.fn(), lateStatus);
      resolveNextSession();
      const lateUnsubscribe = await latePending;
      expect(lateStatus).toHaveBeenCalledWith('CLOSED');
      expect(constructedChannels).toHaveLength(6);

      unsubscribe();
      lateUnsubscribe();
      errorSpy.mockRestore();
    });
  });
});
