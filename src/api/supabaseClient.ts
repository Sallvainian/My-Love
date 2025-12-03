/**
 * Supabase Client - Singleton Instance
 *
 * Provides a configured Supabase client for all API interactions.
 * Uses environment variables for URL and anon key.
 *
 * @module api/supabaseClient
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

// Re-export Database type for convenience
export type { Database } from '../types/database.types';

// Import authService dynamically to avoid circular dependency

let authServiceModule: any = null;
const getAuthService = async () => {
  if (!authServiceModule) {
    authServiceModule = await import('./authService');
  }
  return authServiceModule.authService;
};

/**
 * Supabase configuration from environment variables
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY as string;

/**
 * Validate required environment variables
 */
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] Missing required environment variables');
  console.error('[Supabase] VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('[Supabase] VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY:', supabaseAnonKey ? '✓' : '✗');
  throw new Error(
    'Supabase configuration missing. Check .env file and ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY are set.'
  );
}

/**
 * Singleton Supabase client instance
 *
 * Features:
 * - Typed database schema for type-safe queries
 * - JWT authentication via anon key
 * - Realtime subscriptions support
 * - Row Level Security enforcement
 *
 * @example
 * ```typescript
 * import { supabase } from './api/supabaseClient';
 *
 * // Query moods
 * const { data, error } = await supabase
 *   .from('moods')
 *   .select('*')
 *   .eq('user_id', userId);
 * ```
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // Enable OAuth callback detection
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

/**
 * Get partner user ID
 * Queries the database to find the other user (partner) in the system.
 * For 2-user MVP: Returns the user ID that is not the current user.
 *
 * @returns Partner user ID or null if not found
 */
export const getPartnerId = async (): Promise<string | null> => {
  try {
    const authService = await getAuthService();
    const currentUserId = await authService.getCurrentUserId();

    if (!currentUserId) {
      console.error('[Supabase] Cannot get partner ID: User not authenticated');
      return null;
    }

    // Query users table for the partner (the other user)
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .neq('id', currentUserId)
      .limit(1)
      .single();

    if (error) {
      console.error('[Supabase] Failed to get partner ID:', error);
      return null;
    }

    return data?.id ?? null;
  } catch (error) {
    console.error('[Supabase] Error getting partner ID:', error);
    return null;
  }
};

/**
 * Check if Supabase is properly configured
 */
export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey);
};

export default supabase;
