import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
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
  OWNER_STORAGE_KEY,
  VAULT_STORAGE_KEY,
} from '../../../src/services/anniversaryVault';
import { createAuthSlice, type AuthSlice } from '../../../src/stores/slices/authSlice';
import {
  createInteractionsSlice,
  type InteractionsSlice,
} from '../../../src/stores/slices/interactionsSlice';
import type { AppState, AppStateCreator } from '../../../src/stores/types';

const USER_ID = 'USER-A-ID';
const OTHER_USER_ID = 'USER-B-ID';

type TestStore = InteractionsSlice & AuthSlice & Pick<AppState, 'notes' | 'settings'>;

interface CapturedSubscription {
  userId: string;
  reportInteraction: (record: SupabaseInteractionRecord) => void;
  reportStatus: (status: InteractionSubscriptionStatus) => void;
  unsubscribe: Mock<() => void>;
}

const subscriptions: CapturedSubscription[] = [];

function createTestStore() {
  const createSlices: AppStateCreator<TestStore> = (...args) => ({
    ...createAuthSlice(...args),
    ...createInteractionsSlice(...args),
    notes: [],
    settings: null,
  });
  const store = create<TestStore>()(createSlices as unknown as StateCreator<TestStore>);
  store.getState().setAuthUser(USER_ID);
  return store;
}

function interaction(
  id: string,
  overrides: Partial<SupabaseInteractionRecord> = {}
): SupabaseInteractionRecord {
  return {
    id,
    type: 'poke',
    from_user_id: OTHER_USER_ID,
    to_user_id: USER_ID,
    viewed: false,
    created_at: '2026-08-20T12:00:00.000Z',
    ...overrides,
  };
}

describe('interactionsSlice subscription bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem(OWNER_STORAGE_KEY);
    localStorage.removeItem(VAULT_STORAGE_KEY);
    subscriptions.length = 0;
    subscribeInteractions.mockImplementation(
      (
        userId: string,
        reportInteraction: (record: SupabaseInteractionRecord) => void,
        reportStatus: (status: InteractionSubscriptionStatus) => void
      ) => {
        const subscription = {
          userId,
          reportInteraction,
          reportStatus,
          unsubscribe: vi.fn<() => void>(),
        };
        subscriptions.push(subscription);
        return Promise.resolve(subscription.unsubscribe);
      }
    );
  });

  afterEach(() => {
    localStorage.removeItem(OWNER_STORAGE_KEY);
    localStorage.removeItem(VAULT_STORAGE_KEY);
  });

  it('forwards every service status and keeps isSubscribed aligned through recovery', async () => {
    const store = createTestStore();
    const onStatusChange = vi.fn();

    const unsubscribe = await store.getState().subscribeToInteractions(onStatusChange);
    const subscription = subscriptions[0];
    expect(subscription.userId).toBe(USER_ID);
    expect(store.getState().isSubscribed).toBe(false);

    subscription.reportStatus('SUBSCRIBED');
    expect(store.getState().isSubscribed).toBe(true);

    subscription.reportInteraction(interaction('incoming-1'));
    expect(store.getState().interactions).toEqual([{
      id: 'incoming-1',
      type: 'poke',
      fromUserId: OTHER_USER_ID,
      toUserId: USER_ID,
      viewed: false,
      createdAt: new Date('2026-08-20T12:00:00.000Z'),
    }]);
    expect(store.getState().unviewedCount).toBe(1);

    subscription.reportStatus('CHANNEL_ERROR');
    expect(store.getState().isSubscribed).toBe(false);

    subscription.reportStatus('TIMED_OUT');
    expect(store.getState().isSubscribed).toBe(false);

    subscription.reportStatus('SUBSCRIBED');
    expect(store.getState().isSubscribed).toBe(true);
    expect(onStatusChange.mock.calls).toEqual([
      ['SUBSCRIBED'],
      ['CHANNEL_ERROR'],
      ['TIMED_OUT'],
      ['SUBSCRIBED'],
    ]);

    unsubscribe();
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(store.getState().isSubscribed).toBe(false);
  });

  it('keeps delivering once per record after a same-user auth refresh', async () => {
    const store = createTestStore();
    await store.getState().subscribeToInteractions(vi.fn());
    const subscription = subscriptions[0];
    const authSessionVersion = store.getState().authSessionVersion;

    store.getState().setAuthUser(USER_ID, 'updated@example.com');
    expect(store.getState().authSessionVersion).toBe(authSessionVersion);

    const record = interaction('after-refresh', { type: 'kiss' });
    subscription.reportInteraction(record);
    subscription.reportInteraction(record);

    expect(store.getState().interactions).toEqual([{
      id: 'after-refresh',
      type: 'kiss',
      fromUserId: OTHER_USER_ID,
      toUserId: USER_ID,
      viewed: false,
      createdAt: new Date(record.created_at!),
    }]);
    expect(store.getState().unviewedCount).toBe(1);

    subscription.reportInteraction(interaction('already-viewed', { viewed: true }));
    expect(store.getState().interactions.map(({ id }) => id)).toEqual([
      'already-viewed',
      'after-refresh',
    ]);
    expect(store.getState().unviewedCount).toBe(1);
  });

  it('ignores records and statuses during and after teardown, including repeated cleanup', async () => {
    const store = createTestStore();
    const onStatusChange = vi.fn();
    const unsubscribe = await store.getState().subscribeToInteractions(onStatusChange);
    const subscription = subscriptions[0];
    subscription.reportInteraction(interaction('current'));
    const acceptedInteractions = [...store.getState().interactions];
    subscription.unsubscribe.mockImplementation(() => {
      subscription.reportInteraction(interaction('during-cleanup'));
      subscription.reportStatus('SUBSCRIBED');
    });

    unsubscribe();
    expect(store.getState().interactions).toEqual(acceptedInteractions);
    expect(store.getState().unviewedCount).toBe(1);

    subscription.reportInteraction(interaction('after-cleanup'));
    subscription.reportStatus('SUBSCRIBED');
    unsubscribe();

    expect(store.getState().interactions).toEqual(acceptedInteractions);
    expect(store.getState().unviewedCount).toBe(1);
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(store.getState().isSubscribed).toBe(false);
    expect(onStatusChange).not.toHaveBeenCalled();
  });

  it("ignores an old account's records and statuses before its cleanup runs", async () => {
    const store = createTestStore();
    const onStatusChange = vi.fn();
    await store.getState().subscribeToInteractions(onStatusChange);
    const oldSubscription = subscriptions[0];
    oldSubscription.reportInteraction(interaction('before-switch'));

    store.getState().setAuthUser(OTHER_USER_ID);
    oldSubscription.reportInteraction(interaction('stale-before-current'));
    oldSubscription.reportStatus('SUBSCRIBED');

    expect(store.getState().interactions).toEqual([]);
    expect(store.getState().unviewedCount).toBe(0);
    expect(store.getState().isSubscribed).toBe(false);
    expect(onStatusChange).not.toHaveBeenCalled();

    await store.getState().subscribeToInteractions(vi.fn());
    const currentSubscription = subscriptions[1];
    expect(currentSubscription.userId).toBe(OTHER_USER_ID);
    currentSubscription.reportInteraction(interaction('current-account', {
      from_user_id: USER_ID,
      to_user_id: OTHER_USER_ID,
    }));
    const acceptedInteractions = [...store.getState().interactions];

    oldSubscription.reportInteraction(interaction('stale-after-current'));

    expect(acceptedInteractions.map(({ id }) => id)).toEqual(['current-account']);
    expect(store.getState().interactions).toEqual(acceptedInteractions);
    expect(store.getState().unviewedCount).toBe(1);
    expect(oldSubscription.unsubscribe).not.toHaveBeenCalled();
  });

  it('keeps signed-out account state empty when an old record arrives', async () => {
    const store = createTestStore();
    await store.getState().subscribeToInteractions(vi.fn());
    const subscription = subscriptions[0];
    subscription.reportInteraction(interaction('before-sign-out'));
    expect(store.getState().unviewedCount).toBe(1);

    store.getState().clearAuth();
    subscription.reportInteraction(interaction('after-sign-out'));

    expect(store.getState().userId).toBeNull();
    expect(store.getState().interactions).toEqual([]);
    expect(store.getState().unviewedCount).toBe(0);
    expect(subscription.unsubscribe).not.toHaveBeenCalled();
  });

  it('rejects a previous auth lifetime after the same account signs in again', async () => {
    const store = createTestStore();
    await store.getState().subscribeToInteractions(vi.fn());
    const oldSubscription = subscriptions[0];
    const oldSessionVersion = store.getState().authSessionVersion;

    store.getState().clearAuth();
    store.getState().setAuthUser(USER_ID);
    expect(store.getState().authSessionVersion).toBeGreaterThan(oldSessionVersion);
    oldSubscription.reportInteraction(interaction('old-lifetime-before-current'));

    expect(store.getState().interactions).toEqual([]);
    expect(store.getState().unviewedCount).toBe(0);

    await store.getState().subscribeToInteractions(vi.fn());
    const currentSubscription = subscriptions[1];
    expect(currentSubscription.userId).toBe(USER_ID);
    currentSubscription.reportInteraction(interaction('current-lifetime'));
    const acceptedInteractions = [...store.getState().interactions];

    oldSubscription.reportInteraction(interaction('old-lifetime-after-current'));

    expect(acceptedInteractions.map(({ id }) => id)).toEqual(['current-lifetime']);
    expect(store.getState().interactions).toEqual(acceptedInteractions);
    expect(store.getState().unviewedCount).toBe(1);
    expect(oldSubscription.unsubscribe).not.toHaveBeenCalled();
  });
});
