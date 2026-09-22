/**
 * Navigation Slice
 *
 * Manages all navigation-related state and actions including:
 * - View switching (home/photos/mood/partner/notes/settings)
 * - Browser history integration
 *
 * Cross-slice dependencies:
 * - None (self-contained)
 *
 * Persistence:
 * - NOT persisted (currentView is restored from URL on mount)
 */

import { logger } from '../../utils/logger';
import { withBasePath } from '../../utils/basePath';
import type { AppStateCreator } from '../types';

export type ViewType =
  | 'home'
  | 'photos'
  | 'mood'
  | 'partner'
  | 'notes'
  | 'settings';

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
        settings: '/settings',
      };
      const basePath = pathMap[view];
      // Respect the configured base URL (`/` on Cloudflare Workers).
      // Shared with `App`'s inverse so the round trip can be asserted at the
      // production base, which neither call site could express alone (DW-125).
      const fullPath = withBasePath(basePath);
      // Tapping the already-active tab must not stack an identical history entry —
      // it would cost one Back press per tap before the user can leave the view.
      if (window.location.pathname === fullPath) {
        window.history.replaceState({ view }, '', fullPath);
      } else {
        window.history.pushState({ view }, '', fullPath);
      }
      logger.info(`[AppStore] View changed to '${view}', URL: ${fullPath}`);
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
});
