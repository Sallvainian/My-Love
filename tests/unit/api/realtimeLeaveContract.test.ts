/**
 * The SDK leave/close contract that both channel registries are built on.
 *
 * DW-109 filed a wedged-channel bug: "a phx_leave answered 'error' leaves the
 * channel stuck in `leaving`, yet removeChannel still resolves, so the
 * leave-wait clears and the reopen is handed a channel whose subscribe() is
 * gated shut." Measured against the installed SDK, that state is unreachable —
 * and the reason is one line of ordering inside phoenix:
 *
 *   @supabase/phoenix assets/js/phoenix/channel.js
 *     242:  this.state = CHANNEL_STATES.leaving
 *     250:  leavePush.send()
 *     251:  if(!this.canPush()){ leavePush.trigger("ok", {}) }
 *
 * `canPush()` is `this.socket.isConnected() && this.isJoined()` (`:188`) and
 * `isJoined()` is `this.state === CHANNEL_STATES.joined` (`:326`). Line 242 has
 * already moved the state to `leaving`, so line 251's check is ALWAYS true and
 * the leave completes locally, synchronously, before the server is heard from.
 * The server's answer — 'error', 'timeout' or silence — cannot change the
 * outcome, because nothing is waiting for it.
 *
 * `src/api/realtimeSocket.ts` states the same fact but scopes it to "with the
 * socket already gone". It is unconditional.
 *
 * These cases exist so that an SDK bump which reintroduces the wait turns this
 * file red, rather than silently reopening DW-109 inside two registries whose
 * comments would still claim it cannot happen. They pin the SDK, not our code,
 * which is why they assert against a bare `RealtimeClient` and mock nothing but
 * `setAuth` and the transport.
 *
 * Line numbers are the `dist/module` build; `dist/main` is the same code at
 * different offsets.
 */
import { RealtimeClient, type RealtimeChannel } from '@supabase/realtime-js';
import { beforeEach, describe, expect, it } from 'vitest';

const TOPIC = 'love-notes:00000000-0000-4000-8000-000000000000';
const REALTIME_TOPIC = `realtime:${TOPIC}`;

/** The slice of the WebSocket contract phoenix's `transportConnect` touches. */
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  url: string;
  // OPEN. `RealtimeClient.connect()` ends in `_handleNodeJsRaceCondition()`,
  // which calls `onConnOpen()` itself when readyState already reads OPEN, so
  // nothing here ever has to fire `onopen`.
  readyState = 1;
  binaryType = 'arraybuffer';
  bufferedAmount = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessage: ((event: unknown) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3;
    this.onclose?.({ code: 1000, reason: '', wasClean: true });
  }
}

interface Frame {
  joinRef: string | null;
  ref: string | null;
  topic: string;
  event: string;
}

/** Every frame the client put on the wire, oldest first. */
function frames(): Frame[] {
  return FakeWebSocket.instances
    .flatMap((socket) => socket.sent)
    .map((raw) => {
      const [joinRef, ref, topic, event] = JSON.parse(raw) as [
        string | null,
        string | null,
        string,
        string,
        unknown,
      ];
      return { joinRef, ref, topic, event };
    });
}

/** Deliver a server reply addressed to a frame the client sent. */
function answer(frame: Frame, status: string): void {
  const message = JSON.stringify([
    frame.joinRef,
    frame.ref,
    frame.topic,
    'phx_reply',
    { status, response: {} },
  ]);
  for (const socket of FakeWebSocket.instances) socket.onmessage?.({ data: message });
}

/** Deliver a server-initiated close of a topic the client did not ask to leave. */
function serverCloses(topic: string): void {
  const message = JSON.stringify([null, null, topic, 'phx_close', {}]);
  for (const socket of FakeWebSocket.instances) socket.onmessage?.({ data: message });
}

function newClient(): RealtimeClient {
  const client = new RealtimeClient('ws://localhost:54321/realtime/v1', {
    params: { apikey: 'test-anon-key' },
    // @ts-expect-error - the SDK types `transport` as the DOM WebSocket ctor.
    transport: FakeWebSocket,
    // Far enough out that no heartbeat fires inside a case.
    heartbeatIntervalMs: 1_000_000,
  });
  // The only stub: a real setAuth would read a Supabase session that does not
  // exist here. Every state machine below is the shipped one.
  client.setAuth = (async () => {}) as never;
  return client;
}

/** Open a channel and drive it to `joined`, recording every reported status. */
async function joinedChannel(
  client: RealtimeClient,
  topic = TOPIC
): Promise<{ channel: RealtimeChannel; statuses: string[] }> {
  const statuses: string[] = [];
  const channel = client.channel(topic);
  channel.subscribe((status) => {
    statuses.push(status);
  });
  await Promise.resolve();
  const join = frames().find((frame) => frame.event === 'phx_join');
  expect(join, 'the channel must have put a join on the wire').toBeDefined();
  answer(join as Frame, 'ok');
  await Promise.resolve();
  expect(statuses).toEqual(['SUBSCRIBED']);
  return { channel, statuses };
}

describe('the SDK leave/close contract the channel registries depend on', () => {
  beforeEach(() => {
    FakeWebSocket.instances.length = 0;
  });

  it('completes a leave the server never answers, rather than waiting on it', async () => {
    const client = newClient();
    const { channel } = await joinedChannel(client);

    // Deliberately no `answer(...)`. If the SDK ever starts waiting for the
    // server, this await is where it hangs and the case times out.
    const status = await client.removeChannel(channel);

    expect(status).toBe('ok');
    expect(channel.state).toBe('closed');
  });

  it('frees the topic on that unanswered leave, so the next open builds a fresh channel', async () => {
    const client = newClient();
    const { channel } = await joinedChannel(client);

    await client.removeChannel(channel);

    // Both halves matter. The registry entry is what `supabase.channel(topic)`
    // consults, and a channel left in it would be handed back with its join
    // gated shut by `RealtimeChannel.js:134`'s `isClosed()` check — the exact
    // symptom DW-109 describes.
    expect(client.getChannels()).not.toContain(channel);
    expect(client.channel(TOPIC)).not.toBe(channel);
  });

  it('reports CLOSED for a leave the app asked for', async () => {
    const client = newClient();
    const { channel, statuses } = await joinedChannel(client);

    await client.removeChannel(channel);

    // This is why CLOSED cannot be treated as "the connection dropped" on its
    // own: every deliberate teardown produces one, so a handler that retried on
    // CLOSED alone would reopen the channel it was just asked to release, on
    // every unmount.
    expect(statuses).toEqual(['SUBSCRIBED', 'CLOSED']);
  });

  it('reports the same CLOSED for a close the app did not ask for', async () => {
    const client = newClient();
    const { channel, statuses } = await joinedChannel(client);

    serverCloses(REALTIME_TOPIC);
    await Promise.resolve();

    // Indistinguishable from the deliberate case above by status alone, and the
    // SDK schedules no rejoin for it — so whether the topic goes permanently
    // silent is decided entirely by the caller's own bookkeeping (DW-110).
    expect(statuses).toEqual(['SUBSCRIBED', 'CLOSED']);
    expect(channel.state).toBe('closed');
    expect(client.getChannels()).not.toContain(channel);
  });

  it('never consults the server answer to a leave', async () => {
    const client = newClient();
    const { channel, statuses } = await joinedChannel(client);

    const leave = client.removeChannel(channel);
    const leaveFrame = frames().find((frame) => frame.event === 'phx_leave');
    expect(leaveFrame, 'the leave must have reached the wire').toBeDefined();

    // Settled BEFORE anything is delivered. This is the assertion; everything
    // below measures that the server's answer then changes nothing.
    await expect(leave).resolves.toBe('ok');
    expect(channel.state).toBe('closed');
    expect(client.getChannels()).not.toContain(channel);

    // Now answer it 'error', the case DW-109 was written about, and observe
    // that it is a no-op. The reply matches nothing: phoenix's local
    // `leavePush.trigger("ok", {})` already ran the push's reply handler, whose
    // first act is `cancelRefEvent()` (assets/js/phoenix/push.js:112-117), so
    // the binding `RealtimeChannel.js:610`'s `.receive('error', ...)` hangs off
    // is gone before the frame arrives.
    //
    // Asserting the no-op rather than presenting it as the exercise: an earlier
    // version of this case delivered the 'error' and asserted the resolution was
    // still 'ok', which reads as pinning "no rejection path" but cannot
    // discriminate it — the 'error' branch is unreachable in this scenario, so
    // an SDK that DID reject on it would have left that version green.
    answer(leaveFrame as Frame, 'error');
    await Promise.resolve();
    await Promise.resolve();

    await expect(leave).resolves.toBe('ok');
    expect(channel.state).toBe('closed');
    expect(statuses).toEqual(['SUBSCRIBED', 'CLOSED']);
  });
});
