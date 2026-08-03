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
 * @module api/ephemeralBroadcast
 */

import { logger } from '../utils/logger';
import { waitForSocketReady } from './realtimeSocket';
import { supabase } from './supabaseClient';

/**
 * Upper bound on one send, measured from `subscribe()` to the send resolving.
 *
 * Realtime applies its own 10s timeout and reports TIMED_OUT, which is the
 * signal we would rather act on, so this sits above it. It exists only so that a
 * channel that never reports any status at all cannot wedge the queue for its
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
  // The previous send in this queue closed its channel, and if it was the last
  // one open anywhere in the app that also tore down the socket. Opening now
  // would hand back a channel whose join is never sent -- see realtimeSocket.
  await waitForSocketReady();

  const channel = supabase.channel(topic);

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Broadcast to ${topic} timed out after ${BROADCAST_TIMEOUT_MS}ms`));
      }, BROADCAST_TIMEOUT_MS);

      const succeed = () => {
        clearTimeout(timer);
        resolve();
      };
      const fail = (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({ type: 'broadcast', event, payload }).then(succeed, fail);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          fail(new Error(`Channel subscription failed: ${status}`));
        }
      });
    });
  } finally {
    // Awaited, not fired and forgotten: the topic stays claimed until the
    // server acks the leave, and the next send in this queue would otherwise be
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
 * @throws if the channel never subscribes, or the send fails
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
