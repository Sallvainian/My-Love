/**
 * moodSyncService.subscribeMoodUpdates — channel ownership: reopening after an
 * unsolicited CLOSED
 *
 * Two consumers subscribe in practice — usePartnerMood (Mood tab) and
 * PartnerMoodView (Partner tab) — and both share one channel per topic, so a
 * server-side close must reopen it for whoever is still attached. The Realtime
 * fake is in `fakeMoodRealtime.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ackNextLeave,
  constructedChannels,
  emitMood,
  emitStatus,
  fakeChannel,
  type FakeChannel,
  fakeRemoveChannel,
  fakeResolvePartnerLookup,
  fakeResolveSignedInUser,
  getPartnerId,
  getSession,
  getSignedInUserId,
  leaveQueue,
  moodIdFor,
  opOrder,
  resetRealtimeFake,
  resolveNextSession,
  serverClosesTopic,
  setAuth,
  socket,
  teardownRealtimeFake,
  TOPIC,
} from './fakeMoodRealtime';

vi.mock('@/api/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: () => getSession(),
    },
    // Both bodies live in fakeMoodRealtime.ts, called lazily from here.
    channel: (topic: string, config?: unknown) => fakeChannel(topic, config),
    removeChannel: (chan: FakeChannel) => fakeRemoveChannel(chan),
    realtime: {
      isDisconnecting: () => socket.state === 'disconnecting',
      setAuth: (...args: unknown[]) => setAuth(...args),
    },
  },
  getPartnerId: (...args: unknown[]) => getPartnerId(...args),
  // Both names at one mock: the receive paths read the snapshot through the
  // retrying lookup and the send path through the plain one, but they wrap the
  // same round-trip, so every existing setup in this file keeps its meaning.
  resolvePartnerIdForDelivery: (...args: unknown[]) => getPartnerId(...args),
  resolvePartnerLookupForDelivery: (...args: unknown[]) => fakeResolvePartnerLookup(...args),
  getSignedInUserId: (...args: unknown[]) => getSignedInUserId(...args),
  resolveSignedInUserForDelivery: (...args: unknown[]) => fakeResolveSignedInUser(...args),
}));

import { moodSyncService } from '@/api/moodSyncService';

describe('subscribeMoodUpdates channel ownership', () => {
  beforeEach(() => {
    resetRealtimeFake();
  });

  afterEach(async () => {
    await teardownRealtimeFake();
  });

  describe('unsolicited CLOSED reopen', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(async () => {
      await vi.runOnlyPendingTimersAsync();
      vi.useRealTimers();
    });

    // src/api/moodSyncService.ts RETRY_CONFIG (module-private), mirrored.
    const MOOD_RETRY = { maxRetries: 5, baseDelay: 1000, maxDelay: 30000 };

    /** The wait before each retry, as `armMoodReopen` computes it: 1s, 2s, 4s, 8s, 16s. */
    const MOOD_REOPEN_DELAYS_MS = Array.from({ length: MOOD_RETRY.maxRetries }, (_, retry) =>
      Math.min(MOOD_RETRY.baseDelay * 2 ** retry, MOOD_RETRY.maxDelay)
    );

    /** The delay cap, so no backoff can outlast it. */
    const PAST_EVERY_BACKOFF_MS = MOOD_RETRY.maxDelay;

    async function fireReopen(delayMs = MOOD_RETRY.baseDelay): Promise<void> {
      await vi.advanceTimersByTimeAsync(delayMs);
      while (leaveQueue.length > 0) ackNextLeave();
      await vi.advanceTimersByTimeAsync(socket.windowMs + 20);
    }

    it('re-arms a join when reopen setAuth rejects after the row is swapped', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const onMood = vi.fn();
      const pending = moodSyncService.subscribeMoodUpdates(onMood);
      resolveNextSession();
      const unsubscribe = await pending;

      expect(constructedChannels).toHaveLength(1);

      setAuth.mockRejectedValueOnce(new Error('token install failed'));
      serverClosesTopic(constructedChannels[0]);
      await fireReopen();

      expect(constructedChannels).toHaveLength(1);
      expect(errorSpy).toHaveBeenCalledWith(
        '[MoodSyncService] Retry setup failed:',
        expect.any(Error)
      );

      await fireReopen(2000);

      expect(constructedChannels).toHaveLength(2);
      emitMood(constructedChannels[1], 'after-setAuth-reject');
      expect(onMood).toHaveBeenCalledWith(
        expect.objectContaining({ id: moodIdFor('after-setAuth-reject') })
      );

      unsubscribe();
      errorSpy.mockRestore();
    });

    it('reopens a live entry on a new channel after an unsolicited CLOSED', async () => {
      const onMood = vi.fn();
      const onStatus = vi.fn();
      const pending = moodSyncService.subscribeMoodUpdates(onMood, onStatus);
      resolveNextSession();
      const unsubscribe = await pending;

      const first = constructedChannels[0];
      serverClosesTopic(first);

      expect(onStatus).toHaveBeenCalledWith('CLOSED');
      expect(constructedChannels).toHaveLength(1);

      await fireReopen();

      expect(constructedChannels).toHaveLength(2);
      const replacement = constructedChannels[1];
      expect(replacement).not.toBe(first);
      expect(replacement.state).toBe('joined');
      expect(opOrder.slice(-2)).toEqual(['setAuth', `subscribe:${TOPIC}`]);

      emitMood(replacement, 'after-unsolicited-close');
      expect(onMood).toHaveBeenCalledWith(
        expect.objectContaining({ id: moodIdFor('after-unsolicited-close') })
      );

      unsubscribe();
    });

    it("does not reopen when last-subscriber teardown reports CLOSED", async () => {
      const pending = moodSyncService.subscribeMoodUpdates(vi.fn());
      resolveNextSession();
      const unsubscribe = await pending;

      const channel = constructedChannels[0];
      unsubscribe();
      emitStatus(channel, 'CLOSED');

      await fireReopen();

      expect(constructedChannels).toHaveLength(1);
    });

    it('cancels a pending reopen when the last subscriber detaches during backoff', async () => {
      const pending = moodSyncService.subscribeMoodUpdates(vi.fn());
      resolveNextSession();
      const unsubscribe = await pending;

      serverClosesTopic(constructedChannels[0]);
      unsubscribe();

      await fireReopen();

      expect(constructedChannels).toHaveLength(1);
    });

    it('restores the CLOSED retry budget when the replacement reports SUBSCRIBED', async () => {
      const pending = moodSyncService.subscribeMoodUpdates(vi.fn());
      resolveNextSession();
      const unsubscribe = await pending;

      serverClosesTopic(constructedChannels[0]);
      await fireReopen();
      expect(constructedChannels).toHaveLength(2);

      emitStatus(constructedChannels[1], 'SUBSCRIBED');

      serverClosesTopic(constructedChannels[1]);
      await fireReopen(MOOD_RETRY.baseDelay);

      expect(constructedChannels).toHaveLength(3);

      unsubscribe();
    });

    it("re-takes the partner snapshot on the replacement's first SUBSCRIBED", async () => {
      const onMood = vi.fn();
      const pending = moodSyncService.subscribeMoodUpdates(onMood);
      resolveNextSession();
      const unsubscribe = await pending;

      serverClosesTopic(constructedChannels[0]);
      await fireReopen();

      getPartnerId.mockResolvedValue(null);
      emitStatus(constructedChannels[1], 'SUBSCRIBED');
      await vi.advanceTimersByTimeAsync(0);

      emitMood(constructedChannels[1], 'after-unlink');
      expect(onMood).not.toHaveBeenCalled();

      unsubscribe();
    });

    it("a released channel's late CLOSED does not notify live consumers or open another join", async () => {
      const onStatus = vi.fn();
      const pending = moodSyncService.subscribeMoodUpdates(vi.fn(), onStatus);
      resolveNextSession();
      const unsubscribe = await pending;

      const first = constructedChannels[0];
      serverClosesTopic(first);
      await fireReopen();
      expect(constructedChannels).toHaveLength(2);

      onStatus.mockClear();
      emitStatus(first, 'CLOSED');
      await fireReopen(PAST_EVERY_BACKOFF_MS);

      expect(constructedChannels).toHaveLength(2);
      expect(onStatus).not.toHaveBeenCalledWith('CLOSED');

      unsubscribe();
    });

    it('stops joining once five unsolicited CLOSEs have been spent', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const onStatus = vi.fn();
      const pending = moodSyncService.subscribeMoodUpdates(vi.fn(), onStatus);
      resolveNextSession();
      const unsubscribe = await pending;

      for (const delay of MOOD_REOPEN_DELAYS_MS) {
        serverClosesTopic(constructedChannels[constructedChannels.length - 1]);
        await fireReopen(delay);
      }

      expect(constructedChannels).toHaveLength(6);

      serverClosesTopic(constructedChannels[5]);
      await fireReopen(PAST_EVERY_BACKOFF_MS);

      expect(constructedChannels).toHaveLength(6);
      expect(errorSpy).toHaveBeenCalledWith(
        '[MoodSyncService] Max retries (5) exceeded. Giving up.'
      );

      const lateStatus = vi.fn();
      const latePending = moodSyncService.subscribeMoodUpdates(vi.fn(), lateStatus);
      resolveNextSession();
      const lateUnsubscribe = await latePending;
      expect(lateStatus).toHaveBeenCalledWith('CLOSED');
      expect(constructedChannels).toHaveLength(6);

      unsubscribe();
      lateUnsubscribe();
      errorSpy.mockRestore();
    });
  });
});
