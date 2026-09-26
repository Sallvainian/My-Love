/**
 * Partner Service
 *
 * Manages partner relationships, connection requests, and user search.
 *
 * Features:
 * - Look up a partner by the exact email they sign in with
 * - Send/accept/decline partner requests
 * - Get current partner information
 * - Get pending requests
 *
 * @module partnerService
 */

import { logger } from '../utils/logger';
import { handleSupabaseError, isPostgrestError, logSupabaseError } from './errorHandlers';
import { requireOnline } from '../services/accountDataError';
import { toDateOnlyOrNull } from '../services/eventsService';
import { isSeedFallbackName, sessionMismatch, supabase } from './supabaseClient';

export interface UserSearchResult {
  id: string;
  /** The address the caller typed, trimmed; the server never returns it. */
  email: string;
  /** The account's chosen name, or `null` while it still carries the seed. */
  displayName: string | null;
}

/**
 * The answer to an exact-email partner search, with every case kept apart.
 *
 * `missing` covers both "no account uses that email" and "that is your own
 * email" — the server answers the two identically. `taken` is an account that
 * already has a partner; the server returns nothing else about it. `error` is
 * a failed request, never "no account".
 */
export type PartnerSearchResult =
  | { status: 'found'; user: UserSearchResult }
  | { status: 'taken' }
  | { status: 'missing' }
  | { status: 'error'; reason: string };

/**
 * True when `query`, trimmed, has the shape of an email address — the same
 * shape the sign-in form requires (LoginScreen), so every address someone signs
 * in with passes. A guard against sending an address still being typed, not
 * validation: the server matches exactly anyway.
 */
export function looksLikeEmail(query: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query.trim());
}

export interface PartnerInfo {
  id: string;
  email: string;
  displayName: string;
  connectedAt: string | null;
  /** The partner's own birthday, `YYYY-MM-DD`, or `null` when not set. */
  birthday: string | null;
}

/**
 * The partner read, with "no partner" and "the read failed" kept apart.
 */
export type PartnerResult =
  | { status: 'linked'; partner: PartnerInfo }
  | { status: 'unlinked' }
  | { status: 'error'; reason: string };

export interface PartnerRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  /**
   * The other person's chosen name — the recipient on a sent request, the
   * sender on a received one — or `null` while their profile carries the seed.
   */
  other_display_name: string | null;
  /** The other person's sign-in email. */
  other_email: string | null;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

/** What `accept_partner_request` raises when either user is already linked. */
const ALREADY_PARTNERED = 'One or both users already have a partner';

class PartnerService {
  /**
   * Get the partner of `userId`, the account the caller captured before asking.
   *
   * Three answers, never collapsed: `linked` with the partner, `unlinked` when
   * the server says there is no `partner_id`, and `error` when the read itself
   * failed. Mirrors `PartnerLookup` in supabaseClient.ts — a failed read is not
   * "no partner", and treating it as one showed "Connect with Your Partner" to
   * a linked user whenever the network hiccupped.
   *
   * The session is re-read after every await. A sign-out landing mid-lookup
   * sends the remaining reads without a session, RLS hides the rows, and an
   * empty answer to that request says nothing about whether `userId` is linked
   * — so any read answered while the session is not `userId`'s is an `error`.
   */
  async getPartner(userId: string): Promise<PartnerResult> {
    try {
      const before = await sessionMismatch(userId);
      if (before) return { status: 'error', reason: before };

      // Get user record with partner_id
      const { data: userRecord, error } = await supabase
        .from('users')
        .select('partner_id, updated_at')
        .eq('id', userId)
        .maybeSingle();

      const afterUser = await sessionMismatch(userId);
      if (afterUser) return { status: 'error', reason: afterUser };

      if (error) {
        console.error('[PartnerService] Error fetching user record:', error);
        return { status: 'error', reason: error.message };
      }

      // No row while the session is still this account's: the profile exists
      // without a partner, the same answer lookupPartnerId gives.
      if (!userRecord?.partner_id) {
        return { status: 'unlinked' };
      }

      // Get partner's user info from users table (RLS-protected)
      const { data: partnerRecord, error: partnerError } = await supabase
        .from('users')
        .select('id, email, display_name, birthday')
        .eq('id', userRecord.partner_id)
        .maybeSingle();

      const afterPartner = await sessionMismatch(userId);
      if (afterPartner) return { status: 'error', reason: afterPartner };

      if (partnerError || !partnerRecord) {
        console.error('[PartnerService] Error fetching partner record:', partnerError);
        return { status: 'error', reason: partnerError?.message ?? 'Partner record missing' };
      }

      // The seed rule, not a raw `||` chain. `sync_user_profile()` seeds a new
      // profile with COALESCE(metadata name, email, 'Unknown'), and the stored
      // value is a non-empty string in every one of those cases -- so a plain
      // `display_name || email || 'Partner'` is truthy on the seed and renders
      // the partner's own email address as their name.
      //
      // That is not hypothetical here: it reached the page heading. For a
      // couple where neither person had chosen a name, the chat correctly said
      // 'Partner' -- `getPartnerDisplayName` has applied this rule since DW-104
      // -- while the partner-mood view showed the full address three times over
      // from the same stored row (DW-133). One predicate, shared with that
      // reader, is what keeps the two from disagreeing again.
      const partnerName = isSeedFallbackName(partnerRecord.display_name, partnerRecord.email)
        ? 'Partner'
        : (partnerRecord.display_name?.trim() ?? 'Partner');

      return {
        status: 'linked',
        partner: {
          id: partnerRecord.id,
          email: partnerRecord.email || '',
          displayName: partnerName,
          connectedAt: userRecord.updated_at,
          birthday: toDateOnlyOrNull(partnerRecord.birthday),
        },
      };
    } catch (error) {
      console.error('[PartnerService] Error in getPartner:', error);
      return { status: 'error', reason: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Look up the account that signs in with `email`, matched exactly and
   * case-insensitively after trimming — no partial or name match.
   *
   * Goes through the `find_partner_by_email` RPC: the users SELECT policy hides
   * every row but the caller's own and their partner's, so a direct query
   * cannot see an unlinked account at all.
   *
   * @param email - The address the partner signs in with
   */
  async searchUsers(email: string): Promise<PartnerSearchResult> {
    const trimmed = email.trim();
    // No account can use an address without this shape, so nothing to ask.
    if (!looksLikeEmail(trimmed)) return { status: 'missing' };

    try {
      const { data, error } = await supabase.rpc('find_partner_by_email', { p_email: trimmed });

      if (error) {
        console.error('[PartnerService] Error searching users:', error);
        return { status: 'error', reason: error.message };
      }

      const row = data?.[0];
      if (!row) return { status: 'missing' };
      if (row.is_taken) return { status: 'taken' };
      // The generated type says non-null; the column is null only when taken.
      if (!row.id) return { status: 'error', reason: 'Search result without an id' };

      return {
        status: 'found',
        user: {
          id: row.id,
          email: trimmed,
          // A profile that never chose a name carries the email or 'Unknown'.
          displayName: isSeedFallbackName(row.display_name, trimmed)
            ? null
            : (row.display_name?.trim() ?? null),
        },
      };
    } catch (error) {
      console.error('[PartnerService] Error in searchUsers:', error);
      return { status: 'error', reason: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Send a partner connection request to another user
   *
   * Whether the target already has a partner is not checked here: the users
   * SELECT policy hides every row but the caller's own and their partner's, so
   * the client cannot see it. The server refuses that link when the request is
   * accepted (`accept_partner_request`).
   *
   * @param toUserId - ID of the user to send request to
   * @throws Error if request fails or the caller already has a partner
   */
  async sendPartnerRequest(toUserId: string): Promise<void> {
    // Refused before `auth.getUser()` or any other request goes out.
    requireOnline('Partner requests', 'send');
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user) {
        throw new Error('Not authenticated');
      }
      const userId = currentUser.user.id;

      // Check if current user already has a partner
      const { data: currentUserRecord, error: readError } = await supabase
        .from('users')
        .select('partner_id')
        .eq('id', userId)
        .maybeSingle();

      // A read answered after a sign-out or account switch saw no row because
      // RLS hid it, which is not "no partner".
      const mismatch = await sessionMismatch(userId);
      if (mismatch) throw new Error(mismatch);
      if (readError) throw readError;

      if (currentUserRecord?.partner_id) {
        throw new Error('You already have a partner');
      }

      // Create partner request
      const { error } = await supabase.from('partner_requests').insert({
        from_user_id: currentUser.user.id,
        to_user_id: toUserId,
        status: 'pending',
      });

      if (error) {
        if (isPostgrestError(error) && error.code === '23514') {
          logSupabaseError('PartnerService.sendPartnerRequest', error);
          error.message = handleSupabaseError(error).message;
          throw error;
        }
        // Check for duplicate request error
        if (error.message.includes('duplicate') || error.message.includes('unique')) {
          throw new Error('You already have a pending request to this user');
        }
        throw error;
      }

      logger.debug('[PartnerService] Partner request sent successfully');
    } catch (error) {
      console.error('[PartnerService] Error sending partner request:', error);
      throw error;
    }
  }

  /**
   * Get all pending partner requests (sent and received)
   *
   * Goes through the `get_my_pending_partner_requests` RPC, which names the
   * other person: the users SELECT policy hides every unlinked account from the
   * caller, and a pending request is always between two unlinked people, so a
   * direct `users` read answered nothing and every row showed "Unknown User".
   *
   * @returns Object with sent and received requests
   */
  async getPendingRequests(): Promise<{
    sent: PartnerRequest[];
    received: PartnerRequest[];
  }> {
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.rpc('get_my_pending_partner_requests');

      if (error) {
        console.error('[PartnerService] Error fetching pending requests:', error);
        return { sent: [], received: [] };
      }

      // The generated type says non-null; both columns are null when the other
      // profile has no chosen name or no email.
      const requests: PartnerRequest[] = (data ?? []).map((row) => ({
        id: row.id,
        from_user_id: row.from_user_id,
        to_user_id: row.to_user_id,
        other_display_name: row.other_display_name ?? null,
        other_email: row.other_email ?? null,
        status: 'pending',
        created_at: row.created_at,
      }));

      const sent = requests.filter((req) => req.from_user_id === currentUser.user.id);
      const received = requests.filter((req) => req.to_user_id === currentUser.user.id);

      return { sent, received };
    } catch (error) {
      console.error('[PartnerService] Error in getPendingRequests:', error);
      return { sent: [], received: [] };
    }
  }

  /**
   * Accept a partner request
   *
   * @param requestId - ID of the request to accept
   * @throws Error if acceptance fails
   */
  async acceptPartnerRequest(requestId: string): Promise<void> {
    // Refused before the RPC goes out.
    requireOnline('Partner requests', 'accept');
    try {
      // Call database function to accept request
      const { error } = await supabase.rpc('accept_partner_request', {
        p_request_id: requestId,
      });

      if (error) {
        if (isPostgrestError(error) && error.code === '23514') {
          logSupabaseError('PartnerService.acceptPartnerRequest', error);
          error.message = handleSupabaseError(error).message;
        }
        // The server's refusal to link someone who already has a partner.
        if (error.code === 'P0001' && error.message === ALREADY_PARTNERED) {
          throw new Error(
            'This request can no longer be accepted: one of you already has a partner.'
          );
        }
        throw error;
      }

      logger.debug('[PartnerService] Partner request accepted successfully');
    } catch (error) {
      console.error('[PartnerService] Error accepting partner request:', error);
      throw error;
    }
  }

  /**
   * Decline a partner request
   *
   * @param requestId - ID of the request to decline
   * @throws Error if decline fails
   */
  async declinePartnerRequest(requestId: string): Promise<void> {
    // Refused before the RPC goes out.
    requireOnline('Partner requests', 'decline');
    try {
      // Call database function to decline request
      const { error } = await supabase.rpc('decline_partner_request', {
        p_request_id: requestId,
      });

      if (error) {
        if (isPostgrestError(error) && error.code === '23514') {
          logSupabaseError('PartnerService.declinePartnerRequest', error);
          error.message = handleSupabaseError(error).message;
        }
        throw error;
      }

      logger.debug('[PartnerService] Partner request declined successfully');
    } catch (error) {
      console.error('[PartnerService] Error declining partner request:', error);
      throw error;
    }
  }
}

export const partnerService = new PartnerService();
