// src/hooks/__tests__/useRealtimeMessages.messages.test.ts
import type { RealtimeChannel } from '@supabase/supabase-js';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRealtimeMessages } from '../useRealtimeMessages';
import { OUTSIDER_ID, PARTNER_ID, USER_ID, validNote } from './realtimeMessagesKit';

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
    mockStoreState.partner = null;
    mocks.order.length = 0;
    mocks.getPartnerId.mockResolvedValue(PARTNER_ID);
    mocks.removeChannel.mockResolvedValue('ok');
    mocks.isDisconnecting.mockReturnValue(false);
    mocks.setAuth.mockImplementation(async () => {
      mocks.order.push('setAuth');
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

  describe('a partner linked while the chat is open', () => {
    async function mountUnlinked() {
      const { supabase } = await import('../../api/supabaseClient');
      let broadcastCallback: ((payload: unknown) => void) | null = null;
      const mockChannel = {
        on: vi.fn((type, options, callback) => {
          if (type === 'broadcast' && options.event === 'new_message') broadcastCallback = callback;
          return mockChannel;
        }),
        subscribe: vi.fn((callback) => {
          callback?.('SUBSCRIBED');
          return { unsubscribe: vi.fn() };
        }),
      };
      vi.mocked(supabase.channel).mockReturnValue(mockChannel as unknown as RealtimeChannel);

      // Unlinked at mount: the store has no partner and the lookup says so.
      mockStoreState.partner = null;
      mocks.getPartnerId.mockResolvedValue(null);
      const hook = renderHook(() => useRealtimeMessages());
      await waitFor(() => expect(broadcastCallback).not.toBeNull());
      // The first join's own lookups (before the join, and on its SUBSCRIBED).
      await waitFor(() => expect(mocks.getPartnerId).toHaveBeenCalledTimes(2));
      await act(async () => {});
      const emit = (payload: unknown) => act(() => broadcastCallback?.(payload));
      return { ...hook, emit };
    }

    it('drops the new partner\'s notes until the store learns of the link, then delivers them', async () => {
      const { rerender, emit } = await mountUnlinked();

      // Linked on the server, but nothing has told this chat yet.
      mocks.getPartnerId.mockResolvedValue(PARTNER_ID);
      await emit({ payload: { message: validNote({ id: '55555555-5555-4555-8555-555555555551' }) } });
      expect(mockStoreState.addNote).not.toHaveBeenCalled();

      // The store's partner changes (the accept here, or the partner-linked
      // broadcast on the sender): the snapshot is re-taken without a re-join.
      mockStoreState.partner = { id: PARTNER_ID };
      rerender();
      await waitFor(() => expect(mocks.getPartnerId).toHaveBeenCalledTimes(3));
      await act(async () => {});

      await emit({ payload: { message: validNote() } });
      expect(mockStoreState.addNote).toHaveBeenCalledWith(validNote());
    });

    it('does not re-read when the store settles on the partner the join already resolved', async () => {
      const { supabase } = await import('../../api/supabaseClient');
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn((callback) => {
          callback?.('SUBSCRIBED');
          return { unsubscribe: vi.fn() };
        }),
      };
      vi.mocked(supabase.channel).mockReturnValue(mockChannel as unknown as RealtimeChannel);
      mockStoreState.partner = null;
      const { rerender } = renderHook(() => useRealtimeMessages());
      await waitFor(() => expect(mockChannel.subscribe).toHaveBeenCalled());
      await act(async () => {});
      const lookups = mocks.getPartnerId.mock.calls.length;

      // The saved partner lands in the store after the join resolved the same one.
      mockStoreState.partner = { id: PARTNER_ID };
      rerender();
      await act(async () => {});

      expect(mocks.getPartnerId).toHaveBeenCalledTimes(lookups);
    });
  });
});
