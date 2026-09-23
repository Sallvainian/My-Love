import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { create, type StateCreator } from 'zustand';

const subscribeInteractions = vi.hoisted(() => vi.fn());
/** The partner snapshot the slice takes before it starts listening (F4/CAP-4). */
const resolvePartnerId = vi.hoisted(() => vi.fn<() => Promise<string | null>>());
const sendPoke = vi.hoisted(() => vi.fn());
const sendKiss = vi.hoisted(() => vi.fn());

vi.mock('../../../src/api/interactionService', () => ({
  InteractionService: class {
    subscribeInteractions = subscribeInteractions;
    resolvePartnerId = resolvePartnerId;
    // Derived from the same stub so every existing `resolvePartnerId.mock*`
    // setup keeps working: an id is `linked`, null is `unlinked`, and a
    // rejection is the inconclusive `error` the reconnect path must not act on.
    resolvePartnerLookup = async () => {
      try {
        const partnerId = await resolvePartnerId();
        return partnerId ? { status: 'linked', partnerId } : { status: 'unlinked' };
      } catch (error) {
        return { status: 'error', reason: error instanceof Error ? error.message : String(error) };
      }
    };
    sendPoke = sendPoke;
    sendKiss = sendKiss;
  },
}));

import type {
  InteractionSubscriptionStatus,
  SupabaseInteractionRecord,
} from '../../../src/api/interactionService';
import { serializeAccountDataWrite } from '../../../src/services/accountDataQueue';
import { NoPartnerError } from '../../../src/utils/interactionValidation';
import {
  ACCOUNT_OWNER_STORAGE_KEY,
  createAuthSlice,
  type AuthSlice,
} from '../../../src/stores/slices/authSlice';
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

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

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
    localStorage.removeItem(ACCOUNT_OWNER_STORAGE_KEY);
    subscriptions.length = 0;
    resolvePartnerId.mockResolvedValue(OTHER_USER_ID);
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

  afterEach(async () => {
    localStorage.removeItem(ACCOUNT_OWNER_STORAGE_KEY);
    // Sign-out deletes the outgoing account's mirror rows through the
    // account-data queue, fire-and-forget. Drain it so that work (and its log
    // line) finishes inside the test rather than after the worker closes.
    await serializeAccountDataWrite(async () => {});
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

    resolvePartnerId.mockResolvedValue(USER_ID);
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

  it('takes the partner snapshot before it starts listening, and keeps it past teardown', async () => {
    const store = createTestStore();
    const order: string[] = [];
    resolvePartnerId.mockImplementation(async () => {
      order.push('resolvePartnerId');
      return OTHER_USER_ID;
    });
    subscribeInteractions.mockImplementation(
      (
        userId: string,
        reportInteraction: (record: SupabaseInteractionRecord) => void,
        reportStatus: (status: InteractionSubscriptionStatus) => void
      ) => {
        order.push('subscribeInteractions');
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

    const unsubscribe = await store.getState().subscribeToInteractions(vi.fn());

    // The snapshot has to exist before the first record can arrive: the guard
    // is synchronous and rejects everything while it is null.
    expect(order).toEqual(['resolvePartnerId', 'subscribeInteractions']);
    expect(store.getState().interactionPartnerId).toBe(OTHER_USER_ID);

    // Teardown leaves the snapshot alone: it is account state, and under
    // StrictMode this teardown runs after a second subscription has already
    // taken its own. clearAuth is what clears it.
    unsubscribe();
    expect(store.getState().interactionPartnerId).toBe(OTHER_USER_ID);

    store.getState().clearAuth();
    expect(store.getState().interactionPartnerId).toBeNull();
  });

  it('refreshes the partner snapshot when the channel resubscribes', async () => {
    const store = createTestStore();
    await store.getState().subscribeToInteractions(vi.fn());
    const subscription = subscriptions[0];
    expect(store.getState().interactionPartnerId).toBe(OTHER_USER_ID);

    // A reconnect is the one moment the relationship can have changed under a
    // live subscription.
    resolvePartnerId.mockResolvedValue('USER-D-ID');
    subscription.reportStatus('SUBSCRIBED');
    await vi.waitFor(() => expect(store.getState().interactionPartnerId).toBe('USER-D-ID'));

    subscription.reportInteraction(interaction('from-the-old-partner'));
    expect(store.getState().interactions).toEqual([]);
    expect(store.getState().unviewedCount).toBe(0);
  });

  it('accepts the partner and refuses a stranger, a misaddressed row and an unlinked account', async () => {
    const store = createTestStore();
    await store.getState().subscribeToInteractions(vi.fn());
    const subscription = subscriptions[0];

    subscription.reportInteraction(interaction('from-a-stranger', { from_user_id: 'USER-X-ID' }));
    subscription.reportInteraction(interaction('for-someone-else', { to_user_id: 'USER-X-ID' }));
    expect(store.getState().interactions).toEqual([]);
    expect(store.getState().unviewedCount).toBe(0);

    subscription.reportInteraction(interaction('from-the-partner'));
    expect(store.getState().interactions.map(({ id }) => id)).toEqual(['from-the-partner']);
    expect(store.getState().unviewedCount).toBe(1);
  });

  it('keeps delivering when a reconnect cannot confirm the partner', async () => {
    // The reconnect re-resolve is the one write that can clobber a WORKING
    // snapshot. A failed `users` read is indistinguishable from an unlink
    // unless the lookup says so, and `SUBSCRIBED` fires once more on a healthy
    // socket, so a failure-null here drops every poke and kiss for the rest of
    // the page view while `isSubscribed` stays true and the UI looks fine.
    const store = createTestStore();
    await store.getState().subscribeToInteractions(vi.fn());
    const subscription = subscriptions[0];

    subscription.reportInteraction(interaction('before-the-drop'));
    expect(store.getState().interactions.map(({ id }) => id)).toEqual(['before-the-drop']);

    // Wi-Fi blips; the channel rejoins and the `users` read fails outright.
    resolvePartnerId.mockRejectedValue(new Error('network down'));
    subscription.reportStatus('SUBSCRIBED');
    await flushMicrotasks();

    subscription.reportInteraction(interaction('after-the-blip'));
    expect(store.getState().interactions.map(({ id }) => id)).toEqual([
      'after-the-blip',
      'before-the-drop',
    ]);
  });

  it('keeps a working snapshot when the pre-subscribe lookup cannot confirm the partner', async () => {
    // The pre-subscribe write is the OTHER site that can clobber a working
    // snapshot. Teardown deliberately leaves the snapshot in place, and
    // PokeKissInterface remounts on every navigation back into the partner
    // view, so a remount whose `users` read fails would blank a value the
    // previous mount resolved correctly and refuse every record after it.
    const store = createTestStore();
    const unsubscribe = await store.getState().subscribeToInteractions(vi.fn());
    expect(store.getState().interactionPartnerId).toBe(OTHER_USER_ID);

    // The slice's own teardown, not the service mock's: it is the one that
    // leaves the snapshot in place.
    unsubscribe();
    expect(store.getState().interactionPartnerId).toBe(OTHER_USER_ID);

    // Navigating back remounts; this time the `users` read fails outright.
    resolvePartnerId.mockRejectedValue(new Error('network down'));
    await store.getState().subscribeToInteractions(vi.fn());

    expect(store.getState().interactionPartnerId).toBe(OTHER_USER_ID);
    subscriptions[subscriptions.length - 1].reportInteraction(interaction('after-the-remount'));
    expect(store.getState().interactions.map(({ id }) => id)).toContain('after-the-remount');
  });

  it('still stops delivery when a reconnect confirms the relationship ended', async () => {
    // The conclusive case must keep working: re-resolving on a re-join is
    // exactly how an ex-partner stops being authorized.
    const store = createTestStore();
    await store.getState().subscribeToInteractions(vi.fn());
    const subscription = subscriptions[0];

    subscription.reportInteraction(interaction('while-linked'));
    expect(store.getState().interactions.map(({ id }) => id)).toEqual(['while-linked']);

    resolvePartnerId.mockResolvedValue(null);
    subscription.reportStatus('SUBSCRIBED');
    await flushMicrotasks();

    subscription.reportInteraction(interaction('after-the-unlink'));
    expect(store.getState().interactions.map(({ id }) => id)).toEqual(['while-linked']);
  });

  it('refuses every record while the relationship is unknown', async () => {
    const store = createTestStore();
    resolvePartnerId.mockResolvedValue(null);
    await store.getState().subscribeToInteractions(vi.fn());
    const subscription = subscriptions[0];
    expect(store.getState().interactionPartnerId).toBeNull();

    subscription.reportInteraction(interaction('while-unlinked'));

    expect(store.getState().interactions).toEqual([]);
    expect(store.getState().unviewedCount).toBe(0);
  });

  it('rejects a record that arrives directly, outside any subscription', () => {
    const store = createTestStore();

    // addIncomingInteraction is a public store action: the guard lives in it,
    // not only in the subscription callback that usually calls it.
    store.getState().addIncomingInteraction(interaction('unsolicited'));

    expect(store.getState().interactions).toEqual([]);
    expect(store.getState().unviewedCount).toBe(0);
  });

  it('does not write the snapshot when the account changes during the lookup', async () => {
    const store = createTestStore();
    let releasePartner: ((partnerId: string | null) => void) | undefined;
    resolvePartnerId.mockImplementation(
      () => new Promise<string | null>((resolve) => { releasePartner = resolve; })
    );

    const pending = store.getState().subscribeToInteractions(vi.fn());
    await vi.waitFor(() => expect(releasePartner).toBeDefined());

    // Sign-out lands while the partner lookup is still in flight.
    store.getState().clearAuth();
    releasePartner!(OTHER_USER_ID);
    await expect(pending).rejects.toThrow(/account changed/);

    expect(store.getState().interactionPartnerId).toBeNull();
    expect(subscriptions).toHaveLength(0);
  });

  it('does not let a reconnect refresh write the snapshot after sign-out', async () => {
    const store = createTestStore();
    await store.getState().subscribeToInteractions(vi.fn());
    const subscription = subscriptions[0];

    let releaseRefresh: ((partnerId: string | null) => void) | undefined;
    resolvePartnerId.mockImplementation(
      () => new Promise<string | null>((resolve) => { releaseRefresh = resolve; })
    );
    subscription.reportStatus('SUBSCRIBED');
    await vi.waitFor(() => expect(releaseRefresh).toBeDefined());

    store.getState().clearAuth();
    releaseRefresh!(OTHER_USER_ID);
    await Promise.resolve();
    await Promise.resolve();

    // Restoring it here would re-arm addIncomingInteraction for the couple that
    // just signed out.
    expect(store.getState().interactionPartnerId).toBeNull();
  });

  it('sends as the signed-in user and passes no recipient', async () => {
    const store = createTestStore();
    const record = interaction('sent-poke', { from_user_id: USER_ID, to_user_id: OTHER_USER_ID });
    sendPoke.mockResolvedValue(record);

    const returned = await store.getState().sendPoke();

    expect(sendPoke).toHaveBeenCalledWith(USER_ID);
    expect(returned).toBe(record);
    expect(store.getState().interactions.map(({ id }) => id)).toEqual(['sent-poke']);
  });

  it('propagates the service NoPartnerError unchanged, so the UI can phrase it', async () => {
    const store = createTestStore();
    const thrown = new NoPartnerError();
    sendKiss.mockRejectedValue(thrown);

    await expect(store.getState().sendKiss()).rejects.toBe(thrown);
    expect(store.getState().interactions).toEqual([]);
  });

  it('keeps a send that resolves after an account switch out of the new account feed', async () => {
    const store = createTestStore();
    let releaseSend: ((record: SupabaseInteractionRecord) => void) | undefined;
    sendPoke.mockImplementation(
      () => new Promise<SupabaseInteractionRecord>((resolve) => { releaseSend = resolve; })
    );

    const pending = store.getState().sendPoke();
    await vi.waitFor(() => expect(releaseSend).toBeDefined());

    store.getState().setAuthUser(OTHER_USER_ID);
    const record = interaction('late-poke', { from_user_id: USER_ID, to_user_id: OTHER_USER_ID });
    releaseSend!(record);

    // The caller still learns the true outcome; the next account's feed does not.
    await expect(pending).resolves.toBe(record);
    expect(store.getState().interactions).toEqual([]);
    expect(JSON.stringify(store.getState())).not.toContain('late-poke');
  });

  it('keeps a late KISS out of the new account feed too', async () => {
    // The kiss guard was reachable with the whole suite green: its only other
    // test covers the NoPartnerError rejection, never the post-await account
    // switch, so deleting the guard cost nothing.
    const store = createTestStore();
    let releaseSend: ((record: SupabaseInteractionRecord) => void) | undefined;
    sendKiss.mockImplementation(
      () => new Promise<SupabaseInteractionRecord>((resolve) => { releaseSend = resolve; })
    );

    const pending = store.getState().sendKiss();
    await vi.waitFor(() => expect(releaseSend).toBeDefined());

    store.getState().setAuthUser(OTHER_USER_ID);
    const record = interaction('late-kiss', { from_user_id: USER_ID, to_user_id: OTHER_USER_ID });
    releaseSend!(record);

    await expect(pending).resolves.toBe(record);
    expect(store.getState().interactions).toEqual([]);
    expect(JSON.stringify(store.getState())).not.toContain('late-kiss');
  });

  it('refuses the snapshot when the SAME account signs out and back in mid-lookup', async () => {
    // `authSessionVersion`, not `userId`, is what catches this: the id matches
    // again by the time the lookup resolves. The existing guard tests use
    // clearAuth() alone, which nulls userId, so the version clause was
    // deletable with the suite green.
    const store = createTestStore();
    let releaseLookup: ((partnerId: string | null) => void) | undefined;
    resolvePartnerId.mockImplementation(
      () => new Promise<string | null>((resolve) => { releaseLookup = resolve; })
    );

    const pending = store.getState().subscribeToInteractions(vi.fn());
    await vi.waitFor(() => expect(releaseLookup).toBeDefined());

    // Out and back in as the SAME account: userId ends up identical, the
    // session version does not.
    store.getState().clearAuth();
    store.getState().setAuthUser(USER_ID);

    releaseLookup!(OTHER_USER_ID);
    await pending.catch(() => undefined);

    expect(store.getState().interactionPartnerId).toBeNull();
  });
});
