/**
 * App Slice
 *
 * Owns core app state that was previously "root" fields in useAppStore.ts:
 * - isLoading: Global loading state for app initialization
 * - error: Global error state
 * - __isHydrated: Internal flag for Zustand persist hydration tracking
 *
 * Cross-slice dependencies:
 * - None (this is the core slice that others depend on)
 *
 * Persistence:
 * - NOT persisted (runtime state only)
 */

import type { AppSlice, AppStateCreator } from '../types';

export const createAppSlice: AppStateCreator<AppSlice> = (set, _get, _api) => ({
  // Initial state
  isLoading: false,
  error: null,
  __isHydrated: false,

  // Actions
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setHydrated: (hydrated) => set({ __isHydrated: hydrated }),
});
