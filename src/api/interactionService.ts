/**
 * Interaction Service
 *
 * Handles poke and kiss interactions between partners via Supabase.
 * Provides methods for sending interactions, subscribing to incoming interactions,
 * and fetching interaction history.
 *
 * @module api/interactionService
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import {
  handleNetworkError,
  handleSupabaseError,
  isOnline,
  isPostgrestError,
  logSupabaseError,
} from './errorHandlers';
import type { Database } from './supabaseClient';
import { supabase } from './supabaseClient';

/**
 * Supabase interaction record type (from database schema)
 */
export type SupabaseInteractionRecord = Database['public']['Tables']['interactions']['Row'];

/**
 * Interaction type enum
 */
export type InteractionType = 'poke' | 'kiss';

/**
 * Local Interaction interface
 */
export interface Interaction {
  id: string;
  type: InteractionType;
  fromUserId: string;
  toUserId: string;
  viewed: boolean;
  createdAt: Date;
}

/**
 * Interaction Service Class
 *
 * Responsibilities:
 * - Send poke/kiss interactions to partner
 * - Subscribe to real-time incoming interactions
 * - Fetch interaction history
 * - Mark interactions as viewed
 */
export class InteractionService {
  private realtimeChannel: RealtimeChannel | null = null;

  /**
   * Send a poke to partner
   *
   * @param partnerId - Partner's user ID
   * @returns Supabase interaction record
   * @throws SupabaseServiceError on failure
   *
   * @example
   * ```typescript
   * try {
   *   const poke = await interactionService.sendPoke(partnerId);
   *   console.log('Poke sent:', poke.id);
   * } catch (error) {
   *   console.error('Failed to send poke:', error);
   * }
   * ```
   */
  async sendPoke(partnerId: string, userId: string): Promise<SupabaseInteractionRecord> {
    return this.sendInteraction('poke', partnerId, userId);
  }

  /**
   * Send a kiss to partner
   *
   * @param partnerId - Partner's user ID
   * @returns Supabase interaction record
   * @throws SupabaseServiceError on failure
   *
   * @example
   * ```typescript
   * try {
   *   const kiss = await interactionService.sendKiss(partnerId);
   *   console.log('Kiss sent:', kiss.id);
   * } catch (error) {
   *   console.error('Failed to send kiss:', error);
   * }
   * ```
   */
  async sendKiss(partnerId: string, userId: string): Promise<SupabaseInteractionRecord> {
    return this.sendInteraction('kiss', partnerId, userId);
  }

  /**
   * Internal method to send interaction of any type
   *
   * @param type - Interaction type (poke or kiss)
   * @param toUserId - Recipient user ID
   * @returns Supabase interaction record
   * @throws SupabaseServiceError on failure
   */
  private async sendInteraction(
    type: InteractionType,
    toUserId: string,
    userId: string
  ): Promise<SupabaseInteractionRecord> {
    // Check network status
    if (!isOnline()) {
      throw handleNetworkError(
        new Error('Device is offline'),
        'InteractionService.sendInteraction'
      );
    }

    try {
      // Create interaction insert payload
      const interactionInsert: Database['public']['Tables']['interactions']['Insert'] = {
        type,
        from_user_id: userId,
        to_user_id: toUserId,
        viewed: false,
      };

      // Insert interaction into Supabase
      const { data, error } = await supabase
        .from('interactions')
        .insert(interactionInsert)
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error('No data returned from Supabase insert');
      }

      logger.info(`[InteractionService] Sent ${type} to ${toUserId}`);
      return data;
    } catch (error) {
      logSupabaseError('InteractionService.sendInteraction', error);

      if (isPostgrestError(error)) {
        throw handleSupabaseError(error, 'InteractionService.sendInteraction');
      }

      throw handleNetworkError(error, 'InteractionService.sendInteraction');
    }
  }

  /**
   * Subscribe to real-time incoming interactions
   *
   * Listens for INSERT events on the interactions table filtered by current user ID.
   * Calls the provided callback whenever partner sends an interaction.
   *
   * @param callback - Function called with new interaction record
   * @returns Promise resolving to unsubscribe function to stop listening
   *
   * @example
   * ```typescript
   * const unsubscribe = await interactionService.subscribeInteractions((interaction) => {
   *   console.log('Received interaction:', interaction.type);
   *   // Show notification or update UI
   * });
   *
   * // Later, when component unmounts:
   * unsubscribe();
   * ```
   */
  async subscribeInteractions(
    userId: string,
    callback: (interaction: SupabaseInteractionRecord) => void
  ): Promise<() => void> {
    // Create Realtime channel for incoming interactions
    this.realtimeChannel = supabase
      .channel('incoming-interactions')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'interactions',
          filter: `to_user_id=eq.${userId}`,
        },
        (payload) => {
          logger.info('[InteractionService] Received interaction:', payload.new);
          callback(payload.new as SupabaseInteractionRecord);
        }
      )
      .subscribe((status) => {
        logger.info('[InteractionService] Realtime subscription status:', status);
      });

    // Return unsubscribe function
    return () => {
      if (this.realtimeChannel) {
        supabase.removeChannel(this.realtimeChannel);
        this.realtimeChannel = null;
        logger.info('[InteractionService] Unsubscribed from interactions');
      }
    };
  }

  /**
   * Fetch interaction history
   *
   * Retrieves interactions sent to or from the current user,
   * sorted by creation date (newest first).
   *
   * @param limit - Maximum number of interactions to fetch (default: 50)
   * @param offset - Number of interactions to skip (default: 0)
   * @returns Array of interaction records
   *
   * @example
   * ```typescript
   * const interactions = await interactionService.getInteractionHistory(20);
   * console.log('Last 20 interactions:', interactions);
   * ```
   */
  async getInteractionHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Interaction[]> {
    try {
      // Query interactions where current user is sender or recipient
      const { data, error } = await supabase
        .from('interactions')
        .select('*')
        .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      // Transform Supabase records to local Interaction format
      return (
        data?.map((record) => ({
          id: record.id,
          type: record.type as InteractionType,
          fromUserId: record.from_user_id,
          toUserId: record.to_user_id,
          viewed: record.viewed ?? false,
          createdAt: new Date(record.created_at ?? new Date()),
        })) || []
      );
    } catch (error) {
      logSupabaseError('InteractionService.getInteractionHistory', error);

      if (isPostgrestError(error)) {
        throw handleSupabaseError(error, 'InteractionService.getInteractionHistory');
      }

      throw handleNetworkError(error, 'InteractionService.getInteractionHistory');
    }
  }

  /**
   * Fetch unviewed interactions
   *
   * Retrieves interactions sent to current user that haven't been viewed yet.
   *
   * @returns Array of unviewed interaction records
   *
   * @example
   * ```typescript
   * const unviewed = await interactionService.getUnviewedInteractions();
   * console.log(`You have ${unviewed.length} new interactions`);
   * ```
   */
  async getUnviewedInteractions(userId: string): Promise<Interaction[]> {
    try {
      const { data, error } = await supabase
        .from('interactions')
        .select('*')
        .eq('to_user_id', userId)
        .eq('viewed', false)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return (
        data?.map((record) => ({
          id: record.id,
          type: record.type as InteractionType,
          fromUserId: record.from_user_id,
          toUserId: record.to_user_id,
          viewed: record.viewed ?? false,
          createdAt: new Date(record.created_at ?? new Date()),
        })) || []
      );
    } catch (error) {
      logSupabaseError('InteractionService.getUnviewedInteractions', error);

      if (isPostgrestError(error)) {
        throw handleSupabaseError(error, 'InteractionService.getUnviewedInteractions');
      }

      throw handleNetworkError(error, 'InteractionService.getUnviewedInteractions');
    }
  }

  /**
   * Mark interaction as viewed
   *
   * @param interactionId - Interaction ID to mark as viewed
   *
   * @example
   * ```typescript
   * await interactionService.markAsViewed(interactionId);
   * ```
   */
  async markAsViewed(interactionId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('interactions')
        .update({ viewed: true })
        .eq('id', interactionId);

      if (error) {
        throw error;
      }

      logger.info(`[InteractionService] Marked interaction ${interactionId} as viewed`);
    } catch (error) {
      logSupabaseError('InteractionService.markAsViewed', error);

      if (isPostgrestError(error)) {
        throw handleSupabaseError(error, 'InteractionService.markAsViewed');
      }

      throw handleNetworkError(error, 'InteractionService.markAsViewed');
    }
  }
}
