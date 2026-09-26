// src/hooks/__tests__/useRealtimeMessages.closes.test.ts
import type { RealtimeChannel } from '@supabase/supabase-js';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
