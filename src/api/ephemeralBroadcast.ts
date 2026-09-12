/**
 * One-shot broadcast over a short-lived Realtime channel
 *
 * Mood sync and love notes both push to a partner's topic by opening a channel,
 * subscribing, sending, and closing again. Written per call site that pattern
 * breaks as soon as two sends to the same topic overlap, because
 * `supabase.channel(topic)` does not mint a channel per call — RealtimeClient
 * returns whatever is already registered under the topic
 * (RealtimeClient.js:277-288):
 *
 *   1. Send A opens the channel and subscribes; the channel leaves state
 *      'closed'.
 *   2. Send B calls `supabase.channel(sameTopic)` and is handed A's object.
 *      Its `.subscribe(cb)` registers nothing and never fires, because the whole
 *      join is gated on `state == closed` (RealtimeChannel.js:127) — so B's
 *      promise never settles.
 *   3. A finishes and removes the channel out from under B.
 *
 * The partner silently never receives B. In practice that is the second of two
 * moods in one `syncPendingMoods` pass, or a second love note sent before the
 * first one's channel finished closing.
 *
 * Closing is equally load-bearing: `removeChannel` only awaits
 * `channel.unsubscribe()` (RealtimeClient.js:213-219), which resolves on the
 * server's leave ack, and the registry entry is dropped later still from the
 * `_onClose` hook (RealtimeChannel.js:81-86). So the next send must wait for the
 * leave, not merely for the send.
 *
 * Sends are therefore queued per topic, and each one awaits its own teardown
 * before the next starts.
 *
 * Every send here is PRIVATE, and goes over the REST broadcast endpoint rather
 * than the websocket.
 *
 * `love-notes:<uuid>` and `mood-updates:<uuid>` used to be public topics that
 * anyone holding the anon key could join and publish to. They are private now,
 * authorized by the INSERT policy `couple_broadcast_partner_can_send` on
 * `realtime.messages` (20260912010000_private_couple_broadcast_policies.sql),
 * which admits a send only to the caller's current partner's topic. A caller
 * with no session, or whose partner link has gone, is rejected -- there is
 * deliberately no public fallback.
 *
 * Why REST and not a socket join. A sender holds INSERT on the partner's topic
 * and deliberately NOT SELECT: a sender needs send permission, not blanket read
 * permission across partner topics. Measured against realtime v2.124.4 on the
 * local stack, a private websocket join with INSERT and no SELECT is refused --
 *
 *   error_code=Unauthorized [error] Unauthorized: You do not have permissions
 *   to read from this Channel topic: love-notes:<uuid>
 *
 * -- so the join, not the send, is what a write-only grant fails. The REST
 * broadcast endpoint evaluates the same INSERT policy without requiring a join:
 * the partner's `httpSend` returns 202 and the recipient receives it, while an
 * outsider's rejects with `Unauthorized` and nothing is delivered. Widening the
 * SELECT policy to partner topics would have made the socket join work and is
 * exactly what this story exists to avoid.
 *
 * Note `httpSend`, not `send`. The SDK's `send()` silently falls back to the
 * same REST endpoint when the channel is not joined -- but it swallows the
 * denial and resolves 'ok', which is measured behaviour, not a guess. Only
 * `httpSend` surfaces the rejection the caller has to see.
 *
 * @module api/ephemeralBroadcast
 */

import { logger } from '../utils/logger';
import { waitForSocketReady } from './realtimeSocket';
import { supabase } from './supabaseClient';

/**
 * Upper bound on one send's HTTP request.
 *
 * Passed straight to `httpSend`, which aborts the fetch when it elapses. It
 * exists so that a request that never answers cannot wedge the queue for its
 * topic permanently — that would be a worse failure than the one being fixed.
 */
const BROADCAST_TIMEOUT_MS = 15_000;

/** In-flight send chains, one per topic. */
const sendChains = new Map<string, Promise<unknown>>();

/** Open a channel, send exactly one broadcast, and close it again. */
async function openSendClose(
  topic: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  // Claim the topic BEFORE waiting on the socket, not after. `channel()` pushes
  // into the client's registry synchronously (RealtimeClient.js:277-288), and
  // `removeChannel` only tears the socket down when that registry is empty
  // (:215-217) -- so once we are in it, no other topic's teardown can be the
  // last channel out and disconnect from under us.
  //
  // The queues are per-topic but the socket is global, which is what made the
  // other order wrong: awaiting first left a microtask in which a send on a
  // DIFFERENT topic could finish its `finally`, drop the last channel and
  // disconnect, leaving this send's `removeChannel` to drive a socket it never
  // shared.
  const channel = supabase.channel(topic, { config: { private: true } });

  // Everything after the claim runs inside the `try`, so that every path out of
  // this function goes through the `removeChannel` below. Both awaits here can
  // reject -- `setAuth` on a refresh failure, `waitForSocketReady` on its own
  // timeout -- and before this block was widened either rejection left the topic
  // in the client's registry for the life of the page. The claim itself stays
  // outside: it is synchronous and cannot throw past the registry push, and
  // moving it in would buy nothing while blurring the claim-then-wait order the
  // comment above depends on.
  try {
    // The REST endpoint authorizes against the socket's access token, which is
    // the anon key until this runs -- and an anon caller holds no EXECUTE on
    // get_my_partner_id, so the policy would never even be reached. It only sets
    // the token, so it slots between the claim above and the wait below without
    // disturbing either.
    await supabase.realtime.setAuth();

    // Retained deliberately. The REST send below does not need the socket, but
    // the `removeChannel` in the `finally` still drives the shared socket's
    // disconnect when it takes the last channel out, and the claim-then-wait
    // order this queue was built around is unchanged. Dropping it would be a
    // change to the socket lifecycle that this story did not measure.
    await waitForSocketReady();

    // `httpSend` resolves only on a 202 and rejects on anything else, including
    // the 'Unauthorized' an RLS denial produces. There is no status callback to
    // wait on and no join to time out, so the 15s bound is handed to the fetch
    // itself rather than raced against it.
    const result = await channel.httpSend(event, payload, { timeout: BROADCAST_TIMEOUT_MS });

    // Unreachable against realtime-js 2.116.0, which rejects rather than
    // returning the failure shape -- but the signature admits it, and a
    // silently dropped broadcast is the failure mode this module exists to
    // prevent.
    if (result.success === false) {
      throw new Error(`Broadcast to ${topic} was rejected (${result.status}): ${result.error}`);
    }
  } finally {
    // Awaited, not fired and forgotten: the topic stays claimed until the
    // client has let it go, and the next send in this queue would otherwise be
    // handed this dying channel.
    await supabase.removeChannel(channel);
  }
}

/**
 * Send one broadcast to a topic, queued behind any send already in flight for it
 *
 * @param topic - Realtime topic, e.g. `mood-updates:<partnerId>`
 * @param event - Broadcast event name the receiver listens for
 * @param payload - Broadcast body
 * @throws if the broadcast request is rejected — an RLS denial answers 403 and
 *   rejects with `Unauthorized` — or times out
 */
export function sendEphemeralBroadcast(
  topic: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const prior = sendChains.get(topic) ?? Promise.resolve();

  // Run next regardless of how the previous send ended — one failure must not
  // strand every later send to the same partner.
  const run = prior.then(
    () => openSendClose(topic, event, payload),
    () => openSendClose(topic, event, payload)
  );

  // The stored link is deliberately the swallowed form. It is only ever awaited
  // for sequencing, and an unhandled rejection here would be reported against a
  // caller that has nothing to do with the failure.
  const link = run.catch(() => undefined);
  sendChains.set(topic, link);

  void link.finally(() => {
    // Only drop our own link; a later send may already have replaced it.
    if (sendChains.get(topic) === link) {
      sendChains.delete(topic);
      logger.debug(`[EphemeralBroadcast] Queue for ${topic} drained`);
    }
  });

  return run;
}
