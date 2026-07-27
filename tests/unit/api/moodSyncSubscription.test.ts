/**
 * moodSyncService.subscribeMoodUpdates — channel ownership
 *
 * The channel used to live on a field of this singleton, and the returned
 * unsubscribe read that field when invoked rather than closing over the
 * channel it created. Two consumers subscribe in practice — usePartnerMood
 * (Mood tab) and PartnerMoodView (Partner tab) — and the two views are
 * mutually exclusive, so moving between them unmounts one and mounts the
 * other while both subscribe calls are still in flight.
 *
 * These drive two overlapping subscriptions, which the existing
 * usePartnerMood tests never do: they call subscribe once per test with a
 * fresh mock, so the shared field is never contended.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeChannel {
  id: number;
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
}

let channelSeq = 0;
let createdChannels: FakeChannel[] = [];
const removeChannel = vi.fn();

/** Resolvers for pending getSession calls, so resolution order is controllable */
let sessionQueue: Array<(value: unknown) => void> = [];

const getSession = vi.fn(
  () =>
    new Promise((resolve) => {
      sessionQueue.push(resolve);
    })
);

vi.mock('@/api/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: () => getSession(),
    },
    channel: () => {
      const chan: FakeChannel = {
        id: ++channelSeq,
        on: vi.fn(() => chan),
        subscribe: vi.fn(() => chan),
      };
      createdChannels.push(chan);
      return chan;
    },
    removeChannel: (chan: FakeChannel) => removeChannel(chan),
  },
  getPartnerId: vi.fn(),
}));

import { moodSyncService } from '@/api/moodSyncService';

const USER_ID = '00000000-0000-4000-8000-000000000001';

/** Resolve the oldest pending getSession with a valid session */
function resolveNextSession(): void {
  const resolve = sessionQueue.shift();
  if (!resolve) throw new Error('no pending getSession to resolve');
  resolve({ data: { session: { user: { id: USER_ID } } } });
}

describe('subscribeMoodUpdates channel ownership', () => {
  beforeEach(() => {
    channelSeq = 0;
    createdChannels = [];
    sessionQueue = [];
    removeChannel.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('each unsubscribe removes the channel its own call created', async () => {
    // Mood tab subscribes, then Partner tab subscribes before the first
    // resolves — one tap apart on adjacent bottom-nav buttons.
    const pendingA = moodSyncService.subscribeMoodUpdates(vi.fn());
    const pendingB = moodSyncService.subscribeMoodUpdates(vi.fn());

    // B wins the race and resolves first.
    resolveNextSession();
    resolveNextSession();
    const [unsubscribeA, unsubscribeB] = await Promise.all([pendingA, pendingB]);

    expect(createdChannels).toHaveLength(2);
    const [channelA, channelB] = createdChannels;

    // A's component already unmounted, so its cleanup runs while B is live.
    unsubscribeA();

    expect(removeChannel).toHaveBeenCalledTimes(1);
    // The whole defect: this used to be channelB, torn down under a mounted
    // component that then silently stopped receiving partner moods.
    expect(removeChannel).toHaveBeenCalledWith(channelA);
    expect(removeChannel).not.toHaveBeenCalledWith(channelB);

    // B is still live and can still tear itself down afterwards.
    unsubscribeB();
    expect(removeChannel).toHaveBeenCalledTimes(2);
    expect(removeChannel).toHaveBeenLastCalledWith(channelB);
  });

  it('a second call to the same unsubscribe is a no-op', async () => {
    // usePartnerMood can invoke this twice: from its own !isMounted branch and
    // again from the effect cleanup.
    const pending = moodSyncService.subscribeMoodUpdates(vi.fn());
    resolveNextSession();
    const unsubscribe = await pending;

    unsubscribe();
    unsubscribe();

    expect(removeChannel).toHaveBeenCalledTimes(1);
  });

  it('returns a no-op unsubscribe when there is no session', async () => {
    const pending = moodSyncService.subscribeMoodUpdates(vi.fn());
    const resolve = sessionQueue.shift();
    resolve?.({ data: { session: null } });

    const unsubscribe = await pending;
    unsubscribe();

    expect(createdChannels).toHaveLength(0);
    expect(removeChannel).not.toHaveBeenCalled();
  });
});
