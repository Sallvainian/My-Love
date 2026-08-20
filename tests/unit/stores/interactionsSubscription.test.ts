import { beforeEach, describe, expect, it, vi } from 'vitest';
import { create, type StateCreator } from 'zustand';

const subscribeInteractions = vi.hoisted(() => vi.fn());

vi.mock('../../../src/api/interactionService', () => ({
  InteractionService: class {
    subscribeInteractions = subscribeInteractions;
  },
}));

import type {
  InteractionSubscriptionStatus,
  SupabaseInteractionRecord,
} from '../../../src/api/interactionService';
import {
  createInteractionsSlice,
  type InteractionsSlice,
} from '../../../src/stores/slices/interactionsSlice';

const USER_ID = 'USER-A-ID';

type TestStore = InteractionsSlice & { userId: string | null };

function createTestStore() {
  const store = create<TestStore>()(
    createInteractionsSlice as unknown as StateCreator<TestStore>
  );
  store.setState({ userId: USER_ID });
  return store;
}

describe('interactionsSlice subscription bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards every service status and keeps isSubscribed aligned through recovery', async () => {
    const serviceUnsubscribe = vi.fn();
    let reportInteraction: ((record: SupabaseInteractionRecord) => void) | undefined;
    let reportStatus: ((status: InteractionSubscriptionStatus) => void) | undefined;
    subscribeInteractions.mockImplementation(
      (
        _userId: string,
        onInteraction: (record: SupabaseInteractionRecord) => void,
        onStatusChange: (status: InteractionSubscriptionStatus) => void
      ) => {
        reportInteraction = onInteraction;
        reportStatus = onStatusChange;
        return Promise.resolve(serviceUnsubscribe);
      }
    );
    const store = createTestStore();
    const onStatusChange = vi.fn();

    const unsubscribe = await store.getState().subscribeToInteractions(onStatusChange);
    expect(store.getState().isSubscribed).toBe(false);

    reportStatus?.('SUBSCRIBED');
    expect(store.getState().isSubscribed).toBe(true);

    reportInteraction?.({
      id: 'incoming-1',
      type: 'poke',
      from_user_id: 'USER-B-ID',
      to_user_id: USER_ID,
      viewed: false,
      created_at: '2026-08-20T12:00:00.000Z',
    });
    expect(store.getState().interactions[0]).toMatchObject({
      id: 'incoming-1',
      type: 'poke',
      fromUserId: 'USER-B-ID',
      toUserId: USER_ID,
      viewed: false,
    });
    expect(store.getState().interactions[0].createdAt).toEqual(
      new Date('2026-08-20T12:00:00.000Z')
    );
    expect(store.getState().unviewedCount).toBe(1);

    reportStatus?.('CHANNEL_ERROR');
    expect(store.getState().isSubscribed).toBe(false);

    reportStatus?.('TIMED_OUT');
    expect(store.getState().isSubscribed).toBe(false);

    reportStatus?.('SUBSCRIBED');
    expect(store.getState().isSubscribed).toBe(true);
    expect(onStatusChange.mock.calls).toEqual([
      ['SUBSCRIBED'],
      ['CHANNEL_ERROR'],
      ['TIMED_OUT'],
      ['SUBSCRIBED'],
    ]);

    unsubscribe();
    expect(serviceUnsubscribe).toHaveBeenCalledTimes(1);
    expect(store.getState().isSubscribed).toBe(false);
  });

  it('ignores late statuses after teardown', async () => {
    let reportStatus: ((status: InteractionSubscriptionStatus) => void) | undefined;
    subscribeInteractions.mockImplementation(
      (
        _userId: string,
        _onInteraction: unknown,
        onStatusChange: (status: InteractionSubscriptionStatus) => void
      ) => {
        reportStatus = onStatusChange;
        return Promise.resolve(vi.fn());
      }
    );
    const store = createTestStore();
    const onStatusChange = vi.fn();
    const unsubscribe = await store.getState().subscribeToInteractions(onStatusChange);

    unsubscribe();
    reportStatus?.('SUBSCRIBED');

    expect(store.getState().isSubscribed).toBe(false);
    expect(onStatusChange).not.toHaveBeenCalled();
  });

  it("ignores an old account's status after the active user changes", async () => {
    let reportStatus: ((status: InteractionSubscriptionStatus) => void) | undefined;
    subscribeInteractions.mockImplementation(
      (
        _userId: string,
        _onInteraction: unknown,
        onStatusChange: (status: InteractionSubscriptionStatus) => void
      ) => {
        reportStatus = onStatusChange;
        return Promise.resolve(vi.fn());
      }
    );
    const store = createTestStore();
    const onStatusChange = vi.fn();
    await store.getState().subscribeToInteractions(onStatusChange);

    store.setState({ userId: 'USER-B-ID' });
    reportStatus?.('SUBSCRIBED');

    expect(store.getState().isSubscribed).toBe(false);
    expect(onStatusChange).not.toHaveBeenCalled();
  });
});
