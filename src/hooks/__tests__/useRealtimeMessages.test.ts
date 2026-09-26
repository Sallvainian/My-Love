// src/hooks/__tests__/useRealtimeMessages.test.ts
import type { RealtimeChannel } from '@supabase/supabase-js';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRealtimeMessages } from '../useRealtimeMessages';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PARTNER_ID = '22222222-2222-4222-8222-222222222222';
const OUTSIDER_ID = '33333333-3333-4333-8333-333333333333';

/**
 * Hoisted so the vi.mock factory below can reach them: the factory runs when
 * the hook first imports supabaseClient, which is before any `const` in this
 * file has been initialised.
 */
const mocks = vi.hoisted(() => ({
  getPartnerId: vi.fn(),
  setAuth: vi.fn(),
  /**
   * The leave. The hook records every teardown as
   * `removeChannel(...).catch(...)` in a per-topic registry and the next open
   * for that topic awaits it, so this has to be a promise a test can hold open
   * or reject on purpose.
   */
  removeChannel: vi.fn(),
  /**
   * The shared socket, as `waitForSocketReady` reads it. Removing the last
   * channel used to park the socket in `disconnecting` for ~100ms, and every
   * open inside that window silently never joins. On realtime-js 2.116.0 the
   * disconnect is deferred and reopening cancels it, so the window is no longer
   * reachable that way — see src/api/realtimeSocket.ts, which measures it. The
   * stub stays because `waitForSocketReady` still consults this on every open.
   */
  isDisconnecting: vi.fn(),
  /** Ordered record of the calls whose ORDER is load-bearing */
  order: [] as string[],
}));

// Mock Supabase
vi.mock('../../api/supabaseClient', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn((callback) => {
        mocks.order.push('subscribe');
        callback?.('SUBSCRIBED');
        return { unsubscribe: vi.fn() };
      }),
    })),
    // `async` so this always hands back a promise: the hook does
    // `removeChannel(...).catch(...)` and stores the result, and a bare
    // `undefined` would throw before the registry entry was ever written.
    removeChannel: vi.fn(async (...args: unknown[]) => mocks.removeChannel(...args)),
    realtime: {
      setAuth: (...args: unknown[]) => mocks.setAuth(...args),
      // Consulted by `waitForSocketReady`, which every open goes through.
      isDisconnecting: (...args: unknown[]) => mocks.isDisconnecting(...args),
    },
  },
  getPartnerId: (...args: unknown[]) => mocks.getPartnerId(...args),
  // The hook reads the snapshot through the retrying delivery lookup, which
  // wraps the same round-trip. Routing both names at one mock keeps every
  // existing `getPartnerId.mockResolvedValue(...)` and call-count assertion in
  // this file driving the behaviour it always drove; the retry itself is
  // covered in supabaseClient's own tests, against lookupPartnerId.
  resolvePartnerIdForDelivery: (...args: unknown[]) => mocks.getPartnerId(...args),
  // Derived from the same stub, so an id is `linked`, null is `unlinked`, and a
  // rejection is the inconclusive `error` the refresh must not write back.
  resolvePartnerLookupForDelivery: async (...args: unknown[]) => {
    try {
      const partnerId = await mocks.getPartnerId(...args);
      return partnerId ? { status: 'linked', partnerId } : { status: 'unlinked' };
    } catch (error) {
      return { status: 'error', reason: error instanceof Error ? error.message : String(error) };
    }
  },
}));

// Mock app store
const mockStoreState: Record<string, unknown> = {
  addNote: vi.fn(),
  userId: USER_ID,
};

vi.mock('../../stores/useAppStore', () => ({
  useAppStore: vi.fn((selector: (state: Record<string, unknown>) => unknown) => {
    return selector(mockStoreState);
  }),
}));

type SubscribeCallback = (status: string, err?: Error) => void;

/**
 * Fires a channel status through the hook's own subscribe callback. Asserts the
 * callback was registered first: an optional-chained call would silently do
 * nothing if the hook stopped subscribing, and the test would still pass.
 */
function emitStatus(
  callback: SubscribeCallback | null | undefined,
  ...args: [status: string, err?: Error]
) {
  expect(callback).toBeTypeOf('function');
  callback!(...args);
}

/** A well-formed note from the partner to this user, as the server row looks. */
function validNote(overrides: Record<string, unknown> = {}) {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    from_user_id: PARTNER_ID,
    to_user_id: USER_ID,
    content: 'Hello!',
    created_at: '2024-01-01T10:00:00Z',
    ...overrides,
  };
}

describe('useRealtimeMessages', () => {
  beforeEach(() => {
    // resetAllMocks, not clearAllMocks: it also restores each vi.fn(impl)
    // factory default — `supabase.channel` and the `useAppStore` selector — and
    // drops unconsumed *Once queues, so a test's override cannot reach the next.
    vi.resetAllMocks();
    mockStoreState.userId = USER_ID;
    mocks.order.length = 0;
    mocks.getPartnerId.mockResolvedValue(PARTNER_ID);
    mocks.removeChannel.mockResolvedValue('ok');
    mocks.isDisconnecting.mockReturnValue(false);
    mocks.setAuth.mockImplementation(async () => {
      mocks.order.push('setAuth');
    });
  });

  it('joins only the private love-notes topic for this user on mount', async () => {
    const { supabase } = await import('../../api/supabaseClient');

    renderHook(() => useRealtimeMessages());

    await waitFor(() => {
      // The second argument is the whole point: a public join to this topic is
      // open to anyone holding the anon key.
      expect(supabase.channel).toHaveBeenCalledWith(`love-notes:${USER_ID}`, {
        config: { private: true },
      });
    });
  });

  it('sets the Realtime auth token before subscribing', async () => {
    const { supabase } = await import('../../api/supabaseClient');

    renderHook(() => useRealtimeMessages());

    await waitFor(() => {
      expect(mocks.order).toContain('subscribe');
    });

    // Subscribing first would join with the anon key and the SELECT policy on
    // realtime.messages would reject it.
    expect(mocks.order.indexOf('setAuth')).toBeGreaterThanOrEqual(0);
    expect(mocks.order.indexOf('setAuth')).toBeLessThan(mocks.order.indexOf('subscribe'));
    expect(supabase.channel).toHaveBeenCalled();
  });

  /**
   * The channel a parked setup would have claimed, had it got that far.
   *
   * `supabase.channel()` registers synchronously and the SDK hands the topic
   * back to anyone who asks until its leave has landed, so a channel created
   * before the awaits and abandoned by a cleanup mid-flight is a private topic
   * the hook can no longer release — `channelRef.current` is null by then.
   * The hook therefore creates nothing until every await has returned and
   * `cancelled` has been re-checked, which is what the two cases below pin.
   */
  function parkedChannel() {
    return { on: vi.fn().mockReturnThis(), subscribe: vi.fn() };
  }

  it('creates no channel at all when unmounted during the partner lookup', async () => {
    const { supabase } = await import('../../api/supabaseClient');
    const mockChannel = parkedChannel();
    vi.mocked(supabase.channel).mockReturnValue(mockChannel as unknown as RealtimeChannel);

    let releasePartner: (id: string | null) => void = () => {};
    mocks.getPartnerId.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releasePartner = resolve;
        })
    );

    const { unmount } = renderHook(() => useRealtimeMessages());

    await waitFor(() => {
      expect(mocks.getPartnerId).toHaveBeenCalled();
    });
    // Same invariant as before, against the mechanism that replaced eager
    // creation: nothing is claimed while the setup is parked, so nothing is
    // subscribed either.
    expect(supabase.channel).not.toHaveBeenCalled();
    expect(mockChannel.subscribe).not.toHaveBeenCalled();

    unmount();
    // Nothing was ever claimed, so the cleanup has nothing to release.
    expect(supabase.removeChannel).not.toHaveBeenCalled();

    // Async act drains every continuation of the released lookup.
    await act(async () => {
      releasePartner(PARTNER_ID);
    });

    // The parked run resumes, sees `cancelled`, and stops before creating one.
    expect(supabase.channel).not.toHaveBeenCalled();
    expect(mockChannel.subscribe).not.toHaveBeenCalled();
  });

  it('waits out a leave still in flight before re-opening the topic', async () => {
    const { supabase } = await import('../../api/supabaseClient');
    const first = parkedChannel();
    const second = parkedChannel();
    vi.mocked(supabase.channel)
      .mockReturnValueOnce(first as unknown as RealtimeChannel)
      .mockReturnValue(second as unknown as RealtimeChannel);

    // The leave the cleanup records, held open on purpose.
    let settleLeave: () => void = () => {};
    mocks.removeChannel.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          settleLeave = resolve;
        })
    );

    // Fake timers for the whole case. `waitForSocketReady` polls on a 10ms
    // timer, so on wall-clock sleeps the negatives below would hold only by
    // being longer than the poll and could flip on a loaded machine.
    vi.useFakeTimers();
    try {
      let firstMount!: { unmount: () => void };
      await act(async () => {
        firstMount = renderHook(() => useRealtimeMessages());
        await vi.runOnlyPendingTimersAsync();
      });
      expect(first.subscribe).toHaveBeenCalled();

      firstMount.unmount();
      expect(supabase.removeChannel).toHaveBeenCalledWith(first);

      // A second mount resolves to the same `love-notes:<uid>` topic. Asking
      // the client for it now would just retrieve the object that is still
      // going away, whose subscribe() is gated shut.
      await act(async () => {
        renderHook(() => useRealtimeMessages());
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(supabase.channel).toHaveBeenCalledTimes(1);

      // The leave lands, but the socket is now mid-disconnect: opening inside
      // that window silently never joins. 500ms is half `waitForSocketReady`'s
      // own 1000ms upper bound, so it is unambiguously still parked.
      mocks.isDisconnecting.mockReturnValue(true);
      await act(async () => {
        settleLeave();
        await vi.advanceTimersByTimeAsync(500);
      });
      expect(supabase.channel).toHaveBeenCalledTimes(1);

      // Both gates clear, and only then is the replacement created and joined.
      mocks.isDisconnecting.mockReturnValue(false);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
      expect(supabase.channel).toHaveBeenCalledTimes(2);
      expect(second.subscribe).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('creates nothing when unmounted while parked on the socket check', async () => {
    const { supabase } = await import('../../api/supabaseClient');
    const first = parkedChannel();
    const second = parkedChannel();
    vi.mocked(supabase.channel)
      .mockReturnValueOnce(first as unknown as RealtimeChannel)
      .mockReturnValue(second as unknown as RealtimeChannel);

    vi.useFakeTimers();
    try {
      let firstMount!: { unmount: () => void };
      await act(async () => {
        firstMount = renderHook(() => useRealtimeMessages());
        await vi.runOnlyPendingTimersAsync();
      });
      expect(first.subscribe).toHaveBeenCalled();
      firstMount.unmount();

      // The socket is mid-disconnect, so the second mount's open runs the
      // partner lookup, setAuth and the leave wait and then parks in
      // `waitForSocketReady` — the last await before the channel exists.
      mocks.isDisconnecting.mockReturnValue(true);
      let secondMount!: { unmount: () => void };
      await act(async () => {
        secondMount = renderHook(() => useRealtimeMessages());
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(supabase.channel).toHaveBeenCalledTimes(1);

      // Unmounted while parked there; then the socket settles and the parked
      // open resumes.
      secondMount.unmount();
      mocks.isDisconnecting.mockReturnValue(false);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // It created and subscribed nothing. Without the `cancelled` re-check
      // after `waitForSocketReady` this joins a private channel for a
      // component that is gone, and `channelRef.current` is already null so no
      // cleanup can ever release it — the leave the NEXT mount waits on is
      // never recorded either, so it is handed the live object.
      expect(supabase.channel).toHaveBeenCalledTimes(1);
      expect(second.subscribe).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens the replacement even when the previous leave rejects', async () => {
    const { supabase } = await import('../../api/supabaseClient');
    const { logger } = await import('../../utils/logger');
    const first = parkedChannel();
    const second = parkedChannel();
    vi.mocked(supabase.channel)
      .mockReturnValueOnce(first as unknown as RealtimeChannel)
      .mockReturnValue(second as unknown as RealtimeChannel);

    // Defensive, and labelled as such. The real client cannot reach this:
    // `removeChannel` resolves 'ok' | 'timed out' | 'error' and has no
    // rejection path (pinned in tests/unit/api/realtimeLeaveContract.test.ts).
    // The case is kept because the `.catch()` it drives is what stops a future
    // SDK's rejection from propagating into an unrelated open — but it is not
    // evidence about any behaviour the installed SDK has.
    const leaveFailure = new Error('leave failed');
    mocks.removeChannel.mockRejectedValueOnce(leaveFailure);
    const debug = vi.spyOn(logger, 'debug');

    const firstMount = renderHook(() => useRealtimeMessages());
    await waitFor(() => {
      expect(first.subscribe).toHaveBeenCalled();
    });
    firstMount.unmount();

    renderHook(() => useRealtimeMessages());

    await waitFor(() => {
      expect(second.subscribe).toHaveBeenCalled();
    });
    expect(debug).toHaveBeenCalledWith(
      '[useRealtimeMessages] Love-notes channel leave failed:',
      leaveFailure
    );

    debug.mockRestore();
  });

  it('does not subscribe when unmounted during setAuth', async () => {
    const { supabase } = await import('../../api/supabaseClient');
    const mockChannel = parkedChannel();
    vi.mocked(supabase.channel).mockReturnValue(mockChannel as unknown as RealtimeChannel);

    let releaseAuth: () => void = () => {};
    mocks.setAuth.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseAuth = resolve;
        })
    );

    const { unmount } = renderHook(() => useRealtimeMessages());

    // The partner lookup resolves on its own; this run is parked on setAuth.
    await waitFor(() => {
      expect(mocks.setAuth).toHaveBeenCalled();
    });
    expect(mockChannel.subscribe).not.toHaveBeenCalled();

    unmount();

    await act(async () => {
      releaseAuth();
    });

    expect(mockChannel.subscribe).not.toHaveBeenCalled();
  });

  it('receives new notes broadcast on the love-notes topic', async () => {
    const mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn((callback) => {
        callback?.('SUBSCRIBED');
        return { unsubscribe: vi.fn() };
      }),
    };

    const { supabase } = await import('../../api/supabaseClient');
    vi.mocked(supabase.channel).mockReturnValue(mockChannel as unknown as RealtimeChannel);

    renderHook(() => useRealtimeMessages());

    await waitFor(() => {
      expect(mockChannel.on).toHaveBeenCalledWith(
        'broadcast',
        { event: 'new_message' },
        expect.any(Function)
      );
    });
  });

  it('releases the love-notes channel on unmount', async () => {
    const { supabase } = await import('../../api/supabaseClient');

    const { unmount } = renderHook(() => useRealtimeMessages());

    // Wait for subscription to be established
    await waitFor(() => {
      expect(supabase.channel).toHaveBeenCalled();
    });

    unmount();

    expect(supabase.removeChannel).toHaveBeenCalled();
  });

  // Both gates are synchronous, so fake timers run every pending step of the
  // open (including `waitForSocketReady`'s poll) without a wall-clock sleep,
  // and the positive control proves the same run would have subscribed.
  it('opens no channel while disabled, and one once enabled', async () => {
    const { supabase } = await import('../../api/supabaseClient');

    vi.useFakeTimers();
    try {
      let hook!: { rerender: (props: { enabled: boolean }) => void };
      const initialProps: { enabled: boolean } = { enabled: false };
      await act(async () => {
        hook = renderHook((props: { enabled: boolean }) => useRealtimeMessages(props), {
          initialProps,
        });
        await vi.runOnlyPendingTimersAsync();
      });

      expect(supabase.channel).not.toHaveBeenCalled();
      expect(mocks.setAuth).not.toHaveBeenCalled();

      // Positive control: enabling the same hook subscribes.
      await act(async () => {
        hook.rerender({ enabled: true });
        await vi.runOnlyPendingTimersAsync();
      });
      expect(supabase.channel).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('should not subscribe when user is not authenticated', async () => {
    const { supabase } = await import('../../api/supabaseClient');

    // Mock user not authenticated; the top-level beforeEach restores it.
    mockStoreState.userId = null;

    vi.useFakeTimers();
    try {
      let hook!: { rerender: () => void };
      await act(async () => {
        hook = renderHook(() => useRealtimeMessages());
        await vi.runOnlyPendingTimersAsync();
      });

      // Should not attempt to create a channel
      expect(supabase.channel).not.toHaveBeenCalled();
      expect(mocks.setAuth).not.toHaveBeenCalled();

      // Positive control: once signed in, the same hook subscribes.
      mockStoreState.userId = USER_ID;
      await act(async () => {
        hook.rerender();
        await vi.runOnlyPendingTimersAsync();
      });
      expect(supabase.channel).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  describe('Error Handling and Retry Logic', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should retry on CHANNEL_ERROR with exponential backoff', async () => {
      const { supabase } = await import('../../api/supabaseClient');

      let subscribeCallback: ((status: string, err?: Error) => void) | null = null;
      const mockSubscribe = vi.fn((callback?) => {
        // Only update callback if one is provided (retry calls subscribe without callback)
        if (callback) subscribeCallback = callback;
        return mockChannel; // Return the channel for chaining
      });

      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: mockSubscribe,
      };

      vi.mocked(supabase.channel).mockReturnValue(mockChannel as unknown as RealtimeChannel);

      await act(async () => {
        renderHook(() => useRealtimeMessages());
        await vi.runOnlyPendingTimersAsync();
      });

      expect(mockSubscribe).toHaveBeenCalledTimes(1);

      // Simulate CHANNEL_ERROR
      await act(async () => {
        emitStatus(subscribeCallback, 'CHANNEL_ERROR', new Error('Connection failed'));
      });

      // Should schedule retry after 1000ms (base delay)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(mockSubscribe).toHaveBeenCalledTimes(2);
    });

    it('should retry on TIMED_OUT', async () => {
      const { supabase } = await import('../../api/supabaseClient');

      let subscribeCallback: ((status: string, err?: Error) => void) | null = null;
      const mockSubscribe = vi.fn((callback?) => {
        if (callback) subscribeCallback = callback;
        return mockChannel;
      });

      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: mockSubscribe,
      };

      vi.mocked(supabase.channel).mockReturnValue(mockChannel as unknown as RealtimeChannel);

      await act(async () => {
        renderHook(() => useRealtimeMessages());
        await vi.runOnlyPendingTimersAsync();
      });

      // Simulate TIMED_OUT
      await act(async () => {
        emitStatus(subscribeCallback, 'TIMED_OUT');
      });

      // Should schedule retry
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(mockSubscribe).toHaveBeenCalledTimes(2);
    });

    it('should stop retrying after max retries (5)', async () => {
      const { supabase } = await import('../../api/supabaseClient');

      let subscribeCallback: ((status: string, err?: Error) => void) | null = null;
      const mockSubscribe = vi.fn((callback?) => {
        if (callback) subscribeCallback = callback;
        return mockChannel;
      });

      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: mockSubscribe,
      };

      vi.mocked(supabase.channel).mockReturnValue(mockChannel as unknown as RealtimeChannel);

      await act(async () => {
        renderHook(() => useRealtimeMessages());
        await vi.runOnlyPendingTimersAsync();
      });

      // Simulate 6 consecutive failures (initial + 5 retries)
      for (let i = 0; i < 6; i++) {
        await act(async () => {
          emitStatus(subscribeCallback, 'CHANNEL_ERROR', new Error('Connection failed'));
        });

        // Advance time for exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (capped)
        const delay = Math.min(1000 * 2 ** i, 30000);
        await act(async () => {
          await vi.advanceTimersByTimeAsync(delay + 100);
        });
      }

      // Should have made 6 attempts total (1 initial + 5 retries)
      // After max retries, no more attempts should be made
      expect(mockSubscribe).toHaveBeenCalledTimes(6);

      // The other two halves of giving up, now that a retry REPLACES the
      // channel rather than re-subscribing it. Each of the five retries
      // released exactly the channel it was replacing and created exactly one
      // replacement — 1 initial + 5 replacements = 6 channels, 5 leaves — and
      // the sixth failure created nothing.
      expect(supabase.channel).toHaveBeenCalledTimes(6);

      // SIX leaves, not five (DW-113). The sixth is the give-up itself handing
      // back the channel it is abandoning. Without it that channel stays in
      // `channelRef` and in the client's registry for the rest of the mount,
      // and because `RealtimeChannel.subscribe()` gates its whole join body on
      // the channel being closed, the topic is then unjoinable by ANY later
      // consumer — not just by this hook. Six is therefore the assertion that
      // giving up releases rather than leaks; five was the leak.
      expect(supabase.removeChannel).toHaveBeenCalledTimes(6);

      // And it STAYS given up: another CHANNEL_ERROR, and the longest backoff
      // the config allows, move none of the three counters. A give-up path that
      // still released or re-created a channel fails right here.
      await act(async () => {
        emitStatus(subscribeCallback, 'CHANNEL_ERROR', new Error('Connection failed'));
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30000);
      });

      expect(mockSubscribe).toHaveBeenCalledTimes(6);
      expect(supabase.channel).toHaveBeenCalledTimes(6);
      expect(supabase.removeChannel).toHaveBeenCalledTimes(6);
    });

    it('restarts the backoff at 1s after a successful rejoin', async () => {
      const { supabase } = await import('../../api/supabaseClient');

      let subscribeCallback: ((status: string, err?: Error) => void) | null = null;
      const mockSubscribe = vi.fn((callback?) => {
        if (callback) subscribeCallback = callback;
        return mockChannel;
      });

      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: mockSubscribe,
      };

      vi.mocked(supabase.channel).mockReturnValue(mockChannel as unknown as RealtimeChannel);

      await act(async () => {
        renderHook(() => useRealtimeMessages());
        await vi.runOnlyPendingTimersAsync();
      });

      // Simulate error then success
      await act(async () => {
        emitStatus(subscribeCallback, 'CHANNEL_ERROR');
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      // Now simulate successful subscription (2 subscribe calls now)
      await act(async () => {
        emitStatus(subscribeCallback, 'SUBSCRIBED');
      });

      // Simulate another error - retry count should be reset
      await act(async () => {
        emitStatus(subscribeCallback, 'CHANNEL_ERROR');
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000); // Should be 1s since retry count reset
      });

      // Should retry with base delay again (1s not 2s, proving counter was reset)
      // Count: initial(1) + retry after first error(2) + retry after second error(3)
      expect(mockSubscribe).toHaveBeenCalledTimes(3);
    });

    it('re-takes the partner snapshot on every SUBSCRIBED', async () => {
      const { supabase } = await import('../../api/supabaseClient');

      let subscribeCallback: ((status: string, err?: Error) => void) | null = null;
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn((callback?) => {
          if (callback) subscribeCallback = callback;
          return mockChannel;
        }),
      };

      vi.mocked(supabase.channel).mockReturnValue(mockChannel as unknown as RealtimeChannel);

      await act(async () => {
        renderHook(() => useRealtimeMessages());
        await vi.runOnlyPendingTimersAsync();
      });

      // One lookup before the join.
      expect(mocks.getPartnerId).toHaveBeenCalledTimes(1);

      // The join itself. Its snapshot is the one resolved just above, so this
      // must NOT re-fetch: clearing it here would drop every note arriving
      // during the replacement round-trip, and a note missed live is never
      // re-fetched -- nothing reloads on a realtime miss.
      await act(async () => {
        emitStatus(subscribeCallback, 'SUBSCRIBED');
        await vi.runOnlyPendingTimersAsync();
      });

      expect(mocks.getPartnerId).toHaveBeenCalledTimes(1);

      // A reconnect re-joins, and RLS is re-evaluated there; the relationship
      // may have changed while the channel was down.
      await act(async () => {
        emitStatus(subscribeCallback, 'SUBSCRIBED');
        await vi.runOnlyPendingTimersAsync();
      });

      expect(mocks.getPartnerId).toHaveBeenCalledTimes(2);
    });

    it('re-takes the snapshot on the first SUBSCRIBED when the pre-join lookup failed', async () => {
      // `resolvePartnerIdForDelivery` answers null for an exhausted retry as
      // readily as for a genuine unlink. Treating that null as a fresh snapshot
      // skipped the one refresh left -- a healthy socket emits no further
      // SUBSCRIBED and the CHANNEL_ERROR retry never fires on a working channel
      // -- so every note was dropped for the life of the mount.
      const { supabase } = await import('../../api/supabaseClient');

      let subscribeCallback: ((status: string, err?: Error) => void) | null = null;
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn((callback?) => {
          if (callback) subscribeCallback = callback;
          return mockChannel;
        }),
      };
      vi.mocked(supabase.channel).mockReturnValue(mockChannel as unknown as RealtimeChannel);

      // The pre-join lookup fails; the retry inside it is already exhausted.
      mocks.getPartnerId.mockResolvedValueOnce(null);

      await act(async () => {
        renderHook(() => useRealtimeMessages());
        await vi.runOnlyPendingTimersAsync();
      });

      expect(mocks.getPartnerId).toHaveBeenCalledTimes(1);

      await act(async () => {
        emitStatus(subscribeCallback, 'SUBSCRIBED');
        await vi.runOnlyPendingTimersAsync();
      });

      // It must try again rather than accept the failed null as a snapshot.
      expect(mocks.getPartnerId).toHaveBeenCalledTimes(2);
    });

    it('keeps the previous partner when a re-join refresh is inconclusive', async () => {
      // The refresh clears the ref BEFORE its round-trip, deliberately. So an
      // exhausted lookup that writes its null back leaves the ref null with
      // nothing to re-arm it, and every later note is dropped for the life of
      // the mount while the channel still reports healthy.
      const { supabase } = await import('../../api/supabaseClient');

      let subscribeCallback: ((status: string, err?: Error) => void) | null = null;
      let broadcastCallback: ((payload: unknown) => void) | null = null;
      const mockChannel = {
        on: vi.fn((type: string, options: { event?: string }, callback: (p: unknown) => void) => {
          if (type === 'broadcast' && options?.event === 'new_message') {
            broadcastCallback = callback;
          }
          return mockChannel;
        }),
        subscribe: vi.fn((callback?: (status: string, err?: Error) => void) => {
          if (callback) subscribeCallback = callback;
          return mockChannel;
        }),
      };
      vi.mocked(supabase.channel).mockReturnValue(mockChannel as unknown as RealtimeChannel);

      const onNewMessage = vi.fn();
      await act(async () => {
        renderHook(() => useRealtimeMessages({ onNewMessage }));
        await vi.runOnlyPendingTimersAsync();
      });

      // First SUBSCRIBED consumes the fresh pre-join snapshot without refetching.
      await act(async () => {
        emitStatus(subscribeCallback, 'SUBSCRIBED');
        await vi.runOnlyPendingTimersAsync();
      });

      // The socket drops and rejoins; every attempt of the refresh fails.
      mocks.getPartnerId.mockRejectedValueOnce(new Error('network down'));
      await act(async () => {
        emitStatus(subscribeCallback, 'SUBSCRIBED');
        await vi.runOnlyPendingTimersAsync();
      });

      // The partner the previous lookup resolved must still be in force.
      await act(async () => {
        broadcastCallback?.({ payload: { message: validNote() } });
      });
      expect(onNewMessage).toHaveBeenCalledTimes(1);
    });

    it('delivers a note that arrives immediately after the first SUBSCRIBED', async () => {
      // The user-visible half of the case above: a note the partner sends as
      // the Love Notes view opens. Re-taking the snapshot on the first join
      // nulls it for one PostgREST round-trip, and `parseLoveNoteBroadcast`
      // drops everything without a partner id -- so the note never reaches
      // `addNote` and never appears until the view is left and re-entered.
      const { supabase } = await import('../../api/supabaseClient');

      let subscribeCallback: ((status: string, err?: Error) => void) | null = null;
      let broadcastHandler: ((payload: unknown) => void) | null = null;
      const mockChannel = {
        on: vi.fn((_event: string, _filter: unknown, handler: (payload: unknown) => void) => {
          broadcastHandler = handler;
          return mockChannel;
        }),
        subscribe: vi.fn((callback?) => {
          if (callback) subscribeCallback = callback;
          return mockChannel;
        }),
      };

      vi.mocked(supabase.channel).mockReturnValue(mockChannel as unknown as RealtimeChannel);

      await act(async () => {
        renderHook(() => useRealtimeMessages());
        await vi.runOnlyPendingTimersAsync();
      });

      const addNote = mockStoreState.addNote as ReturnType<typeof vi.fn>;
      addNote.mockClear();

      const note = validNote();
      await act(async () => {
        emitStatus(subscribeCallback, 'SUBSCRIBED');
        // No timer flush between the join and the note: it lands in the very
        // window a first-join refresh would have opened.
        broadcastHandler?.({ payload: { message: note } });
      });

      expect(addNote).toHaveBeenCalledWith(note);
    });

    /**
     * Opens the feed, fails its first join with CHANNEL_ERROR and waits out the
     * 1s backoff, so exactly one retry has joined.
     */
    async function mountAndRetryOnce() {
      const { supabase } = await import('../../api/supabaseClient');

      // Every subscribe call's callback ARGUMENT, in call order — not a single
      // variable that keeps the previous one. RealtimeChannel wires the
      // callback it is handed into _onError/_onClose and the joinPush receives,
      // so a retry that passes none reports nothing; a fake that retains the
      // first callback reports anyway and hides exactly that.
      const subscribeCallbacks: Array<((status: string, err?: Error) => void) | undefined> = [];
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn((callback?) => {
          subscribeCallbacks.push(callback);
          mocks.order.push('subscribe');
          return mockChannel;
        }),
      };

      vi.mocked(supabase.channel).mockReturnValue(mockChannel as unknown as RealtimeChannel);

      await act(async () => {
        renderHook(() => useRealtimeMessages());
        await vi.runOnlyPendingTimersAsync();
      });

      await act(async () => {
        emitStatus(subscribeCallbacks[0], 'CHANNEL_ERROR');
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      return { subscribeCallbacks };
    }

    it('re-installs the Realtime token before every retry', async () => {
      await mountAndRetryOnce();

      // A retry is a re-join, and a private join is authorized against the
      // token on the socket. A retry scheduled because that token had gone
      // stale would otherwise re-join with the same stale token and be denied
      // again, five times over, before giving up.
      expect(mocks.order).toEqual(['setAuth', 'subscribe', 'setAuth', 'subscribe']);
    });

    it('hands the status callback to the retried join', async () => {
      const { subscribeCallbacks } = await mountAndRetryOnce();

      // The retry must hand the status callback back. Without it the rejoined
      // channel reports nothing, so neither the retry-count reset nor the
      // partner-snapshot refresh ever runs again.
      expect(subscribeCallbacks).toHaveLength(2);
      expect(subscribeCallbacks[1]).toBeTypeOf('function');
    });

    it('does not look the partner up again before the retried join', async () => {
      const { subscribeCallbacks } = await mountAndRetryOnce();

      // Premise: the retry really joined again, or a lookup count of one proves nothing.
      expect(subscribeCallbacks).toHaveLength(2);

      // The contract is that every re-join re-takes the snapshot on SUBSCRIBED,
      // so a pre-join lookup here would take it twice and null the ref for a
      // round-trip the join does not need.
      expect(mocks.getPartnerId).toHaveBeenCalledTimes(1);
    });

    it('re-takes the partner snapshot when the retried join reports SUBSCRIBED', async () => {
      const { subscribeCallbacks } = await mountAndRetryOnce();

      const partnerLookupsBefore = mocks.getPartnerId.mock.calls.length;
      await act(async () => {
        emitStatus(subscribeCallbacks[1], 'SUBSCRIBED');
        await vi.runOnlyPendingTimersAsync();
      });

      // Proof it actually reached handleStatus: only that path re-takes the
      // snapshot, and a stale snapshot is the staleness this refresh closes.
      expect(mocks.getPartnerId.mock.calls.length).toBe(partnerLookupsBefore + 1);
    });

    it('restarts the backoff after the retried join reports SUBSCRIBED', async () => {
      const { subscribeCallbacks } = await mountAndRetryOnce();

      await act(async () => {
        emitStatus(subscribeCallbacks[1], 'SUBSCRIBED');
        await vi.runOnlyPendingTimersAsync();
      });

      // The counter was reset, so the next failure starts the backoff over
      // rather than continuing toward the five-retry give-up.
      await act(async () => {
        emitStatus(subscribeCallbacks[1], 'CHANNEL_ERROR');
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(subscribeCallbacks).toHaveLength(3);
    });

    it('cancels the pending retry when the channel recovers inside the backoff', async () => {
      const { supabase } = await import('../../api/supabaseClient');

      let subscribeCallback: ((status: string, err?: Error) => void) | null = null;
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn((callback?: (status: string, err?: Error) => void) => {
          if (callback) subscribeCallback = callback;
        }),
      };
      vi.mocked(supabase.channel).mockReturnValue(mockChannel as unknown as RealtimeChannel);

      await act(async () => {
        renderHook(() => useRealtimeMessages());
        await vi.runOnlyPendingTimersAsync();
      });
      expect(mockChannel.subscribe).toHaveBeenCalledTimes(1);

      await act(async () => {
        emitStatus(subscribeCallback, 'CHANNEL_ERROR', new Error('Connection failed'));
      });

      // The SDK runs its own rejoin loop on an errored channel, so the channel
      // can come back on its own INSIDE our backoff window.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
        emitStatus(subscribeCallback, 'SUBSCRIBED');
        await vi.runOnlyPendingTimersAsync();
      });

      // Well past the 1000ms the retry was scheduled for.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      // The healthy channel was left alone: no leave, no replacement, no second
      // join. A stale timer firing here would tear a joined channel down and
      // rejoin with `snapshotFresh` false, nulling the partner snapshot for a
      // PostgREST round-trip during which every note is dropped.
      expect(supabase.removeChannel).not.toHaveBeenCalled();
      expect(supabase.channel).toHaveBeenCalledTimes(1);
      expect(mockChannel.subscribe).toHaveBeenCalledTimes(1);
    });

    it('keeps a channel that recovers after the retry has already started opening', async () => {
      const { supabase } = await import('../../api/supabaseClient');

      let subscribeCallback: ((status: string, err?: Error) => void) | null = null;
      const first = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn((callback?: (status: string, err?: Error) => void) => {
          if (callback) subscribeCallback = callback;
        }),
        // Read by the release step; the SDK's own rejoin loop moves it back to
        // `joined` below.
        state: 'errored',
      };
      const second = parkedChannel();
      vi.mocked(supabase.channel)
        .mockReturnValueOnce(first as unknown as RealtimeChannel)
        .mockReturnValue(second as unknown as RealtimeChannel);

      await act(async () => {
        renderHook(() => useRealtimeMessages());
        await vi.runOnlyPendingTimersAsync();
      });
      expect(first.subscribe).toHaveBeenCalledTimes(1);

      await act(async () => {
        emitStatus(subscribeCallback, 'CHANNEL_ERROR', new Error('Connection failed'));
      });

      // Park the retry inside its own setAuth. This is the window the
      // SUBSCRIBED branch's `clearTimeout` cannot cover: the timer has already
      // fired, so clearing it changes nothing and the open runs on regardless.
      let releaseAuth: () => void = () => {};
      mocks.setAuth.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseAuth = resolve;
          })
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(mocks.setAuth).toHaveBeenCalledTimes(2);

      // The SDK's rejoin lands while the retry is parked \u2014 its first attempt
      // is due at the same 1000ms this backoff was
      // (@supabase/phoenix assets/js/phoenix/socket.js:137).
      await act(async () => {
        first.state = 'joined';
        emitStatus(subscribeCallback, 'SUBSCRIBED');
        releaseAuth();
        await vi.runOnlyPendingTimersAsync();
      });

      // The parked retry resumed, saw a joined channel and dropped itself:
      // no leave, no replacement, no second join. Replacing it here would
      // drop every note until the replacement had joined, to serve a topic
      // that was already being served.
      expect(supabase.removeChannel).not.toHaveBeenCalled();
      expect(supabase.channel).toHaveBeenCalledTimes(1);
      expect(second.subscribe).not.toHaveBeenCalled();
    });

    it('waits out the retry\u2019s own leave before opening the replacement', async () => {
      const { supabase } = await import('../../api/supabaseClient');

      let subscribeCallback: ((status: string, err?: Error) => void) | null = null;
      const first = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn((callback?: (status: string, err?: Error) => void) => {
          if (callback) subscribeCallback = callback;
        }),
      };
      const second = parkedChannel();
      vi.mocked(supabase.channel)
        .mockReturnValueOnce(first as unknown as RealtimeChannel)
        .mockReturnValue(second as unknown as RealtimeChannel);

      // The leave the RETRY records — not a cleanup's — held open.
      let settleLeave: () => void = () => {};
      mocks.removeChannel.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            settleLeave = resolve;
          })
      );

      await act(async () => {
        renderHook(() => useRealtimeMessages());
        await vi.runOnlyPendingTimersAsync();
      });
      expect(supabase.channel).toHaveBeenCalledTimes(1);

      await act(async () => {
        emitStatus(subscribeCallback, 'CHANNEL_ERROR', new Error('Connection failed'));
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      // The retry let the failed channel go and is parked on that leave. Until
      // it lands the client still hands this topic back, so creating the
      // replacement now would join nothing — which is what a bare
      // `removeChannel(...)` outside the registry reintroduces every time the
      // retry fires against a channel that is `joined` rather than `errored`.
      expect(supabase.removeChannel).toHaveBeenCalledWith(first);
      expect(supabase.channel).toHaveBeenCalledTimes(1);
      expect(second.subscribe).not.toHaveBeenCalled();

      await act(async () => {
        settleLeave();
        await vi.advanceTimersByTimeAsync(10);
      });

      expect(supabase.channel).toHaveBeenCalledTimes(2);
      expect(second.subscribe).toHaveBeenCalled();
    });

    describe('when the retry token install rejects', () => {
      // A rejected token install must never escape as an unhandled rejection:
      // nothing in the hook is awaiting the retry, so an uncaught one would
      // take the page's error handler, not this call stack.
      let unhandled = vi.fn<(reason: unknown) => void>();
      let consoleError: ReturnType<typeof vi.spyOn>;

      beforeEach(() => {
        unhandled = vi.fn<(reason: unknown) => void>();
        process.on('unhandledRejection', unhandled);
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      });

      afterEach(() => {
        process.off('unhandledRejection', unhandled);
        consoleError.mockRestore();
      });

      /** Opens the feed; its first join lands normally. */
      async function mountFirstJoin() {
        const { supabase } = await import('../../api/supabaseClient');

        let subscribeCallback: ((status: string, err?: Error) => void) | null = null;
        const mockChannel = {
          on: vi.fn().mockReturnThis(),
          subscribe: vi.fn((callback?: (status: string, err?: Error) => void) => {
            if (callback) subscribeCallback = callback;
            return mockChannel;
          }),
        };
        vi.mocked(supabase.channel).mockReturnValue(mockChannel as unknown as RealtimeChannel);

        await act(async () => {
          renderHook(() => useRealtimeMessages());
          await vi.runOnlyPendingTimersAsync();
        });

        const emitError = () =>
          emitStatus(subscribeCallback, 'CHANNEL_ERROR', new Error('Connection failed'));
        return { supabase, mockChannel, emitError };
      }

      /** Fails the join, then fails the retry's token install as the backoff ends. */
      async function failRetryTokenInstall(emitError: () => void) {
        // The retry's setAuth is the one that fails — a refresh that could not
        // reach Supabase, say.
        const tokenFailure = new Error('token refresh failed');
        mocks.setAuth.mockRejectedValueOnce(tokenFailure);

        await act(async () => {
          emitError();
        });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });
        return tokenFailure;
      }

      async function mountThenFailRetryTokenInstall() {
        const joined = await mountFirstJoin();
        const tokenFailure = await failRetryTokenInstall(joined.emitError);
        return { ...joined, tokenFailure };
      }

      async function expectNoUnhandledRejection() {
        // Let any rejection Node was going to report reach its checkpoint.
        // Real timers for this last turn: vitest's fake timers stub
        // setImmediate too, so a faked one would never fire. Nothing is pending
        // by now — the hook has given up until the next CHANNEL_ERROR.
        vi.useRealTimers();
        await new Promise((resolve) => setImmediate(resolve));
        expect(unhandled).not.toHaveBeenCalled();
      }

      it('attempts no join and releases nothing when the retry token install rejects', async () => {
        const { supabase, mockChannel, emitError } = await mountFirstJoin();

        // The first join lands normally.
        expect(mockChannel.subscribe).toHaveBeenCalledTimes(1);
        expect(supabase.channel).toHaveBeenCalledTimes(1);

        await failRetryTokenInstall(emitError);

        // The token install rejected before any channel could be created, so
        // nothing joined.
        expect(supabase.channel).toHaveBeenCalledTimes(1);
        expect(mockChannel.subscribe).toHaveBeenCalledTimes(1);

        // And the failed channel was NOT released. Releasing it ahead of
        // setAuth would leave the hook holding no channel at all — nothing
        // left to report a status, so nothing to schedule another retry, and
        // the feed dead until the view is remounted.
        expect(supabase.removeChannel).not.toHaveBeenCalled();
      });

      it('logs a rejected retry token install instead of throwing it', async () => {
        const { tokenFailure } = await mountThenFailRetryTokenInstall();

        // Caught and logged rather than thrown.
        expect(consoleError).toHaveBeenCalledWith(
          '[useRealtimeMessages] Retry setup failed:',
          tokenFailure
        );
        await expectNoUnhandledRejection();
      });

      it('schedules no further attempt on its own after the token install rejects', async () => {
        const { supabase, mockChannel } = await mountThenFailRetryTokenInstall();

        // The channel stays closed: no later timer revives it on its own. Only
        // the next CHANNEL_ERROR — which a channel that never joined cannot
        // report — would schedule another attempt.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(30000);
        });
        expect(supabase.channel).toHaveBeenCalledTimes(1);
        expect(mockChannel.subscribe).toHaveBeenCalledTimes(1);
      });

      it('retries at the second backoff step on the next CHANNEL_ERROR', async () => {
        const { supabase, mockChannel, emitError } = await mountThenFailRetryTokenInstall();

        // The same idle 30s as above, so the timer sequence matches it.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(30000);
        });

        // Recovery is still possible, which is the point of holding the
        // channel: it is still there to report, and the next failure retries
        // normally — at 2000ms, the second step of the backoff, since the
        // attempt that failed still spent one of the five.
        await act(async () => {
          emitError();
        });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2000);
        });
        expect(supabase.removeChannel).toHaveBeenCalledTimes(1);
        expect(supabase.channel).toHaveBeenCalledTimes(2);
        expect(mockChannel.subscribe).toHaveBeenCalledTimes(2);
        await expectNoUnhandledRejection();
      });
    });

    it('does not retry after unmount', async () => {
      const { supabase } = await import('../../api/supabaseClient');

      let subscribeCallback: ((status: string, err?: Error) => void) | null = null;
      const mockSubscribe = vi.fn((callback?) => {
        if (callback) subscribeCallback = callback;
        return mockChannel;
      });

      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: mockSubscribe,
      };

      vi.mocked(supabase.channel).mockReturnValue(mockChannel as unknown as RealtimeChannel);

      let unmountFn: () => void;
      await act(async () => {
        const { unmount } = renderHook(() => useRealtimeMessages());
        unmountFn = unmount;
        await vi.runOnlyPendingTimersAsync();
      });

      // Trigger error to schedule retry
      await act(async () => {
        emitStatus(subscribeCallback, 'CHANNEL_ERROR');
      });

      // Unmount before retry timer fires
      unmountFn!();

      // Advance past the retry timer
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      // Should only have initial subscription, no retry after unmount
      expect(mockSubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('Message Handling', () => {
    /**
     * Mount the hook and hand back the broadcast handler the channel
     * registered, once the async setAuth/partner-lookup path has subscribed.
     */
    async function mountAndCaptureBroadcast(onNewMessage?: (m: unknown) => void) {
      const { supabase } = await import('../../api/supabaseClient');

      let broadcastCallback: ((payload: unknown) => void) | null = null;
      const mockChannel = {
        on: vi.fn((type, options, callback) => {
          if (type === 'broadcast' && options.event === 'new_message') {
            broadcastCallback = callback;
          }
          return mockChannel;
        }),
        subscribe: vi.fn((callback) => {
          callback?.('SUBSCRIBED');
          return { unsubscribe: vi.fn() };
        }),
      };

      vi.mocked(supabase.channel).mockReturnValue(mockChannel as unknown as RealtimeChannel);

      renderHook(() =>
        useRealtimeMessages(onNewMessage ? { onNewMessage: onNewMessage as never } : {})
      );

      // The partner snapshot has to have landed, or every broadcast is dropped
      // for want of an identity to check against — which is correct behaviour,
      // but not what these cases are about.
      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(broadcastCallback).not.toBeNull();
      });

      return (payload: unknown) => act(() => broadcastCallback?.(payload));
    }

    it('delivers a partner note to the thread and to the caller', async () => {
      const onNewMessage = vi.fn();
      const emit = await mountAndCaptureBroadcast(onNewMessage);

      const mockMessage = validNote();

      await emit({
        type: 'broadcast',
        event: 'new_message',
        payload: { message: mockMessage },
      });

      expect(onNewMessage).toHaveBeenCalledWith(mockMessage);
      expect(mockStoreState.addNote).toHaveBeenCalledWith(mockMessage);
    });

    it('strips a forged imagePreviewUrl rather than rendering it', async () => {
      const onNewMessage = vi.fn();
      const emit = await mountAndCaptureBroadcast(onNewMessage);

      await emit({
        payload: {
          message: validNote({ imagePreviewUrl: 'https://attacker.example/x.png' }),
        },
      });

      // LoveNoteMessage prefers imagePreviewUrl over the signed Storage URL and
      // puts it straight into an <img src>, so the field surviving the wire is
      // a request to the attacker's host.
      const stored = vi.mocked(mockStoreState.addNote as (n: unknown) => void).mock.calls[0][0];
      expect(stored).not.toHaveProperty('imagePreviewUrl');
      expect(onNewMessage).toHaveBeenCalledWith(expect.not.objectContaining({ imagePreviewUrl: expect.anything() }));
    });

    it('drops a note whose sender is not the partner', async () => {
      const onNewMessage = vi.fn();
      const emit = await mountAndCaptureBroadcast(onNewMessage);

      await emit({ payload: { message: validNote({ from_user_id: OUTSIDER_ID }) } });

      expect(mockStoreState.addNote).not.toHaveBeenCalled();
      expect(onNewMessage).not.toHaveBeenCalled();
    });

    it('drops a note addressed to somebody else', async () => {
      const onNewMessage = vi.fn();
      const emit = await mountAndCaptureBroadcast(onNewMessage);

      await emit({ payload: { message: validNote({ to_user_id: OUTSIDER_ID }) } });

      expect(mockStoreState.addNote).not.toHaveBeenCalled();
      expect(onNewMessage).not.toHaveBeenCalled();
    });

    it('drops a malformed or non-object payload without throwing', async () => {
      const onNewMessage = vi.fn();
      const emit = await mountAndCaptureBroadcast(onNewMessage);

      await emit({ payload: { message: { content: 'no id' } } });
      await emit({ payload: { message: 'not an object' } });
      await emit({ payload: null });
      await emit(undefined);

      expect(mockStoreState.addNote).not.toHaveBeenCalled();
      expect(onNewMessage).not.toHaveBeenCalled();
    });
  });

  describe('Closes it did not ask for, and giving up (DW-110, DW-113)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    /** The status callback the hook handed to a channel's `subscribe`. */
    function reporterFor(channel: { subscribe: ReturnType<typeof vi.fn> }) {
      return channel.subscribe.mock.calls[0]?.[0] as (status: string, err?: Error) => void;
    }

    it('reopens the topic when the server closes it under a live subscription', async () => {
      const { supabase } = await import('../../api/supabaseClient');
      const first = parkedChannel();
      const second = parkedChannel();
      vi.mocked(supabase.channel)
        .mockReturnValueOnce(first as unknown as RealtimeChannel)
        .mockReturnValue(second as unknown as RealtimeChannel);

      await act(async () => {
        renderHook(() => useRealtimeMessages());
        await vi.runOnlyPendingTimersAsync();
      });

      const report = reporterFor(first);
      await act(async () => {
        report('SUBSCRIBED');
      });

      // The close nobody asked for. The SDK schedules no rejoin of its own for
      // this — the channel goes to `closed` and leaves the client's registry —
      // so if the hook ignores it the feed is silent for the rest of the mount.
      await act(async () => {
        report('CLOSED');
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1100);
      });

      expect(second.subscribe).toHaveBeenCalled();
    });

    it('does not reopen the topic when the close is this hook\'s own teardown', async () => {
      const { supabase } = await import('../../api/supabaseClient');
      const first = parkedChannel();
      const second = parkedChannel();
      vi.mocked(supabase.channel)
        .mockReturnValueOnce(first as unknown as RealtimeChannel)
        .mockReturnValue(second as unknown as RealtimeChannel);

      const { unmount } = renderHook(() => useRealtimeMessages());
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
      const report = reporterFor(first);
      await act(async () => {
        report('SUBSCRIBED');
      });

      unmount();

      // Every deliberate leave produces a CLOSED, so this is the ordinary
      // unmount path, not an edge case. Answering it would have the hook
      // reopen a topic for a component that no longer exists — once per
      // unmount, forever.
      //
      // Honest about what this case is: a REGRESSION GUARD, not a mutant-killer.
      // Three independent mechanisms already stop it — `subscriptionActive`, the
      // `source` comparison, and `cancelled` inside `openChannel` — and deleting
      // any one of them, or all three of the first two, leaves this green. It
      // pins the composed invariant, so a future edit that moved the CLOSED
      // branch above the guards would fail here. It is not evidence that any
      // single guard is load-bearing, and it is listed as such in
      // verification.md rather than counted among the mutation results.
      await act(async () => {
        report('CLOSED');
        await vi.advanceTimersByTimeAsync(30000);
      });

      expect(supabase.channel).toHaveBeenCalledTimes(1);
      expect(second.subscribe).not.toHaveBeenCalled();
    });

    it('does not reopen the topic for a CLOSED from a channel the retry replaced', async () => {
      const { supabase } = await import('../../api/supabaseClient');
      const first = parkedChannel();
      const second = parkedChannel();
      const third = parkedChannel();
      vi.mocked(supabase.channel)
        .mockReturnValueOnce(first as unknown as RealtimeChannel)
        .mockReturnValueOnce(second as unknown as RealtimeChannel)
        .mockReturnValue(third as unknown as RealtimeChannel);

      await act(async () => {
        renderHook(() => useRealtimeMessages());
        await vi.runOnlyPendingTimersAsync();
      });

      // Drive one retry, so `first` has been released and `second` owns the topic.
      await act(async () => {
        reporterFor(first)('CHANNEL_ERROR', new Error('boom'));
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1100);
      });
      expect(second.subscribe).toHaveBeenCalled();

      // The released channel now reports its own close, late. It is not the
      // live channel any more, so it says nothing about the live feed — and
      // acting on it would tear down the healthy replacement that just joined.
      await act(async () => {
        reporterFor(first)('CLOSED');
        await vi.advanceTimersByTimeAsync(30000);
      });

      expect(supabase.channel).toHaveBeenCalledTimes(2);
      expect(third.subscribe).not.toHaveBeenCalled();
    });

    it('does not resurrect the topic when an open is in flight as the ceiling is hit', async () => {
      const { supabase } = await import('../../api/supabaseClient');
      const channels = Array.from({ length: 8 }, () => parkedChannel());
      let created = 0;
      vi.mocked(supabase.channel).mockImplementation(
        () => channels[created++] as unknown as RealtimeChannel
      );

      // Park the FIFTH retry's token install. `openChannel` awaits `setAuth`
      // before it releases anything, so `channelRef` still holds the old channel
      // while this is held open — which is the window the retry path's own
      // comment says the SDK's rejoin loop fires into.
      let releaseAuth: () => void = () => {};
      let authCalls = 0;
      mocks.setAuth.mockImplementation(async () => {
        authCalls += 1;
        if (authCalls === 6) {
          await new Promise<void>((resolve) => {
            releaseAuth = resolve;
          });
        }
      });

      let result: { current: { status: string } };
      await act(async () => {
        result = renderHook(() => useRealtimeMessages()).result as typeof result;
        await vi.runOnlyPendingTimersAsync();
      });

      // Four completed retries: 1 initial channel + 4 replacements.
      for (let attempt = 0; attempt < 4; attempt++) {
        await act(async () => {
          reporterFor(channels[attempt])('CHANNEL_ERROR', new Error('boom'));
        });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(Math.min(1000 * 2 ** attempt, 30000) + 100);
        });
      }
      expect(supabase.channel).toHaveBeenCalledTimes(5);

      // The fifth retry starts and parks on `setAuth`.
      await act(async () => {
        reporterFor(channels[4])('CHANNEL_ERROR', new Error('boom'));
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30000);
      });
      expect(authCalls).toBe(6);
      expect(supabase.channel).toHaveBeenCalledTimes(5);

      // The still-current old channel fails again from inside that window. The
      // ceiling is already at five, so this is the give-up.
      await act(async () => {
        reporterFor(channels[4])('CHANNEL_ERROR', new Error('boom'));
      });
      expect(result!.current.status).toBe('disconnected');

      // Now let the parked open resume. Without the give-up flag it walks on and
      // builds a sixth channel, leaving the banner reading "not receiving new
      // notes" while a channel is live — the type calls `disconnected` terminal,
      // so it has to be.
      await act(async () => {
        releaseAuth();
        await vi.advanceTimersByTimeAsync(30000);
      });

      expect(supabase.channel).toHaveBeenCalledTimes(5);
      expect(result!.current.status).toBe('disconnected');
    });

    it('reports the feed as connected, then reconnecting, then disconnected', async () => {
      const { supabase } = await import('../../api/supabaseClient');
      const channel = parkedChannel();
      vi.mocked(supabase.channel).mockReturnValue(channel as unknown as RealtimeChannel);

      let result: { current: { status: string } };
      await act(async () => {
        result = renderHook(() => useRealtimeMessages()).result as typeof result;
        await vi.runOnlyPendingTimersAsync();
      });

      await act(async () => {
        reporterFor(channel)('SUBSCRIBED');
      });
      expect(result!.current.status).toBe('connected');

      await act(async () => {
        reporterFor(channel)('CHANNEL_ERROR', new Error('boom'));
      });
      expect(result!.current.status).toBe('reconnecting');

      // Exhaust the ceiling. The terminal state is the whole point: the hook
      // stops trying here and nothing else in the app re-arms it, so a consumer
      // that cannot read this has no way to tell a working feed from a dead one.
      for (let attempt = 1; attempt <= 5; attempt++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(Math.min(1000 * 2 ** attempt, 30000) + 100);
        });
        await act(async () => {
          reporterFor(channel)('CHANNEL_ERROR', new Error('boom'));
        });
      }

      expect(result!.current.status).toBe('disconnected');
    });
  });

});
