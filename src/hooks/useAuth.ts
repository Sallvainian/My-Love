/**
 * useAuth Hook
 *
 * Provides authentication state by reading from the Zustand store (authSlice).
 * The store is populated by onAuthStateChange in App.tsx.
 *
 * @module hooks/useAuth
 */

import { useAppStore } from '../stores/useAppStore';

interface AuthUser {
  id: string;
  email: string | null;
}

interface UseAuthReturn {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Get current authenticated user from the store
 *
 * @returns Current user state
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { user } = useAuth();
 *   if (!user) return <div>Not authenticated</div>;
 *   return <div>Welcome {user.email}</div>;
 * }
 * ```
 */
export function useAuth(): UseAuthReturn {
  const userId = useAppStore((s) => s.userId);
  const userEmail = useAppStore((s) => s.userEmail);

  return {
    user: userId ? { id: userId, email: userEmail } : null,
    isLoading: false,
    error: null,
  };
}
