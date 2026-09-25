/**
 * useRealtimeMessages Hook
 *
 * Handles real-time message reception via Supabase Broadcast API.
 * Story 2.3 - AC-2.3.1 through AC-2.3.5
 *
 * Uses Broadcast API instead of postgres_changes per commit 9a02e56 findings:
 * - postgres_changes doesn't work reliably for cross-user updates
 * - Broadcast API provides consistent cross-user messaging
 *
 * The channel is PRIVATE. `love-notes:<uuid>` used to be a public topic, so
 * anyone holding the project's anon key could join a stranger's topic and both
 * read their notes and publish forged ones. Joining is now authorized by the
 * SELECT policy `couple_broadcast_recipient_can_receive` on
 * `realtime.messages` — receive only on your own topic — which requires
 * `supabase.realtime.setAuth()` to have run before `subscribe()`. There is
 * deliberately no public fallback when a private join is denied.
 *
 * Authorization at the transport is only half of it: RLS says who may send, not
 * what they may send, and it is evaluated at join and cached until the JWT
 * refreshes. So every payload is also parsed and identity-checked by
 * `parseLoveNoteBroadcast` before it reaches the store — which is what strips a
 * forged `imagePreviewUrl` off the wire.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { waitForSocketReady } from '../api/realtimeSocket';
import {
  resolvePartnerIdForDelivery,
  resolvePartnerLookupForDelivery,
  supabase,
} from '../api/supabaseClient';
import { parseLoveNoteBroadcast } from '../api/validation/broadcastSchemas';
import { useAppStore } from '../stores/useAppStore';
import type { LoveNote } from '../types/models';
import { logger } from '../utils/logger';

/**
 * How the love-notes feed is doing, for a consumer that wants to say so.
 *
 * `disconnected` is terminal within a mount: it means the retry ceiling was
 * reached and this hook will not try again on its own.
 */
export type NoteFeedStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

interface UseRealtimeMessagesOptions {
  onNewMessage?: (message: LoveNote) => void;
  enabled?: boolean;
}

// Retry configuration for subscription failures
const RETRY_CONFIG = {
  maxRetries: 5,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds max
};

/**
 * Love-notes topics whose channel is mid-leave, keyed to the promise that
 * settles when the server acks it.
 *
 * Defensive, and measured to be so. The registry entry is dropped from the
 * `_onClose` hook (@supabase/realtime-js
 * dist/module/RealtimeChannel.js:100-101), and on the installed SDK that hook
 * runs synchronously inside `removeChannel`, because phoenix's leave completes
 * locally without waiting for the server (assets/js/phoenix/channel.js:242,251
 * — see `releaseNoteChannel` below). So today a leave and its deregistration
 * are effectively one step, and nothing observed here is racing.
 *
 * It is kept anyway because the cost is a Map entry and the failure it guards
 * is silent: were the deregistration to become asynchronous again,
 * `supabase.channel(topic)` would hand back the dying object
 * (@supabase/realtime-js dist/module/RealtimeClient.js:335-346) and
 * `.subscribe()` on it would do nothing at all, since the whole join body is
 * gated on the channel being closed (@supabase/realtime-js
 * dist/module/RealtimeChannel.js:134 `if (this.channelAdapter.isClosed())`) —
 * a dead feed with no error anywhere.
 *
 * Line numbers are the `dist/module` build throughout this file; `dist/main`
 * is the same code at different offsets.
 *
 * Module scope, not a ref, and deliberately so: the cleanup closure of effect
 * run N and the setup closure of run N+1 never share a ref cell, and two mounts
 * of the Love Notes view both resolve to `love-notes:<uid>`. `moodSyncService`
 * gets the same effect for free by being a singleton; this hook has to say it.
 */
const closingNoteChannels = new Map<string, Promise<unknown>>();

/**
 * Hand a channel back to the client and record the leave, so the next open for
 * this topic waits it out instead of being handed the object that is still
 * going away.
 *
 * The `.catch()` is a belt, not the mechanism. `removeChannel` awaits
 * `channel.unsubscribe()`, which resolves 'ok' | 'timed out' | 'error' and has
 * no rejection path at all (@supabase/realtime-js
 * dist/module/RealtimeChannel.js:604-612), so nothing reaches it today. It is
 * kept because a rejection escaping into an unrelated open would be silent and
 * expensive, and an SDK bump is free to introduce one.
 *
 * What actually frees the topic is the SDK: phoenix sets `state = leaving`
 * BEFORE it tests `canPush()`, so `canPush()` -- which requires `isJoined()` --
 * is always false by then and the leave completes locally and at once, running
 * its close hook without waiting for the server (@supabase/phoenix
 * assets/js/phoenix/channel.js:242,250-251). That close hook is what calls
 * `socket.remove(this)`, so the client already holds no channel under this
 * topic by the time the promise here settles. Measured, not assumed:
 * tests/unit/api/realtimeLeaveContract.test.ts drives a real client and asserts
 * it for a leave the server never answers, so an SDK bump that reintroduces the
 * wait turns that file red instead of silently wedging both registries.
 */
function releaseNoteChannel(topic: string, channel: RealtimeChannel): void {
  const leaving = supabase.removeChannel(channel).catch((err) => {
    logger.debug('[useRealtimeMessages] Love-notes channel leave failed:', err);
  });
  closingNoteChannels.set(topic, leaving);
  void leaving.finally(() => {
    // Only clear our own entry — a later teardown may already have replaced it.
    if (closingNoteChannels.get(topic) === leaving) {
      closingNoteChannels.delete(topic);
    }
  });
}

/**
 * Wait out every leave recorded for this topic.
 *
 * Re-read after each await rather than awaiting the one promise captured up
 * front: a teardown landing while we wait REPLACES the entry, and the open that
 * follows would then race a leave nobody waited on.
 *
 * This loop is a deliberate DIVERGENCE from `moodSyncService`, not a copy of
 * it: that module reads `closingMoodChannels` exactly once and never re-reads
 * it after its `await closing`. The divergence is harmless rather than a bug on
 * either side — the leave and its deregistration are one synchronous step on
 * the installed SDK, so neither module can actually observe a replaced entry —
 * and it is left in place here because a re-read loop stays correct if that
 * ever stops being true, while the single read would not.
 *
 * The loop terminates because a settled leave deletes its own entry before this
 * continuation runs.
 */
async function waitForNoteChannelLeaves(topic: string): Promise<void> {
  let closing = closingNoteChannels.get(topic);
  while (closing) {
    logger.debug(`[useRealtimeMessages] Waiting for the previous ${topic} channel to close`);
    await closing;
    const next = closingNoteChannels.get(topic);
    if (next === closing) break;
    closing = next;
  }
}

/** Pull the `message` field out of a broadcast body without trusting its shape. */
function unwrapMessage(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return undefined;
  return (raw as { message?: unknown }).message;
}

export function useRealtimeMessages(options: UseRealtimeMessagesOptions = {}) {
  const { onNewMessage, enabled = true } = options;
  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Who this subscription will accept notes from, resolved before the join and
   * refreshed on every `SUBSCRIBED`. Held in a ref rather than state so that
   * refreshing it does not re-render the chat or re-run the effect.
   */
  const partnerIdRef = useRef<string | null>(null);
  /**
   * The last status a channel actually reported, tagged with the account it was
   * reported for.
   *
   * State rather than a ref because this one is meant to reach the screen --
   * every other piece of subscription bookkeeping here is a ref precisely so
   * that refreshing it does NOT re-render the chat.
   *
   * Only the reported half is stored. `idle` and `connecting` are derived below
   * instead, because setting them would mean calling setState in the effect
   * body, and the account tag is what makes that derivation safe: a sign-out or
   * an account switch changes the key, so a previous account's `disconnected`
   * can never be shown against the new one's freshly opening channel.
   */
  const [report, setReportState] = useState<{ key: string; status: NoteFeedStatus } | null>(null);

  /**
   * Write only when something actually changed.
   *
   * `setReport` is called from `handleStatus`, which a healthy channel can reach
   * repeatedly -- every re-join reports SUBSCRIBED again. A fresh object each
   * time is a new state value by identity, so React re-renders the chat for a
   * status that did not move. Harmless for the two current callers, but
   * `useRealtimeMessages` takes an `onNewMessage` callback and a caller passing
   * an inline arrow would re-run the effect on every render, which turns a
   * needless re-render into a loop.
   */
  const setReport = useCallback((next: { key: string; status: NoteFeedStatus }) => {
    setReportState((previous) =>
      previous && previous.key === next.key && previous.status === next.status ? previous : next
    );
  }, []);
  const addNote = useAppStore((state) => state.addNote);
  const userId = useAppStore((state) => state.userId);

  const handleNewMessage = useCallback(
    (raw: unknown, currentUserId: string) => {
      // Parsed, not destructured. The wire carries only server columns after
      // this: every client-only LoveNote field is stripped, `imagePreviewUrl`
      // above all, because LoveNoteMessage prefers it over the signed Storage
      // URL and a forged one would make this browser fetch an attacker host.
      const message = parseLoveNoteBroadcast(unwrapMessage(raw), {
        currentUserId,
        partnerId: partnerIdRef.current,
      });

      if (!message) {
        logger.debug('[useRealtimeMessages] Dropped an unauthorized or malformed broadcast');
        return;
      }

      logger.debug('[useRealtimeMessages] New message received:', message.id);

      // Add to store (with deduplication check in addNote)
      addNote(message);

      // Trigger vibration feedback (AC-2.3.3)
      if (navigator.vibrate) {
        navigator.vibrate([30]);
      }

      // Call optional callback
      onNewMessage?.(message);
    },
    [addNote, onNewMessage]
  );

  useEffect(() => {
    if (!enabled || !userId) return;

    let subscriptionActive = true;
    // Set when this effect run is superseded or unmounted, so the async
    // partner lookup, the wait for a previous leave, and setAuth below do not
    // go on to create and subscribe a channel this run no longer owns.
    // supabase.channel() dedupes by topic, so a superseded run and its
    // replacement would share one object, and letting both call subscribe()
    // sends duplicate phx_join frames.
    let cancelled = false;

    /**
     * Whether the retry ceiling has been reached for this effect run.
     *
     * Separate from `cancelled`, which means "this run is over". This run is
     * still live; it has simply stopped trying. The distinction matters because
     * an `openChannel` can be parked on an await when the ceiling is hit: the
     * fifth retry fires, parks on `setAuth()`, and the old channel reports
     * another failure from inside that window -- which is exactly the
     * interleaving the retry path documents below. The give-up branch then runs,
     * releases the channel and reports `disconnected`, and the parked open would
     * resume and build a fresh channel on top of it, leaving the banner saying
     * the feed is dead while a channel is live. `disconnected` is documented as
     * terminal, so it has to actually be.
     */
    let gaveUp = false;

    // Whether the partner snapshot can be trusted for the NEXT `SUBSCRIBED`.
    //
    // The first open below resolves it immediately before the first `subscribe`,
    // so it is fresh for that join and re-taking it would only cost delivery.
    // Every later join may span a relationship change, so it is marked stale
    // both after a join is reported and before the retry path opens its
    // replacement channel -- a retry is a re-join even though the original join
    // never reported SUBSCRIBED at all.
    // Starts false and is raised only once the pre-join lookup below actually
    // produces a snapshot. `resolvePartnerIdForDelivery` answers null both for a
    // genuine unlink AND for a lookup that failed all three attempts, so an
    // unconditional `true` here would let an exhausted retry pass as fresh and
    // skip the one refresh that could still recover it.
    let snapshotFresh = false;
    // The signed-in user is captured here, for the life of this effect run.
    // A different account re-runs the effect with a different topic, and this
    // run's handlers are already inert by then.
    const currentUserId = userId;
    const topic = `love-notes:${currentUserId}`;

    // Never carry the previous run's partner over; until it resolves, every
    // broadcast is dropped rather than trusted.
    partnerIdRef.current = null;

    logger.info('[useRealtimeMessages] Setting up Broadcast subscription for:', currentUserId);

    const refreshPartnerSnapshot = () => {
      // Cleared BEFORE the await, not after it. A refresh runs on every
      // SUBSCRIBED, and a re-join after a disconnect is precisely when the
      // relationship may have changed — so holding the pre-disconnect partner
      // for the length of the round-trip would check the first notes off the
      // rejoined channel against the relationship this refresh exists to
      // replace. Dropping them for that window is the safe direction.
      const previous = partnerIdRef.current;
      partnerIdRef.current = null;

      // An INCONCLUSIVE lookup restores what was there rather than leaving the
      // clear above standing. The clear is correct and has to stay, but a
      // retry that exhausts every attempt still answers null through the
      // `string | null` wrapper, so writing it back left the ref null with
      // nothing to re-arm it -- SUBSCRIBED fires once on a healthy socket --
      // and every subsequent note was dropped for the life of the mount.
      // A conclusive unlink still writes null, which is the point of the
      // refresh.
      void resolvePartnerLookupForDelivery()
        .then((lookup) => {
          if (cancelled || gaveUp) return;
          if (lookup.status === 'error') {
            partnerIdRef.current = previous;
            return;
          }
          partnerIdRef.current = lookup.status === 'linked' ? lookup.partnerId : null;
        })
        .catch(() => {
          if (cancelled || gaveUp) return;
          partnerIdRef.current = previous;
        });
    };

    const handleStatus = (status: string, err?: Error, source?: RealtimeChannel) => {
      logger.info('[useRealtimeMessages] Subscription status:', status, err || '');

      // A status from a channel this run has already let go is not news about
      // the live feed, and the CLOSED branch below makes that distinction
      // load-bearing: the SDK reports CLOSED for every deliberate leave, not
      // only for one the app did not ask for
      // (tests/unit/api/realtimeLeaveContract.test.ts pins both). Without these
      // two guards, releasing a channel would immediately reopen the topic it
      // was just asked to release -- on every unmount, and on every retry.
      //
      // All three release paths are already covered by the time they call
      // `releaseNoteChannel`: the cleanup lowers `subscriptionActive` first, and
      // both the retry and the give-up below null `channelRef` first.
      if (!subscriptionActive) return;
      if (source && source !== channelRef.current) return;

      // Reset retry count on successful subscription
      if (status === 'SUBSCRIBED') {
        retryCountRef.current = 0;
        setReport({ key: currentUserId, status: 'connected' });
        // And cancel the retry that failure scheduled. The SDK runs its own
        // rejoin loop on an errored channel (@supabase/phoenix
        // assets/js/phoenix/channel.js:76 `rejoinTimer.scheduleTimeout()`),
        // so a channel can report SUBSCRIBED again from INSIDE our backoff
        // window -- and now that the retry removes and recreates rather than
        // re-subscribing, letting the stale timer fire would tear a healthy,
        // joined channel down. Its replacement joins with `snapshotFresh`
        // false, which nulls `partnerIdRef` for a PostgREST round-trip, and
        // every note arriving in that window is dropped. Before the retry did
        // real work this timer was harmless, which is why it was never cleared
        // here.
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }
        // Only a RE-join re-takes the snapshot. The relationship may have
        // changed while the channel was down, so trusting the original join's
        // value across a reconnect would be wrong.
        //
        // The FIRST join is not that case, and refreshing it costs delivery for
        // nothing: the first open resolved the snapshot and assigned it
        // microseconds before calling `subscribe`, so clearing it here would
        // discard a fresh value and re-fetch it over a new PostgREST
        // round-trip. `parseLoveNoteBroadcast` drops every note for want of a
        // partner id while that is in flight — and nothing re-fetches on a
        // realtime miss, so a note the partner sends as this view opens would
        // never appear until the user navigated away and came back.
        if (!snapshotFresh) {
          refreshPartnerSnapshot();
        }
        snapshotFresh = false;
        return;
      }

      // Handle subscription errors with exponential backoff (AC-2.3.5)
      //
      // CLOSED joins them. Everything deliberate has been filtered out above,
      // so a CLOSED reaching here is the server or the socket closing a topic
      // out from under a live subscription -- and the SDK schedules no rejoin
      // for that: the channel goes to `closed`, leaves the client's registry,
      // and nothing re-arms it. Before this, that left the notes feed silent
      // for the rest of the mount with no error logged and nothing on screen.
      // It shares the backoff rather than getting its own path because the
      // recovery is identical: replace the channel and join again.
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        if (status === 'CLOSED') {
          // Not `console.error`: an unsolicited close is an ordinary network
          // event, and the recovery below is expected to succeed.
          logger.info('[useRealtimeMessages] Channel closed unexpectedly; re-opening');
        } else {
          console.error('[useRealtimeMessages] Subscription error:', err);
        }

        // Check if max retries exceeded
        if (retryCountRef.current >= RETRY_CONFIG.maxRetries) {
          console.error(
            `[useRealtimeMessages] Max retries (${RETRY_CONFIG.maxRetries}) exceeded. Giving up.`
          );

          // Hand the dead channel back instead of abandoning it in place.
          // Leaving it in `channelRef` and in the client's registry keeps the
          // topic occupied for the rest of the mount, and since its join is
          // gated on the channel being closed, nothing that later reaches for
          // this topic can join either -- so giving up poisoned the topic for
          // every future consumer, not just this one.
          const abandoned = channelRef.current;
          channelRef.current = null;
          if (abandoned) {
            releaseNoteChannel(topic, abandoned);
          }

          // Checked by `openChannel` after each of its awaits, so an open
          // already in flight abandons rather than resurrecting the topic.
          gaveUp = true;

          // And say so. This is the only terminal state the hook has; until it
          // was reported, the feed just stopped and no consumer could tell.
          setReport({ key: currentUserId, status: 'disconnected' });
          return;
        }

        // Calculate delay with exponential backoff: baseDelay * 2^retryCount
        const delay = Math.min(
          RETRY_CONFIG.baseDelay * 2 ** retryCountRef.current,
          RETRY_CONFIG.maxDelay
        );

        retryCountRef.current++;
        setReport({ key: currentUserId, status: 'reconnecting' });

        logger.debug(
          `[useRealtimeMessages] Retry attempt ${retryCountRef.current}/${RETRY_CONFIG.maxRetries} in ${delay}ms`
        );

        // Clear any existing retry timeout
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }

        // Schedule retry with exponential backoff. The delays are unchanged;
        // what is new is that the retry REPLACES the channel instead of
        // re-subscribing the one that failed.
        //
        // `channelRef.current.subscribe(handleStatus)` could never rejoin:
        // RealtimeChannel gates its entire join body on the channel already
        // being closed (@supabase/realtime-js
        // dist/module/RealtimeChannel.js:134
        // `if (this.channelAdapter.isClosed())`), a join-push or socket-level
        // error leaves it `errored` (@supabase/realtime-js
        // dist/module/RealtimeChannel.js:169, @supabase/phoenix
        // assets/js/phoenix/channel.js:75), and a `subscribe()` that misses the
        // gate just `return this` — no phx_join frame, no status callback,
        // silence for the life of the page. Only a fresh object can join the
        // topic again, and it can only be created once the leave of the old one
        // has landed.
        //
        // The setAuth() ahead of the join stays where it was, inside
        // `openChannel`: a retry is a re-join, and a private join is authorized
        // against the token on the socket. Without it a retry that was
        // scheduled because the token had gone stale would re-join with the
        // stale token and be denied again — five times, and then give up.
        // `openChannel` is also what releases the failed channel, and only
        // once that setAuth has RESOLVED: releasing first would mean a rejected
        // token install left no channel at all, and with nothing left to report
        // a status, nothing would ever schedule another retry.
        retryTimeoutRef.current = setTimeout(() => {
          if (!subscriptionActive) return;

          // The backoff has elapsed since the snapshot was taken and this is
          // a fresh join, so the SUBSCRIBED it produces must re-take it. The
          // retry itself deliberately does NOT re-resolve the partner before
          // joining: every re-join re-takes the snapshot on SUBSCRIBED, and
          // doing it here as well would take it twice.
          snapshotFresh = false;

          void openChannel({ takeSnapshot: false, releaseCurrent: true })
            // A rejected token install — or a rejected leave, or anything else
            // thrown in there — must not surface as an unhandled rejection.
            // The retry is simply not made; the next CHANNEL_ERROR schedules
            // another, and the channel stays closed meanwhile, which is the
            // safe direction.
            .catch((error) => {
              console.error('[useRealtimeMessages] Retry setup failed:', error);
            });
        }, delay);
      }
    };

    /**
     * Open (or re-open) this run's channel.
     *
     * Ordering follows moodSyncService's: the two round-trips first (`:603`
     * the partner lookup, `:607` setAuth), then the wait for a leave in flight
     * (`:616-624`), then `waitForSocketReady()` (`:626-630`), and only then the
     * channel — with no await between that last check and `subscribe()`, which
     * is what `moodSyncService:598-600` warns the block creating the channel
     * must stay free of. Both socket-facing checks are read immediately before
     * they are acted on; putting the two round-trips after them would let
     * either go stale across an await.
     *
     * It is that ordering, not a transcription: the release step below has no
     * counterpart in moodSyncService (a refcounted singleton never throws its
     * own live channel away), and this hook skips that module's `:621`/`:629`
     * re-reads of the open map because it holds no such map — one mount owns
     * the topic (`MessageInput.tsx:50` passes `useLoveNotes(false)`).
     *
     * Creating the channel this late also closes the window in which a
     * superseded run owns a registered, never-joined channel that no later
     * cleanup can remove.
     */
    const openChannel = async ({
      takeSnapshot,
      releaseCurrent,
    }: {
      takeSnapshot: boolean;
      releaseCurrent: boolean;
    }): Promise<void> => {
      if (takeSnapshot) {
        // Snapshot the partner BEFORE the join, so the very first broadcast is
        // already checked against a known sender.
        const partnerId = await resolvePartnerIdForDelivery();
        if (cancelled || gaveUp) return;
        partnerIdRef.current = partnerId;
        // Only skip the first SUBSCRIBED's refresh when this produced a
        // snapshot. A genuinely unlinked user pays one extra round-trip that
        // answers null again; a failed lookup gets the re-fetch that keeps the
        // channel alive.
        snapshotFresh = partnerId !== null;
      }

      // Required for a private channel: Realtime authorizes the join against
      // the socket's access token, which is the anon key until this runs.
      await supabase.realtime.setAuth();
      if (cancelled || gaveUp) return;

      // Only now is the failed channel let go. Everything above can reject,
      // and a retry that had already released it would leave the hook with no
      // channel at all — nothing to report a further CHANNEL_ERROR, so nothing
      // to schedule the next retry, and a feed dead until the view is
      // remounted. Held until here, a rejected token install leaves the
      // channel in place for the SDK's own rejoin loop to recover.
      if (releaseCurrent) {
        const failed = channelRef.current;

        // ...unless it is not failed any more. The SDK runs its own rejoin
        // loop on an errored channel and schedules the first attempt 1000ms
        // out (@supabase/phoenix assets/js/phoenix/socket.js:137
        // `[1000, 2000, 5000][tries - 1]`), which is exactly when this hook's
        // first backoff elapses -- so a SUBSCRIBED can land on the old channel
        // while the awaits above are still in flight. The SUBSCRIBED branch
        // clears the pending timer, but this open is already past that point
        // and nothing else it reads can see the recovery; only the channel's
        // own state can. Replacing a joined channel here would drop every note
        // until the replacement finished joining, and buy nothing: the topic
        // is already being served.
        if (failed?.state === 'joined') {
          logger.debug(
            '[useRealtimeMessages] Channel recovered while re-opening; keeping it and dropping the retry'
          );
          return;
        }

        channelRef.current = null;
        if (failed) {
          releaseNoteChannel(topic, failed);
        }
      }

      // A leave for this topic may still be in flight — the one just recorded
      // above, or a previous mount's cleanup. Opening now would just retrieve
      // the dying channel and join nothing.
      await waitForNoteChannelLeaves(topic);
      if (cancelled || gaveUp) return;

      // Closing that channel may have been what removed the LAST channel in
      // the app, which tears the shared socket down; opening inside that window
      // silently never joins. Read last, and acted on with no await in
      // between.
      await waitForSocketReady();
      if (cancelled || gaveUp) return;

      // Created here rather than at the top of the effect: `supabase.channel()`
      // registers synchronously, and anything registered before these awaits
      // outlives a cleanup that ran while they were in flight.
      const channel = supabase
        .channel(topic, {
          config: { private: true },
        })
        .on('broadcast', { event: 'new_message' }, (payload) => {
          if (!subscriptionActive) return;
          handleNewMessage((payload as { payload?: unknown })?.payload, currentUserId);
        });

      channelRef.current = channel;

      // `handleStatus` is handed to every subscribe, first join and retry
      // alike. RealtimeChannel wires the callback it is HANDED into
      // _onError/_onClose and the joinPush receives; a join that passes none
      // reports nothing, so neither the retry-count reset nor the partner
      // refresh would ever run again.
      // Wrapped rather than handed over bare, so a status can be attributed to
      // the channel that reported it. `handleStatus` outlives any one channel --
      // the retry hands the same function to the replacement -- so without this
      // identity a late CLOSED from the channel just released is
      // indistinguishable from the live one closing.
      channel.subscribe((subscribeStatus, subscribeError) =>
        handleStatus(subscribeStatus, subscribeError, channel)
      );
    };

    void openChannel({ takeSnapshot: true, releaseCurrent: false }).catch((error) => {
      // Same reason as the retry path: without this a rejected `setAuth` — or
      // anything else thrown in here — becomes an unhandled rejection. The
      // channel simply never joins, and the snapshot stays null, so nothing is
      // dispatched that was not authorized.
      console.error('[useRealtimeMessages] Subscription setup failed:', error);
    });

    return () => {
      cancelled = true;
      subscriptionActive = false;
      partnerIdRef.current = null;

      // Clear any pending retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      if (channelRef.current) {
        logger.debug('[useRealtimeMessages] Unsubscribing from channel');
        // Through the registry, not a bare removeChannel: recording the leave
        // is what lets the next effect run for this topic wait it out instead
        // of opening the dying object.
        releaseNoteChannel(topic, channelRef.current);
        channelRef.current = null;
      }

      // Reset retry count on cleanup
      retryCountRef.current = 0;
    };
    // `setReport` is `useCallback`-stable with an empty dependency list, so
    // listing it satisfies the exhaustive-deps rule without adding a re-run.
  }, [enabled, userId, handleNewMessage, setReport]);

  // Derived, not stored: `idle` and `connecting` are facts about the props and
  // about whether anything has reported yet, so deriving them here keeps the
  // effect free of a setState that would cascade a render on every mount.
  // A report tagged with a different account is ignored rather than shown --
  // after a switch the new channel is opening, which is `connecting`.
  const feedKey = enabled && userId ? userId : '';
  const status: NoteFeedStatus = !feedKey
    ? 'idle'
    : report?.key === feedKey
      ? report.status
      : 'connecting';

  // Previously `{}`. The one terminal state this hook has -- the retry ceiling
  // giving up -- was invisible to every caller, so the notes feed could stop
  // for good with nothing anywhere to say so.
  return { status };
}
