/**
 * Auth Slice
 *
 * Single source of truth for authenticated user identity across all slices.
 * Populated by onAuthStateChange in App.tsx — readable synchronously via get().userId.
 *
 * Cross-slice dependencies:
 * - All slices read userId from this slice instead of making async auth calls
 *
 * Persistence:
 * - NOT persisted (derived from Supabase session on each app load)
 */

import type { AppStateCreator } from '../types';

export interface AuthSlice {
  /** Logged-in user's auth ID — null when signed out */
  userId: string | null;
  /** User's email for display purposes */
  userEmail: string | null;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;

  /** Set authenticated user (called from onAuthStateChange in App.tsx) */
  setAuthUser: (userId: string | null, email?: string | null) => void;
  /** Clear auth state on sign-out */
  clearAuth: () => void;
}

export const createAuthSlice: AppStateCreator<AuthSlice> = (set) => ({
  userId: null,
  userEmail: null,
  isAuthenticated: false,

  setAuthUser: (userId, email) => {
    set({
      userId,
      userEmail: email ?? null,
      isAuthenticated: !!userId,
    });
  },

  clearAuth: () => {
    set({
      userId: null,
      userEmail: null,
      isAuthenticated: false,
      // Drop the cached moods with the identity that owns them. They are a
      // read cache of IndexedDB, so nothing is lost — unsynced entries stay in
      // IndexedDB and are still picked up once their owner signs back in.
      // Leaving them in memory let the next account to sign in on this device
      // read the previous one's notes.
      moods: [],
    });
  },
});
