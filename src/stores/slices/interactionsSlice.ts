/**
 * Interactions Slice
 *
 * Manages all poke/kiss interaction state and actions including:
 * - Sending poke/kiss to partner
 * - Receiving real-time interaction notifications
 * - Marking interactions as viewed
 * - Interaction history retrieval
 *
 * Recipient derivation (F4/CAP-4):
 * - `sendPoke`/`sendKiss` take no recipient. The service derives it from the
 *   authenticated relationship and the database refuses anything else, so no
 *   caller-supplied UUID reaches the insert.
 * - `interactionPartnerId` is the partner snapshot taken when a subscription
 *   opens and refreshed on SUBSCRIBED. `addIncomingInteraction` rejects any row
 *   that is not addressed to the signed-in user and sent by that partner,
 *   before the feed or the badge move. It is account state, cleared by
 *   `signedOutState()` rather than by a subscription teardown.
 *
 * Cross-slice dependencies:
 * - authSlice.userId: sends, unviewed filtering, history loading,
 *   subscriptions and identity guards
 * - authSlice.authSessionVersion: captured at subscription creation and
 *   checked for incoming records to enforce session ownership; the status
 *   callback checks only user identity and subscription activity. authSlice
 *   advances the version on sign-out or identity change and retains it on
 *   same-user refresh
 *
 * Persistence:
 * - Interactions are ephemeral (not persisted to LocalStorage/IndexedDB)
 * - Fetched from Supabase on app init and via Realtime updates
 * - Marked as viewed via Supabase API
 */

import {
  InteractionService,
  type InteractionSubscriptionStatus,
} from '../../api/interactionService';
import type { Interaction, SupabaseInteractionRecord } from '../../types';
import { validateIncomingInteraction } from '../../utils/interactionValidation';
import { logger } from '../../utils/logger';
import type { AppStateCreator } from '../types';

// Initialize interaction service singleton
const interactionService = new InteractionService();

export interface InteractionsSlice {
  // State
  interactions: Interaction[];
  unviewedCount: number;
  isSubscribed: boolean;
  /** The signed-in account's partner, resolved when a subscription opens; null when unlinked or not yet resolved */
  interactionPartnerId: string | null;

  // Actions
  sendPoke: () => Promise<SupabaseInteractionRecord>;
  sendKiss: () => Promise<SupabaseInteractionRecord>;
  markInteractionViewed: (id: string) => Promise<void>;
  getUnviewedInteractions: () => Interaction[];
  getInteractionHistory: (days?: number) => Interaction[];
  loadInteractionHistory: (limit?: number) => Promise<void>;
  subscribeToInteractions: (
    onStatusChange: (status: InteractionSubscriptionStatus) => void
  ) => Promise<() => void>;
  addIncomingInteraction: (interaction: SupabaseInteractionRecord) => void;
}

/**
 * Convert Supabase interaction record to local Interaction interface
 */
function toLocalInteraction(record: SupabaseInteractionRecord): Interaction {
  return {
    id: record.id,
    type: record.type as 'poke' | 'kiss',
    fromUserId: record.from_user_id,
    toUserId: record.to_user_id,
    viewed: record.viewed ?? false,
    createdAt: new Date(record.created_at ?? new Date()),
  };
}

export const createInteractionsSlice: AppStateCreator<InteractionsSlice> = (set, get, _api) => ({
  // Initial state
  interactions: [],
  unviewedCount: 0,
  isSubscribed: false,
  interactionPartnerId: null,

  // Actions
  sendPoke: async () => {
    const currentUserId = get().userId;
    if (!currentUserId) {
      throw new Error('Cannot send poke: User not authenticated');
    }

    try {
      // Send poke via InteractionService — the recipient is derived there from
      // the authenticated relationship, never passed in from the UI.
      const pokeRecord = await interactionService.sendPoke(currentUserId);

      // Sign Out sits on the same screen, and the send now waits on two round
      // trips (the partner lookup and the insert). A poke that resolves after
      // the switch belongs to the previous account: report it truthfully to its
      // own caller, but never push it into the next account's feed.
      if (get().userId !== currentUserId) return pokeRecord;

      // Add to local state immediately (optimistic UI)
      const localInteraction = toLocalInteraction(pokeRecord);
      set((state) => ({
        interactions: [localInteraction, ...state.interactions],
      }));

      logger.debug('[InteractionsSlice] Poke sent:', pokeRecord.id);

      return pokeRecord;
    } catch (error) {
      console.error('[InteractionsSlice] Error sending poke:', error);
      throw error; // Re-throw to allow UI to show error feedback
    }
  },

  sendKiss: async () => {
    const currentUserId = get().userId;
    if (!currentUserId) {
      throw new Error('Cannot send kiss: User not authenticated');
    }

    try {
      // Send kiss via InteractionService — recipient derived, see sendPoke.
      const kissRecord = await interactionService.sendKiss(currentUserId);

      // See sendPoke: a kiss that resolves after an account switch is still the
      // true outcome for its caller, but not state for the new account.
      if (get().userId !== currentUserId) return kissRecord;

      // Add to local state immediately (optimistic UI)
      const localInteraction = toLocalInteraction(kissRecord);
      set((state) => ({
        interactions: [localInteraction, ...state.interactions],
      }));

      logger.debug('[InteractionsSlice] Kiss sent:', kissRecord.id);

      return kissRecord;
    } catch (error) {
      console.error('[InteractionsSlice] Error sending kiss:', error);
      throw error; // Re-throw to allow UI to show error feedback
    }
  },

  markInteractionViewed: async (id) => {
    try {
      // Mark as viewed via InteractionService
      await interactionService.markAsViewed(id);

      // Update local state
      set((state) => ({
        interactions: state.interactions.map((interaction) =>
          interaction.id === id ? { ...interaction, viewed: true } : interaction
        ),
        unviewedCount: Math.max(0, state.unviewedCount - 1),
      }));

      logger.debug('[InteractionsSlice] Interaction marked as viewed:', id);
    } catch (error) {
      console.error('[InteractionsSlice] Error marking interaction as viewed:', error);
      throw error;
    }
  },

  getUnviewedInteractions: () => {
    const { interactions, userId } = get();
    return interactions.filter(
      (interaction) => !interaction.viewed && interaction.toUserId === userId
    );
  },

  getInteractionHistory: (days = 7) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return get()
      .interactions.filter((interaction) => interaction.createdAt >= cutoffDate)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  loadInteractionHistory: async (limit = 100) => {
    const currentUserId = get().userId;
    if (!currentUserId) {
      throw new Error('Cannot load interaction history: User not authenticated');
    }

    try {
      // Fetch interaction history from Supabase
      // Note: getInteractionHistory already returns Interaction[] (converted format)
      const interactions = await interactionService.getInteractionHistory(currentUserId, limit);

      // Identity guard: Sign Out sits on the same screen that fires this, and the
      // request goes out with a still-valid token — so it succeeds and its write
      // lands after clearAuth, putting the previous account's data back.
      if (get().userId !== currentUserId) return;

      // Update state
      set({ interactions });

      // Calculate unviewed count (received-and-unviewed only — outgoing rows are never notifications)
      const unviewedCount = interactions.filter(
        (i) => !i.viewed && i.toUserId === currentUserId
      ).length;

      set({ unviewedCount });

      logger.debug(
        '[InteractionsSlice] Loaded interaction history:',
        interactions.length,
        'interactions,',
        unviewedCount,
        'unviewed'
      );
    } catch (error) {
      console.error('[InteractionsSlice] Error loading interaction history:', error);
      // Don't throw - graceful degradation with empty state
    }
  },

  subscribeToInteractions: async (onStatusChange) => {
    try {
      const { userId: currentUserId, authSessionVersion: subscribedInSession } = get();
      if (!currentUserId) {
        throw new Error('Cannot subscribe: User not authenticated');
      }

      // Partner snapshot, taken before the first record can arrive.
      // addIncomingInteraction is synchronous and runs inside a Realtime
      // callback, so it cannot await a lookup per row.
      const lookupAtSubscribe = await interactionService.resolvePartnerLookup();
      if (get().userId !== currentUserId || get().authSessionVersion !== subscribedInSession) {
        throw new Error('Cannot subscribe: account changed during partner lookup');
      }
      // Only a CONCLUSIVE lookup may overwrite the snapshot, for the same reason
      // as the re-resolve below: teardown leaves the snapshot in place, so a
      // remount whose `users` read fails would blank a value the previous mount
      // resolved correctly, and every record after it is refused.
      if (lookupAtSubscribe.status !== 'error') {
        set({
          interactionPartnerId:
            lookupAtSubscribe.status === 'linked' ? lookupAtSubscribe.partnerId : null,
        });
      }

      // Subscribe to incoming interactions
      let active = true;
      const unsubscribe = await interactionService.subscribeInteractions(
        currentUserId,
        (record) => {
          // Queued records can outlive teardown or a new sign-in by the same user.
          if (
            !active ||
            get().userId !== currentUserId ||
            get().authSessionVersion !== subscribedInSession
          ) return;

          // Add incoming interaction to state
          get().addIncomingInteraction(record);
        },
        (status) => {
          if (!active || get().userId !== currentUserId) return;
          set({ isSubscribed: status === 'SUBSCRIBED' });
          if (status === 'SUBSCRIBED') {
            // A reconnect re-fires SUBSCRIBED, which is the one moment the
            // relationship can have changed under a live subscription.
            void interactionService.resolvePartnerLookup().then((lookup) => {
              if (
                !active ||
                get().userId !== currentUserId ||
                get().authSessionVersion !== subscribedInSession
              ) return;
              // An INCONCLUSIVE read leaves the existing snapshot alone. This is
              // the one write that can clobber a working value: `SUBSCRIBED`
              // fires once more on a healthy socket, so a failure-null here
              // silently drops every poke and kiss for the rest of the page
              // view while `isSubscribed` stays true and the UI looks fine.
              //
              // A genuine unlink is conclusive and still nulls it, which is the
              // whole point of re-resolving on a re-join.
              if (lookup.status === 'error') {
                logger.debug(
                  '[InteractionsSlice] Partner re-resolve was inconclusive; keeping the previous snapshot'
                );
                return;
              }
              set({
                interactionPartnerId: lookup.status === 'linked' ? lookup.partnerId : null,
              });
            });
          }
          onStatusChange(status);
        }
      );

      logger.debug('[InteractionsSlice] Interaction subscription created');

      // Return enhanced unsubscribe function that also updates state
      return () => {
        if (!active) return;
        active = false;
        unsubscribe();
        // The snapshot is NOT cleared here. It belongs to the account, not to
        // one subscription: under StrictMode the first effect's teardown runs
        // after a second subscription has already taken its own snapshot, and
        // clearing here would blank the live one and refuse every real record.
        // signedOutState() clears it when the account changes, and each
        // subscribe overwrites it.
        set({ isSubscribed: false });
        logger.debug('[InteractionsSlice] Unsubscribed from interactions');
      };
    } catch (error) {
      console.error('[InteractionsSlice] Error subscribing to interactions:', error);
      throw error;
    }
  },

  addIncomingInteraction: (record) => {
    // CAP-4: a row that is not addressed to this account and sent by its
    // current partner never reaches the feed or the badge. Checked before the
    // duplicate lookup so a rejected row cannot even consume an id.
    const { userId: currentUserId, interactionPartnerId } = get();
    const validation = validateIncomingInteraction(record, {
      currentUserId,
      partnerId: interactionPartnerId,
    });
    if (!validation.isValid) {
      logger.debug('[InteractionsSlice] Rejecting incoming interaction:', {
        id: record.id,
        reason: validation.error,
      });
      return;
    }

    // Convert to local format
    const localInteraction = toLocalInteraction(record);

    // Only add if it's not already in the list (prevent duplicates)
    const exists = get().interactions.some((i) => i.id === record.id);
    if (exists) {
      logger.debug('[InteractionsSlice] Ignoring duplicate interaction:', record.id);
      return;
    }

    // Add to state
    set((state) => ({
      interactions: [localInteraction, ...state.interactions],
      unviewedCount: !localInteraction.viewed ? state.unviewedCount + 1 : state.unviewedCount,
    }));

    logger.debug('[InteractionsSlice] Incoming interaction added:', {
      id: record.id,
      type: record.type,
      from: record.from_user_id,
    });
  },
});
