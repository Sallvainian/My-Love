/**
 * Navigation Slice
 *
 * Manages all navigation-related state and actions including:
 * - View switching (home/photos/mood/partner)
 * - Browser history integration
 *
 * Cross-slice dependencies:
 * - None (self-contained)
 *
 * Persistence:
 * - NOT persisted (currentView is restored from URL on mount)
 */

import type { AppStateCreator } from '../types';

export type ViewType = 'home' | 'photos' | 'mood' | 'partner' | 'notes' | 'scripture';

export interface NavigationSlice {
  // State
  currentView: ViewType;

  // Actions
  setView: (view: ViewType, skipHistory?: boolean) => void;
  navigateHome: () => void;
  navigatePhotos: () => void;
  navigateMood: () => void;
  navigatePartner: () => void;
  navigateNotes: () => void;
  navigateScripture: () => void;
}

export const createNavigationSlice: AppStateCreator<NavigationSlice> = (set, get, _api) => ({
  // Initial state
  currentView: 'home',

  // Actions
  setView: (view: ViewType, skipHistory = false) => {
    set({ currentView: view });

    // Update browser URL if not skipping history (prevents loops during popstate)
    if (!skipHistory) {
      const pathMap: Record<ViewType, string> = {
        home: '/',
        photos: '/photos',
        mood: '/mood',
        partner: '/partner',
        notes: '/notes',
        scripture: '/scripture',
      };
      const basePath = pathMap[view];
      // Respect base URL in production (e.g., /My-Love/ for GitHub Pages)
      const base = import.meta.env.BASE_URL || '/';
      const fullPath = base === '/' ? basePath : base.slice(0, -1) + basePath;
      window.history.pushState({ view }, '', fullPath);
      console.log(`[AppStore] View changed to '${view}', URL: ${fullPath}`);
    }
  },

  // Convenience actions
  navigateHome: () => {
    get().setView('home');
  },

  navigatePhotos: () => {
    get().setView('photos');
  },

  navigateMood: () => {
    get().setView('mood');
  },

  navigatePartner: () => {
    get().setView('partner');
  },

  navigateNotes: () => {
    get().setView('notes');
  },

  navigateScripture: () => {
    get().setView('scripture');
  },
});
