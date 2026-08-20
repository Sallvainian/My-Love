import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { DailyMessage } from './components/DailyMessage/DailyMessage';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import { NavigationTray } from './components/Navigation/NavigationTray';
import {
  BirthdayCountdown,
  EventCountdown,
  getEventsSlotView,
  getUpcomingEventCards,
  TimeTogether,
} from './components/RelationshipTimers';
import { ViewErrorBoundary } from './components/ViewErrorBoundary';
import { RELATIONSHIP_DATES } from './config/relationshipDates';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from './stores/useAppStore';
// PokeKissInterface moved to PartnerMoodView
import type { Session } from '@supabase/supabase-js';
import { getSession, onAuthStateChange } from './api/auth/sessionService';
import { DisplayNameSetup } from './components/DisplayNameSetup';
import { LoginScreen } from './components/LoginScreen';
import { NetworkStatusIndicator, SyncToast, type SyncResult } from './components/shared';
import { migrateCustomMessagesFromLocalStorage } from './services/migrationService';
import { isServiceWorkerSupported } from './utils/backgroundSync';
import { logger } from './utils/logger';
import { logStorageQuota } from './utils/storageMonitor';
import { applyTheme } from './utils/themes';

// Lazy load route components for code splitting
const PhotoGallery = lazy(() =>
  import('./components/PhotoGallery/PhotoGallery').then((m) => ({ default: m.PhotoGallery }))
);
const MoodTracker = lazy(() =>
  import('./components/MoodTracker/MoodTracker').then((m) => ({ default: m.MoodTracker }))
);
const PartnerMoodView = lazy(() =>
  import('./components/PartnerMoodView/PartnerMoodView').then((m) => ({
    default: m.PartnerMoodView,
  }))
);
const AdminPanel = lazy(() => import('./components/AdminPanel/AdminPanel'));
const LoveNotes = lazy(() =>
  import('./components/love-notes').then((m) => ({ default: m.LoveNotes }))
);

// Story 1.1: Scripture Reading Entry Point
const ScriptureOverview = lazy(() =>
  import('./components/scripture-reading').then((m) => ({ default: m.ScriptureOverview }))
);

// Story 4 (dynamic events): Settings is the app's only sign-out and, from
// story 5, the home of events CRUD. It was unreachable dead code until the
// navigation tray gave it a destination.
const Settings = lazy(() =>
  import('./components/Settings/Settings').then((m) => ({ default: m.Settings }))
);

// Lazy load modal/conditional components to reduce initial bundle
const WelcomeSplash = lazy(() =>
  import('./components/WelcomeSplash/WelcomeSplash').then((m) => ({ default: m.WelcomeSplash }))
);
const PhotoUpload = lazy(() =>
  import('./components/PhotoUpload/PhotoUpload').then((m) => ({ default: m.PhotoUpload }))
);
const PhotoCarousel = lazy(() =>
  import('./components/PhotoCarousel/PhotoCarousel').then((m) => ({ default: m.PhotoCarousel }))
);

// Loading spinner component for Suspense fallback
const LoadingSpinner = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-pink-500"></div>
  </div>
);

// Timer configuration
const WELCOME_DISPLAY_INTERVAL = 3600000; // 60 minutes in milliseconds
const LAST_WELCOME_VIEW_KEY = 'lastWelcomeView';

/**
 * How many event cards Home's right-hand column renders (DW-22). Without it
 * that column grows with the couple's event list while the birthdays column
 * beside it stays fixed at two cards.
 *
 * 6, chosen by the couple over the 3 this shipped with: a cap of 3 hid events
 * they had deliberately created, with no "+N more" affordance to say so, and
 * the upcoming list is bounded anyway by how many future events two people
 * plan at once. The overflow still gets no affordance — Settings lists every
 * event, past ones included — but at 6 the overflow is not reachable in
 * practice. Sibling precedent for the pattern (not the number) is
 * `<CountdownTimer anniversaries={...} maxDisplay={3} />` in `DailyMessage`,
 * a `.slice(0, count)` in `utils/countdownService.ts`.
 */
const HOME_MAX_EVENT_CARDS = 6;

function App() {
  const { settings, isLoading, currentView, isOnline, events } = useAppStore(
    useShallow((s) => ({
      settings: s.settings,
      isLoading: s.isLoading,
      currentView: s.currentView,
      isOnline: s.syncStatus.isOnline,
      events: s.events,
    }))
  );
  const initializeApp = useAppStore((s) => s.initializeApp);
  const setView = useAppStore((s) => s.setView);
  const syncPendingMoods = useAppStore((s) => s.syncPendingMoods);
  const updateSyncStatus = useAppStore((s) => s.updateSyncStatus);
  const loadEvents = useAppStore((s) => s.loadEvents);
  const hasInitialized = useRef(false);

  // Story 6.7: Authentication state
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [needsDisplayName, setNeedsDisplayName] = useState(false);

  // Story 3 (dynamic events): which account's first loadEvents() has come back.
  // Home's events slot stays empty rather than showing the "no upcoming events"
  // placeholder until this matches the current user, so the placeholder never
  // flashes before the first response — and it re-arms both for the next
  // account on a switch and, via the sign-out branch below, for a re-sign-in of
  // the same account. Declared here, alongside the other auth state, because
  // that sign-out reset runs in the auth listener further down.
  const [eventsSettledForUserId, setEventsSettledForUserId] = useState<string | null>(null);
  // Whether that settle was a FAILED load. loadEvents never rejects — it parks
  // the reason in eventsError and resolves — so the .finally gate alone reads
  // "settled" for a load that returned nothing, and Home would tell an offline
  // user "No upcoming events yet.". Snapshotted at settle time rather than
  // subscribed live, so a later write failure parking its own eventsError
  // cannot flip a successfully-loaded slot into the error state.
  const [eventsLoadFailed, setEventsLoadFailed] = useState(false);

  // Helper function to check if welcome splash should be shown
  const shouldShowWelcome = (): boolean => {
    const lastViewStr = localStorage.getItem(LAST_WELCOME_VIEW_KEY);

    // First visit - no timestamp stored
    if (!lastViewStr) {
      return true;
    }

    // Parse timestamp and check if 60 minutes have passed
    const lastView = parseInt(lastViewStr, 10);
    if (isNaN(lastView)) {
      // Invalid timestamp, treat as first visit
      return true;
    }

    const now = Date.now();
    const timeSinceLastView = now - lastView;

    return timeSinceLastView >= WELCOME_DISPLAY_INTERVAL;
  };

  const [showSplash, setShowSplash] = useState(shouldShowWelcome);
  const [splashSource, setSplashSource] = useState<'auto' | 'manual'>('auto');
  // Decided once, by the URL the page was loaded with, so it belongs in the initializer
  // rather than in a mount effect that needs a second render to correct itself. Nothing
  // re-derives this from the URL later: after mount the flag belongs entirely to
  // handleAdminExit, whose pushState is URL bookkeeping and never reads back into state.
  const [showAdmin, setShowAdmin] = useState(() => window.location.pathname.includes('/admin'));
  const [isPhotoUploadOpen, setIsPhotoUploadOpen] = useState(false);

  // Story 1.5: Sync completion feedback state (AC-1.5.4)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // Sign-out lives in Settings alone (story 4). Both controls called the same
  // `signOut` -- api/authService.ts:10 re-exports the very function this file
  // used to import from ./api/auth/actionService -- and the store reset hangs
  // off the auth listener below (clearStoreAuth -> authSlice.clearAuth ->
  // signedOutState()), not off either caller, so nothing was lost with the
  // App-level wiring. Settings' copy is strictly better: it surfaces the
  // failure to the user instead of only console.error-ing it.

  // Helper to get route path without base (handles both dev and production)
  const getRoutePath = (pathname: string): string => {
    // Strip the base path in production (/My-Love/)
    const base = import.meta.env.BASE_URL || '/';
    if (base !== '/' && pathname.startsWith(base)) {
      return pathname.slice(base.length - 1); // Keep leading slash
    }
    return pathname;
  };

  // Story 4.5: Initial route detection and popstate listener (AC-4.5.5, AC-4.5.6)
  useEffect(() => {
    // AC-4.5.5: Initial route detection - set view based on URL
    const routePath = getRoutePath(window.location.pathname);
    const initialView =
      routePath === '/photos'
        ? 'photos'
        : routePath === '/mood'
          ? 'mood'
          : routePath === '/partner'
            ? 'partner'
            : routePath === '/notes'
              ? 'notes'
              : routePath === '/scripture'
                ? 'scripture'
                : routePath === '/settings'
                  ? 'settings'
                  : 'home';
    setView(initialView, true); // Skip history update on initial load

    // AC-4.5.6: Browser back/forward button support
    const handlePopState = () => {
      const routePath = getRoutePath(window.location.pathname);
      const view =
        routePath === '/photos'
          ? 'photos'
          : routePath === '/mood'
            ? 'mood'
            : routePath === '/partner'
              ? 'partner'
              : routePath === '/notes'
                ? 'notes'
                : routePath === '/scripture'
                  ? 'scripture'
                  : routePath === '/settings'
                    ? 'settings'
                    : 'home';
      setView(view, true); // Skip history update to prevent loop
      logger.debug(`[App] Popstate: navigated to ${view}`);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [setView]);

  // Story 6.7: Check authentication status on mount
  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const currentSession = await getSession();
        if (isMounted) {
          setSession(currentSession);
          setAuthLoading(false);

          // Populate store auth state for synchronous access by all slices
          const { setAuthUser, clearAuth } = useAppStore.getState();
          if (currentSession?.user) {
            setAuthUser(currentSession.user.id, currentSession.user.email);
          } else {
            clearAuth();
          }

          logger.debug('[App] Auth check:', currentSession ? 'authenticated' : 'not authenticated');
        }
      } catch (error) {
        console.error('[App] Auth check failed:', error);
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    };

    checkAuth();

    // Listen for auth state changes
    const unsubscribe = onAuthStateChange((newSession) => {
      if (isMounted) {
        setSession(newSession);

        // Update store auth state for synchronous access by all slices
        const { setAuthUser, clearAuth: clearStoreAuth } = useAppStore.getState();

        // Check if user needs to set display name (for new OAuth signups)
        if (newSession?.user) {
          setAuthUser(newSession.user.id, newSession.user.email);
          const hasDisplayName = newSession.user.user_metadata?.display_name;
          setNeedsDisplayName(!hasDisplayName);

          logger.debug('[App] Auth state changed:', {
            authenticated: true,
            hasDisplayName,
            needsSetup: !hasDisplayName,
          });
        } else {
          clearStoreAuth();
          setNeedsDisplayName(false);
          // Re-arm Home's events gate. App stays mounted across a sign-out —
          // the `!session` branch returns the login screen from inside this
          // component — while clearStoreAuth empties `events` via
          // signedOutState() (authSlice.ts). Without this reset, signing back
          // in as the SAME account finds eventsSettledForUserId already equal
          // to the user id, so firstEventsLoadSettled is true against an empty
          // list and the "no upcoming events" placeholder paints before the
          // refetch lands. Keying the load effect on the user id covers an
          // account switch; only this covers a re-sign-in of the same account.
          setEventsSettledForUserId(null);
          setEventsLoadFailed(false);
          logger.debug('[App] Auth state changed: signed out');
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Initialize the app on mount (useRef ensures single init even in StrictMode)
    // Only initialize if user is authenticated
    if (!hasInitialized.current && session) {
      hasInitialized.current = true;

      // Performance fix: Initialize app immediately for fast first paint
      // Migration runs in background after initial render
      initializeApp();

      // Story 3.5: Migrate custom messages from LocalStorage to IndexedDB
      // Deferred to not block initial paint - runs after first render
      const runMigration = async () => {
        try {
          const migrationResult = await migrateCustomMessagesFromLocalStorage();
          if (migrationResult.migratedCount > 0) {
            logger.debug('[App] Migration completed:', {
              migrated: migrationResult.migratedCount,
              skipped: migrationResult.skippedCount,
              success: migrationResult.success,
            });
          }
          if (migrationResult.errors.length > 0) {
            console.error('[App] Migration errors:', migrationResult.errors);
          }
        } catch (error) {
          console.error('[App] Migration failed:', error);
        }

        // Monitor LocalStorage quota in development mode (Epic 2 technical debt)
        logStorageQuota();
      };

      // Use requestIdleCallback if available, otherwise setTimeout
      // This ensures migration doesn't block the main thread during initial render
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => runMigration(), { timeout: 2000 });
      } else {
        setTimeout(runMigration, 100);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]); // Initialize when session is established

  // Apply theme when settings change
  useEffect(() => {
    if (settings) {
      applyTheme(settings.themeName);
    }
  }, [settings]);

  // Story 6.4: Task 2 - Network state detection with auto-sync on reconnect (AC #2)
  useEffect(() => {
    const handleOnline = () => {
      logger.debug('[App] Network: ONLINE - triggering sync');

      // Update sync status to reflect online state
      updateSyncStatus();

      // Trigger background sync when coming back online
      syncPendingMoods().catch((error) => {
        console.error('[App] Auto-sync on reconnect failed:', error);
      });
    };

    const handleOffline = () => {
      logger.debug('[App] Network: OFFLINE');

      // Update sync status to reflect offline state
      updateSyncStatus();
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync status update
    updateSyncStatus();

    // Cleanup on unmount
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncPendingMoods, updateSyncStatus]);

  // Hybrid Sync Solution: Periodic background sync + immediate sync on mount
  useEffect(() => {
    // Part 1: Immediate sync on app mount (if online and authenticated)
    if (isOnline && session) {
      logger.debug('[App] Initial sync on mount - checking for pending moods');
      syncPendingMoods().catch((error) => {
        console.error('[App] Initial sync on mount failed:', error);
      });
    }

    // Part 2: Periodic sync every 5 minutes while app is open
    const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
    const syncInterval = setInterval(() => {
      if (isOnline && session) {
        logger.debug('[App] Periodic sync triggered (5-minute interval)');
        syncPendingMoods().catch((error) => {
          console.error('[App] Periodic sync failed:', error);
        });
      }
    }, SYNC_INTERVAL_MS);

    // Cleanup interval on unmount
    return () => {
      clearInterval(syncInterval);
      logger.debug('[App] Periodic sync interval cleared');
    };
  }, [syncPendingMoods, isOnline, session]);

  // Story 3 (dynamic events): load the couple's countdown events on first
  // Home render and on every later return to Home while signed in — covers
  // both "first load" and "B's next load of Home" (CAP-1). No live
  // subscription: freshness is reload-based only, by design.
  //
  // Depends on the signed-in user's id, never `session` itself and never a
  // bare boolean. onAuthStateChange (sessionService.ts) invokes its callback —
  // and therefore setSession — on every auth event, including periodic
  // TOKEN_REFRESHED, each producing a new Session object reference, so keying
  // on `session` would re-fire loadEvents() on every token refresh. A bare
  // Boolean(session) fixes that but breaks the opposite case: signing in over
  // a live session routes through setAuthUser's account-switch branch
  // (authSlice.ts), which empties `events` via signedOutState(), while
  // `currentView` is left at 'home' — so with a boolean key neither dependency
  // changes, loadEvents() never re-fires, and the new account sits on the
  // empty-state placeholder until it navigates away and back. The user id is
  // stable across token refreshes and changes on exactly that switch.
  const authUserId = session?.user?.id ?? null;

  const firstEventsLoadSettled =
    eventsSettledForUserId !== null && eventsSettledForUserId === authUserId;

  useEffect(() => {
    if (!authUserId || currentView !== 'home') return;

    let cancelled = false;
    void loadEvents().finally(() => {
      if (cancelled) return;
      // loadEvents cleared eventsError on entry, so non-null here means THIS
      // load failed — the one signal the resolved-void promise cannot carry.
      setEventsLoadFailed(useAppStore.getState().eventsError !== null);
      setEventsSettledForUserId(authUserId);
    });

    return () => {
      cancelled = true;
    };
    // isOnline is a dep for exactly one reason: coming back online re-fires
    // the load, so the offline error card clears without leaving Home. The
    // offline-direction re-fire just fails fast into the same parked error,
    // and a failed refresh never blanks the last-good list (eventsSlice).
  }, [authUserId, currentView, isOnline, loadEvents]);

  // Bumped when a card retires itself at local midnight, purely to re-run the
  // filter and slot decision below. Not a timer of its own: it rides the
  // one-second interval EventCountdown already runs, so the Never rule against
  // a dedicated midnight timer still holds. Without it, the last upcoming event
  // rolling over removes its own card while the upcoming count still includes
  // it, and the slot shows neither a card nor the placeholder. With the render
  // cap it also refills: the tick is what lets the 4th event take the slot the
  // retiring 1st just freed, without a reload.
  const [, setRetiredEventTick] = useState(0);
  const handleEventRetired = useCallback(() => setRetiredEventTick((tick) => tick + 1), []);

  // Part 3: Service Worker Background Sync listener
  // Story 1.5: Enhanced to show sync completion feedback (AC-1.5.4)
  useEffect(() => {
    // Guard: Skip setup if service workers are not supported
    // (e.g., Safari private mode, older browsers, test environment)
    if (!isServiceWorkerSupported() || !navigator.serviceWorker) {
      logger.debug('[App] Service Worker not supported, skipping background sync listener');
      return; // No cleanup needed
    }

    // Direct message listener to capture sync counts for toast notification
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'BACKGROUND_SYNC_COMPLETED') {
        const { successCount, failCount } = event.data;

        logger.debug('[App] Service Worker completed background sync:', {
          successCount,
          failCount,
        });

        // Refresh local state after SW completed sync
        await updateSyncStatus();

        // Story 1.5: Show sync completion toast (AC-1.5.4)
        if (successCount > 0 || failCount > 0) {
          setSyncResult({ successCount, failCount });
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    // Cleanup on unmount
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [updateSyncStatus]);

  // Story 6.7: Show loading screen while checking authentication
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 animate-pulse text-6xl">💕</div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Story 6.7: Show login screen if not authenticated
  if (!session) {
    return (
      <ErrorBoundary>
        <LoginScreen
          onLoginSuccess={() => {
            // Session will be updated by auth state listener
            logger.debug('[App] Login successful');
          }}
        />
      </ErrorBoundary>
    );
  }

  // Show display name setup modal if user needs to set display name
  // This appears AFTER successful OAuth signup, not before
  if (needsDisplayName) {
    return (
      <ErrorBoundary>
        <DisplayNameSetup
          isOpen={needsDisplayName}
          onComplete={() => {
            setNeedsDisplayName(false);
            // Refresh session to get updated user_metadata
            getSession().then((refreshedSession) => {
              if (refreshedSession) {
                setSession(refreshedSession);
              }
            });
          }}
        />
      </ErrorBoundary>
    );
  }

  // Show app loading screen while initializing data
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 animate-pulse text-6xl">💕</div>
          <p className="text-gray-600">Loading your data...</p>
        </div>
      </div>
    );
  }

  // Handle splash screen continuation (automatic display)
  const handleContinue = () => {
    // Only the automatic splash resets the 60-minute timer
    if (splashSource === 'auto') {
      localStorage.setItem(LAST_WELCOME_VIEW_KEY, Date.now().toString());
    }
    setSplashSource('auto');
    setShowSplash(false);
  };

  // Handle manual trigger from button (does NOT reset timer)
  const showWelcomeManually = () => {
    setSplashSource('manual');
    setShowSplash(true);
  };

  // Handle admin exit
  const handleAdminExit = () => {
    setShowAdmin(false);
    // Update URL without page reload
    window.history.pushState({}, '', window.location.pathname.replace('/admin', ''));
  };

  // Show welcome splash on first visit
  if (showSplash) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<LoadingSpinner />}>
          <WelcomeSplash onContinue={handleContinue} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  // Story 3.4: Show AdminPanel if admin route is active
  if (showAdmin) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<LoadingSpinner />}>
          <AdminPanel onExit={handleAdminExit} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  // Story 3 (dynamic events): only events that have not yet passed at the
  // viewer's own local midnight (CAP-3), capped at HOME_MAX_EVENT_CARDS
  // (DW-22). Both live in `getUpcomingEventCards`, which reuses
  // `getCalendarDaysDiff` — the same comparison EventCountdown already trusts —
  // rather than re-deriving it. `events` is already sorted soonest-first by
  // eventsSlice; no re-sort. One clock reading for the whole list: called
  // without `now`, every event samples its own `new Date()`, so a pass
  // straddling a midnight tick can judge two same-day events against different
  // days.
  const now = new Date();
  const { upcomingCount, visible: visibleEvents } = getUpcomingEventCards(
    events,
    now,
    HOME_MAX_EVENT_CARDS
  );
  const eventsSlotView = getEventsSlotView(
    events.length,
    upcomingCount,
    firstEventsLoadSettled,
    eventsLoadFailed
  );

  // Story 1.4 & 4.1/4.2 & 6.2 & 6.4: Render home, photos, mood, or partner view based on navigation
  return (
    <ErrorBoundary>
      <div className="min-h-screen" data-testid="app-container">
        {/* Story 4 (dynamic events): sticky app chrome. It sits in normal flow
            above <main>, so no view needs a compensating pad -- which is why
            the retired bottom bar's `pb-16` is gone rather than mirrored. */}
        <NavigationTray currentView={currentView} onViewChange={setView} />

        {/* Story 1.5: Network Status Indicator - Shows banner when offline/connecting (AC-1.5.1) */}
        <NetworkStatusIndicator showOnlyWhenOffline />

        {/* Story 1.5: Sync Completion Toast - Shows feedback after reconnection sync (AC-1.5.4) */}
        <SyncToast syncResult={syncResult} onDismiss={() => setSyncResult(null)} />

        {/* Story 6.5: Poke/Kiss Interaction Interface - Moved to PartnerMoodView */}

        <main id="main-content">
          {/* Home view - inline, not lazy-loaded, always works offline */}
          {currentView === 'home' && (
            <div className="mx-auto max-w-4xl space-y-6 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {/* Time Together - replaces Day 37 Together header */}
              <TimeTogether />

              {/* Countdown timers grid: Birthdays (left) | Wedding+Events (right) */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Left column - Birthdays */}
                <div className="space-y-4">
                  <BirthdayCountdown birthday={RELATIONSHIP_DATES.birthdays.frank} />
                  <BirthdayCountdown birthday={RELATIONSHIP_DATES.birthdays.gracie} />
                </div>

                {/* Right column - Wedding & Events */}
                <div className="space-y-4">
                  <EventCountdown
                    label="Wedding"
                    icon="ring"
                    date={RELATIONSHIP_DATES.wedding}
                    placeholderText="Date TBD"
                  />
                  {eventsSlotView === 'hidden' ? null : eventsSlotView === 'error' ? (
                    <div
                      className="rounded-2xl border-2 border-gray-200 bg-white p-4 text-center shadow-lg dark:border-gray-700 dark:bg-gray-900"
                      data-testid="events-load-error"
                      role="status"
                      aria-live="polite"
                    >
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Unable to load events — check your connection, then come back to Home.
                      </p>
                    </div>
                  ) : eventsSlotView === 'empty' ? (
                    <div
                      className="rounded-2xl border-2 border-gray-200 bg-white p-4 text-center shadow-lg dark:border-gray-700 dark:bg-gray-900"
                      data-testid="events-empty-placeholder"
                      role="status"
                      aria-live="polite"
                    >
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No upcoming events yet.
                      </p>
                    </div>
                  ) : (
                    // Already filtered and capped by getUpcomingEventCards,
                    // which hands the slot decision above the UNCAPPED count —
                    // so hiding the tail can never turn a real list into the
                    // empty placeholder.
                    visibleEvents.map((event) => (
                      <EventCountdown
                        key={event.id}
                        label={event.label}
                        icon={event.icon}
                        date={event.date}
                        description={event.description ?? undefined}
                        onRetire={handleEventRetired}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* Daily Message */}
              <DailyMessage onShowWelcome={showWelcomeManually} />
            </div>
          )}

          {/* Lazy-loaded views wrapped in ViewErrorBoundary to keep navigation visible on errors */}
          {currentView !== 'home' && (
            <ViewErrorBoundary viewName={currentView} onNavigateHome={() => setView('home')}>
              <Suspense fallback={<LoadingSpinner />}>
                {currentView === 'photos' && (
                  <PhotoGallery onUploadClick={() => setIsPhotoUploadOpen(true)} />
                )}

                {currentView === 'mood' && <MoodTracker />}

                {currentView === 'partner' && <PartnerMoodView />}

                {currentView === 'notes' && <LoveNotes />}

                {/* Story 1.1: Scripture Reading Entry Point */}
                {currentView === 'scripture' && <ScriptureOverview />}

                {/* Story 4 (dynamic events): Settings, home of the only sign-out */}
                {currentView === 'settings' && <Settings />}
              </Suspense>
            </ViewErrorBoundary>
          )}
        </main>

        {/* Photo upload modal - Story 4.1 (lazy loaded) */}
        <Suspense fallback={null}>
          <PhotoUpload isOpen={isPhotoUploadOpen} onClose={() => setIsPhotoUploadOpen(false)} />
        </Suspense>

        {/* Photo carousel - Story 4.3: AC-4.3.1 - Render when photo selected (lazy loaded) */}
        <Suspense fallback={null}>
          <PhotoCarousel />
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}

export default App;
