/**
 * sendEphemeralBroadcast — overlapping sends to one topic
 *
 * Mood sync and love notes both push to a partner's topic by opening a channel,
 * sending, and closing again. Written inline at each call site that races as
 * soon as two sends overlap, because the client does two things a naive mock
 * hides:
 *
 *   - `channel(topic)` returns whatever is already registered under the topic
 *     (RealtimeClient.js:277-288) rather than a fresh object, and
 *   - `subscribe()` registers nothing at all unless the channel is in state
 *     'closed' (RealtimeChannel.js:127), so the second caller's status callback
 *     never fires and its promise never settles;
 *   - `removeChannel` only awaits the leave (RealtimeClient.js:213-219); the
 *     registry entry is dropped later, from `_onClose`
 *     (RealtimeChannel.js:81-86).
 *
 * The mock below reproduces all three. Without it the tests pass against the
 * broken implementation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeChannel {
  topic: string;
  state: string;
  statusHandler: ((status: string) => void) | null;
  sent: Array<{ event: string; payload: Record<string, unknown> }>;
  subscribe: (handler: (status: string) => void) => FakeChannel;
  send: (message: {
    type: string;
    event: string;
    payload: Record<string, unknown>;
  }) => Promise<string>;
}

let openChannels: Map<string, FakeChannel> = new Map();
let constructedChannels: FakeChannel[] = [];
/** Pending leave acks, oldest first */
let leaveQueue: Array<() => void> = [];
/** Sends waiting on a resolver, so ordering is observable */
let sendGate: Array<() => void> = [];
let gateSends = false;
/** Status the next subscribe reports instead of SUBSCRIBED, consumed once */
let nextSubscribeStatus: string | null = null;

vi.mock('@/api/supabaseClient', () => ({
  supabase: {
    channel: (topic: string) => {
      const existing = openChannels.get(topic);
      if (existing) return existing;

      const chan: FakeChannel = {
        topic,
        state: 'closed',
        statusHandler: null,
        sent: [],
        subscribe: (handler) => {
          // The join — and therefore the callback registration — is gated on
          // 'closed'. Subscribing to a channel that is joined or leaving is a
          // silent no-op.
          if (chan.state !== 'closed') return chan;
          chan.state = 'joined';
          chan.statusHandler = handler;
          const status = nextSubscribeStatus ?? 'SUBSCRIBED';
          nextSubscribeStatus = null;
          handler(status);
          return chan;
        },
        send: async (message) => {
          if (gateSends) {
            await new Promise<void>((resolve) => sendGate.push(resolve));
          }
          chan.sent.push({ event: message.event, payload: message.payload });
          return 'ok';
        },
      };
      openChannels.set(topic, chan);
      constructedChannels.push(chan);
      return chan;
    },
    removeChannel: (chan: FakeChannel) => {
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

import { sendEphemeralBroadcast } from '@/api/ephemeralBroadcast';

const TOPIC = 'mood-updates:partner-1';

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Ack every queued leave, repeatedly, until the queue stays empty */
async function settle(): Promise<void> {
  for (let i = 0; i < 12; i++) {
    while (sendGate.length > 0) sendGate.shift()!();
    while (leaveQueue.length > 0) leaveQueue.shift()!();
    await flush();
    if (leaveQueue.length === 0 && sendGate.length === 0) break;
  }
}

describe('sendEphemeralBroadcast', () => {
  beforeEach(() => {
    openChannels = new Map();
    constructedChannels = [];
    leaveQueue = [];
    sendGate = [];
    gateSends = false;
    nextSubscribeStatus = null;
  });

  afterEach(async () => {
    // The queue lives on a module-level map; an unsettled send would park the
    // next test behind it.
    await settle();
    vi.clearAllMocks();
  });

  it('delivers both of two overlapping sends to the same topic', async () => {
    const first = sendEphemeralBroadcast(TOPIC, 'new_mood', { id: 'mood-1' });
    const second = sendEphemeralBroadcast(TOPIC, 'new_mood', { id: 'mood-2' });

    await settle();
    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();

    // The defect: the second send was handed the first one's channel, its
    // subscribe callback never fired, and the partner never got mood-2.
    const delivered = constructedChannels.flatMap((c) => c.sent.map((s) => s.payload.id));
    expect(delivered).toEqual(['mood-1', 'mood-2']);
  });

  it('opens a separate channel per send rather than reusing a closing one', async () => {
    const first = sendEphemeralBroadcast(TOPIC, 'new_mood', { id: 'mood-1' });
    const second = sendEphemeralBroadcast(TOPIC, 'new_mood', { id: 'mood-2' });

    await settle();
    await Promise.all([first, second]);

    expect(constructedChannels).toHaveLength(2);
    expect(constructedChannels[0]).not.toBe(constructedChannels[1]);
    // Both fully closed and deregistered, not left claiming the topic.
    expect(constructedChannels.every((c) => c.state === 'closed')).toBe(true);
    expect(openChannels.has(TOPIC)).toBe(false);
  });

  it('does not start the second send until the first channel has fully left', async () => {
    gateSends = true;

    const first = sendEphemeralBroadcast(TOPIC, 'new_mood', { id: 'mood-1' });
    const second = sendEphemeralBroadcast(TOPIC, 'new_mood', { id: 'mood-2' });
    await flush();

    // Only the first has a channel; the second is still queued.
    expect(constructedChannels).toHaveLength(1);

    // Let the first send through, but hold its leave unacked.
    sendGate.shift()!();
    await flush();
    expect(constructedChannels[0].state).toBe('leaving');
    // Still queued: the topic is claimed until the leave is acked, so opening
    // now would just retrieve the dying channel.
    expect(constructedChannels).toHaveLength(1);

    leaveQueue.shift()!();
    await flush();
    expect(constructedChannels).toHaveLength(2);

    gateSends = false;
    await settle();
    await Promise.all([first, second]);
  });

  it('a failed send does not strand the next one', async () => {
    // The first channel errors instead of subscribing.
    nextSubscribeStatus = 'CHANNEL_ERROR';

    const failing = sendEphemeralBroadcast(TOPIC, 'new_mood', { id: 'mood-1' });
    const following = sendEphemeralBroadcast(TOPIC, 'new_mood', { id: 'mood-2' });

    await settle();

    await expect(failing).rejects.toThrow(/CHANNEL_ERROR/);
    // The whole point of running the next link on both settle paths: chaining
    // with a bare .then() would leave every later send to this partner
    // permanently rejected behind the first failure.
    await expect(following).resolves.toBeUndefined();
    expect(constructedChannels).toHaveLength(2);
    expect(constructedChannels[0].sent).toHaveLength(0);
    expect(constructedChannels[1].sent).toHaveLength(1);
  });

  it('sends to different topics do not queue behind each other', async () => {
    gateSends = true;

    const toPartner = sendEphemeralBroadcast(TOPIC, 'new_mood', { id: 'mood-1' });
    const toNotes = sendEphemeralBroadcast('love-notes:partner-1', 'new_message', { id: 'note-1' });
    await flush();

    // Independent topics never collide in the client's registry, so serialising
    // across them would only add latency.
    expect(constructedChannels).toHaveLength(2);

    gateSends = false;
    await settle();
    await Promise.all([toPartner, toNotes]);
  });

  it('rejects rather than hanging when the channel never reports a status', async () => {
    vi.useFakeTimers();
    try {
      // A channel that is handed back already joined never calls the handler.
      openChannels.set(TOPIC, {
        topic: TOPIC,
        state: 'joined',
        statusHandler: null,
        sent: [],
        subscribe: function (this: FakeChannel) {
          return this;
        },
        send: async () => 'ok',
      } as FakeChannel);

      const stuck = sendEphemeralBroadcast(TOPIC, 'new_mood', { id: 'mood-1' });
      const assertion = expect(stuck).rejects.toThrow(/timed out/);

      await vi.advanceTimersByTimeAsync(16_000);
      // The teardown's leave still needs acking for the promise to settle.
      while (leaveQueue.length > 0) leaveQueue.shift()!();
      await vi.advanceTimersByTimeAsync(0);

      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
