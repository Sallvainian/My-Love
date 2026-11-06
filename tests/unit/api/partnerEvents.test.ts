/**
 * moodSyncService.subscribePartnerEvents — the partner event registry
 *
 * One `mood-updates:<uid>` channel carries three events (`PARTNER_EVENTS`:
 * `partner_linked`, `daily_pick`, `new_mood`). Each is validated by
 * `parsePartnerEvent` and fanned out to the subscribers' handler for that event
 * alone. The refcount, the reopen and the identity snapshot are covered by the
 * `moodSyncSubscription*` files; the Realtime fake is in `fakeMoodRealtime.ts`.
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
  resolvePartnerIdForDelivery: (...args: unknown[]) => getPartnerId(...args),
  resolvePartnerLookupForDelivery: (...args: unknown[]) => fakeResolvePartnerLookup(...args),
  getSignedInUserId: (...args: unknown[]) => getSignedInUserId(...args),
  resolveSignedInUserForDelivery: (...args: unknown[]) => fakeResolveSignedInUser(...args),
}));

import { moodSyncService, type PartnerEventHandlers } from '@/api/moodSyncService';
import { PARTNER_EVENTS } from '@/api/validation/broadcastSchemas';

const DAY_ID = '00000000-0000-4000-8000-0000000000d1';

/** Subscribe, let the session resolve, and hand back the one channel. */
async function join(handlers: PartnerEventHandlers) {
  const pending = moodSyncService.subscribePartnerEvents(handlers);
  resolveNextSession();
  const unsubscribe = await pending;
  return { channel: constructedChannels[0], unsubscribe };
}

describe('subscribePartnerEvents', () => {
  beforeEach(() => {
    resetRealtimeFake();
  });

  afterEach(async () => {
    await teardownRealtimeFake();
  });

  it('binds each PARTNER_EVENTS name once, when the channel is created', async () => {
    const { channel, unsubscribe } = await join({});

    const bound = channel.on.mock.calls.map(([type, filter]) => [type, filter]);
    expect(bound).toEqual(PARTNER_EVENTS.map((event) => ['broadcast', { event }]));
    expect(channel.subscribe).toHaveBeenCalledTimes(1);
    // Every binding was made before the join.
    const lastBinding = channel.on.mock.invocationCallOrder.at(-1)!;
    expect(lastBinding).toBeLessThan(channel.subscribe.mock.invocationCallOrder[0]);
    unsubscribe();
  });

  it('does not bind them again for a second subscriber', async () => {
    const first = await join({});
    const pending = moodSyncService.subscribePartnerEvents({});
    resolveNextSession();
    const second = await pending;

    expect(constructedChannels).toHaveLength(1);
    expect(first.channel.on).toHaveBeenCalledTimes(PARTNER_EVENTS.length);
    first.unsubscribe();
    second();
  });

  it('delivers new_mood to its handler as the event with the validated mood', async () => {
    const new_mood = vi.fn();
    const daily_pick = vi.fn();
    const partner_linked = vi.fn();
    const { channel, unsubscribe } = await join({ new_mood, daily_pick, partner_linked });

    const id = emitMood(channel, 'partner-mood');

    expect(new_mood).toHaveBeenCalledTimes(1);
    expect(new_mood).toHaveBeenCalledWith({
      event: 'new_mood',
      mood: expect.objectContaining({ id, user_id: PARTNER_ID, mood_type: 'happy' }),
    });
    expect(daily_pick).not.toHaveBeenCalled();
    expect(partner_linked).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('delivers partner_linked to its handler, and re-takes the snapshot', async () => {
    const new_mood = vi.fn();
    const partner_linked = vi.fn();
    const { channel, unsubscribe } = await join({ new_mood, partner_linked });

    const rearmed = nextLookupHandled('partner');
    emitEvent(channel, 'partner_linked');

    expect(partner_linked).toHaveBeenCalledTimes(1);
    expect(partner_linked).toHaveBeenCalledWith({ event: 'partner_linked' });
    expect(new_mood).not.toHaveBeenCalled();
    await rearmed;
    unsubscribe();
  });

  it('delivers daily_pick to its handler with the day id', async () => {
    const new_mood = vi.fn();
    const daily_pick = vi.fn();
    const { channel, unsubscribe } = await join({ new_mood, daily_pick });

    emitEvent(channel, 'daily_pick', { day_id: DAY_ID });

    expect(daily_pick).toHaveBeenCalledTimes(1);
    expect(daily_pick).toHaveBeenCalledWith({ event: 'daily_pick', day_id: DAY_ID });
    expect(new_mood).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('strips every key but day_id: a choice on the wire reaches no handler', async () => {
    const daily_pick = vi.fn();
    const { channel, unsubscribe } = await join({ daily_pick });

    emitEvent(channel, 'daily_pick', { day_id: DAY_ID, choice: 'this', extra: 1 });

    expect(daily_pick).toHaveBeenCalledTimes(1);
    expect(daily_pick.mock.calls[0][0]).toStrictEqual({ event: 'daily_pick', day_id: DAY_ID });
    unsubscribe();
  });

  it('fans an event out to every subscriber that has a handler for it', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const statusOnly = vi.fn();
    const a = await join({ daily_pick: first });
    const pendingB = moodSyncService.subscribePartnerEvents({ daily_pick: second });
    const pendingC = moodSyncService.subscribePartnerEvents({ onStatus: statusOnly });
    resolveNextSession();
    resolveNextSession();
    const [releaseB, releaseC] = await Promise.all([pendingB, pendingC]);

    emitEvent(a.channel, 'daily_pick', { day_id: DAY_ID });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(statusOnly).not.toHaveBeenCalled();
    a.unsubscribe();
    releaseB();
    releaseC();
  });

  it('still reports the status to onStatus', async () => {
    const onStatus = vi.fn();
    const { channel, unsubscribe } = await join({ onStatus });

    emitStatus(channel, 'SUBSCRIBED');

    expect(onStatus).toHaveBeenCalledWith('SUBSCRIBED');
    unsubscribe();
  });

  describe('dispatches nothing', () => {
    it.each([
      ['an empty payload', {}],
      ['a day_id that is not a uuid', { day_id: 'not-a-uuid' }],
      ['a numeric day_id', { day_id: 7 }],
      ['a day_id beside the wrong key', { dayId: DAY_ID }],
    ])('for a daily_pick with %s', async (_label, payload) => {
      const daily_pick = vi.fn();
      const { channel, unsubscribe } = await join({ daily_pick });

      emitEvent(channel, 'daily_pick', payload as Record<string, unknown>);

      expect(daily_pick).not.toHaveBeenCalled();
      unsubscribe();
    });

    it('for a malformed new_mood', async () => {
      const new_mood = vi.fn();
      const { channel, unsubscribe } = await join({ new_mood });

      emitMood(channel, 'bad', { mood_type: 42 });

      expect(new_mood).not.toHaveBeenCalled();
      unsubscribe();
    });

    it('for a daily_pick while the partner snapshot is null', async () => {
      getPartnerId.mockResolvedValue(null);
      const daily_pick = vi.fn();
      const { channel, unsubscribe } = await join({ daily_pick });

      emitEvent(channel, 'daily_pick', { day_id: DAY_ID });

      expect(daily_pick).not.toHaveBeenCalled();
      unsubscribe();
    });

    it('for a daily_pick once the device is signed in as a different account', async () => {
      const daily_pick = vi.fn();
      const { channel, unsubscribe } = await join({ daily_pick });
      emitEvent(channel, 'daily_pick', { day_id: DAY_ID });
      expect(daily_pick).toHaveBeenCalledTimes(1);

      getSignedInUserId.mockResolvedValue(OUTSIDER_ID);
      const sessionChecked = nextLookupHandled('session');
      emitStatus(channel, 'SUBSCRIBED');
      await sessionChecked;

      emitEvent(channel, 'daily_pick', { day_id: DAY_ID });
      expect(daily_pick).toHaveBeenCalledTimes(1);
      unsubscribe();
    });

    it('for an event the registry does not know', async () => {
      const daily_pick = vi.fn();
      const new_mood = vi.fn();
      const { channel, unsubscribe } = await join({ daily_pick, new_mood });

      emitEvent(channel, 'daily_nudge', { day_id: DAY_ID });

      expect(daily_pick).not.toHaveBeenCalled();
      expect(new_mood).not.toHaveBeenCalled();
      unsubscribe();
    });
  });
});
