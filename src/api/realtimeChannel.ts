/**
 * Shared utility for subscribing to private Supabase Realtime channels.
 *
 * Extracts the duplicated auth+channel setup pattern from useScriptureBroadcast
 * and useScripturePresence into a single reusable function.
 *
 * Pattern:
 *   1. setAuth() on supabase.realtime (required for private channels)
 *   2. getUser() to obtain the current user ID
 *   3. Call the provided onReady callback with the userId
 *
 * Error handling is delegated to the caller via onError.
 */

import { supabase } from './supabaseClient';

interface SubscribePrivateChannelOptions {
  /** Called after successful auth with the authenticated user's ID. */
  onReady: (userId: string) => void;
  /** Called if auth or getUser fails. */
  onError: (error: unknown) => void;
}

/**
 * Authenticates and prepares a private Realtime channel for subscription.
 *
 * Performs `supabase.realtime.setAuth()` followed by `supabase.auth.getUser()`,
 * then invokes `onReady` with the user ID so the caller can proceed with
 * `channel.subscribe()`.
 */
export function subscribePrivateChannel({
  onReady,
  onError,
}: SubscribePrivateChannelOptions): void {
  void supabase.realtime
    .setAuth()
    .then(async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        throw authError;
      }
      if (!authData.user) {
        throw new Error('No authenticated user found');
      }
      onReady(authData.user.id);
    })
    .catch((err: unknown) => {
      onError(err);
    });
}
