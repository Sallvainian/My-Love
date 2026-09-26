// src/hooks/__tests__/useRealtimeMessages.retriedJoin.test.ts
import type { RealtimeChannel } from '@supabase/supabase-js';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRealtimeMessages } from '../useRealtimeMessages';
import { PARTNER_ID, USER_ID, emitStatus, parkedChannel } from './realtimeMessagesKit';

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
});
