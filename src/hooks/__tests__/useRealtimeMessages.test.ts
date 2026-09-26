// src/hooks/__tests__/useRealtimeMessages.test.ts
import type { RealtimeChannel } from '@supabase/supabase-js';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRealtimeMessages } from '../useRealtimeMessages';
import { PARTNER_ID, USER_ID, parkedChannel } from './realtimeMessagesKit';

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
});
