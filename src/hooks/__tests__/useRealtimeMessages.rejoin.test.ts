// src/hooks/__tests__/useRealtimeMessages.rejoin.test.ts
/**
 * The CHANNEL_ERROR retry, against the SDK's own channel state machine.
 *
 * Every other spec in this folder hands the hook a hand-rolled channel whose
 * `subscribe()` always does something. The bug this file exists for is that the
 * REAL `subscribe()` frequently does nothing at all: RealtimeChannel gates its
 * entire join body on `this.channelAdapter.isClosed()` (@supabase/realtime-js
 * dist/module/RealtimeChannel.js:134), and a socket-level error leaves the channel
 * `errored` (@supabase/phoenix assets/js/phoenix/channel.js:75) — so
 * re-subscribing the same object after a CHANNEL_ERROR is a silent no-op that a
 * mock cannot reproduce.
 *
 * So the hook is driven here against a genuine `RealtimeClient`, wired to a
 * fake WebSocket transport (@supabase/realtime-js
 * dist/module/RealtimeClient.js:649 takes `options.transport`). Only
 * `realtime.setAuth` is stubbed; `channel`, `removeChannel` and the
 * channel/socket state machines are the shipped ones.
 *
 * Line numbers are the `dist/module` build; `dist/main` is the same code at
 * different offsets.
 */
import { RealtimeClient, type RealtimeChannel } from '@supabase/supabase-js';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRealtimeMessages } from '../useRealtimeMessages';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PARTNER_ID = '22222222-2222-4222-8222-222222222222';
const TOPIC = `love-notes:${USER_ID}`;

/** The slice of the WebSocket contract phoenix's `transportConnect` touches. */
interface FakeSocket {
  url: string;
  readyState: number;
  binaryType: string;
  bufferedAmount: number;
  /** Every frame handed to the transport, oldest first, as `send` recorded it. */
  sent: string[];
  send: (data: string) => void;
  onopen: (() => void) | null;
  onerror: ((event: unknown) => void) | null;
  onmessage: ((event: unknown) => void) | null;
  onclose: ((event: unknown) => void) | null;
  close: () => void;
}

const harness = vi.hoisted(() => {
  const sockets: FakeSocket[] = [];

  /**
   * Opens instantly rather than on a fired `onopen`: `RealtimeClient.connect()`
   * finishes with `_handleNodeJsRaceCondition()` (@supabase/realtime-js
   * dist/module/RealtimeClient.js:569-574), which calls `onConnOpen()` itself
   * when `readyState` already reads OPEN. Nothing is ever written to a server,
   * so `send` only records — and those recordings are the wire evidence the
   * assertions below read.
   */
  class FakeWebSocket implements FakeSocket {
    url: string;
    readyState = 1; // OPEN
    binaryType = 'arraybuffer';
    bufferedAmount = 0;
    sent: string[] = [];
    onopen: (() => void) | null = null;
    onerror: ((event: unknown) => void) | null = null;
    onmessage: ((event: unknown) => void) | null = null;
    onclose: ((event: unknown) => void) | null = null;

    constructor(url: string) {
      this.url = url;
      sockets.push(this);
    }

    send(data: string): void {
      this.sent.push(data);
    }

    close(): void {
      this.readyState = 3; // CLOSED
      this.onclose?.({ code: 1000, reason: '', wasClean: true });
    }
  }

  return {
    sockets,
    FakeWebSocket,
    /** Every channel the hook asked the client for, in order. */
    opened: [] as RealtimeChannel[],
    client: null as RealtimeClient | null,
    setAuth: vi.fn(async () => {}),
    getPartnerId: vi.fn(async () => PARTNER_ID as string | null),
  };
});

vi.mock('../../api/supabaseClient', () => {
  const client = new RealtimeClient('ws://localhost:54321/realtime/v1', {
    params: { apikey: 'test-anon-key' },
    // @ts-expect-error - the SDK types `transport` as the DOM WebSocket ctor.
    transport: harness.FakeWebSocket,
    // Far enough out that no heartbeat fires inside a 1s backoff window.
    heartbeatIntervalMs: 1_000_000,
  });

  // The ONLY stub. A real setAuth would read a Supabase session that does not
  // exist here; everything else about the join is the shipped state machine.
  client.setAuth = harness.setAuth;
  harness.client = client;

  return {
    supabase: {
      channel: (topic: string, params?: Record<string, unknown>) => {
        const channel = client.channel(topic, params as never);
        harness.opened.push(channel);
        return channel;
      },
      removeChannel: (channel: RealtimeChannel) => client.removeChannel(channel),
      realtime: client,
    },
    resolvePartnerIdForDelivery: () => harness.getPartnerId(),
    resolvePartnerLookupForDelivery: async () => {
      const partnerId = await harness.getPartnerId();
      return partnerId ? { status: 'linked', partnerId } : { status: 'unlinked' };
    },
  };
});

const mockStoreState: Record<string, unknown> = {
  addNote: vi.fn(),
  userId: USER_ID,
};

vi.mock('../../stores/useAppStore', () => ({
  useAppStore: vi.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector(mockStoreState)
  ),
}));

/** The live channel the client currently holds for the love-notes topic. */
function registeredChannel(): RealtimeChannel | undefined {
  return harness.client?.getChannels().find((c) => c.topic === `realtime:${TOPIC}`);
}

/**
 * The frames this topic actually put on the wire, oldest first.
 *
 * The v2 serializer encodes each as `[join_ref, ref, topic, event, payload]`,
 * so the event name is what says whether a join was really sent — the symptom
 * the gated `subscribe()` suppresses.
 */
function topicFrames(): Array<{ joinRef: string | null; ref: string | null; event: string }> {
  return harness.sockets
    .flatMap((socket) => socket.sent)
    .map((raw) => JSON.parse(raw) as [string | null, string | null, string, string, unknown])
    .filter(([, , topic]) => topic === `realtime:${TOPIC}`)
    .map(([joinRef, ref, , event]) => ({ joinRef, ref, event }));
}

describe('useRealtimeMessages — rejoin after a real CHANNEL_ERROR', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    harness.opened.length = 0;
    harness.sockets.length = 0;
    harness.setAuth.mockClear();
    harness.getPartnerId.mockClear();
  });

  afterEach(async () => {
    // Drain anything the hook scheduled before handing the timers back, so a
    // leave in flight never crosses into another test's registry entry.
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    vi.useRealTimers();
  });

  it('replaces the errored channel with a new one that actually joins', async () => {
    let unmount: () => void = () => {};
    await act(async () => {
      ({ unmount } = renderHook(() => useRealtimeMessages()));
      await vi.runOnlyPendingTimersAsync();
    });

    // The first join: one channel, registered with the client and joining.
    expect(harness.opened).toHaveLength(1);
    const first = harness.opened[0];
    expect(first.state).toBe('joining');
    expect(registeredChannel()).toBe(first);

    // A genuine transport error, not a hand-fired status string: phoenix's
    // `onConnError` -> `triggerChanError` -> `channel.trigger(phx_error)` is
    // what sets `state = errored` AND reaches the hook's status callback.
    expect(harness.sockets).toHaveLength(1);

    // Exactly one join went out for this topic so far.
    expect(topicFrames().filter((frame) => frame.event === 'phx_join')).toHaveLength(1);

    await act(async () => {
      harness.sockets[0].onerror?.(new Error('transport blew up'));
    });
    expect(first.state).toBe('errored');

    // The backoff elapses.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // A DIFFERENT channel object now serves the topic. Re-subscribing `first`
    // could not have produced this: `subscribe()` returns without sending a
    // join whenever the channel is not closed, so before this fix the topic was
    // served by the same errored object for the life of the page.
    expect(harness.opened).toHaveLength(2);
    const second = harness.opened[1];
    expect(second).not.toBe(first);
    expect(['joining', 'joined']).toContain(second.state);

    // And the errored one was handed back to the client, not left registered.
    expect(registeredChannel()).toBe(second);
    expect(harness.client?.getChannels()).not.toContain(first);

    // The token was re-installed ahead of the re-join, as on the first one.
    expect(harness.setAuth).toHaveBeenCalledTimes(2);

    // And the partner was NOT re-resolved ahead of it. A re-join re-takes the
    // snapshot on its SUBSCRIBED, never before the join, so the only lookup in
    // this whole sequence is the first open's. Asserted here rather than only
    // against the hand-rolled mock because this is the file where the retry
    // really is a fresh join.
    expect(harness.getPartnerId).toHaveBeenCalledTimes(1);

    // And the wire says so. The assertion keys on ORDER, not on a count: the
    // SDK's own rejoin loop also fires a `phx_join` for the errored channel
    // inside this same backoff window, so a bare "one more join arrived" would
    // pass against the unfixed hook too. Only the fix sends a `phx_leave` —
    // handing the topic back — and only the fix can then put a join behind it.
    const sequence = topicFrames().map((frame) => frame.event);
    const leaveAt = sequence.indexOf('phx_leave');
    expect(leaveAt).toBeGreaterThanOrEqual(0);
    expect(sequence.slice(leaveAt + 1)).toContain('phx_join');

    // That trailing join is the replacement's, not a resend of the errored
    // channel's: its join_ref matches no frame sent before the leave.
    const trailingJoin = topicFrames()
      .slice(leaveAt + 1)
      .find((frame) => frame.event === 'phx_join');
    const refsBeforeLeave = new Set(topicFrames().slice(0, leaveAt + 1).map((f) => f.joinRef));
    expect(refsBeforeLeave.has(trailingJoin!.joinRef)).toBe(false);

    unmount();
  });
});
