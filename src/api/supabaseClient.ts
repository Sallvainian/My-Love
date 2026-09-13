/**
 * Supabase Client - Singleton Instance
 *
 * Provides a configured Supabase client for all API interactions.
 * Uses environment variables for URL and anon key.
 *
 * @module api/supabaseClient
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import { logger } from '../utils/logger';

// Re-export Database type for convenience
export type { Database } from '../types/database.types';

/**
 * Supabase configuration from environment variables
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY as string;

/**
 * Validate required environment variables
 */
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] Missing required environment variables');
  console.error('[Supabase] VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('[Supabase] VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY:', supabaseAnonKey ? '✓' : '✗');
  throw new Error(
    'Supabase configuration missing. Check .env file and ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY are set.'
  );
}

/**
 * Singleton Supabase client instance
 *
 * Features:
 * - Typed database schema for type-safe queries
 * - JWT authentication via anon key
 * - Realtime subscriptions support
 * - Row Level Security enforcement
 *
 * @example
 * ```typescript
 * import { supabase } from './api/supabaseClient';
 *
 * // Query moods
 * const { data, error } = await supabase
 *   .from('moods')
 *   .select('*')
 *   .eq('user_id', userId);
 * ```
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Accept a callback only for a flow this browser started. With PKCE the
      // SDK takes a `?code=` back only when a code verifier this browser wrote
      // is in its storage, and refuses a `#access_token=...` fragment outright
      // -- before any network call and without touching the stored session --
      // so a link carrying someone else's tokens cannot establish or replace
      // the session here.
      //
      // "a verifier", not "the matching verifier": our redirects carry no
      // `sb_flow_id`, so the exchange reads the SDK's single legacy slot, which
      // every new flow overwrites. Two sign-ins started concurrently in
      // different tabs therefore leave the first one unredeemable -- it fails
      // closed, and retrying signs in. Enabling the SDK's per-flow slots would
      // append that parameter to the redirect URL and risk the project's
      // exact-match allow list, which is why it stays off.
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

/**
 * Attempts the two delivery-side lookups make, and the backoff between them.
 * Three attempts over ~900ms covers the failures these exist for -- a 5xx, a
 * JWT expiring mid-flight, a network transition between the join ack and the
 * follow-up fetch -- without holding a join open long enough to matter.
 */
const LOOKUP_ATTEMPTS = 3;
const LOOKUP_BACKOFF_MS = [300, 600];

export type SessionLookup =
  | { status: 'signed-in'; userId: string }
  | { status: 'signed-out' }
  | { status: 'error'; reason: string };

/**
 * The session read, with the two null cases kept apart.
 *
 * Same split, and same reason, as `lookupPartnerId` below: collapsing "nobody
 * is signed in" and "the read failed" into one `null` is fine for a caller
 * deciding what to render, and wrong for one deciding whether an account
 * changed underneath a live channel. Treating a failed read as an account
 * change mutes delivery on a session the user still holds.
 *
 * A session read rather than a cached value on purpose: this exists to notice
 * that the signed-in account CHANGED under a long-lived Realtime channel, and a
 * cache of the id would be exactly the thing that cannot see that.
 */
export const lookupSignedInUser = async (): Promise<SessionLookup> => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('[Supabase] Failed to read the current session:', error);
      return { status: 'error', reason: error.message };
    }
    const userId = data.session?.user?.id ?? null;
    return userId ? { status: 'signed-in', userId } : { status: 'signed-out' };
  } catch (error) {
    console.error('[Supabase] Error reading the current session:', error);
    return { status: 'error', reason: error instanceof Error ? error.message : String(error) };
  }
};

/**
 * The session read for a Realtime receiver: retries a failed read, and accepts
 * a conclusive answer -- signed in, or signed out -- immediately.
 *
 * Returns the discriminated result rather than an id, because the caller has to
 * tell "signed out" (conclusive: mute) from "the read failed" (inconclusive:
 * muting would be permanent, since nothing re-runs on a healthy socket).
 */
export const resolveSignedInUserForDelivery = async (): Promise<SessionLookup> => {
  let last: SessionLookup = { status: 'error', reason: 'not attempted' };

  for (let attempt = 0; attempt < LOOKUP_ATTEMPTS; attempt += 1) {
    last = await lookupSignedInUser();
    if (last.status !== 'error') return last;

    const backoff = LOOKUP_BACKOFF_MS[attempt];
    if (backoff === undefined) break;
    await new Promise((resolve) => setTimeout(resolve, backoff));
  }

  console.error('[Supabase] Session read failed on every attempt; answer is inconclusive');
  return last;
};

/**
 * Get partner user ID
 * Queries the users table to get the partner_id for the current user.
 * Uses the proper partner_id column that stores the established partner relationship.
 *
 * @returns Partner user ID or null if not found/not connected
 */
export type PartnerLookup =
  | { status: 'linked'; partnerId: string }
  | { status: 'unlinked' }
  | { status: 'error'; reason: string };

/**
 * The partner lookup, with the two null cases kept apart.
 *
 * `getPartnerId` below collapses this to `string | null`, which is the right
 * shape for the callers that only decide what to render or which id to write
 * to. It is the wrong shape for the Realtime receivers: they gate delivery on
 * the snapshot, so "no partner" and "the lookup failed" must not be the same
 * answer. A transient PostgREST error read as "unlinked" silently drops every
 * subsequent broadcast, and `SUBSCRIBED` fires once on a healthy socket, so
 * nothing re-arms it.
 *
 * `unlinked` is deliberately returned for PGRST116 and for a missing
 * `partner_id`: neither is a failure, and retrying either would only delay a
 * correct answer.
 */
export const lookupPartnerId = async (): Promise<PartnerLookup> => {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const currentUserId = sessionData.session?.user?.id ?? null;

    if (!currentUserId) {
      if (sessionError) {
        console.error('[Supabase] Failed to get current session:', sessionError);
        // A failed getSession is not evidence of being signed out; the session
        // may be perfectly valid and the read transient.
        return { status: 'error', reason: sessionError.message };
      }
      console.error('[Supabase] Cannot get partner ID: User not authenticated');
      return { status: 'unlinked' };
    }

    // Query current user's partner_id from users table
    const { data, error } = await supabase
      .from('users')
      .select('partner_id')
      .eq('id', currentUserId)
      .single();

    if (error) {
      // PGRST116 = no rows found (user doesn't have users table record yet)
      if (error.code === 'PGRST116') {
        console.warn('[Supabase] User has no users table record yet');
        return { status: 'unlinked' };
      }
      console.error('[Supabase] Failed to get partner ID:', error);
      return { status: 'error', reason: error.message };
    }

    const partnerId = data?.partner_id ?? null;
    return partnerId ? { status: 'linked', partnerId } : { status: 'unlinked' };
  } catch (error) {
    console.error('[Supabase] Error getting partner ID:', error);
    return { status: 'error', reason: error instanceof Error ? error.message : String(error) };
  }
};

/**
 * The partner snapshot for a Realtime receiver: retries a failed lookup, and
 * accepts `unlinked` immediately.
 *
 * Returns `null` for a genuine unlink and for an exhausted retry, so callers
 * keep the fail-closed behaviour they already have -- a null snapshot still
 * drops every broadcast. What changes is that one transient failure no longer
 * looks like an unlink, which is what made the drop permanent.
 */
export const resolvePartnerLookupForDelivery = async (): Promise<PartnerLookup> => {
  let last: PartnerLookup = { status: 'error', reason: 'not attempted' };

  for (let attempt = 0; attempt < LOOKUP_ATTEMPTS; attempt += 1) {
    last = await lookupPartnerId();
    if (last.status !== 'error') return last;

    const backoff = LOOKUP_BACKOFF_MS[attempt];
    if (backoff === undefined) break;
    await new Promise((resolve) => setTimeout(resolve, backoff));
  }

  console.error('[Supabase] Partner lookup failed on every attempt; answer is inconclusive');
  return last;
};

export const resolvePartnerIdForDelivery = async (): Promise<string | null> => {
  const result = await resolvePartnerLookupForDelivery();
  return result.status === 'linked' ? result.partnerId : null;
};

export const getPartnerId = async (): Promise<string | null> => {
  const result = await lookupPartnerId();
  return result.status === 'linked' ? result.partnerId : null;
};

/**
 * Get partner's display name
 * Fetches the partner's display_name from the users table.
 * This provides the correct name for each user's partner (not a hardcoded config value).
 *
 * @returns Partner's display name or null if not found
 */
export const getPartnerDisplayName = async (): Promise<string | null> => {
  try {
    const partnerId = await getPartnerId();

    if (!partnerId) {
      logger.debug('[Supabase] No partner ID found, cannot get partner display name');
      return null;
    }

    // Query partner's display_name from users table
    const { data, error } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', partnerId)
      .single();

    if (error) {
      console.error('[Supabase] Failed to get partner display name:', error);
      return null;
    }

    return data?.display_name ?? null;
  } catch (error) {
    console.error('[Supabase] Error getting partner display name:', error);
    return null;
  }
};

/**
 * The name `sync_user_profile()` writes when it seeds a brand-new profile row
 * and the account has neither a metadata name nor an email
 * (`20251206024345_remote_schema.sql:164`). It is a placeholder, never a name
 * anyone chose, so it counts as "not set" here.
 */
export const SEED_FALLBACK_NAME = 'Unknown';

/**
 * The signed-in user's own profile name, with "not chosen yet" and "could not
 * find out" kept apart.
 *
 * Same three-state shape, and for the same reason, as `PartnerLookup` above:
 * `getOwnDisplayName` collapses it to `string | null` for the callers that only
 * decide what to render, but App gates the setup modal on it, and there "no
 * name yet" and "the read failed" must not be the same answer. A 5xx read as
 * `unset` shoves an established user back into the setup screen.
 */
export type OwnDisplayNameLookup =
  | { status: 'chosen'; displayName: string }
  | { status: 'unset' }
  | { status: 'error'; reason: string };

/**
 * Read the chosen profile name from `public.users`.
 *
 * `unset` means the row carries only what `sync_user_profile()` seeded it with,
 * which is `COALESCE(raw_user_meta_data->>'display_name', email, 'Unknown')`
 * (`20251206024345_remote_schema.sql:164`). So the four seed shapes -- null, the
 * empty string, the account's own email, and 'Unknown' -- all read as "no name
 * chosen". 20260912030000 stopped the trigger rewriting the column after the
 * INSERT, but it deliberately did not backfill existing rows, so this rule is
 * what decides which of those rows still need the setup screen.
 *
 * This classification is recomputed on EVERY read, never recorded — so a row
 * whose `display_name` really does hold the account's own email address reads
 * as `unset` every time, not once. Such a user would be shown the setup screen
 * on every load and every token refresh, permanently. That is why
 * `DisplayNameSetup` refuses to write a name equal to the account email or to
 * `SEED_FALLBACK_NAME`: the write side rejects exactly what this function calls
 * a seed, so the only thing that can put such a value in the column is the
 * trigger's own seed — where it genuinely does mean "no name chosen". Existing
 * customer rows are still never edited.
 *
 * PGRST116 (no row) also reads as `unset`. It should be unreachable -- the
 * trigger creates the row inside the same statement that creates the auth user
 * -- and the setup write fails closed if the row really is missing, because it
 * checks that its UPDATE matched something.
 */
export const lookupOwnDisplayName = async (): Promise<OwnDisplayNameLookup> => {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const user = sessionData.session?.user ?? null;

    if (!user) {
      // Not an `unset`: with no session there is no profile to have a name, and
      // answering "no name chosen" here would open the setup modal over a
      // signed-out app. Same fail-open-on-display rule as the read error below.
      const reason = sessionError?.message ?? 'No authenticated session';
      console.error('[Supabase] Cannot read own display name:', reason);
      return { status: 'error', reason };
    }

    const { data, error } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.warn('[Supabase] User has no users table record yet');
        return { status: 'unset' };
      }
      console.error('[Supabase] Failed to get own display name:', error);
      return { status: 'error', reason: error.message };
    }

    const stored = data?.display_name?.trim() ?? '';
    const email = user.email?.trim() ?? '';
    const isSeedFallback =
      stored === '' ||
      stored === SEED_FALLBACK_NAME ||
      (email !== '' && stored.toLowerCase() === email.toLowerCase());

    return isSeedFallback ? { status: 'unset' } : { status: 'chosen', displayName: stored };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error('[Supabase] Error getting own display name:', error);
    return { status: 'error', reason };
  }
};

/**
 * The signed-in user's chosen profile name, or null when they have not chosen
 * one and for a failed read alike.
 *
 * The right shape for a consumer that only renders a name and already has its
 * own fallback (`LoveNotes` shows the email prefix). Anything that has to act
 * on the difference -- App's setup gate -- calls `lookupOwnDisplayName`.
 */
export const getOwnDisplayName = async (): Promise<string | null> => {
  const result = await lookupOwnDisplayName();
  return result.status === 'chosen' ? result.displayName : null;
};

/**
 * Check if Supabase is properly configured
 */
export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey);
};

export default supabase;
