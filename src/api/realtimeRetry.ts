/**
 * The bounded backoff every retry of the shared partner channel uses: the
 * registry's own re-open after an unsolicited CLOSED (`armMoodReopen` in
 * moodSyncService) and the listeners' re-subscribe after a rejected
 * `subscribePartnerEvents` (`listenToPartnerEvents`). One table, so the two
 * cannot drift apart.
 *
 * Same ceiling the love-notes hook uses. CLOSED is the only channel status
 * retried: the SDK rejoins an `errored` channel itself and does not rejoin a
 * closed one.
 */
export const RETRY_CONFIG = {
  maxRetries: 5,
  baseDelay: 1000,
  maxDelay: 30000,
};

/** The wait before the next retry, given how many have been spent. */
export function retryDelay(retriesSpent: number): number {
  return Math.min(RETRY_CONFIG.baseDelay * 2 ** retriesSpent, RETRY_CONFIG.maxDelay);
}
