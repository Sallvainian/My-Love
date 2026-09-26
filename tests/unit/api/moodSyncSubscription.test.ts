/**
 * moodSyncService.subscribeMoodUpdates — channel ownership
 *
 * Two consumers subscribe in practice — usePartnerMood (Mood tab) and
 * PartnerMoodView (Partner tab) — and the two views are mutually exclusive, so
 * moving between them unmounts one and mounts the other while both subscribe
 * calls are still in flight.
 *
 * The shared-channel Realtime fake these tests run against, and why it hands
 * the same object back per topic, is in `fakeMoodRealtime.ts`. The partner and
 * session identity checks are in `moodSyncSubscription.identity.test.ts`, and
 * the unsolicited-CLOSED reopen in `moodSyncSubscription.reopen.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ackNextLeave,
  channelConfigs,
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
  moodIdFor,
  openChannels,
  opOrder,
  OUTSIDER_ID,
  removeChannel,
  resetRealtimeFake,
  resolveNextSession,
  sessionQueue,
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

  it('two overlapping subscribers share one channel', async () => {
    // Mood tab subscribes, then Partner tab subscribes before the first
    // resolves — one tap apart on adjacent bottom-nav buttons.
    const pendingA = moodSyncService.subscribeMoodUpdates(vi.fn());
    const pendingB = moodSyncService.subscribeMoodUpdates(vi.fn());

    resolveNextSession();
    resolveNextSession();
    const [unsubscribeA, unsubscribeB] = await Promise.all([pendingA, pendingB]);

    // The real client deduped these to one object; opening a second would mean
    // the service is keying on something other than the topic.
    expect(constructedChannels).toHaveLength(1);
    expect(openChannels.get(TOPIC)).toBe(constructedChannels[0]);

    unsubscribeA();
    unsubscribeB();
  });

  it('one subscriber leaving does not tear the channel out from under the other', async () => {
    const onMoodA = vi.fn();
    const onMoodB = vi.fn();

    const pendingA = moodSyncService.subscribeMoodUpdates(onMoodA);
    const pendingB = moodSyncService.subscribeMoodUpdates(onMoodB);
    resolveNextSession();
    resolveNextSession();
    const [unsubscribeA, unsubscribeB] = await Promise.all([pendingA, pendingB]);

    const channel = constructedChannels[0];

    // A's component already unmounted, so its cleanup runs while B is mounted.
    unsubscribeA();

    // The whole defect: this used to remove the shared channel, and B then
    // silently stopped receiving partner moods for the life of the page.
    expect(removeChannel).not.toHaveBeenCalled();
    expect(openChannels.get(TOPIC)).toBe(channel);

    emitMood(channel, 'mood-after-a-left');

    expect(onMoodA).not.toHaveBeenCalled();
    expect(onMoodB).toHaveBeenCalledTimes(1);
    expect(onMoodB).toHaveBeenCalledWith(expect.objectContaining({ id: moodIdFor('mood-after-a-left') }));

    unsubscribeB();
  });

  it('the last subscriber to leave removes the channel', async () => {
    const pendingA = moodSyncService.subscribeMoodUpdates(vi.fn());
    const pendingB = moodSyncService.subscribeMoodUpdates(vi.fn());
    resolveNextSession();
    resolveNextSession();
    const [unsubscribeA, unsubscribeB] = await Promise.all([pendingA, pendingB]);

    const channel = constructedChannels[0];

    unsubscribeA();
    expect(removeChannel).not.toHaveBeenCalled();

    unsubscribeB();
    expect(removeChannel).toHaveBeenCalledTimes(1);
    expect(removeChannel).toHaveBeenCalledWith(channel);

    // The topic is not free yet — the client holds it until the server acks.
    expect(openChannels.get(TOPIC)).toBe(channel);
    expect(channel.state).toBe('leaving');

    ackNextLeave();
    expect(openChannels.has(TOPIC)).toBe(false);
  });

  it('both subscribers receive the same broadcast', async () => {
    const onMoodA = vi.fn();
    const onMoodB = vi.fn();

    const pendingA = moodSyncService.subscribeMoodUpdates(onMoodA);
    const pendingB = moodSyncService.subscribeMoodUpdates(onMoodB);
    resolveNextSession();
    resolveNextSession();
    const [unsubscribeA, unsubscribeB] = await Promise.all([pendingA, pendingB]);

    emitMood(constructedChannels[0], 'shared-mood');

    // Only the first `.on()` handler is registered on the shared channel, so a
    // fan-out that forgot the second consumer would leave B silent.
    expect(onMoodA).toHaveBeenCalledWith(expect.objectContaining({ id: moodIdFor('shared-mood') }));
    expect(onMoodB).toHaveBeenCalledWith(expect.objectContaining({ id: moodIdFor('shared-mood') }));

    unsubscribeA();
    unsubscribeB();
  });

  it('a subscriber that joins an already-open channel is told the current status', async () => {
    const onStatusA = vi.fn();
    const pendingA = moodSyncService.subscribeMoodUpdates(vi.fn(), onStatusA);
    resolveNextSession();
    const unsubscribeA = await pendingA;

    emitStatus(constructedChannels[0], 'SUBSCRIBED');
    expect(onStatusA).toHaveBeenCalledWith('SUBSCRIBED');

    // B attaches after subscribe() already reported. Its connection indicator
    // would otherwise sit on its initial value forever, showing "disconnected"
    // over a live channel.
    const onStatusB = vi.fn();
    const pendingB = moodSyncService.subscribeMoodUpdates(vi.fn(), onStatusB);
    resolveNextSession();
    const unsubscribeB = await pendingB;

    expect(onStatusB).toHaveBeenCalledWith('SUBSCRIBED');

    // And it keeps receiving later transitions.
    emitStatus(constructedChannels[0], 'TIMED_OUT');
    expect(onStatusB).toHaveBeenLastCalledWith('TIMED_OUT');

    unsubscribeA();
    unsubscribeB();
  });

  it('a second call to the same unsubscribe is a no-op', async () => {
    // usePartnerMood can invoke this twice: from its own !isMounted branch and
    // again from the effect cleanup. Calling it twice must not consume the
    // other consumer's registration.
    const onMoodB = vi.fn();
    const pendingA = moodSyncService.subscribeMoodUpdates(vi.fn());
    const pendingB = moodSyncService.subscribeMoodUpdates(onMoodB);
    resolveNextSession();
    resolveNextSession();
    const [unsubscribeA, unsubscribeB] = await Promise.all([pendingA, pendingB]);

    unsubscribeA();
    unsubscribeA();

    expect(removeChannel).not.toHaveBeenCalled();
    emitMood(constructedChannels[0], 'still-delivered');
    expect(onMoodB).toHaveBeenCalledTimes(1);

    unsubscribeB();
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });

  it('two consumers passing the same callback reference unsubscribe independently', async () => {
    // Set-of-callbacks would collapse these into one entry, and the first
    // unsubscribe would then take the channel down under the second.
    const shared = vi.fn();
    const pendingA = moodSyncService.subscribeMoodUpdates(shared);
    const pendingB = moodSyncService.subscribeMoodUpdates(shared);
    resolveNextSession();
    resolveNextSession();
    const [unsubscribeA, unsubscribeB] = await Promise.all([pendingA, pendingB]);

    unsubscribeA();
    expect(removeChannel).not.toHaveBeenCalled();

    unsubscribeB();
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });

  it('a subscriber arriving during the previous leave still gets a working channel', async () => {
    // The Mood tab -> Partner tab swap. React runs the outgoing effect's
    // cleanup and then the incoming effect's setup back to back, so the second
    // subscribe lands inside the first one's leave round-trip.
    const onMoodA = vi.fn();
    const pendingA = moodSyncService.subscribeMoodUpdates(onMoodA);
    resolveNextSession();
    const unsubscribeA = await pendingA;

    unsubscribeA();
    expect(removeChannel).toHaveBeenCalledTimes(1);
    // Still claimed: `supabase.channel(TOPIC)` would hand this dying object back.
    expect(openChannels.get(TOPIC)!.state).toBe('leaving');

    const onMoodB = vi.fn();
    const pendingB = moodSyncService.subscribeMoodUpdates(onMoodB);
    resolveNextSession();
    // B has installed its token, the last step before it looks for the topic.
    await vi.waitFor(() => expect(setAuth).toHaveBeenCalledTimes(2));

    // The defect this guards: B used to take the leaving channel, call
    // subscribe() on it — a no-op, since the join is gated on state 'closed' —
    // and then receive nothing at all for the life of the page. B must instead
    // still be waiting, not holding a channel.
    expect(constructedChannels).toHaveLength(1);

    ackNextLeave();
    const unsubscribeB = await pendingB;

    expect(constructedChannels).toHaveLength(2);
    const reopened = constructedChannels[1];
    expect(reopened).not.toBe(constructedChannels[0]);
    expect(reopened.state).toBe('joined');

    emitMood(reopened, 'after-reopen');
    expect(onMoodB).toHaveBeenCalledWith(expect.objectContaining({ id: moodIdFor('after-reopen') }));
    expect(onMoodA).not.toHaveBeenCalled();

    unsubscribeB();
  });

  it('two subscribers arriving during one leave share a single reopened channel', async () => {
    const pendingA = moodSyncService.subscribeMoodUpdates(vi.fn());
    resolveNextSession();
    const unsubscribeA = await pendingA;
    unsubscribeA();

    // Both arrive while the leave is unacked.
    const pendingB = moodSyncService.subscribeMoodUpdates(vi.fn());
    const pendingC = moodSyncService.subscribeMoodUpdates(vi.fn());
    resolveNextSession();
    resolveNextSession();
    // Both have installed their tokens (A's was the first), so both are
    // waiting on that one leave.
    await vi.waitFor(() => expect(setAuth).toHaveBeenCalledTimes(3));

    ackNextLeave();
    const [unsubscribeB, unsubscribeC] = await Promise.all([pendingB, pendingC]);

    // Exactly one replacement — both waiters must not each open their own.
    expect(constructedChannels).toHaveLength(2);

    unsubscribeB();
    expect(removeChannel).toHaveBeenCalledTimes(1);
    unsubscribeC();
    expect(removeChannel).toHaveBeenCalledTimes(2);
  });

  it("a dead channel's late CLOSED does not pin its replacement to disconnected", async () => {
    // The status callback used to look the entry up by topic when stashing
    // `lastStatus`. A terminal status from a channel that has since been
    // replaced under the same topic therefore landed on its REPLACEMENT, and
    // the replay below handed that stale CLOSED to the next consumer to
    // attach — a live channel reporting itself disconnected, permanently.
    const pendingA = moodSyncService.subscribeMoodUpdates(vi.fn());
    resolveNextSession();
    const unsubscribeA = await pendingA;

    const dead = constructedChannels[0];
    emitStatus(dead, 'SUBSCRIBED');

    unsubscribeA();
    ackNextLeave();

    // A replacement opens under the same topic.
    const pendingB = moodSyncService.subscribeMoodUpdates(vi.fn());
    resolveNextSession();
    const unsubscribeB = await pendingB;

    const live = constructedChannels[1];
    expect(live).not.toBe(dead);
    emitStatus(live, 'SUBSCRIBED');

    // The old channel's terminal callback finally fires, after its replacement
    // is already registered under the topic.
    emitStatus(dead, 'CLOSED');

    // A third consumer attaches to the LIVE channel and gets the replay.
    const onStatusC = vi.fn();
    const pendingC = moodSyncService.subscribeMoodUpdates(vi.fn(), onStatusC);
    resolveNextSession();
    const unsubscribeC = await pendingC;

    expect(onStatusC).toHaveBeenCalledWith('SUBSCRIBED');
    expect(onStatusC).not.toHaveBeenCalledWith('CLOSED');

    unsubscribeB();
    unsubscribeC();
  });

  it('opens the topic as a private channel, with the JWT installed before the join', async () => {
    const pending = moodSyncService.subscribeMoodUpdates(vi.fn());
    resolveNextSession();
    const unsubscribe = await pending;

    // A public join to this topic is readable and writable by anyone holding
    // the project's anon key; `private: true` is what makes the SELECT policy
    // on realtime.messages run at all.
    expect(channelConfigs).toEqual([
      { config: { broadcast: { self: false }, private: true } },
    ]);
    // And the token has to be on the socket first, or the join is evaluated
    // against the anon key and denied.
    expect(opOrder).toEqual(['setAuth', `subscribe:${TOPIC}`]);

    unsubscribe();
  });

  it('drops a broadcast from someone who is not the partner', async () => {
    const onMood = vi.fn();
    const pending = moodSyncService.subscribeMoodUpdates(onMood);
    resolveNextSession();
    const unsubscribe = await pending;

    // The identity check lives in the service, not in each consumer:
    // PartnerMoodView raised a toast for ANY broadcast, so a check that only
    // usePartnerMood performed left that path exposed.
    emitMood(constructedChannels[0], 'forged', { user_id: OUTSIDER_ID });

    expect(onMood).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('drops malformed broadcasts without reaching a subscriber', async () => {
    const onMood = vi.fn();
    const pending = moodSyncService.subscribeMoodUpdates(onMood);
    resolveNextSession();
    const unsubscribe = await pending;

    const channel = constructedChannels[0];

    // A non-array mood_types used to be indexed and mapped straight into three
    // mood views; an unknown mood_type has no MOOD_CONFIG entry; a missing
    // created_at leaves the timeline with no timestamp to sort on.
    emitMood(channel, 'string-moods', { mood_types: 'happy' });
    emitMood(channel, 'number-moods', { mood_types: 7 });
    emitMood(channel, 'unknown-type', { mood_type: 'hangry' });
    emitMood(channel, 'no-created-at', { created_at: undefined });
    channel.broadcastHandlers.forEach((handler) =>
      handler({ payload: 'not an object' } as unknown as { payload: Record<string, unknown> })
    );

    expect(onMood).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('delivers a valid multi-mood broadcast whole', async () => {
    const onMood = vi.fn();
    const pending = moodSyncService.subscribeMoodUpdates(onMood);
    resolveNextSession();
    const unsubscribe = await pending;

    const id = emitMood(constructedChannels[0], 'multi', { mood_types: ['happy', 'tired'] });

    expect(onMood).toHaveBeenCalledWith(
      expect.objectContaining({ id, mood_types: ['happy', 'tired'] })
    );
    // The wire carries no updated_at; the receiver has always used the creation
    // time in its place.
    expect(onMood.mock.calls[0][0]).toMatchObject({ updated_at: '2026-08-03T12:00:00.000Z' });

    unsubscribe();
  });

  it('returns a no-op unsubscribe when there is no session', async () => {
    const pending = moodSyncService.subscribeMoodUpdates(vi.fn());
    const resolve = sessionQueue.shift();
    resolve?.({ data: { session: null } });

    const unsubscribe = await pending;
    unsubscribe();

    expect(constructedChannels).toHaveLength(0);
    expect(removeChannel).not.toHaveBeenCalled();
  });
});
