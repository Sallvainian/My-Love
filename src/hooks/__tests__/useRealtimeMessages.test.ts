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
    removeChannel: vi.fn(),
    realtime: {
      setAuth: (...args: unknown[]) => mocks.setAuth(...args),
    },
  },
  getPartnerId: (...args: unknown[]) => mocks.getPartnerId(...args),
  // The hook reads the snapshot through the retrying delivery lookup, which
  // wraps the same round-trip. Routing both names at one mock keeps every
  // existing `getPartnerId.mockResolvedValue(...)` and call-count assertion in
  // this file driving the behaviour it always drove; the retry itself is
  // covered in supabaseClient's own tests, against lookupPartnerId.
  resolvePartnerIdForDelivery: (...args: unknown[]) => mocks.getPartnerId(...args),
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
    vi.clearAllMocks();
    mocks.order.length = 0;
    mocks.getPartnerId.mockResolvedValue(PARTNER_ID);
    mocks.setAuth.mockImplementation(async () => {
      mocks.order.push('setAuth');
    });
  });

  it('should subscribe to a PRIVATE broadcast channel on mount', async () => {
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
   * A channel that is claimed but never subscribed, with the async setup parked
   * mid-flight.
   *
   * `supabase.channel()` registers synchronously, so the cleanup can remove it;
   * `subscribe()` happens two awaits later, and by then the effect run may no
   * longer own it. A superseded run that subscribes anyway re-joins a private
   * topic the hook has already released, and no later cleanup can remove it —
   * `channelRef.current` is null by then.
   */
  function parkedChannel() {
    return { on: vi.fn().mockReturnThis(), subscribe: vi.fn() };
  }

  it('does not subscribe when unmounted during the partner lookup', async () => {
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
      expect(supabase.channel).toHaveBeenCalled();
    });
    expect(mockChannel.subscribe).not.toHaveBeenCalled();

    unmount();
    expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);

    await act(async () => {
      releasePartner(PARTNER_ID);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockChannel.subscribe).not.toHaveBeenCalled();
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
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockChannel.subscribe).not.toHaveBeenCalled();
  });

  it('should listen for broadcast new_message events', async () => {
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

  it('should unsubscribe on unmount', async () => {
    const { supabase } = await import('../../api/supabaseClient');

    const { unmount } = renderHook(() => useRealtimeMessages());

    // Wait for subscription to be established
    await waitFor(() => {
      expect(supabase.channel).toHaveBeenCalled();
    });

    unmount();

    expect(supabase.removeChannel).toHaveBeenCalled();
  });

  it('should not subscribe when enabled is false', async () => {
    const { supabase } = await import('../../api/supabaseClient');

    renderHook(() => useRealtimeMessages({ enabled: false }));

    // Wait a bit for any async operations
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(supabase.channel).not.toHaveBeenCalled();
  });

  it('should not subscribe when user is not authenticated', async () => {
    const { supabase } = await import('../../api/supabaseClient');

    // Mock user not authenticated
    const originalUserId = mockStoreState.userId;
    mockStoreState.userId = null;

    renderHook(() => useRealtimeMessages());

    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should not attempt to create a channel
    expect(supabase.channel).not.toHaveBeenCalled();

    // Restore
    mockStoreState.userId = originalUserId;
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
        subscribeCallback?.('CHANNEL_ERROR', new Error('Connection failed'));
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
        subscribeCallback?.('TIMED_OUT');
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
          subscribeCallback?.('CHANNEL_ERROR', new Error('Connection failed'));
        });

        // Advance time for exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (capped)
        const delay = Math.min(1000 * Math.pow(2, i), 30000);
        await act(async () => {
          await vi.advanceTimersByTimeAsync(delay + 100);
        });
      }

      // Should have made 6 attempts total (1 initial + 5 retries)
      // After max retries, no more attempts should be made
      expect(mockSubscribe).toHaveBeenCalledTimes(6);
    });

    it('should reset retry count on successful subscription', async () => {
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
        subscribeCallback?.('CHANNEL_ERROR');
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      // Now simulate successful subscription (2 subscribe calls now)
      await act(async () => {
        subscribeCallback?.('SUBSCRIBED');
      });

      // Simulate another error - retry count should be reset
      await act(async () => {
        subscribeCallback?.('CHANNEL_ERROR');
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
        subscribeCallback?.('SUBSCRIBED');
        await vi.runOnlyPendingTimersAsync();
      });

      expect(mocks.getPartnerId).toHaveBeenCalledTimes(1);

      // A reconnect re-joins, and RLS is re-evaluated there; the relationship
      // may have changed while the channel was down.
      await act(async () => {
        subscribeCallback?.('SUBSCRIBED');
        await vi.runOnlyPendingTimersAsync();
      });

      expect(mocks.getPartnerId).toHaveBeenCalledTimes(2);
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
        subscribeCallback?.('SUBSCRIBED');
        // No timer flush between the join and the note: it lands in the very
        // window a first-join refresh would have opened.
        broadcastHandler?.({ payload: { message: note } });
      });

      expect(addNote).toHaveBeenCalledWith(note);
    });

    it('re-installs the Realtime token before every retry', async () => {
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
        subscribeCallbacks[0]?.('CHANNEL_ERROR');
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      // A retry is a re-join, and a private join is authorized against the
      // token on the socket. A retry scheduled because that token had gone
      // stale would otherwise re-join with the same stale token and be denied
      // again, five times over, before giving up.
      expect(mocks.order).toEqual(['setAuth', 'subscribe', 'setAuth', 'subscribe']);

      // The retry must hand the status callback back. Without it the rejoined
      // channel reports nothing, so neither the retry-count reset nor the
      // partner-snapshot refresh below ever runs again.
      expect(subscribeCallbacks).toHaveLength(2);
      expect(subscribeCallbacks[1]).toBeTypeOf('function');

      const partnerLookupsBefore = mocks.getPartnerId.mock.calls.length;
      await act(async () => {
        subscribeCallbacks[1]?.('SUBSCRIBED');
        await vi.runOnlyPendingTimersAsync();
      });

      // Proof it actually reached handleStatus: only that path re-takes the
      // snapshot, and a stale snapshot is the staleness this refresh closes.
      expect(mocks.getPartnerId.mock.calls.length).toBe(partnerLookupsBefore + 1);

      // And the counter was reset, so the next failure starts the backoff over
      // rather than continuing toward the five-retry give-up.
      await act(async () => {
        subscribeCallbacks[1]?.('CHANNEL_ERROR');
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(subscribeCallbacks).toHaveLength(3);
    });

    it('should clear retry timeout on unmount', async () => {
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
        subscribeCallback?.('CHANNEL_ERROR');
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

    it('should call onNewMessage callback when message received', async () => {
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
});
