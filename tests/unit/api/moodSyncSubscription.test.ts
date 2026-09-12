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
      chan.state = 'leaving';
      return new Promise<string>((resolve) => {
        leaveQueue.push(() => {
          chan.state = 'closed';
          openChannels.delete(chan.topic);
          // RealtimeClient.js:217 — the last channel out takes the socket with it.
          if (openChannels.size === 0) {
            socket.state = 'disconnecting';
            setTimeout(() => {
              socket.state = 'connected';
            }, socket.windowMs);
          }
          resolve('ok');
        });
      });
    },
    realtime: {
      isDisconnecting: () => socket.state === 'disconnecting',
      setAuth: async () => {
        opOrder.push('setAuth');
      },
    },
  },
  getPartnerId: (...args: unknown[]) => getPartnerId(...args),
  getSignedInUserId: (...args: unknown[]) => getSignedInUserId(...args),
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

/** Deliver the server's ack for the oldest in-flight leave */
function ackNextLeave(): void {
  const ack = leaveQueue.shift();
  if (!ack) throw new Error('no pending leave to ack');
  ack();
}

/** Let every already-queued microtask and continuation run */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Ack every in-flight leave, then wait out the socket's disconnect window */
async function settleLeaves(): Promise<void> {
  // Sustained quiescence, not a single bounded wait. Its sibling in
  // ephemeralBroadcast.test.ts used the one-shot form and failed 11 of 12 runs:
  // a subscriber parked in waitForSocketReady wakes on its own poll tick, up to
  // POLL_MS after the socket settles, and can queue another leave after the
  // wait has already returned.
  let quiet = 0;
  for (let i = 0; i < 400; i++) {
    while (leaveQueue.length > 0) ackNextLeave();
    await new Promise((r) => setTimeout(r, 5));
    quiet = leaveQueue.length === 0 && socket.state === 'connected' ? quiet + 1 : 0;
    if (quiet >= 6) return;
  }
  throw new Error(
    `settleLeaves() never reached quiescence: leaveQueue=${leaveQueue.length} socket=${socket.state}`
  );
}

describe('subscribeMoodUpdates channel ownership', () => {
  beforeEach(() => {
    openChannels = new Map();
    constructedChannels = [];
    sessionQueue = [];
    leaveQueue = [];
    channelConfigs = [];
    opOrder = [];
    removeChannel.mockClear();
    getPartnerId.mockReset();
    getPartnerId.mockResolvedValue(PARTNER_ID);
    getSignedInUserId.mockReset();
    getSignedInUserId.mockResolvedValue(USER_ID);
    socket.state = 'connected';
    socket.windowMs = 40;
  });

  afterEach(async () => {
    // The service tracks in-flight leaves on a singleton field. An unacked
    // leave would outlive the test and park the next test's subscribe on a
    // promise whose resolver was thrown away with the queue.
    await settleLeaves();
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

    await settleLeaves();
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
    await flush();

    // The defect this guards: B used to take the leaving channel, call
    // subscribe() on it — a no-op, since the join is gated on state 'closed' —
    // and then receive nothing at all for the life of the page. B must instead
    // still be waiting, not holding a channel.
    expect(constructedChannels).toHaveLength(1);

    await settleLeaves();
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
    await flush();

    await settleLeaves();
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
    await settleLeaves();

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
    emitStatus(channel, 'SUBSCRIBED');
    await flush();

    emitMood(channel, 'after-switch');
    expect(onMood).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('re-takes the partner snapshot on every SUBSCRIBED', async () => {
    const onMood = vi.fn();
    const pending = moodSyncService.subscribeMoodUpdates(onMood);
    resolveNextSession();
    const unsubscribe = await pending;

    const channel = constructedChannels[0];

    // The relationship ended while the channel was up. RLS is re-evaluated at
    // the re-join, and so is this snapshot.
    getPartnerId.mockResolvedValue(null);
    emitStatus(channel, 'SUBSCRIBED');
    await flush();

    emitMood(channel, 'after-unlink');
    expect(onMood).not.toHaveBeenCalled();

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

    getPartnerId.mockResolvedValue(null);
    emitStatus(channel, 'SUBSCRIBED');
    await flush();

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

  it('returns a no-op unsubscribe when there is no session', async () => {
    const pending = moodSyncService.subscribeMoodUpdates(vi.fn());
    const resolve = sessionQueue.shift();
    resolve?.({ data: { session: null } });

    const unsubscribe = await pending;
    unsubscribe();

    expect(constructedChannels).toHaveLength(0);
    expect(removeChannel).not.toHaveBeenCalled();
  });
});
