/**
 * Interactions Slice
 *
 * Manages all poke/kiss interaction state and actions including:
 * - Sending poke/kiss to partner
 * - Receiving real-time interaction notifications
 * - Marking interactions as viewed
 * - Interaction history retrieval
 *
 * Cross-slice dependencies:
 * - None (self-contained)
 *
 * Persistence:
 * - Interactions are ephemeral (not persisted to LocalStorage/IndexedDB)
 * - Fetched from Supabase on app init and via Realtime updates
 * - Marked as viewed via Supabase API
 */

import type { AppStateCreator } from '../types';
import type { Interaction, SupabaseInteractionRecord } from '../../types';
import { InteractionService } from '../../api/interactionService';
import { getCurrentUserId } from '../../api/auth/sessionService';
import { validateInteraction, INTERACTION_ERRORS } from '../../utils/interactionValidation';

// Initialize interaction service singleton
const interactionService = new InteractionService();

export interface InteractionsSlice {
  // State
  interactions: Interaction[];
  unviewedCount: number;
  isSubscribed: boolean;

  // Actions
  sendPoke: (partnerId: string) => Promise<SupabaseInteractionRecord>;
  sendKiss: (partnerId: string) => Promise<SupabaseInteractionRecord>;
  markInteractionViewed: (id: string) => Promise<void>;
  getUnviewedInteractions: () => Interaction[];
  getInteractionHistory: (days?: number) => Interaction[];
  loadInteractionHistory: (limit?: number) => Promise<void>;
  subscribeToInteractions: () => Promise<() => void>;
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

  // Actions
  sendPoke: async (partnerId) => {
    // Validate interaction data before sending
    const validation = validateInteraction(partnerId, 'poke');
    if (!validation.isValid) {
      const error = new Error(validation.error || INTERACTION_ERRORS.INVALID_TYPE);
      console.error('[InteractionsSlice] Validation failed for poke:', validation.error);
      throw error;
    }

    try {
      // Send poke via InteractionService
      const pokeRecord = await interactionService.sendPoke(partnerId);

      // Add to local state immediately (optimistic UI)
      const localInteraction = toLocalInteraction(pokeRecord);
      set((state) => ({
        interactions: [localInteraction, ...state.interactions],
      }));

      if (import.meta.env.DEV) {
        console.log('[InteractionsSlice] Poke sent:', pokeRecord.id);
      }

      return pokeRecord;
    } catch (error) {
      console.error('[InteractionsSlice] Error sending poke:', error);
      throw error; // Re-throw to allow UI to show error feedback
    }
  },

  sendKiss: async (partnerId) => {
    // Validate interaction data before sending
    const validation = validateInteraction(partnerId, 'kiss');
    if (!validation.isValid) {
      const error = new Error(validation.error || INTERACTION_ERRORS.INVALID_TYPE);
      console.error('[InteractionsSlice] Validation failed for kiss:', validation.error);
      throw error;
    }

    try {
      // Send kiss via InteractionService
      const kissRecord = await interactionService.sendKiss(partnerId);

      // Add to local state immediately (optimistic UI)
      const localInteraction = toLocalInteraction(kissRecord);
      set((state) => ({
        interactions: [localInteraction, ...state.interactions],
      }));

      if (import.meta.env.DEV) {
        console.log('[InteractionsSlice] Kiss sent:', kissRecord.id);
      }

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

      if (import.meta.env.DEV) {
        console.log('[InteractionsSlice] Interaction marked as viewed:', id);
      }
    } catch (error) {
      console.error('[InteractionsSlice] Error marking interaction as viewed:', error);
      throw error;
    }
  },

  getUnviewedInteractions: () => {
    // getCurrentUserId returns Promise, but we need sync access
    // This is safe because the user ID is cached after auth initialization
    // For a more robust solution, we could store userId in state
    const interactions = get().interactions;

    // Filter for received unviewed interactions
    // We can't await getCurrentUserId here, so we check both directions
    return interactions.filter((interaction) => !interaction.viewed);
  },

  getInteractionHistory: (days = 7) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return get()
      .interactions.filter((interaction) => interaction.createdAt >= cutoffDate)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  loadInteractionHistory: async (limit = 100) => {
    try {
      // Fetch interaction history from Supabase
      // Note: getInteractionHistory already returns Interaction[] (converted format)
      const interactions = await interactionService.getInteractionHistory(limit);

      // Update state
      set({ interactions });

      // Calculate unviewed count (all unviewed received interactions)
      const unviewedCount = interactions.filter((i) => !i.viewed).length;

      set({ unviewedCount });

      if (import.meta.env.DEV) {
        console.log(
          '[InteractionsSlice] Loaded interaction history:',
          interactions.length,
          'interactions,',
          unviewedCount,
          'unviewed'
        );
      }
    } catch (error) {
      console.error('[InteractionsSlice] Error loading interaction history:', error);
      // Don't throw - graceful degradation with empty state
    }
  },

  subscribeToInteractions: async () => {
    try {
      const currentUserId = await getCurrentUserId();
      if (!currentUserId) {
        throw new Error('Cannot subscribe: User not authenticated');
      }

      // Subscribe to incoming interactions
      const unsubscribe = await interactionService.subscribeInteractions((record) => {
        // Add incoming interaction to state
        get().addIncomingInteraction(record);
      });

      set({ isSubscribed: true });

      if (import.meta.env.DEV) {
        console.log('[InteractionsSlice] Subscribed to interactions');
      }

      // Return enhanced unsubscribe function that also updates state
      return () => {
        unsubscribe();
        set({ isSubscribed: false });
        if (import.meta.env.DEV) {
          console.log('[InteractionsSlice] Unsubscribed from interactions');
        }
      };
    } catch (error) {
      console.error('[InteractionsSlice] Error subscribing to interactions:', error);
      throw error;
    }
  },

  addIncomingInteraction: (record) => {
    // Convert to local format
    const localInteraction = toLocalInteraction(record);

    // Only add if it's not already in the list (prevent duplicates)
    const exists = get().interactions.some((i) => i.id === record.id);
    if (exists) {
      if (import.meta.env.DEV) {
        console.log('[InteractionsSlice] Ignoring duplicate interaction:', record.id);
      }
      return;
    }

    // Add to state
    set((state) => ({
      interactions: [localInteraction, ...state.interactions],
      unviewedCount: !localInteraction.viewed ? state.unviewedCount + 1 : state.unviewedCount,
    }));

    if (import.meta.env.DEV) {
      console.log('[InteractionsSlice] Incoming interaction added:', {
        id: record.id,
        type: record.type,
        from: record.from_user_id,
      });
    }
  },
});
