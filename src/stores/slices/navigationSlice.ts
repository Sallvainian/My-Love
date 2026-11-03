/**
 * Navigation Slice
 *
 * Manages all navigation-related state and actions including:
 * - View switching (home/photos/mood/partner/notes/settings)
 * - The open Settings subpage (`settingsPath`), mirrored in the URL under `/settings/`
 * - Whether that page was opened from Home (`settingsFromHome`), a date card or
 *   Home's Add button: the entry carries `from: 'home'` in `history.state`, which
 *   survives a reload, and the flag mirrors it so the dock keeps Home lit
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

/** The route Settings' top page lives at; its subpages sit under `/settings/`. */
const SETTINGS_ROUTE = '/settings';

/** Whether a route (base path already stripped) is Settings' top page or one of its subpages. */
export function isSettingsRoute(routePath: string): boolean {
  return routePath === SETTINGS_ROUTE || routePath.startsWith(`${SETTINGS_ROUTE}/`);
}

/** The route of a Settings page: `''` (the top page) is `/settings`, `photos` is `/settings/photos`. */
export function settingsRoute(path: string): string {
  return path ? `${SETTINGS_ROUTE}/${path}` : SETTINGS_ROUTE;
}

/**
 * The Settings page a route names: `/settings/photos` is `photos`, and the top
 * page, a trailing slash or any route outside Settings is `''`.
 */
export function settingsPathFromRoute(routePath: string): string {
  if (!isSettingsRoute(routePath)) return '';
  return routePath.slice(SETTINGS_ROUTE.length).replace(/^\/+|\/+$/g, '');
}

export interface NavigationSlice {
  // State
  currentView: ViewType;
  /** The open Settings subpage, relative to `/settings` (`''` is the top page). */
  settingsPath: string;
  /**
   * The open Settings page belongs to a flow that began on Home. Mirrors
   * `history.state.from === 'home'` (the truth, since it survives a reload):
   * set by `openSettingsPage` and re-read by `showSettingsPage`, cleared by a
   * view the person picks. The dock highlights Home while it is set.
   */
  settingsFromHome: boolean;
  /**
   * The page the last `openSettingsPage` pushed, or `null`: a reload starts the
   * store afresh and every history restore (`showSettingsPage`) clears it. It
   * tells a form or one-field page that the person opened it just now -- from
   * Home's Add, with no stack mounted yet -- from one a reload or a history
   * restore landed on, which shows the parent.
   */
  settingsPushedPath: string | null;

  // Actions
  setView: (view: ViewType, skipHistory?: boolean) => void;
  /**
   * Push a Settings subpage: one history entry, marked as created by the app.
   * `fromHome` marks the entry as part of a flow that began on Home; left out,
   * a push from a page that is itself from Home inherits it.
   */
  openSettingsPage: (path: string, options?: { fromHome?: boolean }) => void;
  /**
   * Show a Settings page without touching history (popstate, reload,
   * redirects), taking `settingsFromHome` from the current entry.
   */
  showSettingsPage: (path: string) => void;
  navigateHome: () => void;
  navigatePhotos: () => void;
  navigateMood: () => void;
  navigatePartner: () => void;
  navigateNotes: () => void;
}

export const createNavigationSlice: AppStateCreator<NavigationSlice> = (set, get, _api) => ({
  // Initial state
  currentView: 'home',
  settingsPath: '',
  settingsFromHome: false,
  settingsPushedPath: null,

  // Actions
  setView: (view: ViewType, skipHistory = false) => {
    // A view the person picks opens Settings at its top page; a history
    // restore (skipHistory) leaves the page to `showSettingsPage`.
    set(
      skipHistory
        ? { currentView: view }
        : { currentView: view, settingsPath: '', settingsFromHome: false }
    );

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
        // The entry keeps whether the app created it: Settings' back arrow
        // reads `inApp` to tell "back returns one level" from "back leaves".
        const inApp = window.history.state?.inApp === true;
        window.history.replaceState(inApp ? { view, inApp } : { view }, '', fullPath);
      } else {
        window.history.pushState({ view, inApp: true }, '', fullPath);
      }
      logger.info(`[AppStore] View changed to '${view}', URL: ${fullPath}`);
    }
  },

  openSettingsPage: (path: string, options?: { fromHome?: boolean }) => {
    const { currentView, settingsFromHome } = get();
    const fromHome = options?.fromHome ?? (currentView === 'settings' && settingsFromHome);
    set({
      currentView: 'settings',
      settingsPath: path,
      settingsFromHome: fromHome,
      settingsPushedPath: path,
    });
    const fullPath = withBasePath(settingsRoute(path));
    window.history.pushState(
      { view: 'settings', settingsPath: path, inApp: true, ...(fromHome ? { from: 'home' } : {}) },
      '',
      fullPath
    );
    logger.info(`[AppStore] Settings page opened: '${path}', URL: ${fullPath}`);
  },

  showSettingsPage: (path: string) => {
    set({
      settingsPath: path,
      settingsFromHome: window.history.state?.from === 'home',
      settingsPushedPath: null,
    });
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
