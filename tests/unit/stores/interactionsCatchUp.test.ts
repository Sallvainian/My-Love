/**
 * interactionsSlice — catching up on pokes live delivery did not bring.
 *
 * SUBSCRIBED comes from the join reply. The server can confirm the
 * subscription's postgres_changes binding later, with a `system` message, and
 * a row inserted before that confirmation can miss live delivery; a row
 * inserted while no screen was subscribed never had it. So the slice reads the
 * history again on the confirmation. A row accepted while any history read is
 * out, from Realtime or a confirmed send, is kept when that read's answer lands
 * without it.
 *
 * The real server's timing cannot be steered, so the gap is staged here: the
 * service is faked and each test reports SUBSCRIBED, the insert and the
 * confirmation in the order it needs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { create, type StateCreator } from 'zustand';

// Hoisted: the slice builds its service when it is imported.
const subscribeInteractions = vi.hoisted(() => vi.fn());
const getInteractionHistory = vi.hoisted(() => vi.fn());
const sendPoke = vi.hoisted(() => vi.fn());
const sendKiss = vi.hoisted(() => vi.fn());
const PARTNER = vi.hoisted(() => 'PARTNER-ID');

vi.mock('../../../src/api/interactionService', () => ({
  InteractionService: class {
    subscribeInteractions = subscribeInteractions;
    getInteractionHistory = getInteractionHistory;
    sendPoke = sendPoke;
    sendKiss = sendKiss;
    resolvePartnerLookup = async () => ({ status: 'linked', partnerId: PARTNER });
  },
}));

const writeLocalCopy = vi.hoisted(() => vi.fn());

vi.mock('../../../src/services/localCopy', () => ({
  readLocalCopy: async () => null,
  writeLocalCopy: (userId: string, kind: string, value: unknown) =>
    writeLocalCopy(userId, kind, value),
  registerLocalCopy: () => () => {},
}));

import type {
  Interaction,
  InteractionSubscriptionStatus,
  SupabaseInteractionRecord,
} from '../../../src/api/interactionService';
import { createInteractionRecord } from '../../support/factories/interaction-record-ownership';
import {
  createInteractionsSlice,
  INTERACTIONS_COPY_KIND,
  type InteractionsSlice,
} from '../../../src/stores/slices/interactionsSlice';

const USER_A = 'USER-A-ID';
const POKED_AT = '2026-10-29T08:00:00.000Z';

type TestStore = InteractionsSlice & { userId: string | null; authSessionVersion: number };

interface CapturedSubscription {
  reportInteraction: (record: SupabaseInteractionRecord) => void;
  reportStatus: (status: InteractionSubscriptionStatus) => void;
  reportArmed: (() => void) | undefined;
}

const subscriptions: CapturedSubscription[] = [];

function createTestStore() {
  const store = create<TestStore>()(createInteractionsSlice as unknown as StateCreator<TestStore>);
  store.setState({ userId: USER_A, authSessionVersion: 1 });
  return store;
}

/** Subscribes the store as the Partner tab does, and returns the service side of it. */
async function subscribe(store: ReturnType<typeof createTestStore>) {
  const unsubscribe = await store.getState().subscribeToInteractions(vi.fn());
  const subscription = subscriptions.at(-1)!;
  return { unsubscribe, subscription };
}

/** The server's confirmation; absent when the slice registers no handler for it. */
function confirm(subscription: CapturedSubscription) {
  expect(subscription.reportArmed, 'the slice listens for the confirmation').toBeTypeOf('function');
  subscription.reportArmed!();
}

/** An unviewed poke from the partner, as Realtime delivers it. */
function poke(id: string): SupabaseInteractionRecord {
  return createInteractionRecord({
    id,
    from_user_id: PARTNER,
    to_user_id: USER_A,
    created_at: POKED_AT,
  });
}

/** The same row as the history read returns it. */
function read(
  record: SupabaseInteractionRecord,
  overrides: Partial<Interaction> = {}
): Interaction {
  return {
    id: record.id,
    type: record.type as Interaction['type'],
    fromUserId: record.from_user_id,
    toUserId: record.to_user_id,
    viewed: record.viewed ?? false,
    createdAt: new Date(record.created_at ?? POKED_AT),
    ...overrides,
  };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('interactionsSlice catch-up', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    subscriptions.length = 0;
    writeLocalCopy.mockResolvedValue(undefined);
    getInteractionHistory.mockResolvedValue([]);
    subscribeInteractions.mockImplementation(
      async (
        _userId: string,
        reportInteraction: CapturedSubscription['reportInteraction'],
        reportStatus: CapturedSubscription['reportStatus'],
        reportArmed?: () => void
      ) => {
        subscriptions.push({ reportInteraction, reportStatus, reportArmed });
        return vi.fn();
      }
    );
  });

  it('reads the history once the server confirms the subscription, showing a poke inserted before then', async () => {
    const store = createTestStore();
    const { subscription } = await subscribe(store);
    subscription.reportStatus('SUBSCRIBED');
    // SUBSCRIBED alone is the join reply: no read yet.
    expect(getInteractionHistory).not.toHaveBeenCalled();

    // The poke is inserted in the gap and never delivered live.
    const missed = poke('missed-in-the-gap');
    getInteractionHistory.mockResolvedValue([read(missed)]);
    confirm(subscription);

    expect(getInteractionHistory).toHaveBeenCalledWith(USER_A, 100);
    await vi.waitFor(() => expect(store.getState().unviewedCount).toBe(1));
    expect(store.getState().interactions).toEqual([read(missed)]);
  });

  it('starts no read for a confirmation after teardown or after the account changed', async () => {
    const store = createTestStore();
    const first = await subscribe(store);
    first.unsubscribe();
    confirm(first.subscription);

    const second = await subscribe(store);
    store.setState({ authSessionVersion: 2 });
    confirm(second.subscription);

    expect(getInteractionHistory).not.toHaveBeenCalled();
  });

  it('keeps a poke delivered live while a history read is out, when the answer lacks it', async () => {
    const store = createTestStore();
    const { subscription } = await subscribe(store);
    subscription.reportStatus('SUBSCRIBED');
    const answer = deferred<Interaction[]>();
    getInteractionHistory.mockReturnValue(answer.promise);
    const older = read(poke('older'), {
      viewed: true,
      createdAt: new Date('2026-10-28T08:00:00Z'),
    });

    const loading = store.getState().loadInteractionHistory();
    const live = poke('live-during-read');
    subscription.reportInteraction(live);
    answer.resolve([older]);
    await loading;

    expect(store.getState().interactions).toEqual([read(live), older]);
    expect(store.getState().unviewedCount).toBe(1);
    expect(writeLocalCopy).toHaveBeenLastCalledWith(
      USER_A,
      INTERACTIONS_COPY_KIND,
      expect.arrayContaining([expect.objectContaining({ id: live.id })])
    );
  });

  it('keeps it through every read that was out, the catch-up read included, when the older read answers last', async () => {
    const store = createTestStore();
    const { subscription } = await subscribe(store);
    subscription.reportStatus('SUBSCRIBED');
    const startup = deferred<Interaction[]>();
    const catchUp = deferred<Interaction[]>();
    getInteractionHistory.mockReturnValueOnce(startup.promise).mockReturnValueOnce(catchUp.promise);

    const startupLoad = store.getState().loadInteractionHistory();
    confirm(subscription);
    expect(getInteractionHistory).toHaveBeenCalledTimes(2);
    const live = poke('live-during-both');
    subscription.reportInteraction(live);
    // The live row's own copy write is the first; the catch-up answer's is the second.
    expect(writeLocalCopy).toHaveBeenCalledTimes(1);
    catchUp.resolve([]);
    await vi.waitFor(() => expect(writeLocalCopy).toHaveBeenCalledTimes(2));
    startup.resolve([]);
    await startupLoad;

    expect(store.getState().interactions).toEqual([read(live)]);
    expect(store.getState().unviewedCount).toBe(1);
  });

  it('keeps a row the catch-up read brought when an older read answers last without it', async () => {
    const store = createTestStore();
    const { subscription } = await subscribe(store);
    subscription.reportStatus('SUBSCRIBED');
    const startup = deferred<Interaction[]>();
    const catchUp = deferred<Interaction[]>();
    getInteractionHistory.mockReturnValueOnce(startup.promise).mockReturnValueOnce(catchUp.promise);
    const missed = poke('missed-in-the-gap');

    const startupLoad = store.getState().loadInteractionHistory();
    confirm(subscription);
    catchUp.resolve([read(missed)]);
    // Applied: its answer is in state and saved.
    await vi.waitFor(() => expect(writeLocalCopy).toHaveBeenCalledTimes(1));
    startup.resolve([]);
    await startupLoad;

    expect(store.getState().interactions).toEqual([read(missed)]);
    expect(store.getState().unviewedCount).toBe(1);
  });

  it.each(['poke', 'kiss'] as const)(
    'keeps a %s sent while a history read is out, when the answer lacks it',
    async (type) => {
      const store = createTestStore();
      const answer = deferred<Interaction[]>();
      getInteractionHistory.mockReturnValue(answer.promise);
      const sentRecord = createInteractionRecord({
        id: `sent-${type}`,
        type,
        from_user_id: USER_A,
        to_user_id: PARTNER,
        created_at: POKED_AT,
      });
      sendPoke.mockResolvedValue(sentRecord);
      sendKiss.mockResolvedValue(sentRecord);
      const older = read(poke('older'), {
        viewed: true,
        createdAt: new Date('2026-10-28T08:00:00Z'),
      });

      const loading = store.getState().loadInteractionHistory();
      await (type === 'poke' ? store.getState().sendPoke() : store.getState().sendKiss());
      answer.resolve([older]);
      await loading;

      expect(store.getState().interactions).toEqual([read(sentRecord), older]);
      // Outgoing: never a notification.
      expect(store.getState().unviewedCount).toBe(0);
    }
  );
});
