/**
 * Interaction Service
 *
 * Handles poke and kiss interactions between partners via Supabase.
 * Provides methods for sending interactions, subscribing to incoming interactions,
 * and fetching interaction history.
 *
 * **The error convention.** This file throws, but never through
 * `handleNetworkError`: that helper closes every message it builds with "Your
 * changes will be synced when you're back online" (`errorHandlers.ts:95`), and
 * interactions are Supabase-only — no offline queue, no IndexedDB mirror, no
 * retry — so a poke that never left the device is not waiting to sync, it is
 * gone. The reasoning is written out at length in
 * `src/services/eventsService.ts:19-26`, and the two local builders below are
 * copied from it. The helper's promise stays TRUE for its mood callers, which
 * do have a service-worker sync queue, so `errorHandlers.ts` is left alone.
 *
 * @module api/interactionService
 */

import { logger } from '../utils/logger';
import {
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

export type InteractionSubscriptionStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT';

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
 * An interaction that could not be sent: it was refused before leaving the
 * device (offline), or it reached the database and created nothing.
 *
 * Not exported, and deliberately re-thrown untouched by the catch tail —
 * routing it through `handleNetworkError` would tell the user their poke "will
 * be synced when you're back online", which is the opposite of what happened.
 * Same shape as `EventWriteError` (`eventsService.ts:108-113`).
 */
class InteractionWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InteractionWriteError';
  }
}

/**
 * A mid-flight failure that is not a PostgREST error — DNS, a timeout, a
 * dropped socket. NOT `handleNetworkError`, for the reason in the module
 * header: interactions sync in neither direction, so every catch tail here
 * builds its own truthful message instead. Copied from
 * `eventsService.ts:124-127`.
 */
function networkFailure(context: string, error: unknown): Error {
  const detail = error instanceof Error ? error.message : 'Unknown network error';
  return new Error(`[${context}] Network error: ${detail}. Check your internet connection.`);
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

  /**
   * Send a poke to partner
   *
   * @param partnerId - Partner's user ID
   * @returns Supabase interaction record
   * @throws {InteractionWriteError} if offline, or if the insert created no
   *   row — no queue exists, so the interaction is lost rather than deferred
   * @throws an accurate network error if the request fails mid-flight
   * @throws {SupabaseServiceError} if PostgREST rejects the insert
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
   * @throws {InteractionWriteError} if offline, or if the insert created no
   *   row — no queue exists, so the interaction is lost rather than deferred
   * @throws an accurate network error if the request fails mid-flight
   * @throws {SupabaseServiceError} if PostgREST rejects the insert
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
   * @throws {InteractionWriteError} if offline, or if the insert created no
   *   row — no queue exists, so the interaction is lost rather than deferred
   * @throws an accurate network error if the request fails mid-flight
   * @throws {SupabaseServiceError} if PostgREST rejects the insert
   */
  private async sendInteraction(
    type: InteractionType,
    toUserId: string,
    userId: string
  ): Promise<SupabaseInteractionRecord> {
    if (!isOnline()) {
      // NOT handleNetworkError: no offline queue exists, so its "will be
      // synced when you're back online" promise is the opposite of the truth.
      throw new InteractionWriteError(`You are offline. A ${type} needs a connection to send.`);
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
        // Not a network problem, so it must not be dressed as one: the catch
        // tail would otherwise promise a sync that no queue exists to perform.
        throw new InteractionWriteError(`The ${type} was not sent`);
      }

      logger.info(`[InteractionService] Sent ${type} to ${toUserId}`);
      return data;
    } catch (error) {
      if (error instanceof InteractionWriteError) {
        throw error;
      }

      logSupabaseError('InteractionService.sendInteraction', error);

      if (isPostgrestError(error)) {
        throw handleSupabaseError(error, 'InteractionService.sendInteraction');
      }

      throw networkFailure('InteractionService.sendInteraction', error);
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
    callback: (interaction: SupabaseInteractionRecord) => void,
    onStatusChange: (status: InteractionSubscriptionStatus) => void
  ): Promise<() => void> {
    // NOTE: this does NOT give each subscription its own channel, despite the
    // per-call shape. `supabase.channel(topic)` returns whatever is already
    // registered under the topic (RealtimeClient.js:277-288), and the topic here
    // keys on the user, so two overlapping subscriptions for one user share an
    // object and the first teardown closes it under the second. Only
    // PokeKissInterface mounts this, and only once, so today the overlap is
    // confined to StrictMode's double-invoked effects in dev. See
    // moodSyncService.subscribeMoodUpdates for the per-topic tracking this
    // needs if a second consumer is ever added.
    const channel = supabase
      .channel(`incoming-interactions:${userId}`)
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
        if (
          status === 'SUBSCRIBED' ||
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT'
        ) {
          onStatusChange(status);
        }
      });

    let removed = false;
    return () => {
      if (removed) return;
      removed = true;
      supabase.removeChannel(channel);
      logger.info('[InteractionService] Unsubscribed from interactions');
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

      throw networkFailure('InteractionService.getInteractionHistory', error);
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

      throw networkFailure('InteractionService.getUnviewedInteractions', error);
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

      throw networkFailure('InteractionService.markAsViewed', error);
    }
  }
}
