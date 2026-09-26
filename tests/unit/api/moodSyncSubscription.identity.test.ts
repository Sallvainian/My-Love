/**
 * moodSyncService.subscribeMoodUpdates — channel ownership: who a delivered
 * mood may come from and who it may go to
 *
 * Two consumers subscribe in practice — usePartnerMood (Mood tab) and
 * PartnerMoodView (Partner tab) — and both share one channel per topic. These
 * tests cover the partner snapshot taken at join and re-taken on a re-join, and
 * the session check that mutes the channel once the device is signed in as a
 * different account. The Realtime fake is in `fakeMoodRealtime.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  constructedChannels,
  emitEvent,
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
  nextLookupHandled,
  OUTSIDER_ID,
  PARTNER_ID,
  resetRealtimeFake,
  resolveNextSession,
  setAuth,
  socket,
  teardownRealtimeFake,
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

  it('stops dispatching once the device is signed in as a different account', async () => {
    const onMood = vi.fn();
    const pending = moodSyncService.subscribeMoodUpdates(onMood);
    resolveNextSession();
    const unsubscribe = await pending;

    const channel = constructedChannels[0];
    emitMood(channel, 'before-switch');
    expect(onMood).toHaveBeenCalledTimes(1);

    // Sign-out, or a second account on a shared device, while this channel is
    // still open. The next join re-checks, and the topic no longer belongs to
    // whoever is signed in.
    getSignedInUserId.mockResolvedValue(OUTSIDER_ID);
    const sessionChecked = nextLookupHandled('session');
    emitStatus(channel, 'SUBSCRIBED');
    await sessionChecked;

    emitMood(channel, 'after-switch');
    expect(onMood).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('keeps the join-time snapshot on the FIRST SUBSCRIBED', async () => {
    // `subscribeMoodUpdates` resolved the partner moments before the join and
    // assigned it. Re-taking it here would null a fresh value and re-fetch it
    // over a `users` round-trip, and `parseMoodBroadcast` drops everything for
    // want of a partner id while that is in flight -- so a mood sent as the
    // view opens would be lost, silently and for good.
    const onMood = vi.fn();
    const pending = moodSyncService.subscribeMoodUpdates(onMood);
    resolveNextSession();
    const unsubscribe = await pending;

    const channel = constructedChannels[0];
    const lookupsAfterJoin = getPartnerId.mock.calls.length;
    const sessionReadsAfterJoin = getSignedInUserId.mock.calls.length;

    // Were this SUBSCRIBED to refresh, the mood below would land in the window
    // where the snapshot is null and be dropped.
    const sessionChecked = nextLookupHandled('session');
    emitStatus(channel, 'SUBSCRIBED');
    emitMood(channel, 'immediately-after-join');
    expect(onMood).toHaveBeenCalledTimes(1);

    // The join's only check is the session read; once it has been acted on,
    // the identity check is over.
    await sessionChecked;
    // Exactly one session read. A refresh chained after the check starts with
    // a second one, before this line runs -- and clears the snapshot, so the
    // mood below would be dropped.
    expect(getSignedInUserId.mock.calls.length).toBe(sessionReadsAfterJoin + 1);
    emitMood(channel, 'after-the-check');
    expect(onMood).toHaveBeenCalledTimes(2);
    // And it cost no second round-trip.
    expect(getPartnerId.mock.calls.length).toBe(lookupsAfterJoin);

    unsubscribe();
  });

  it('re-takes the partner snapshot on a RE-join', async () => {
    const onMood = vi.fn();
    const pending = moodSyncService.subscribeMoodUpdates(onMood);
    resolveNextSession();
    const unsubscribe = await pending;

    const channel = constructedChannels[0];

    // The join itself. Everything after this is a re-join.
    const joinChecked = nextLookupHandled('session');
    emitStatus(channel, 'SUBSCRIBED');
    await joinChecked;

    // The relationship ended while the channel was up. RLS is re-evaluated at
    // the re-join, and so is this snapshot.
    getPartnerId.mockResolvedValue(null);
    const refreshed = nextLookupHandled('partner');
    emitStatus(channel, 'SUBSCRIBED');
    await refreshed;

    emitMood(channel, 'after-unlink');
    expect(onMood).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('keeps the partner when a RE-join refresh is inconclusive', async () => {
    // The refresh clears the snapshot BEFORE its round-trips, to close the
    // ex-partner window. So a lookup that fails every attempt and writes its
    // null back leaves the channel muted for the life of the page view:
    // `refreshChannelIdentity` runs only on SUBSCRIBED and a healthy socket
    // emits no further one. An ex-partner cannot exploit the restored value --
    // `couple_broadcast_partner_can_send` pins the send on `get_my_partner_id()`,
    // so after a real unlink the server refuses their insert outright.
    const onMood = vi.fn();
    const pending = moodSyncService.subscribeMoodUpdates(onMood);
    resolveNextSession();
    const unsubscribe = await pending;

    const channel = constructedChannels[0];

    // The join itself. Everything after this is a re-join.
    const joinChecked = nextLookupHandled('session');
    emitStatus(channel, 'SUBSCRIBED');
    await joinChecked;

    // The socket drops and rejoins; the `users` read fails outright.
    getPartnerId.mockRejectedValueOnce(new Error('network down'));
    const refreshed = nextLookupHandled('partner');
    emitStatus(channel, 'SUBSCRIBED');
    await refreshed;

    emitMood(channel, 'after-the-blip');
    expect(onMood).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('a later subscriber re-arms a snapshot a failed refresh had nulled', async () => {
    // The recovery half of the line above: `entry.partnerId = partnerIdAtJoin`
    // runs for EVERY caller, not only the one that opens the channel. Without
    // it, a refresh that resolved null — a failed `users` lookup, or a session
    // read that momentarily reported no account — leaves the entry muted for
    // the life of the page, because `refreshChannelIdentity` only runs on the
    // next SUBSCRIBED and an already-joined channel never emits another.
    const onMoodA = vi.fn();
    const pendingA = moodSyncService.subscribeMoodUpdates(onMoodA);
    resolveNextSession();
    const unsubscribeA = await pendingA;

    const channel = constructedChannels[0];

    // The join, then the re-join whose lookup fails. Only a RE-join refreshes,
    // so the failing lookup has to be the second SUBSCRIBED.
    const joinChecked = nextLookupHandled('session');
    emitStatus(channel, 'SUBSCRIBED');
    await joinChecked;

    getPartnerId.mockResolvedValue(null);
    const refreshed = nextLookupHandled('partner');
    emitStatus(channel, 'SUBSCRIBED');
    await refreshed;

    emitMood(channel, 'while-muted');
    expect(onMoodA).not.toHaveBeenCalled();

    // The Partner tab mounts. Its own lookup succeeds, and that is the only
    // thing that can restore delivery for BOTH consumers.
    getPartnerId.mockResolvedValue(PARTNER_ID);
    const onMoodB = vi.fn();
    const pendingB = moodSyncService.subscribeMoodUpdates(onMoodB);
    resolveNextSession();
    const unsubscribeB = await pendingB;

    expect(constructedChannels).toHaveLength(1);

    emitMood(channel, 'after-rearm');
    expect(onMoodB).toHaveBeenCalledTimes(1);
    expect(onMoodA).toHaveBeenCalledTimes(1);

    unsubscribeA();
    unsubscribeB();
  });

  it('a later subscriber whose lookup fails does not mute a working channel', async () => {
    // The other half of the line above. `entry.partnerId = partnerIdAtJoin`
    // must not run when the lookup FAILED: getPartnerId answers null for a
    // transient `users` error exactly as it does for an unlink, so an
    // unguarded write here lets the second consumer's failed round-trip
    // silently stop partner moods for the first one too — and nothing
    // re-arms it, because refreshChannelIdentity fires only on SUBSCRIBED
    // and an already-joined channel emits no further one.
    const onMoodA = vi.fn();
    const pendingA = moodSyncService.subscribeMoodUpdates(onMoodA);
    resolveNextSession();
    const unsubscribeA = await pendingA;

    const channel = constructedChannels[0];

    emitMood(channel, 'before');
    expect(onMoodA).toHaveBeenCalledTimes(1);

    // The Partner tab mounts while the websocket is healthy, but its `users`
    // round-trip fails.
    getPartnerId.mockResolvedValue(null);
    const onMoodB = vi.fn();
    const pendingB = moodSyncService.subscribeMoodUpdates(onMoodB);
    resolveNextSession();
    const unsubscribeB = await pendingB;

    expect(constructedChannels).toHaveLength(1);

    // Both consumers still receive the partner's mood.
    emitMood(channel, 'after');
    expect(onMoodA).toHaveBeenCalledTimes(2);
    expect(onMoodB).toHaveBeenCalledTimes(1);

    unsubscribeA();
    unsubscribeB();
  });

  it('re-takes the snapshot on the first SUBSCRIBED when the join lookup failed', async () => {
    // Mirror of the love-notes case: `partnerIdAtJoin` is null because the
    // lookup failed, not because the user is unlinked, so the entry must not be
    // marked fresh -- nothing else would re-arm it with one consumer mounted.
    getPartnerId.mockResolvedValue(null);

    const onMood = vi.fn();
    const pending = moodSyncService.subscribeMoodUpdates(onMood);
    resolveNextSession();
    const unsubscribe = await pending;

    const channel = constructedChannels[0];

    // The retry succeeds this time.
    getPartnerId.mockResolvedValue(PARTNER_ID);
    const refreshed = nextLookupHandled('partner');
    emitStatus(channel, 'SUBSCRIBED');
    await refreshed;

    emitMood(channel, 'after-recovery');
    expect(onMood).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('a failed session read at the first SUBSCRIBED does not mute the channel', async () => {
    // `getSignedInUserId` answers null for a FAILED `getSession` exactly as it
    // does for "signed out", so reading that null as an account change muted
    // the channel on a session the user still held -- terminally, because
    // `refreshChannelIdentity` runs only on a later SUBSCRIBED and a healthy
    // socket emits none. The scenario: the access token expires as the channel
    // joins and the refresh hits a network blip.
    const onMood = vi.fn();
    const pending = moodSyncService.subscribeMoodUpdates(onMood);
    resolveNextSession();
    const unsubscribe = await pending;

    const channel = constructedChannels[0];

    getSignedInUserId.mockRejectedValue(new Error('network down'));
    const sessionChecked = nextLookupHandled('session');
    emitStatus(channel, 'SUBSCRIBED');
    await sessionChecked;

    // The read told us nothing, so the join-time snapshot stands.
    emitMood(channel, 'after-inconclusive-read');
    expect(onMood).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('still mutes when the session read conclusively reports another account', async () => {
    // The other side of the line above: a CONCLUSIVE answer naming a different
    // account still stops dispatch on the first SUBSCRIBED.
    const onMood = vi.fn();
    const pending = moodSyncService.subscribeMoodUpdates(onMood);
    resolveNextSession();
    const unsubscribe = await pending;

    const channel = constructedChannels[0];

    getSignedInUserId.mockResolvedValue(OUTSIDER_ID);
    const sessionChecked = nextLookupHandled('session');
    emitStatus(channel, 'SUBSCRIBED');
    await sessionChecked;

    emitMood(channel, 'after-account-change');
    expect(onMood).not.toHaveBeenCalled();

    unsubscribe();
  });
});

describe('a partner link made while the channel is open', () => {
  beforeEach(() => {
    resetRealtimeFake();
    // The account is unlinked when the channel joins.
    getPartnerId.mockResolvedValue(null);
  });

  afterEach(async () => {
    await teardownRealtimeFake();
  });

  /** Subscribe unlinked, and let the first SUBSCRIBED finish its (null) lookup. */
  async function joinUnlinked(onMood = vi.fn(), onPartnerLinked?: () => void) {
    const pending = moodSyncService.subscribeMoodUpdates(onMood, undefined, onPartnerLinked);
    resolveNextSession();
    const unsubscribe = await pending;
    const channel = constructedChannels[0];
    // Unlinked at join, so the first SUBSCRIBED re-takes the snapshot, and it
    // is still null.
    const joined = nextLookupHandled('partner');
    emitStatus(channel, 'SUBSCRIBED');
    await joined;
    return { channel, unsubscribe };
  }

  it('drops the new partner\'s moods until something re-arms the snapshot', async () => {
    // The premise the two fixes below exist for.
    const onMood = vi.fn();
    const { channel, unsubscribe } = await joinUnlinked(onMood);
    getPartnerId.mockResolvedValue(PARTNER_ID);

    emitMood(channel, 'after-link-before-rearm');

    expect(onMood).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('partner_linked tells every subscriber and re-arms the snapshot', async () => {
    const onMood = vi.fn();
    const onPartnerLinked = vi.fn();
    const { channel, unsubscribe } = await joinUnlinked(onMood, onPartnerLinked);

    // The other account accepted this one's request, then announced it.
    getPartnerId.mockResolvedValue(PARTNER_ID);
    const rearmed = nextLookupHandled('partner');
    emitEvent(channel, 'partner_linked');
    expect(onPartnerLinked).toHaveBeenCalledTimes(1);
    await rearmed;

    emitMood(channel, 'after-link');
    expect(onMood).toHaveBeenCalledTimes(1);
    // A mood is not a link announcement.
    expect(onPartnerLinked).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('refreshPartnerSnapshots re-arms the accepting device\'s own channel', async () => {
    const onMood = vi.fn();
    const { channel, unsubscribe } = await joinUnlinked(onMood);

    getPartnerId.mockResolvedValue(PARTNER_ID);
    await moodSyncService.refreshPartnerSnapshots();

    emitMood(channel, 'after-accept');
    expect(onMood).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
