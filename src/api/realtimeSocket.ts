/**
 * Shared Realtime socket state
 *
 * Every channel in the app rides one WebSocket, and RealtimeClient tears that
 * socket down whenever the LAST channel is removed:
 *
 *   RealtimeClient.js:213-219
 *     async removeChannel(channel) {
 *       const status = await channel.unsubscribe();
 *       if (this.channels.length === 0) { this.disconnect(); }
 *
 * `disconnect()` then parks the socket in a `disconnecting` state, escaped only
 * by the transport's `onclose` or a 100 ms fallback timer:
 *
 *   RealtimeClient.js:174-183
 *     if (this.isDisconnecting()) { return; }
 *     this._setConnectionState('disconnecting', true);
 *     ... const fallbackTimer = setTimeout(() => {
 *           this._setConnectionState('disconnected'); }, 100);
 *
 * and every `connect()` inside that window is a silent no-op:
 *
 *   RealtimeClient.js:117-122
 *     connect() {
 *       if (this.isConnecting() || this.isDisconnecting() ||
 *           (this.conn !== null && this.isConnected())) { return; }
 *
 * So closing the last channel and immediately opening another gives a channel
 * whose join is never sent. It reports TIMED_OUT ten seconds later and never
 * rejoins -- `_rejoinUntilConnected` only reschedules while the socket is
 * connected, so nothing brings it back.
 *
 * The leave itself does NOT wait for the server, which makes this deterministic
 * rather than a race: with the socket already gone `_canPush()` is false and the
 * leave resolves locally and at once (RealtimeChannel.js:386-387
 * `if (!this._canPush()) { leavePush.trigger('ok', {}); }`).
 *
 * Both places that close a channel and then open another -- the mood
 * subscribe/resubscribe path and the queued one-shot broadcasts -- land squarely
 * inside that window. Waiting it out is what makes reopening work at all.
 *
 * @module api/realtimeSocket
 */

import { logger } from '../utils/logger';
import { supabase } from './supabaseClient';

/** Poll interval while the socket is mid-disconnect. */
const POLL_MS = 10;

/**
 * Upper bound on the wait.
 *
 * RealtimeClient's own escape hatch is a 100 ms fallback timer, so anything
 * beyond that means the state machine is stuck. Pressing on and letting the
 * channel report TIMED_OUT beats hanging the caller forever.
 */
const MAX_WAIT_MS = 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait until the shared socket is not mid-disconnect, so that opening a channel
 * actually connects.
 *
 * Returns immediately in the overwhelmingly common case -- the socket is only
 * `disconnecting` for the ~100 ms after its last channel goes away.
 */
export async function waitForSocketReady(): Promise<void> {
  if (!supabase.realtime.isDisconnecting()) return;

  logger.debug('[RealtimeSocket] Socket is mid-disconnect; waiting before opening a channel');

  let waited = 0;
  while (supabase.realtime.isDisconnecting() && waited < MAX_WAIT_MS) {
    await delay(POLL_MS);
    waited += POLL_MS;
  }

  if (supabase.realtime.isDisconnecting()) {
    console.warn(
      `[RealtimeSocket] Socket still disconnecting after ${MAX_WAIT_MS}ms; opening anyway`
    );
    return;
  }

  logger.debug(`[RealtimeSocket] Socket settled after ${waited}ms`);
}
