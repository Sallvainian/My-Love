/**
 * Navigation Slice
 *
 * Manages all navigation-related state and actions including:
 * - View switching (home/photos)
 * - Browser history integration
 *
 * Cross-slice dependencies:
 * - None (self-contained)
 *
 * Persistence:
 * - NOT persisted (currentView is restored from URL on mount)
 */

import type { StateCreator } from 'zustand';

export interface NavigationSlice {
  // State
  currentView: 'home' | 'photos';

  // Actions
  setView: (view: 'home' | 'photos', skipHistory?: boolean) => void;
  navigateHome: () => void;
  navigatePhotos: () => void;
}

export const createNavigationSlice: StateCreator<NavigationSlice, [], [], NavigationSlice> = (
  set,
  get
) => ({
  // Initial state
  currentView: 'home',

  // Actions
  setView: (view: 'home' | 'photos', skipHistory = false) => {
    set({ currentView: view });

    // Update browser URL if not skipping history (prevents loops during popstate)
    if (!skipHistory) {
      const path = view === 'home' ? '/' : '/photos';
      window.history.pushState({ view }, '', path);
      console.log(`[AppStore] View changed to '${view}', URL: ${path}`);
    }
  },

  // Convenience actions
  navigateHome: () => {
    get().setView('home');
  },

  navigatePhotos: () => {
    get().setView('photos');
  },
});
