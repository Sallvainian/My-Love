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
 * Queries the users table to get the partner_id for the current user.
 * Uses the proper partner_id column that stores the established partner relationship.
 *
 * @returns Partner user ID or null if not found/not connected
 */
export const getPartnerId = async (): Promise<string | null> => {
  try {
    const authService = await getAuthService();
    const currentUserId = await authService.getCurrentUserId();

    if (!currentUserId) {
      console.error('[Supabase] Cannot get partner ID: User not authenticated');
      return null;
    }

    // Query current user's partner_id from users table
    const { data, error } = await supabase
      .from('users')
      .select('partner_id')
      .eq('id', currentUserId)
      .single();

    if (error) {
      // PGRST116 = no rows found (user doesn't have users table record yet)
      if (error.code === 'PGRST116') {
        console.warn('[Supabase] User has no users table record yet');
        return null;
      }
      console.error('[Supabase] Failed to get partner ID:', error);
      return null;
    }

    return data?.partner_id ?? null;
  } catch (error) {
    console.error('[Supabase] Error getting partner ID:', error);
    return null;
  }
};

/**
 * Get partner's display name
 * Fetches the partner's display_name from the users table.
 * This provides the correct name for each user's partner (not a hardcoded config value).
 *
 * @returns Partner's display name or null if not found
 */
export const getPartnerDisplayName = async (): Promise<string | null> => {
  try {
    const partnerId = await getPartnerId();

    if (!partnerId) {
      if (import.meta.env.DEV) {
        console.log('[Supabase] No partner ID found, cannot get partner display name');
      }
      return null;
    }

    // Query partner's display_name from users table
    const { data, error } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', partnerId)
      .single();

    if (error) {
      console.error('[Supabase] Failed to get partner display name:', error);
      return null;
    }

    return data?.display_name ?? null;
  } catch (error) {
    console.error('[Supabase] Error getting partner display name:', error);
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
