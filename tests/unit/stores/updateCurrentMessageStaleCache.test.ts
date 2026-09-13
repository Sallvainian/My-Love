/**
 * A remembered message id that no longer belongs to the signed-in account must
 * not strand Home
 *
 * `messageHistory.shownMessages` is persisted (useAppStore `partialize`) and
 * `messages` is not, so the two can disagree across a reload. Account scoping
 * made that disagreement reachable: a custom row that used to be visible to
 * everyone is now visible only to its owner.
 *
 * The path that produces it is a no-session boot. `App.tsx` calls `clearAuth()`
 * the moment `getSession()` comes back empty, and `initializeApp` is gated on a
 * session, so the pool is still empty when the sign-out prune in `authSlice`
 * runs — its `strippedIds` set is built FROM that pool, so it strips nothing and
 * the previous account's id for today survives in the map. The next partner to
 * sign in on that device loads their own scoped pool, and the lookup misses.
 *
 * Asserting `currentMessage` is non-null is not enough on its own: it would also
 * pass if the rotation happened to return the stale id. Each test therefore
 * pins the resolved message to the pool actually in the store.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../src/api/supabaseClient', () => ({
  supabase: { from: vi.fn(), auth: {}, channel: vi.fn(), removeChannel: vi.fn() },
  getPartnerId: vi.fn(),
}));

import { useAppStore } from '../../../src/stores/useAppStore';
import { formatDateISO } from '../../../src/utils/dateUtils';

type Message = ReturnType<typeof useAppStore.getState>['messages'][number];

const message = (id: number, text: string, isCustom = false): Message =>
  ({
    id,
    text,
    category: 'sweet',
    isCustom,
    active: true,
    isFavorite: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    tags: [],
  }) as unknown as Message;

const TODAY = formatDateISO(new Date());

const seed = (messages: Message[], shownMessages: Map<string, number>) => {
  useAppStore.setState({
    messages,
    currentMessage: null,
    messageHistory: {
      ...useAppStore.getState().messageHistory,
      shownMessages,
      currentIndex: 0,
    },
  } as unknown as Parameters<typeof useAppStore.setState>[0]);
};

describe('updateCurrentMessage with a stale cached id', () => {
  beforeEach(() => {
    seed([], new Map());
  });

  it('recomputes when the cached id is absent from the signed-in pool', () => {
    // 9001 is the previous account's custom row: remembered for today, but not
    // in this account's pool.
    const pool = [message(1, 'INCOMING-ACCOUNT-A'), message(2, 'INCOMING-ACCOUNT-B')];
    seed(pool, new Map([[TODAY, 9001]]));

    useAppStore.getState().updateCurrentMessage();

    const { currentMessage, messageHistory } = useAppStore.getState();
    expect(currentMessage).toBeDefined();
    expect(pool.map((m) => m.id)).toContain(currentMessage?.id);
    // The corrected id is written back, so the next reload is a hit rather than
    // a second recompute.
    expect(messageHistory.shownMessages.get(TODAY)).toBe(currentMessage?.id);
    expect(messageHistory.shownMessages.get(TODAY)).not.toBe(9001);
  });

  it('still honours a cached id that IS in the pool', () => {
    // The cache has to keep working, or today's message changes on every reload.
    const pool = [message(1, 'ONE'), message(2, 'TWO'), message(3, 'THREE')];
    seed(pool, new Map([[TODAY, 3]]));

    useAppStore.getState().updateCurrentMessage();

    const { currentMessage, messageHistory } = useAppStore.getState();
    expect(currentMessage?.id).toBe(3);
    expect(messageHistory.shownMessages.get(TODAY)).toBe(3);
  });
});
