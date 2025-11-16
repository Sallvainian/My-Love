/**
 * Partner Service
 *
 * Manages partner relationships, connection requests, and user search.
 *
 * Features:
 * - Search for users by display name or email
 * - Send/accept/decline partner requests
 * - Get current partner information
 * - Get pending requests
 *
 * @module partnerService
 */

import { supabase } from './supabaseClient';

export interface UserSearchResult {
  id: string;
  email: string;
  displayName: string;
}

export interface PartnerInfo {
  id: string;
  email: string;
  displayName: string;
  connectedAt: string | null;
}

export interface PartnerRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  from_user_email: string | null;
  from_user_display_name: string | null;
  to_user_email: string | null;
  to_user_display_name: string | null;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

class PartnerService {
  /**
   * Get current user's partner information
   *
   * @returns Partner info if connected, null otherwise
   */
  async getPartner(): Promise<PartnerInfo | null> {
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user) {
        throw new Error('Not authenticated');
      }

      // Get user record with partner_id
      const { data: userRecord, error } = await supabase
        .from('users')
        .select('partner_id, updated_at')
        .eq('id', currentUser.user.id)
        .single();

      if (error) {
        console.error('[PartnerService] Error fetching user record:', error);
        return null;
      }

      if (!userRecord?.partner_id) {
        return null;
      }

      // Get partner's user info from users table (RLS-protected)
      const { data: partnerRecord, error: partnerError } = await supabase
        .from('users')
        .select('id, email, display_name')
        .eq('id', userRecord.partner_id)
        .single();

      if (partnerError || !partnerRecord) {
        console.error('[PartnerService] Error fetching partner record:', partnerError);
        return null;
      }

      return {
        id: partnerRecord.id,
        email: partnerRecord.email || '',
        displayName: partnerRecord.display_name || partnerRecord.email || 'Partner',
        connectedAt: userRecord.updated_at,
      };
    } catch (error) {
      console.error('[PartnerService] Error in getPartner:', error);
      return null;
    }
  }

  /**
   * Search for users by display name or email
   * Uses RLS-protected users table instead of auth admin API
   *
   * @param query - Search query (matches display name or email)
   * @param limit - Maximum number of results (default: 10)
   * @returns List of matching users
   */
  async searchUsers(query: string, limit: number = 10): Promise<UserSearchResult[]> {
    try {
      if (!query || query.trim().length < 2) {
        return [];
      }

      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user) {
        throw new Error('Not authenticated');
      }

      const searchLower = query.toLowerCase().trim();

      // Query users table directly (RLS policy allows authenticated users to search)
      const { data, error } = await supabase
        .from('users')
        .select('id, email, display_name')
        .neq('id', currentUser.user.id) // Exclude current user
        .or(`email.ilike.%${searchLower}%,display_name.ilike.%${searchLower}%`)
        .limit(limit);

      if (error) {
        console.error('[PartnerService] Error searching users:', error);
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Map to UserSearchResult
      const results: UserSearchResult[] = data.map((user) => ({
        id: user.id,
        email: user.email || '',
        displayName: user.display_name || user.email || 'Unknown',
      }));

      return results;
    } catch (error) {
      console.error('[PartnerService] Error in searchUsers:', error);
      return [];
    }
  }

  /**
   * Send a partner connection request to another user
   *
   * @param toUserId - ID of the user to send request to
   * @throws Error if request fails or user already has a partner
   */
  async sendPartnerRequest(toUserId: string): Promise<void> {
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user) {
        throw new Error('Not authenticated');
      }

      // Check if current user already has a partner
      const { data: currentUserRecord } = await supabase
        .from('users')
        .select('partner_id')
        .eq('id', currentUser.user.id)
        .single();

      if (currentUserRecord?.partner_id) {
        throw new Error('You already have a partner');
      }

      // Check if target user already has a partner
      const { data: targetUserRecord } = await supabase
        .from('users')
        .select('partner_id')
        .eq('id', toUserId)
        .single();

      if (targetUserRecord?.partner_id) {
        throw new Error('This user already has a partner');
      }

      // Create partner request
      const { error } = await supabase.from('partner_requests').insert({
        from_user_id: currentUser.user.id,
        to_user_id: toUserId,
        status: 'pending',
      });

      if (error) {
        // Check for duplicate request error
        if (error.message.includes('duplicate') || error.message.includes('unique')) {
          throw new Error('You already have a pending request to this user');
        }
        throw error;
      }

      if (import.meta.env.DEV) {
        console.log('[PartnerService] Partner request sent successfully');
      }
    } catch (error) {
      console.error('[PartnerService] Error sending partner request:', error);
      throw error;
    }
  }

  /**
   * Get all pending partner requests (sent and received)
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

      // Get all pending requests involving current user
      const { data, error } = await supabase
        .from('partner_requests')
        .select('*')
        .eq('status', 'pending')
        .or(`from_user_id.eq.${currentUser.user.id},to_user_id.eq.${currentUser.user.id}`);

      if (error) {
        console.error('[PartnerService] Error fetching pending requests:', error);
        return { sent: [], received: [] };
      }

      if (!data || data.length === 0) {
        return { sent: [], received: [] };
      }

      // Get user info for all involved users from users table (RLS-protected)
      const userIds = Array.from(
        new Set<string>(data.flatMap((req) => [req.from_user_id, req.to_user_id]))
      );

      // Fetch user data from users table (no admin API needed)
      const { data: usersData } = await supabase
        .from('users')
        .select('id, email, display_name')
        .in('id', userIds);

      const userMap = new Map(
        usersData?.map((user) => [
          user.id,
          {
            email: user.email,
            displayName: user.display_name || user.email || 'Unknown',
          },
        ]) || []
      );

      // Enrich requests with user info
      const enrichedRequests: PartnerRequest[] = data.map((request) => ({
        id: request.id,
        from_user_id: request.from_user_id,
        to_user_id: request.to_user_id,
        from_user_email: userMap.get(request.from_user_id)?.email || null,
        from_user_display_name: userMap.get(request.from_user_id)?.displayName || null,
        to_user_email: userMap.get(request.to_user_id)?.email || null,
        to_user_display_name: userMap.get(request.to_user_id)?.displayName || null,
        status: request.status as 'pending' | 'accepted' | 'declined',
        created_at: request.created_at,
      }));

      // Separate sent and received
      const sent = enrichedRequests.filter((req) => req.from_user_id === currentUser.user.id);
      const received = enrichedRequests.filter((req) => req.to_user_id === currentUser.user.id);

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
    try {
      // Call database function to accept request
      const { error } = await supabase.rpc('accept_partner_request', {
        p_request_id: requestId,
      });

      if (error) {
        throw error;
      }

      if (import.meta.env.DEV) {
        console.log('[PartnerService] Partner request accepted successfully');
      }
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
    try {
      // Call database function to decline request
      const { error } = await supabase.rpc('decline_partner_request', {
        p_request_id: requestId,
      });

      if (error) {
        throw error;
      }

      if (import.meta.env.DEV) {
        console.log('[PartnerService] Partner request declined successfully');
      }
    } catch (error) {
      console.error('[PartnerService] Error declining partner request:', error);
      throw error;
    }
  }

  /**
   * Check if current user has a partner
   *
   * @returns true if user has a partner, false otherwise
   */
  async hasPartner(): Promise<boolean> {
    const partner = await this.getPartner();
    return partner !== null;
  }
}

export const partnerService = new PartnerService();
