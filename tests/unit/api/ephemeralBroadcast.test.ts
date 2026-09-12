/**
 * sendEphemeralBroadcast — overlapping sends to one topic, over a private REST broadcast
 *
 * Mood sync and love notes both push to a partner's topic by opening a channel,
 * sending, and closing again. Written inline at each call site that races as
 * soon as two sends overlap, because the client does two things a naive mock
 * hides:
 *
 *   - `channel(topic)` returns whatever is already registered under the topic
 *     (RealtimeClient.js:277-288) rather than a fresh object, so a second send
 *     is handed the first one's dying object;
 *   - `removeChannel` only awaits the leave (RealtimeClient.js:213-219); the
 *     registry entry is dropped later, from `_onClose`
 *     (RealtimeChannel.js:81-86), and removing the LAST channel disconnects the
 *     shared socket for ~100ms.
 *
 * The mock below reproduces both. Without it the tests pass against the broken
 * implementation.
 *
 * The transport is `httpSend`, not `send`, and that is load-bearing rather than
 * incidental. These topics are private now, and a sender holds INSERT on the
 * partner's topic and deliberately not SELECT — a private websocket JOIN with
 * no SELECT is refused by Realtime ("You do not have permissions to read from
 * this Channel topic", measured against realtime v2.124.4). The REST broadcast
 * endpoint evaluates the same INSERT policy without a join. The SDK's `send()`
 * silently falls back to that endpoint too, but swallows the denial and
 * resolves 'ok'; only `httpSend` rejects.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeChannel {
  topic: string;
  /** 'closed' | 'leaving', mirroring CHANNEL_STATES for the registry's purposes */
  state: string;
  sent: Array<{ event: string; payload: Record<string, unknown> }>;
  httpSend: (
    event: string,
    payload: Record<string, unknown>,
    opts?: { timeout?: number }
  ) => Promise<{ success: true } | { success: false; status: number; error: string }>;
}

let openChannels: Map<string, FakeChannel> = new Map();
let constructedChannels: FakeChannel[] = [];
/** Pending leave acks, oldest first */
let leaveQueue: Array<() => void> = [];
/** Sends waiting on a resolver, so ordering is observable */
let sendGate: Array<() => void> = [];
let gateSends = false;
/**
 * Config object each `channel()` call was given, in call order.
 *
 * These topics are private now: a public send is open to anyone holding the
 * project's anon key, so the config is part of the contract.
 */
let channelConfigs: Array<unknown> = [];
/**
 * The order of the calls whose ORDER is load-bearing: `setAuth` must have
 * installed the caller's JWT before the request, or the endpoint sees the anon
 * key — on which anon holds no EXECUTE for get_my_partner_id, so the INSERT
 * policy is never even reached.
 */
let opOrder: string[] = [];
/** Timeout option each httpSend was handed, in call order */
let sendTimeouts: Array<number | undefined> = [];
/**
 * Token currently on the socket. `null` models a client whose session was
 * cleared while a send was queued: the endpoint then answers Unauthorized.
 */
let socketToken: string | null = 'valid-jwt';
/** What the next `setAuth()` will install. Set to null to model sign-out. */
let nextAuthToken: string | null = 'valid-jwt';
/** Makes the next httpSend reject, consumed once */
let nextSendFailure: string | null = null;
/**
 * Makes the next httpSend RESOLVE with the failure shape rather than reject,
 * consumed once.
 *
 * realtime-js 2.116.0 always rejects a non-202, so this shape is unreachable
 * there — but the signature admits it, and a resolved failure that the caller
 * did not inspect is a silently dropped broadcast, which is the one failure
 * mode this module exists to prevent.
 */
let nextSendFailureShape: { status: number; error: string } | null = null;
/** When true, httpSend honours its timeout option instead of resolving */
let hangNextSend = false;

/**
 * The shared socket, modelled the way RealtimeClient actually behaves:
 * removing the LAST channel calls disconnect(), which parks the socket in
 * 'disconnecting' until onclose or a 100ms fallback timer.
 */
const socket = {
  state: 'connected' as 'connected' | 'disconnecting',
  /** How long the disconnecting window lasts, in ms */
  windowMs: 40,
  /** Set false to model the pre-fix library assumption (no window at all) */
  modelDisconnectWindow: true,
};

vi.mock('@/api/supabaseClient', () => ({
  supabase: {
    channel: (topic: string, config?: unknown) => {
      channelConfigs.push(config);
      const existing = openChannels.get(topic);
      if (existing) return existing;

      const chan: FakeChannel = {
        topic,
        state: 'closed',
        sent: [],
        httpSend: async (event, payload, opts) => {
          sendTimeouts.push(opts?.timeout);
          opOrder.push(`httpSend:${chan.topic}`);

          if (gateSends) {
            await new Promise<void>((resolve) => sendGate.push(resolve));
          }

          if (hangNextSend) {
            hangNextSend = false;
            // RealtimeChannel._fetchWithTimeout aborts the request when the
            // timeout elapses; nothing in sendEphemeralBroadcast races it.
            await new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error('The operation was aborted due to timeout')),
                opts?.timeout ?? 10_000
              )
            );
          }

          if (nextSendFailureShape !== null) {
            const shape = nextSendFailureShape;
            nextSendFailureShape = null;
            return { success: false, ...shape } as const;
          }

          // realtime-js RealtimeChannel.js:478 — anything but a 202 rejects,
          // and an RLS denial answers 'Unauthorized'.
          if (socketToken === null) throw new Error('Unauthorized');
          if (nextSendFailure !== null) {
            const message = nextSendFailure;
            nextSendFailure = null;
            throw new Error(message);
          }

          chan.sent.push({ event, payload });
          return { success: true } as const;
        },
      };
      openChannels.set(topic, chan);
      constructedChannels.push(chan);
      return chan;
    },
    realtime: {
      isDisconnecting: () => socket.state === 'disconnecting',
      setAuth: async () => {
        opOrder.push('setAuth');
        socketToken = nextAuthToken;
      },
    },
    removeChannel: (chan: FakeChannel) => {
      chan.state = 'leaving';
      return new Promise<string>((resolve) => {
        leaveQueue.push(() => {
          chan.state = 'closed';
          openChannels.delete(chan.topic);
          // RealtimeClient.js:217 — `if (this.channels.length === 0) { this.disconnect(); }`
          if (socket.modelDisconnectWindow && openChannels.size === 0) {
            socket.state = 'disconnecting';
            setTimeout(() => {
              socket.state = 'connected';
            }, socket.windowMs);
          }
          resolve('ok');
        });
      });
    },
  },
  getPartnerId: vi.fn(),
  getSignedInUserId: vi.fn(),
}));

import { sendEphemeralBroadcast } from '@/api/ephemeralBroadcast';

const TOPIC = 'mood-updates:partner-1';

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Ack every queued leave until the queue stays empty.
 *
 * "Stays" is the load-bearing word. A send parked inside `waitForSocketReady`
 * wakes on its own poll tick, up to POLL_MS after the socket settles, so at the
 * instant the socket flips back to 'connected' there is a window in which both
 * queues are empty and yet a send is about to open a channel and queue another
 * leave. Breaking on a single quiet iteration returned before that send had
 * run, left its leave unacked, and the test then died on its 5s timeout —
 * which made this file fail 11 of 12 runs.
 */
const QUIET_ITERATIONS_REQUIRED = 6;

async function settle(): Promise<void> {
  let quiet = 0;

  for (let i = 0; i < 400; i++) {
    while (sendGate.length > 0) sendGate.shift()!();
    while (leaveQueue.length > 0) leaveQueue.shift()!();
    await new Promise((r) => setTimeout(r, 5));

    const idle = leaveQueue.length === 0 && sendGate.length === 0 && socket.state === 'connected';
    quiet = idle ? quiet + 1 : 0;
    if (quiet >= QUIET_ITERATIONS_REQUIRED) return;
  }

  // Falling off the end used to return normally, so a genuine hang looked like
  // a drained queue and surfaced later as a confusing assertion failure.
  throw new Error(
    `settle() never reached quiescence: leaveQueue=${leaveQueue.length} ` +
      `sendGate=${sendGate.length} socket=${socket.state}`
  );
}

describe('sendEphemeralBroadcast', () => {
  beforeEach(() => {
    openChannels = new Map();
    constructedChannels = [];
    leaveQueue = [];
    sendGate = [];
    gateSends = false;
    channelConfigs = [];
    opOrder = [];
    sendTimeouts = [];
    socketToken = 'valid-jwt';
    nextAuthToken = 'valid-jwt';
    nextSendFailure = null;
    nextSendFailureShape = null;
    hangNextSend = false;
    socket.state = 'connected';
    socket.windowMs = 40;
    socket.modelDisconnectWindow = true;
  });

  afterEach(async () => {
    // The queue lives on a module-level map; an unsettled send would park the
    // next test behind it.
    await settle();
    vi.clearAllMocks();
  });

  it('opens the topic as a private channel', async () => {
    const send = sendEphemeralBroadcast(TOPIC, 'new_mood', { id: 'mood-1' });
    await settle();
    await expect(send).resolves.toBeUndefined();

    // Without `private: true` the endpoint runs no policy check at all, and the
    // topic stays publishable by anyone holding the anon key.
    expect(channelConfigs).toEqual([{ config: { private: true } }]);
  });

  it('installs the caller JWT before sending, and claims the topic before either', async () => {
    const send = sendEphemeralBroadcast(TOPIC, 'new_mood', { id: 'mood-1' });
    await settle();
    await expect(send).resolves.toBeUndefined();

    // Sending first would present the anon key, on which anon holds no EXECUTE
    // for get_my_partner_id — so the INSERT policy would never be reached.
    expect(opOrder).toEqual(['setAuth', `httpSend:${TOPIC}`]);
    // And the claim still precedes both: `channel()` registers synchronously,
    // which is what stops another topic's teardown disconnecting the shared
    // socket underneath this send.
    expect(constructedChannels).toHaveLength(1);
  });

  it('hands the send its own timeout rather than racing a timer against it', async () => {
    const send = sendEphemeralBroadcast(TOPIC, 'new_mood', { id: 'mood-1' });
    await settle();
    await send;

    expect(sendTimeouts).toEqual([15_000]);
  });

  it('rejects, without a public fallback, when the session is gone mid-send', async () => {
    // notesSlice.sendNote treats this rejection as non-fatal: the note is
    // already saved, only the realtime hop failed.
    nextAuthToken = null;

    const send = sendEphemeralBroadcast(TOPIC, 'new_mood', { id: 'mood-1' });
    await settle();

    await expect(send).rejects.toThrow(/Unauthorized/);
    expect(constructedChannels[0].sent).toHaveLength(0);
    // Denied means denied — nothing retries the same send over a public topic.
    expect(channelConfigs).toEqual([{ config: { private: true } }]);
  });

  it('rejects a send that RESOLVES with the failure shape instead of throwing', async () => {
    nextSendFailureShape = { status: 403, error: 'Unauthorized' };

    const send = sendEphemeralBroadcast(TOPIC, 'new_mood', { id: 'mood-1' });
    await settle();

    // Treating a resolved `{ success: false }` as delivered would drop the
    // broadcast silently and tell the caller it had arrived.
    await expect(send).rejects.toThrow(/rejected \(403\): Unauthorized/);
    expect(constructedChannels[0].sent).toHaveLength(0);
  });

  it('delivers both of two overlapping sends to the same topic', async () => {
    const first = sendEphemeralBroadcast(TOPIC, 'new_mood', { id: 'mood-1' });
    const second = sendEphemeralBroadcast(TOPIC, 'new_mood', { id: 'mood-2' });

    await settle();
    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();

    // The defect: the second send was handed the first one's channel and the
    // partner never got mood-2.
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
    // Still queued: the topic is claimed until the client lets it go, so
    // opening now would just retrieve the dying channel.
    expect(constructedChannels).toHaveLength(1);

    leaveQueue.shift()!();
    await flush();

    // That leave removed the last open channel, so the socket is now
    // mid-disconnect. The second send claims the topic straight away — that is
    // deliberate, and it is what stops a send on a DIFFERENT topic being the
    // last channel out and disconnecting from under this one.
    expect(socket.state).toBe('disconnecting');
    expect(constructedChannels).toHaveLength(2);
    // A fresh object, not the dying one handed back by topic lookup.
    expect(constructedChannels[1]).not.toBe(constructedChannels[0]);

    gateSends = false;
    await settle();
    await Promise.all([first, second]);

    const delivered = constructedChannels.flatMap((c) => c.sent.map((s) => s.payload.id));
    expect(delivered).toEqual(['mood-1', 'mood-2']);
  });

  it('a send on another topic does not disconnect the socket under this one', async () => {
    // The queues are per-topic; the socket is global. So a send on
    // `love-notes:<partner>` can be mid-flight at the exact moment a send on
    // `mood-updates:<partner>` finishes its `finally` — and if that leave finds
    // an empty registry it disconnects the shared socket, which is what every
    // LIVE subscriber in the app is riding. Claiming the topic before waiting
    // is what prevents it: once this channel is in the registry, no other
    // teardown can be the last one out.
    gateSends = true;

    const other = sendEphemeralBroadcast('love-notes:partner-1', 'new_note', { id: 'note-1' });
    await flush();
    expect(constructedChannels).toHaveLength(1);

    sendGate.shift()!();
    await flush();
    // Its channel is leaving, and it is currently the only one registered.
    expect(leaveQueue).toHaveLength(1);

    // The interleaving that matters, forced rather than hoped for. The chain
    // runs openSendClose one microtask after this call, and this test's own
    // continuation was queued before that microtask queued its next — so the
    // ack below lands after the claim.
    const mine = sendEphemeralBroadcast(TOPIC, 'new_mood', { id: 'mood-1' });
    await Promise.resolve();
    leaveQueue.shift()!();
    await flush();

    // Claiming the topic before the wait is what makes this hold: the ack found
    // this channel already registered, so it was not the last one out and the
    // socket stayed up.
    expect(socket.state).toBe('connected');
    expect(constructedChannels).toHaveLength(2);

    gateSends = false;
    await settle();
    await Promise.all([other, mine]);

    // Both actually delivered.
    const delivered = constructedChannels.flatMap((c) => c.sent.map((s) => s.payload.id));
    expect(delivered).toEqual(['note-1', 'mood-1']);
  });

  it('a failed send does not strand the next one', async () => {
    nextSendFailure = 'Internal Server Error';

    const failing = sendEphemeralBroadcast(TOPIC, 'new_mood', { id: 'mood-1' });
    const following = sendEphemeralBroadcast(TOPIC, 'new_mood', { id: 'mood-2' });

    await settle();

    await expect(failing).rejects.toThrow(/Internal Server Error/);
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

  it('still delivers the second send after the first closed the last channel', async () => {
    // The queue's own teardown is what breaks it. `removeChannel` on the LAST
    // open channel calls disconnect(), and the socket sits in 'disconnecting'
    // for ~100ms. Two moods in one syncPendingMoods pass is enough, which is
    // the exact case this queue was added to fix.
    const first = sendEphemeralBroadcast(TOPIC, 'new_mood', { id: 'mood-1' });
    const second = sendEphemeralBroadcast(TOPIC, 'new_mood', { id: 'mood-2' });
    const third = sendEphemeralBroadcast(TOPIC, 'new_mood', { id: 'mood-3' });

    await settle();
    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();
    await expect(third).resolves.toBeUndefined();

    const delivered = constructedChannels.flatMap((c) => c.sent.map((s) => s.payload.id));
    expect(delivered).toEqual(['mood-1', 'mood-2', 'mood-3']);
    // None left stranded.
    expect(constructedChannels.every((c) => c.state === 'closed')).toBe(true);
  });

  it('rejects rather than hanging when the endpoint never answers', async () => {
    vi.useFakeTimers();
    try {
      hangNextSend = true;

      const stuck = sendEphemeralBroadcast(TOPIC, 'new_mood', { id: 'mood-1' });
      const assertion = expect(stuck).rejects.toThrow(/aborted due to timeout/);

      await vi.advanceTimersByTimeAsync(16_000);
      // The teardown's leave still needs acking for the promise to settle.
      while (leaveQueue.length > 0) leaveQueue.shift()!();
      await vi.advanceTimersByTimeAsync(0);

      await assertion;
    } finally {
      // The socket's "disconnecting -> connected" restore was scheduled under
      // fake timers and is discarded with them, so the socket would stay stuck
      // and afterEach's settle() would never reach quiescence.
      vi.useRealTimers();
      socket.state = 'connected';
    }
  });
});
