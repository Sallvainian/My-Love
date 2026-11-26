/**
 * listenToPartnerEvents — attach one consumer to the shared partner channel and
 * keep trying while that fails (DW-505).
 *
 * `subscribePartnerEvents` is async and can reject before it has a channel to
 * hold: the session read, the partner lookup, the socket wait or
 * `supabase.realtime.setAuth()` ahead of the join. The SDK cannot recover that
 * for the caller — an errored channel is rejoined by the SDK, but a rejection
 * here leaves no channel to rejoin, and its rejoin sends the join again without
 * running `setAuth` (it runs on the `ok` reply and on the heartbeat). A listener
 * that only logged the rejection held nothing, so its page got no live
 * re-reads until it was reopened, the device reconnected or the session changed.
 *
 * The four routed listeners (`useDailyPickListener`, `usePartnerStreakListener`,
 * `usePartnerLinkListener`, `useDatesChangedListener`) share this one path
 * instead of each carrying its own retry. It retries on the registry's own
 * bounded backoff (`RETRY_CONFIG`, as `armMoodReopen` does) and stops when its
 * caller cancels it (unmount, a new session, going offline: each re-runs the
 * hook's effect, whose cleanup calls the function returned here), when the
 * device is offline at a retry, and after `RETRY_CONFIG.maxRetries` retries.
 * A later effect run starts it again from zero.
 *
 * A retry that succeeds attaches the handlers exactly as a first attempt does,
 * so the channel's `SUBSCRIBED` replay reaches `onStatus` and the hook re-reads.
 */

import { logger } from '../utils/logger';
import { isOnline } from './errorHandlers';
import { type PartnerEventHandlers, moodSyncService } from './moodSyncService';
import { RETRY_CONFIG, retryDelay } from './realtimeRetry';

interface ListenToPartnerEventsOptions {
  /** Logged with each rejection, as the hook's own `.catch` did: `[hook] Could not ...:`. */
  failureMessage: string;
  /**
   * Called just before each retry, never before the first attempt. For a
   * consumer that treats its first `SUBSCRIBED` as covered by the loads that
   * started it: after a failed attempt that is no longer true.
   */
  onRetry?: () => void;
}

/**
 * @returns Cancels the listener: stops any pending retry and releases the
 *   subscription, including one that is still being made. Safe to call twice.
 */
export function listenToPartnerEvents(
  handlers: PartnerEventHandlers,
  { failureMessage, onRetry }: ListenToPartnerEventsOptions
): () => void {
  let active = true;
  let release: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let retriesSpent = 0;

  const attempt = () => {
    moodSyncService
      .subscribePartnerEvents(handlers)
      .then((unsubscribe) => {
        // Cancelled while the subscribe was in flight: hand it straight back.
        if (!active) {
          unsubscribe();
          return;
        }
        release = unsubscribe;
      })
      .catch((error: unknown) => {
        console.error(failureMessage, error);
        if (!active) return;

        if (retriesSpent >= RETRY_CONFIG.maxRetries) {
          console.error(
            `[listenToPartnerEvents] Max retries (${RETRY_CONFIG.maxRetries}) exceeded. Giving up.`
          );
          return;
        }

        const delay = retryDelay(retriesSpent);
        retriesSpent++;
        logger.debug(
          `[listenToPartnerEvents] Retry attempt ${retriesSpent}/${RETRY_CONFIG.maxRetries} in ${delay}ms`
        );

        timer = setTimeout(() => {
          timer = null;
          // Offline stops the retry; coming back online re-runs the effect.
          if (!active || !isOnline()) return;
          onRetry?.();
          attempt();
        }, delay);
      });
  };

  attempt();

  return () => {
    active = false;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    release?.();
    release = null;
  };
}
