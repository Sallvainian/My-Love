/**
 * Mood API Service with Zod Validation
 *
 * Provides a validated wrapper around Supabase client for mood operations.
 * All API responses are validated using Zod schemas before being returned
 * to the application, ensuring type safety and data integrity.
 *
 * @module api/moodApi
 */

import { supabase } from './supabaseClient';
import {
  SupabaseMoodSchema,
  MoodArraySchema,
  type SupabaseMood,
  type MoodInsert,
} from './validation/supabaseSchemas';
import {
  isOnline,
  handleSupabaseError,
  handleNetworkError,
  logSupabaseError,
  isPostgrestError,
} from './errorHandlers';
import { ZodError } from 'zod';

/**
 * Custom error for API validation failures
 */
export class ApiValidationError extends Error {
  public readonly validationErrors: ZodError | null;

  constructor(message: string, validationErrors: ZodError | null = null) {
    super(message);
    this.name = 'ApiValidationError';
    this.validationErrors = validationErrors;
  }
}

/**
 * Mood API Service Class
 *
 * Provides validated CRUD operations for mood entries:
 * - Create: Insert new mood with validation
 * - Read: Fetch moods with validation
 * - Update: Update mood with validation
 * - Delete: Remove mood
 *
 * All responses are validated against Zod schemas to ensure data integrity.
 */
export class MoodApi {
  /**
   * Create a new mood entry in Supabase
   *
   * @param moodData - Mood entry to insert
   * @returns Validated mood record from database
   * @throws {ApiValidationError} if response validation fails
   * @throws {SupabaseServiceError} if database operation fails
   *
   * @example
   * ```typescript
   * const newMood = await moodApi.create({
   *   user_id: userId,
   *   mood_type: 'happy',
   *   note: 'Great day!',
   *   created_at: new Date().toISOString(),
   * });
   * ```
   */
  async create(moodData: MoodInsert): Promise<SupabaseMood> {
    // Check network status
    if (!isOnline()) {
      throw handleNetworkError(
        new Error('Device is offline'),
        'MoodApi.create'
      );
    }

    try {
      // Insert mood into Supabase
      const { data, error } = await supabase
        .from('moods')
        .insert(moodData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error('No data returned from Supabase insert');
      }

      // Validate response data
      try {
        const validatedMood = SupabaseMoodSchema.parse(data);
        return validatedMood;
      } catch (validationError) {
        if (validationError instanceof ZodError) {
          console.error('[MoodApi] Validation error on create:', validationError.errors);
          throw new ApiValidationError(
            'Invalid mood data received from server',
            validationError
          );
        }
        throw validationError;
      }
    } catch (error) {
      // Handle validation errors
      if (error instanceof ApiValidationError) {
        throw error;
      }

      logSupabaseError('MoodApi.create', error);

      if (isPostgrestError(error)) {
        throw handleSupabaseError(error, 'MoodApi.create');
      }

      throw handleNetworkError(error, 'MoodApi.create');
    }
  }

  /**
   * Fetch moods for a specific user
   *
   * @param userId - User ID to fetch moods for
   * @param limit - Maximum number of moods to fetch (default: 50)
   * @returns Validated array of mood records, sorted by created_at descending
   * @throws {ApiValidationError} if response validation fails
   * @throws {SupabaseServiceError} if database operation fails
   *
   * @example
   * ```typescript
   * const moods = await moodApi.fetchByUser(userId, 10);
   * console.log('Latest 10 moods:', moods);
   * ```
   */
  async fetchByUser(userId: string, limit: number = 50): Promise<SupabaseMood[]> {
    if (!isOnline()) {
      throw handleNetworkError(
        new Error('Device is offline'),
        'MoodApi.fetchByUser'
      );
    }

    try {
      const { data, error } = await supabase
        .from('moods')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      // Validate response data
      try {
        const validatedMoods = MoodArraySchema.parse(data || []);
        return validatedMoods;
      } catch (validationError) {
        if (validationError instanceof ZodError) {
          console.error('[MoodApi] Validation error on fetchByUser:', validationError.errors);
          throw new ApiValidationError(
            'Invalid mood data received from server',
            validationError
          );
        }
        throw validationError;
      }
    } catch (error) {
      // Handle validation errors
      if (error instanceof ApiValidationError) {
        throw error;
      }

      logSupabaseError('MoodApi.fetchByUser', error);

      if (isPostgrestError(error)) {
        throw handleSupabaseError(error, 'MoodApi.fetchByUser');
      }

      throw handleNetworkError(error, 'MoodApi.fetchByUser');
    }
  }

  /**
   * Fetch moods within a date range for a user
   *
   * @param userId - User ID to fetch moods for
   * @param startDate - Start of date range (ISO string)
   * @param endDate - End of date range (ISO string)
   * @returns Validated array of mood records within range
   * @throws {ApiValidationError} if response validation fails
   * @throws {SupabaseServiceError} if database operation fails
   *
   * @example
   * ```typescript
   * const moods = await moodApi.fetchByDateRange(
   *   userId,
   *   '2024-01-01T00:00:00Z',
   *   '2024-01-31T23:59:59Z'
   * );
   * ```
   */
  async fetchByDateRange(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<SupabaseMood[]> {
    if (!isOnline()) {
      throw handleNetworkError(
        new Error('Device is offline'),
        'MoodApi.fetchByDateRange'
      );
    }

    try {
      const { data, error } = await supabase
        .from('moods')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Validate response data
      try {
        const validatedMoods = MoodArraySchema.parse(data || []);
        return validatedMoods;
      } catch (validationError) {
        if (validationError instanceof ZodError) {
          console.error('[MoodApi] Validation error on fetchByDateRange:', validationError.errors);
          throw new ApiValidationError(
            'Invalid mood data received from server',
            validationError
          );
        }
        throw validationError;
      }
    } catch (error) {
      // Handle validation errors
      if (error instanceof ApiValidationError) {
        throw error;
      }

      logSupabaseError('MoodApi.fetchByDateRange', error);

      if (isPostgrestError(error)) {
        throw handleSupabaseError(error, 'MoodApi.fetchByDateRange');
      }

      throw handleNetworkError(error, 'MoodApi.fetchByDateRange');
    }
  }

  /**
   * Fetch a single mood by ID
   *
   * @param moodId - Mood ID to fetch
   * @returns Validated mood record or null if not found
   * @throws {ApiValidationError} if response validation fails
   * @throws {SupabaseServiceError} if database operation fails
   *
   * @example
   * ```typescript
   * const mood = await moodApi.fetchById(moodId);
   * if (mood) {
   *   console.log('Mood found:', mood);
   * }
   * ```
   */
  async fetchById(moodId: string): Promise<SupabaseMood | null> {
    if (!isOnline()) {
      throw handleNetworkError(
        new Error('Device is offline'),
        'MoodApi.fetchById'
      );
    }

    try {
      const { data, error } = await supabase
        .from('moods')
        .select('*')
        .eq('id', moodId)
        .single();

      if (error) {
        // PGRST116 = no rows found (expected for null returns)
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      if (!data) {
        return null;
      }

      // Validate response data
      try {
        const validatedMood = SupabaseMoodSchema.parse(data);
        return validatedMood;
      } catch (validationError) {
        if (validationError instanceof ZodError) {
          console.error('[MoodApi] Validation error on fetchById:', validationError.errors);
          throw new ApiValidationError(
            'Invalid mood data received from server',
            validationError
          );
        }
        throw validationError;
      }
    } catch (error) {
      // Handle validation errors
      if (error instanceof ApiValidationError) {
        throw error;
      }

      logSupabaseError('MoodApi.fetchById', error);

      if (isPostgrestError(error)) {
        throw handleSupabaseError(error, 'MoodApi.fetchById');
      }

      throw handleNetworkError(error, 'MoodApi.fetchById');
    }
  }

  /**
   * Update an existing mood entry
   *
   * @param moodId - ID of mood to update
   * @param updates - Partial mood data to update
   * @returns Validated updated mood record
   * @throws {ApiValidationError} if response validation fails
   * @throws {SupabaseServiceError} if database operation fails
   *
   * @example
   * ```typescript
   * const updated = await moodApi.update(moodId, {
   *   note: 'Updated note',
   * });
   * ```
   */
  async update(moodId: string, updates: Partial<MoodInsert>): Promise<SupabaseMood> {
    if (!isOnline()) {
      throw handleNetworkError(
        new Error('Device is offline'),
        'MoodApi.update'
      );
    }

    try {
      const { data, error} = await supabase
        .from('moods')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', moodId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error('No data returned from Supabase update');
      }

      // Validate response data
      try {
        const validatedMood = SupabaseMoodSchema.parse(data);
        return validatedMood;
      } catch (validationError) {
        if (validationError instanceof ZodError) {
          console.error('[MoodApi] Validation error on update:', validationError.errors);
          throw new ApiValidationError(
            'Invalid mood data received from server',
            validationError
          );
        }
        throw validationError;
      }
    } catch (error) {
      // Handle validation errors
      if (error instanceof ApiValidationError) {
        throw error;
      }

      logSupabaseError('MoodApi.update', error);

      if (isPostgrestError(error)) {
        throw handleSupabaseError(error, 'MoodApi.update');
      }

      throw handleNetworkError(error, 'MoodApi.update');
    }
  }

  /**
   * Delete a mood entry
   *
   * @param moodId - ID of mood to delete
   * @throws {SupabaseServiceError} if database operation fails
   *
   * @example
   * ```typescript
   * await moodApi.delete(moodId);
   * console.log('Mood deleted successfully');
   * ```
   */
  async delete(moodId: string): Promise<void> {
    if (!isOnline()) {
      throw handleNetworkError(
        new Error('Device is offline'),
        'MoodApi.delete'
      );
    }

    try {
      const { error } = await supabase
        .from('moods')
        .delete()
        .eq('id', moodId);

      if (error) {
        throw error;
      }
    } catch (error) {
      logSupabaseError('MoodApi.delete', error);

      if (isPostgrestError(error)) {
        throw handleSupabaseError(error, 'MoodApi.delete');
      }

      throw handleNetworkError(error, 'MoodApi.delete');
    }
  }
}

/**
 * Singleton instance of MoodApi
 * Use this instance throughout the app for validated mood API operations
 */
export const moodApi = new MoodApi();

export default moodApi;
