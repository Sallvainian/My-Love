/**
 * Partner Slice
 *
 * Manages partner connection state and actions including:
 * - Partner information
 * - Partner requests (sent/received)
 * - Partner search by exact email
 * - Connection/accept/decline operations
 *
 * Cross-slice dependencies:
 * - Accepting a request, or `loadPartner` seeing a partner the couple
 *   settings do not name, refreshes the `couple-settings` local copy
 *   (settingsSlice) through the local-copy registry, not a direct import
 *
 * Persistence:
 * - NOT persisted through Zustand. The partner profile is kept in the shared
 *   per-account local copy (`services/localCopy.ts`, kind `partner`): shown at
 *   once, online or offline, then refreshed from Supabase.
 */

import { moodSyncService } from '../../api/moodSyncService';
import type { PartnerInfo, PartnerRequest, PartnerSearchResult } from '../../api/partnerService';
import { partnerService } from '../../api/partnerService';
import { toDateOnlyOrNull } from '../../services/eventsService';
import {
  readLocalCopy,
  refreshLocalCopy,
  registerLocalCopy,
  writeLocalCopy,
} from '../../services/localCopy';
import type { AppStateCreator } from '../types';

/** Local-copy kind for the partner profile. */
export const PARTNER_COPY_KIND = 'partner';

/**
 * What is saved for the partner kind. Only a successful server answer is ever
 * saved, so `unlinked` here means the server said so — never a failed read.
 */
export type PartnerCopy = { status: 'linked'; partner: PartnerInfo } | { status: 'unlinked' };

/**
 * A saved copy in today's shape. A copy saved before birthdays moved to the
 * server has no `birthday` field; it still parses, and reads it as not set
 * until the next refresh replaces it.
 */
function normalizePartnerCopy(copy: PartnerCopy | null): PartnerCopy | null {
  if (!copy || copy.status !== 'linked') return copy;
  const birthday = (copy.partner as Partial<PartnerInfo>).birthday;
  return {
    status: 'linked',
    partner: {
      ...copy.partner,
      birthday: typeof birthday === 'string' ? toDateOnlyOrNull(birthday) : null,
    },
  };
}

/**
 * Orders overlapping `loadPartner` calls (view mount, start/reconnect refresh,
 * accept). Only the most recent call may write state or the copy, so an older
 * answer that lands last — a pre-accept "unlinked" after the post-accept
 * "linked" — cannot overwrite a newer one.
 */
let partnerLoadSeq = 0;

/**
 * Orders partner searches the same way: only the latest search, and no search
 * after `clearSearch`, may write its answer. Otherwise a slow answer for an
 * address the user has since replaced lands under the new one.
 */
let partnerSearchSeq = 0;

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine;
}

export interface PartnerSlice {
  // State
  partner: PartnerInfo | null;
  isLoadingPartner: boolean;
  /**
   * True when the partner could not be determined and nothing is known to show:
   * no saved copy, and the server read failed or the device is offline. The
   * view shows a load-error message then — never the Connect UI, which is for a
   * server-confirmed "unlinked" only.
   */
  partnerLoadError: boolean;
  sentRequests: PartnerRequest[];
  receivedRequests: PartnerRequest[];
  isLoadingRequests: boolean;
  /** The last exact-email search's answer; `null` before any search. */
  searchResult: PartnerSearchResult | null;
  isSearching: boolean;

  // Actions
  loadPartner: () => Promise<void>;
  loadPendingRequests: () => Promise<void>;
  searchUsers: (email: string) => Promise<void>;
  clearSearch: () => void;
  sendPartnerRequest: (toUserId: string) => Promise<void>;
  acceptPartnerRequest: (requestId: string) => Promise<void>;
  declinePartnerRequest: (requestId: string) => Promise<void>;
  hasPartner: () => boolean;
}

export const createPartnerSlice: AppStateCreator<PartnerSlice> = (set, get, _api) => {
  // The partner kind's refresher for signed-in start, reconnect and on-demand
  // refreshes. Re-registering (a second store in tests) replaces the first.
  registerLocalCopy(PARTNER_COPY_KIND, () => get().loadPartner());

  return {
    // Initial state
    partner: null,
    isLoadingPartner: false,
    partnerLoadError: false,
    sentRequests: [],
    receivedRequests: [],
    isLoadingRequests: false,
    searchResult: null,
    isSearching: false,

    // Actions
    loadPartner: async () => {
      // Whose data this is, captured before any await. The Sign Out control sits
      // in the bottom nav on the same screen that fires this, and the request
      // went out with a still-valid token — so it can land AFTER clearAuth (or an
      // in-place switch) and write the previous account's partner straight back.
      // authSessionVersion catches a same-account re-login as well.
      const { userId, authSessionVersion } = get();
      if (!userId) return;
      const isCurrent = () =>
        get().userId === userId && get().authSessionVersion === authSessionVersion;
      const seq = ++partnerLoadSeq;

      // Spinner only while nothing is on screen: a refresh over a shown partner
      // must not swap the view for a loading state.
      if (get().partner === null) set({ isLoadingPartner: true });

      // Every early return below releases the flag. PartnerMoodView gates its
      // branches on it, so a stuck flag renders a blank tab. Cutting short the
      // next account's own spinner is a flicker; a blank tab is not.
      const release = (): void => {
        set({ isLoadingPartner: false });
      };
      // True when this call must not write. A call superseded by a newer one
      // for the SAME account leaves the flag alone: the newer call owns it and
      // releases it on every path, and releasing here mid-flight would paint
      // the Connect UI for one beat over a linked user.
      const stale = (): boolean => {
        if (!isCurrent()) {
          release();
          return true;
        }
        return seq !== partnerLoadSeq;
      };

      // 1. The saved copy, at once — online or offline.
      const copy = normalizePartnerCopy(
        await readLocalCopy<PartnerCopy>(userId, PARTNER_COPY_KIND)
      );
      if (stale()) return;
      // Only when nothing is shown yet: a partner already in memory is at least
      // as new as the saved copy, and swapping it for an older one flashes.
      if (copy && get().partner === null) {
        set({
          partner: copy.status === 'linked' ? copy.partner : null,
          partnerLoadError: false,
          isLoadingPartner: false,
        });
      }

      // 2. Nothing known and no way to ask: say so rather than claim "unlinked".
      if (!isOnline()) {
        set({ isLoadingPartner: false, partnerLoadError: !copy && get().partner === null });
        return;
      }

      // 3. The server answer replaces the copy — only when it is an answer.
      let result: Awaited<ReturnType<typeof partnerService.getPartner>>;
      try {
        result = await partnerService.getPartner(userId);
      } catch (error) {
        result = { status: 'error', reason: error instanceof Error ? error.message : String(error) };
      }
      if (stale()) return;

      if (result.status === 'error') {
        // A failed read keeps what is shown and leaves the copy untouched.
        console.error('[PartnerSlice] Error loading partner:', result.reason);
        set({ isLoadingPartner: false, partnerLoadError: !copy && get().partner === null });
        return;
      }

      const next: PartnerCopy =
        result.status === 'linked'
          ? { status: 'linked', partner: result.partner }
          : { status: 'unlinked' };
      set({
        partner: next.status === 'linked' ? next.partner : null,
        partnerLoadError: false,
        isLoadingPartner: false,
      });
      // A link this device did not make (the partner accepted our request)
      // reaches us only here, so the couple settings still describe the old
      // pair. Before they have loaded at all, the start refresh owns them.
      const couple = get().coupleSettings;
      const couplePartnerId = couple?.status === 'linked' ? couple.partnerId : null;
      const serverPartnerId = next.status === 'linked' ? next.partner.id : null;
      if (couple && couplePartnerId !== serverPartnerId) {
        void refreshLocalCopy('couple-settings');
      }
      // Saved under the captured account; isCurrent() was checked synchronously
      // above, so this is never issued after a sign-out's copy deletion.
      try {
        await writeLocalCopy(userId, PARTNER_COPY_KIND, next);
      } catch (error) {
        console.error('[PartnerSlice] Failed to save partner copy:', error);
      }
    },

    loadPendingRequests: async () => {
      // Same identity guard as loadPartner: these name real third parties.
      const { userId, authSessionVersion } = get();
      const isCurrent = () =>
        get().userId === userId && get().authSessionVersion === authSessionVersion;
      set({ isLoadingRequests: true });
      try {
        const { sent, received } = await partnerService.getPendingRequests();
        // Same reasoning as loadPartner: release the flag, discard the data.
        if (!isCurrent()) {
          set({ isLoadingRequests: false });
          return;
        }
        set({
          sentRequests: sent,
          receivedRequests: received,
          isLoadingRequests: false,
        });
      } catch (error) {
        console.error('[PartnerSlice] Error loading requests:', error);
        if (!isCurrent()) {
          set({ isLoadingRequests: false });
          return;
        }
        set({
          sentRequests: [],
          receivedRequests: [],
          isLoadingRequests: false,
        });
      }
    },

    searchUsers: async (email: string) => {
      const seq = ++partnerSearchSeq;
      if (!email.trim()) {
        set({ searchResult: null, isSearching: false });
        return;
      }

      // Search hits name third parties, so they get the same guard as the loaders
      // above: discard the result if the signed-in session changed mid-flight
      // (a same-account re-login included), but release the flag rather than
      // stranding it.
      const { userId, authSessionVersion } = get();
      const isCurrent = () =>
        get().userId === userId && get().authSessionVersion === authSessionVersion;
      set({ isSearching: true });
      let result: PartnerSearchResult;
      try {
        result = await partnerService.searchUsers(email);
      } catch (error) {
        console.error('[PartnerSlice] Error searching users:', error);
        result = { status: 'error', reason: error instanceof Error ? error.message : String(error) };
      }
      if (!isCurrent()) {
        set({ isSearching: false });
        return;
      }
      // Superseded: the newer search, or the clear, owns the flag.
      if (seq !== partnerSearchSeq) return;
      set({ searchResult: result, isSearching: false });
    },

    clearSearch: () => {
      ++partnerSearchSeq;
      set({ searchResult: null, isSearching: false });
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
      // The sender, read before the reload below drops the accepted request.
      const senderId =
        get().receivedRequests.find((request) => request.id === requestId)?.from_user_id ?? null;
      try {
        await partnerService.acceptPartnerRequest(requestId);
        // The sender's open Partner tab re-reads its partner only on mount,
        // start or reconnect, so tell it the link exists. Not awaited: a lost
        // announcement delays the sender's view, it does not undo the link.
        if (senderId) {
          moodSyncService.announcePartnerLinked(senderId).catch((error: unknown) => {
            console.error('[PartnerSlice] Failed to tell the sender about the link:', error);
          });
        }
        // This device's mood channel joined while unlinked; re-arm it so the
        // new partner's moods are not dropped until the next re-join.
        void moodSyncService.refreshPartnerSnapshots();
        // Reload partner and requests after accepting, and the couple's shared
        // settings: the new pair has its own row (or none yet), and the copy
        // still says "unlinked".
        await Promise.all([
          get().loadPartner(),
          get().loadPendingRequests(),
          refreshLocalCopy('couple-settings'),
        ]);
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
  };
};
