/**
 * useAuth Hook
 *
 * Provides authentication state and current user information.
 *
 * @module hooks/useAuth
 */

import { useState, useEffect } from 'react';
import { supabase } from '../api/supabaseClient';
import type { User } from '@supabase/supabase-js';

interface UseAuthReturn {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Get current authenticated user
 *
 * @returns Current user state with loading and error states
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { user, isLoading } = useAuth();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (!user) return <div>Not authenticated</div>;
 *
 *   return <div>Welcome {user.email}</div>;
 * }
 * ```
 */
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get initial session
    const getUser = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) throw error;

        setUser(user);
      } catch (err) {
        console.error('[useAuth] Failed to get user:', err);
        setError(err instanceof Error ? err.message : 'Failed to get user');
      } finally {
        setIsLoading(false);
      }
    };

    getUser();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    isLoading,
    error,
  };
}
