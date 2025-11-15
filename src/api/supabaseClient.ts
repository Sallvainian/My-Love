/**
 * Supabase Client - Singleton Instance
 *
 * Provides a configured Supabase client for all API interactions.
 * Uses environment variables for URL and anon key.
 *
 * @module api/supabaseClient
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Database schema type definition
 * Generated from Supabase schema (to be replaced with generated types)
 */
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          partner_name: string | null;
          device_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          partner_name?: string | null;
          device_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          partner_name?: string | null;
          device_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      moods: {
        Row: {
          id: string;
          user_id: string;
          mood_type: 'loved' | 'happy' | 'content' | 'thoughtful' | 'grateful';
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          mood_type: 'loved' | 'happy' | 'content' | 'thoughtful' | 'grateful';
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          mood_type?: 'loved' | 'happy' | 'content' | 'thoughtful' | 'grateful';
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      interactions: {
        Row: {
          id: string;
          type: 'poke' | 'kiss';
          from_user_id: string;
          to_user_id: string;
          viewed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: 'poke' | 'kiss';
          from_user_id: string;
          to_user_id: string;
          viewed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          type?: 'poke' | 'kiss';
          from_user_id?: string;
          to_user_id?: string;
          viewed?: boolean;
          created_at?: string;
        };
      };
    };
  };
}

/**
 * Supabase configuration from environment variables
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/**
 * Validate required environment variables
 */
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] Missing required environment variables');
  console.error('[Supabase] VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('[Supabase] VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓' : '✗');
  throw new Error(
    'Supabase configuration missing. Check .env file and ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.'
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
 * Get current authenticated user ID
 * Returns the authenticated user's ID from the Supabase Auth session
 *
 * @deprecated Use authService.getCurrentUserId() instead
 * @throws Error if no authenticated session exists
 */
export const getCurrentUserId = async (): Promise<string> => {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    console.error('[Supabase Auth] Failed to get user:', error);
    throw error;
  }

  if (!user) {
    throw new Error('No authenticated user found. Please sign in first.');
  }

  return user.id;
};

/**
 * Get partner user ID
 * Queries the database to find the other user (partner) in the system.
 * For 2-user MVP: Returns the user ID that is not the current user.
 *
 * @returns Partner user ID or null if not found
 */
export const getPartnerId = async (): Promise<string | null> => {
  try {
    const currentUserId = await getCurrentUserId();

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
