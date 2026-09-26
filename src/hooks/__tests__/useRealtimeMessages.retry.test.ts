// src/hooks/__tests__/useRealtimeMessages.retry.test.ts
import type { RealtimeChannel } from '@supabase/supabase-js';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRealtimeMessages } from '../useRealtimeMessages';
import { PARTNER_ID, USER_ID, emitStatus, validNote } from './realtimeMessagesKit';

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
  });
});
