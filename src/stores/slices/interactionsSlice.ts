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
import { validateInteraction, INTERACTION_ERRORS } from '../../utils/interactionValidation';
import { logger } from '../../utils/logger';

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
    const currentUserId = get().userId;
    if (!currentUserId) {
      throw new Error('Cannot send poke: User not authenticated');
    }

    // Validate interaction data before sending
    const validation = validateInteraction(partnerId, 'poke');
    if (!validation.isValid) {
      const error = new Error(validation.error || INTERACTION_ERRORS.INVALID_TYPE);
      console.error('[InteractionsSlice] Validation failed for poke:', validation.error);
      throw error;
    }

    try {
      // Send poke via InteractionService
      const pokeRecord = await interactionService.sendPoke(partnerId, currentUserId);

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

  sendKiss: async (partnerId) => {
    const currentUserId = get().userId;
    if (!currentUserId) {
      throw new Error('Cannot send kiss: User not authenticated');
    }

    // Validate interaction data before sending
    const validation = validateInteraction(partnerId, 'kiss');
    if (!validation.isValid) {
      const error = new Error(validation.error || INTERACTION_ERRORS.INVALID_TYPE);
      console.error('[InteractionsSlice] Validation failed for kiss:', validation.error);
      throw error;
    }

    try {
      // Send kiss via InteractionService
      const kissRecord = await interactionService.sendKiss(partnerId, currentUserId);

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
    const interactions = get().interactions;
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
    const currentUserId = get().userId;
    if (!currentUserId) {
      throw new Error('Cannot load interaction history: User not authenticated');
    }

    try {
      // Fetch interaction history from Supabase
      // Note: getInteractionHistory already returns Interaction[] (converted format)
      const interactions = await interactionService.getInteractionHistory(currentUserId, limit);

      // Update state
      set({ interactions });

      // Calculate unviewed count (all unviewed received interactions)
      const unviewedCount = interactions.filter((i) => !i.viewed).length;

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

  subscribeToInteractions: async () => {
    try {
      const currentUserId = get().userId;
      if (!currentUserId) {
        throw new Error('Cannot subscribe: User not authenticated');
      }

      // Subscribe to incoming interactions
      const unsubscribe = await interactionService.subscribeInteractions(
        currentUserId,
        (record) => {
          // Add incoming interaction to state
          get().addIncomingInteraction(record);
        }
      );

      set({ isSubscribed: true });

      logger.debug('[InteractionsSlice] Subscribed to interactions');

      // Return enhanced unsubscribe function that also updates state
      return () => {
        unsubscribe();
        set({ isSubscribed: false });
        logger.debug('[InteractionsSlice] Unsubscribed from interactions');
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
