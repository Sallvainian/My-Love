/**
 * Shared Realtime socket state
 *
 * Every channel in the app rides one WebSocket, and this module exists because
 * opening a channel while that socket is mid-disconnect silently never joins.
 *
 * What this gate was originally written for no longer exists. It documented
 * `RealtimeClient.removeChannel` disconnecting the socket the moment its last
 * channel went away, and a ~100 ms `disconnecting` window escaped by a fallback
 * timer. Measured against the installed realtime-js 2.116.0, all three parts of
 * that are gone:
 *
 *   - `removeChannel` no longer disconnects at all. It awaits
 *     `channel.unsubscribe()` and tears the channel down on 'ok', nothing more
 *     (dist/module/RealtimeClient.js:254-260).
 *   - The disconnect moved to `_remove` -> `_schedulePendingDisconnect`
 *     (`:439-460`), and it is DEFERRED, not immediate:
 *     `_disconnectOnEmptyChannelsAfterMs` defaults to twice the heartbeat
 *     interval (`:646-647` x `CONNECTION_TIMEOUTS.HEARTBEAT_INTERVAL: 25000`),
 *     and this app passes no override (`src/api/supabaseClient.ts:83-87`), so
 *     the window is 50 SECONDS.
 *   - Reopening cancels it outright: `channel()` calls
 *     `_cancelPendingDisconnect()` before registering (`:340`).
 *   - The 100 ms fallback timer is gone with the state machine that owned it
 *     (`grep -c "_setConnectionState" RealtimeClient.js` is 0). `isDisconnecting()`
 *     now reads the raw transport: `socketAdapter.isDisconnecting()` returns
 *     `socket.connectionState() == 'closing'`, i.e. WebSocket.CLOSING.
 *
 * So the close-then-immediately-reopen race this was built for cannot happen on
 * a rejoin any more: nothing disconnects in that window, and reopening cancels
 * the pending disconnect regardless.
 *
 * The gate is kept anyway, for two reasons. It still describes something real —
 * a socket the browser or an explicit `disconnect()` has genuinely put into
 * CLOSING, which sign-out does — and in that state an open really would fail to
 * join. And it is close to free: `isDisconnecting()` is a boolean read, and the
 * poll below runs only when it is already true. Removing it would buy one
 * property access and reintroduce a failure mode whose only symptom is a
 * channel that reports TIMED_OUT ten seconds later for no visible reason.
 *
 * Line numbers are the `dist/module` build; `dist/main` is the same code at
 * different offsets. The leave-side half of these measurements is asserted in
 * tests/unit/api/realtimeLeaveContract.test.ts.
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
 * A socket in CLOSING reaches CLOSED when the browser finishes the handshake,
 * which is not something this process can hurry along; anything past a second
 * means it is not going to. Pressing on and letting the channel report
 * TIMED_OUT beats hanging the caller forever.
 */
const MAX_WAIT_MS = 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait until the shared socket is not mid-disconnect, so that opening a channel
 * actually connects.
 *
 * Returns immediately in the overwhelmingly common case. On the installed SDK
 * the socket is `disconnecting` only while the transport is genuinely in
 * WebSocket.CLOSING -- an explicit `disconnect()` such as sign-out, or a socket
 * the browser is tearing down -- never merely because a channel was released.
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
