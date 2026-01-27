/**
 * Partner Slice
 *
 * Manages partner connection state and actions including:
 * - Partner information
 * - Partner requests (sent/received)
 * - User search
 * - Connection/accept/decline operations
 *
 * Cross-slice dependencies:
 * - None (self-contained)
 *
 * Persistence:
 * - NOT persisted (loaded fresh on mount from Supabase)
 */

import type { AppStateCreator } from '../types';
import { partnerService } from '../../api/partnerService';
import type { PartnerInfo, PartnerRequest, UserSearchResult } from '../../api/partnerService';

export interface PartnerSlice {
  // State
  partner: PartnerInfo | null;
  isLoadingPartner: boolean;
  sentRequests: PartnerRequest[];
  receivedRequests: PartnerRequest[];
  isLoadingRequests: boolean;
  searchResults: UserSearchResult[];
  isSearching: boolean;

  // Actions
  loadPartner: () => Promise<void>;
  loadPendingRequests: () => Promise<void>;
  searchUsers: (query: string) => Promise<void>;
  clearSearch: () => void;
  sendPartnerRequest: (toUserId: string) => Promise<void>;
  acceptPartnerRequest: (requestId: string) => Promise<void>;
  declinePartnerRequest: (requestId: string) => Promise<void>;
  hasPartner: () => boolean;
}

export const createPartnerSlice: AppStateCreator<PartnerSlice> = (set, get, _api) => ({
  // Initial state
  partner: null,
  isLoadingPartner: false,
  sentRequests: [],
  receivedRequests: [],
  isLoadingRequests: false,
  searchResults: [],
  isSearching: false,

  // Actions
  loadPartner: async () => {
    set({ isLoadingPartner: true });
    try {
      const partner = await partnerService.getPartner();
      set({ partner, isLoadingPartner: false });
    } catch (error) {
      console.error('[PartnerSlice] Error loading partner:', error);
      set({ partner: null, isLoadingPartner: false });
    }
  },

  loadPendingRequests: async () => {
    set({ isLoadingRequests: true });
    try {
      const { sent, received } = await partnerService.getPendingRequests();
      set({
        sentRequests: sent,
        receivedRequests: received,
        isLoadingRequests: false,
      });
    } catch (error) {
      console.error('[PartnerSlice] Error loading requests:', error);
      set({
        sentRequests: [],
        receivedRequests: [],
        isLoadingRequests: false,
      });
    }
  },

  searchUsers: async (query: string) => {
    if (!query || query.trim().length < 2) {
      set({ searchResults: [], isSearching: false });
      return;
    }

    set({ isSearching: true });
    try {
      const results = await partnerService.searchUsers(query);
      set({ searchResults: results, isSearching: false });
    } catch (error) {
      console.error('[PartnerSlice] Error searching users:', error);
      set({ searchResults: [], isSearching: false });
    }
  },

  clearSearch: () => {
    set({ searchResults: [], isSearching: false });
  },

  sendPartnerRequest: async (toUserId: string) => {
    try {
      await partnerService.sendPartnerRequest(toUserId);
      // Reload pending requests to show the new request
      await get().loadPendingRequests();
      // Clear search results after sending request
      get().clearSearch();
    } catch (error) {
      console.error('[PartnerSlice] Error sending partner request:', error);
      throw error;
    }
  },

  acceptPartnerRequest: async (requestId: string) => {
    try {
      await partnerService.acceptPartnerRequest(requestId);
      // Reload partner and requests after accepting
      await Promise.all([get().loadPartner(), get().loadPendingRequests()]);
    } catch (error) {
      console.error('[PartnerSlice] Error accepting partner request:', error);
      throw error;
    }
  },

  declinePartnerRequest: async (requestId: string) => {
    try {
      await partnerService.declinePartnerRequest(requestId);
      // Reload pending requests after declining
      await get().loadPendingRequests();
    } catch (error) {
      console.error('[PartnerSlice] Error declining partner request:', error);
      throw error;
    }
  },

  hasPartner: () => {
    return get().partner !== null;
  },
});
