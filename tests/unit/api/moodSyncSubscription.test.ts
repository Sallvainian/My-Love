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

/** Resolvers for pending getSession calls, so resolution order is controllable */
let sessionQueue: Array<(value: unknown) => void> = [];

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
    channel: (topic: string) => {
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
          resolve('ok');
        });
      });
    },
  },
  getPartnerId: vi.fn(),
}));

import { moodSyncService } from '@/api/moodSyncService';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const TOPIC = `mood-updates:${USER_ID}`;

/** Resolve the oldest pending getSession with a valid session */
function resolveNextSession(): void {
  const resolve = sessionQueue.shift();
  if (!resolve) throw new Error('no pending getSession to resolve');
  resolve({ data: { session: { user: { id: USER_ID } } } });
}

/** Deliver a partner mood broadcast to everything attached to the channel */
function emitMood(chan: FakeChannel, id: string): void {
  chan.broadcastHandlers.forEach((handler) =>
    handler({
      payload: {
        id,
        user_id: USER_ID,
        mood_type: 'happy',
        mood_types: ['happy'],
        note: null,
        created_at: '2026-08-03T12:00:00.000Z',
      },
    })
  );
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

/** Ack every in-flight leave and let the continuations run */
async function settleLeaves(): Promise<void> {
  while (leaveQueue.length > 0) ackNextLeave();
  await flush();
}

describe('subscribeMoodUpdates channel ownership', () => {
  beforeEach(() => {
    openChannels = new Map();
    constructedChannels = [];
    sessionQueue = [];
    leaveQueue = [];
    removeChannel.mockClear();
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
    expect(onMoodB).toHaveBeenCalledWith(expect.objectContaining({ id: 'mood-after-a-left' }));

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
    expect(onMoodA).toHaveBeenCalledWith(expect.objectContaining({ id: 'shared-mood' }));
    expect(onMoodB).toHaveBeenCalledWith(expect.objectContaining({ id: 'shared-mood' }));

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
    expect(onMoodB).toHaveBeenCalledWith(expect.objectContaining({ id: 'after-reopen' }));
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
