/**
 * Navigation Slice
 *
 * Manages all navigation-related state and actions including:
 * - View switching (home/photos/mood/partner/notes/settings)
 * - The open Settings subpage (`settingsPath`), mirrored in the URL under `/settings/`
 * - Whether that page was opened from Home (`settingsFromHome`), a date card or
 *   Home's Add button: the entry carries `from: 'home'` in `history.state`, which
 *   survives a reload, and the flag mirrors it so the dock keeps Home lit
 * - Browser history integration: Home is the bottom of the history. A view
 *   picked in the dock goes back down to the first entry, makes it Home and
 *   stacks the view on it, so back (the shell's edge swipe, the browser's
 *   button) from any view returns to Home, and back on Home leaves nothing
 *   behind. Each entry the app creates carries `depth`, its height above that
 *   first entry; a fresh load has no state and is depth 0. The walk down ends
 *   on the `popstate` it causes; if none comes (a depth past the start of the
 *   history, a page restored from the back/forward cache mid-walk) a `pageshow`
 *   or `WALK_TIMEOUT_MS` ends it, so the dock never stays stuck (DW-441).
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
  | 'daily'
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

/**
 * How many entries the app has stacked above the first entry of this visit.
 * A fresh load carries no state, so it reads 0. A stored depth can outlive the
 * entries below it, so it is capped at `history.length - 1`. That is only an
 * upper bound: the length also counts entries below the app (another site,
 * `about:blank`) and forward entries. A walk the cap leaves out of range gets
 * no `popstate` and is ended by the timer; one it overshoots can leave the app.
 */
export function historyDepth(): number {
  const depth: unknown = window.history.state?.depth;
  if (typeof depth !== 'number' || depth <= 0) return 0;
  return Math.min(depth, Math.max(window.history.length - 1, 0));
}

/** How long a walk down may wait for its `popstate` before the pick lands in place. */
export const WALK_TIMEOUT_MS = 1000;

/** The route of each view, before the base path. */
const pathMap: Record<ViewType, string> = {
  home: '/',
  photos: '/photos',
  mood: '/mood',
  partner: '/partner',
  daily: '/daily',
  notes: '/notes',
  settings: '/settings',
};

/**
 * A dock pick waiting for `history.go` to reach the first entry, and, while
 * that walk is under way, the function that ends it (removes its listeners and
 * timer and clears the pick), so a second tap before it lands changes the
 * target rather than walking again.
 */
let pendingView: ViewType | null = null;
let stopWalk: (() => void) | null = null;

/**
 * Make the current entry Home and put any other view on top of it. The walk
 * lands on the first entry, but the timer path, where no `popstate` came,
 * treats the current entry as the bottom, so entries below it can stay behind
 * Home there.
 */
function stackOnFirstEntry(view: ViewType): void {
  const homePath = withBasePath(pathMap.home);
  // An entry that still claims a depth is not the bottom, whatever its URL.
  if (window.location.pathname !== homePath || window.history.state?.depth !== undefined) {
    const inApp = window.history.state?.inApp === true;
    window.history.replaceState({ view: 'home', ...(inApp ? { inApp } : {}) }, '', homePath);
  }
  if (view !== 'home') {
    window.history.pushState({ view, inApp: true, depth: 1 }, '', withBasePath(pathMap[view]));
  }
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
      const basePath = pathMap[view];
      // Respect the configured base URL (`/` on Cloudflare Workers).
      // Shared with `App`'s inverse so the round trip can be asserted at the
      // production base, which neither call site could express alone (DW-125).
      const fullPath = withBasePath(basePath);
      const depth = historyDepth();
      // Tapping the already-active tab must not stack an identical history entry —
      // it would cost one Back press per tap before the user can leave the view.
      if (window.location.pathname === fullPath && !stopWalk) {
        // The entry keeps whether the app created it: Settings' back arrow
        // reads `inApp` to tell "back returns one level" from "back leaves".
        const inApp = window.history.state?.inApp === true;
        window.history.replaceState(
          { view, ...(inApp ? { inApp } : {}), ...(depth > 0 ? { depth } : {}) },
          '',
          fullPath
        );
      } else if (depth > 0 || stopWalk) {
        // Above the first entry: walk back down to it, then stack the view on
        // Home there once the walk lands (App's popstate handler runs first).
        pendingView = view;
        if (!stopWalk) {
          const onPopstate = () => {
            const target = pendingView;
            stopWalk?.();
            if (target) get().setView(target);
          };
          // A page restored from the back/forward cache mid-walk never gets
          // the popstate; the next tap starts a fresh walk.
          const onPageshow = (event: Event) => {
            if ((event as PageTransitionEvent).persisted) stopWalk?.();
          };
          // Safety net: no popstate came, so land the last pick in place.
          const timer = setTimeout(() => {
            const target = pendingView;
            stopWalk?.();
            if (target) {
              stackOnFirstEntry(target);
              console.warn(
                `[AppStore] Dock walk to the first entry got no popstate; landed '${target}' in place`
              );
            }
          }, WALK_TIMEOUT_MS);
          stopWalk = () => {
            window.removeEventListener('popstate', onPopstate);
            window.removeEventListener('pageshow', onPageshow);
            clearTimeout(timer);
            stopWalk = null;
            pendingView = null;
          };
          window.addEventListener('popstate', onPopstate);
          window.addEventListener('pageshow', onPageshow);
          window.history.go(-depth);
        }
      } else {
        stackOnFirstEntry(view);
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
      {
        view: 'settings',
        settingsPath: path,
        inApp: true,
        depth: historyDepth() + 1,
        ...(fromHome ? { from: 'home' } : {}),
      },
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
