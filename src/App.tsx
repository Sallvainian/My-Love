import { Heart, Plus } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { DailyMessage } from './components/DailyMessage/DailyMessage';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import { AppNavigation } from './components/Navigation/AppNavigation';
import {
  BirthdayWeddingCards,
  EventCountdown,
  getEventsSlotView,
  getUpcomingEventCards,
  TimeTogether,
} from './components/RelationshipTimers';
import { ViewErrorBoundary } from './components/ViewErrorBoundary';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from './stores/useAppStore';
// PokeKissInterface moved to PartnerMoodView
import type { Session } from '@supabase/supabase-js';
import { getSession, onAuthStateChange } from './api/auth/sessionService';
import {
  getAuthCallbackOutcome,
  lookupOwnDisplayName,
  type AuthCallbackOutcome,
} from './api/supabaseClient';
import { DisplayNameSetup } from './components/DisplayNameSetup';
import { LoginScreen } from './components/LoginScreen';
import { NetworkStatusIndicator, SyncToast, type SyncResult } from './components/shared';
import { isServiceWorkerSupported } from './utils/backgroundSync';
import { refreshLocalCopies, refreshLocalCopy } from './services/localCopy';
import { MESSAGE_DATA_COPY_KIND } from './stores/slices/messagesSlice';
import { PROFILE_COPY_KIND } from './stores/slices/settingsSlice';
import { stripBasePath } from './utils/basePath';
import { logger } from './utils/logger';
import { logStorageQuota } from './utils/storageMonitor';

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

// Loading spinner component for Suspense fallback
const LoadingSpinner = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-accent"></div>
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
  const {
    isLoading, currentView, isOnline, events, authUserId, authSessionVersion,
  } = useAppStore(
    useShallow((s) => ({
      isLoading: s.isLoading,
      currentView: s.currentView,
      isOnline: s.syncStatus.isOnline,
      events: s.events,
      authUserId: s.userId,
      authSessionVersion: s.authSessionVersion,
    }))
  );
  const initializeApp = useAppStore((s) => s.initializeApp);
  const setView = useAppStore((s) => s.setView);
  const syncPendingMoods = useAppStore((s) => s.syncPendingMoods);
  const drainQueuedNotes = useAppStore((s) => s.drainQueuedNotes);
  const updateSyncStatus = useAppStore((s) => s.updateSyncStatus);
  const loadEvents = useAppStore((s) => s.loadEvents);
  // The bundled rows are seeded by initializeApp; the message-data refresher maps
  // server keys onto them, so account-data sync waits until they exist.
  const messagesSeeded = useAppStore((s) => s.messages.length > 0);
  const hasInitialized = useRef(false);

  // Story 6.7: Authentication state
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [needsDisplayName, setNeedsDisplayName] = useState(false);
  // DW-95 / DW-96: what this page load's authentication callback did, when it
  // ended here with nothing to read. Only the login screen renders it.
  const [callbackOutcome, setCallbackOutcome] = useState<AuthCallbackOutcome>(null);
  // Which profile-name read is allowed to move the gate. Bumped by every new
  // read, by sign-out, and by a completed setup — see resolveDisplayNameGate.
  const displayNameReadRef = useRef(0);

  // App survives sign-out. A settled result belongs to one authentication
  // lifetime, even when the same account signs back in before React renders.
  const [eventsSettlement, setEventsSettlement] = useState<{
    userId: string;
    authSessionVersion: number;
    failed: boolean;
  } | null>(null);

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
  // The gallery header's Upload: where the upload dialog returns focus when the
  // empty album's Upload that opened it has been replaced by the grid.
  const photoUploadButtonRef = useRef<HTMLButtonElement>(null);

  // Story 1.5: Sync completion feedback state (AC-1.5.4)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // Sign-out lives in Settings alone (story 4). Both controls called the same
  // `signOut` -- api/authService.ts:10 re-exports the very function this file
  // used to import from ./api/auth/actionService -- and the store reset hangs
  // off the auth listener below (clearStoreAuth -> authSlice.clearAuth ->
  // signedOutState()), not off either caller, so nothing was lost with the
  // App-level wiring. Settings' copy is strictly better: it surfaces the
  // failure to the user instead of only console.error-ing it.

  // Story 4.5: Initial route detection and popstate listener (AC-4.5.5, AC-4.5.6)
  useEffect(() => {
    // AC-4.5.5: Initial route detection - set view based on URL
    const routePath = stripBasePath(window.location.pathname);
    const initialView =
      routePath === '/photos'
        ? 'photos'
        : routePath === '/mood'
          ? 'mood'
          : routePath === '/partner'
            ? 'partner'
            : routePath === '/notes'
              ? 'notes'
              : routePath === '/settings'
                ? 'settings'
                : 'home';
    setView(initialView, true); // Skip history update on initial load

    // AC-4.5.6: Browser back/forward button support
    const handlePopState = () => {
      const routePath = stripBasePath(window.location.pathname);
      const view =
        routePath === '/photos'
          ? 'photos'
          : routePath === '/mood'
            ? 'mood'
            : routePath === '/partner'
              ? 'partner'
              : routePath === '/notes'
                ? 'notes'
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
    let hasAuthNotification = false;
    // A notification that ESTABLISHED a session, which is the only thing that
    // retires a callback outcome. Kept apart from `hasAuthNotification` above,
    // which every notification sets -- sign-out and the initial signed-out
    // snapshot included.
    let hasSessionNotification = false;

    const checkAuth = async () => {
      try {
        const currentSession = await getSession();
        if (isMounted && !hasAuthNotification) {
          setSession(currentSession);

          // Populate store auth state for synchronous access by all slices
          const { setAuthUser, clearAuth } = useAppStore.getState();
          if (currentSession?.user) {
            setAuthUser(currentSession.user.id, currentSession.user.email);
          } else {
            clearAuth();
          }

          logger.debug('[App] Auth check:', currentSession ? 'authenticated' : 'not authenticated');
        }

        // The callback this load arrived with, read once. `initialize()` is
        // memoised, so this is the outcome of the initialization the session
        // read above already awaited -- no second exchange and no extra
        // request.
        //
        // Guarded on `hasSessionNotification`, NOT `hasAuthNotification`: the
        // SDK emits INITIAL_SESSION as soon as the listener subscribes, and on
        // exactly the loads this exists for that notification carries no
        // session and still arrives first -- so the broader flag would suppress
        // every notice there is. Only a session supersedes an outcome, and the
        // session branch below both sets that flag and clears the outcome.
        const outcome = await getAuthCallbackOutcome();
        if (isMounted && !hasSessionNotification) {
          setCallbackOutcome(outcome);
        }
      } catch (error) {
        console.error('[App] Auth check failed:', error);
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    };

    checkAuth();

    /**
     * Settle the display-name gate from the profile row.
     *
     * Three things can invalidate an in-flight read before it returns, and each
     * one is checked on the way out rather than prevented on the way in:
     *
     *  - the component unmounted (`isMounted`);
     *  - a newer read superseded this one, or the user just completed setup,
     *    both of which bump `displayNameReadRef` — without this a read raised
     *    before the modal was submitted comes back `unset` afterwards and
     *    re-opens it;
     *  - auth moved on. `userId` catches an account switch, `authSessionVersion`
     *    catches a sign-out and sign-in by the SAME account, which leaves
     *    `userId` identical. Same capture-and-recheck pair the store's async
     *    actions use, and the rule `App.eventsSession.test.tsx` already pins for
     *    this listener.
     */
    const resolveDisplayNameGate = (ownerId: string | null, ownerVersion: number) => {
      const readId = displayNameReadRef.current + 1;
      displayNameReadRef.current = readId;

      void lookupOwnDisplayName().then((result) => {
        if (!isMounted || displayNameReadRef.current !== readId) return;

        const { userId, authSessionVersion } = useAppStore.getState();
        if (userId !== ownerId || authSessionVersion !== ownerVersion) return;

        // Fail OPEN on display: a failed read is not evidence that the user has
        // no name, and forcing an established account into the setup modal on a
        // transient 5xx is worse than leaving the gate where it was. The write
        // side fails closed instead — see DisplayNameSetup.
        if (result.status === 'error') {
          console.error('[App] Could not read the profile display name:', result.reason);
          return;
        }

        setNeedsDisplayName(result.status === 'unset');
      });
    };

    // Listen for auth state changes
    const unsubscribe = onAuthStateChange((newSession) => {
      if (isMounted) {
        // Every notification supersedes the pending initial snapshot, including
        // sign-out and same-user updates that keep the store session version.
        hasAuthNotification = true;
        setSession(newSession);

        // Update store auth state for synchronous access by all slices
        const { setAuthUser, clearAuth: clearStoreAuth } = useAppStore.getState();

        // Check if user needs to set display name (for signups without one)
        if (newSession?.user) {
          setAuthUser(newSession.user.id, newSession.user.email);
          // The callback that raised a notice is settled the moment a session
          // exists. Cleared here rather than on sign-out because LoginScreen
          // remounts fresh on the way back: a value left here would greet the
          // next sign-out with a message about a callback long since over.
          // The flag keeps a still-in-flight `checkAuth` from putting it back.
          hasSessionNotification = true;
          setCallbackOutcome(null);
          // The name lives in the profile row, not in auth metadata, so this is
          // a read and the gate settles a tick later.
          //
          // Captured AFTER setAuthUser so an ACCOUNT SWITCH is seen: that is the
          // only case which moves either value — `authSlice.ts:356` advances
          // authSessionVersion only when `previous !== userId`. A same-user
          // TOKEN_REFRESHED, INITIAL_SESSION or USER_UPDATED leaves userId and
          // the version both unchanged, so for those the identity pair below
          // cannot tell the superseded read from the new one and
          // `displayNameReadRef` is the ONLY thing that retires it. Neither
          // guard is redundant; do not drop the ref.
          const { userId: ownerId, authSessionVersion: ownerVersion } = useAppStore.getState();
          resolveDisplayNameGate(ownerId, ownerVersion);

          logger.debug('[App] Auth state changed:', { authenticated: true });
        } else {
          clearStoreAuth();
          // Retire any in-flight profile read with the session that raised it,
          // so a late `unset` cannot open the setup modal over the login screen.
          displayNameReadRef.current += 1;
          setNeedsDisplayName(false);
          setEventsSettlement(null);
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
      initializeApp();

      // Monitor LocalStorage quota in development mode (Epic 2 technical debt).
      // Use requestIdleCallback if available, otherwise setTimeout, so it does
      // not block the main thread during initial render.
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => logStorageQuota(), { timeout: 2000 });
      } else {
        setTimeout(logStorageQuota, 100);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]); // Initialize when session is established

  // Custom messages and favorites refresh through their local-copy
  // refresher (kind `message-data`), which no-ops until the bundled rows are seeded (messagesSlice).
  // A signed-in start's refreshLocalCopies() below usually runs before
  // initializeApp has seeded, so this fires the first refresh once seeding
  // lands. Keyed on seeding alone: `messages` is never emptied again in this
  // page load (sign-out keeps the shared rows), so every later sign-in, switch
  // and reconnect reaches the refresher through refreshLocalCopies() itself.
  useEffect(() => {
    if (!messagesSeeded || !useAppStore.getState().userId) return;
    void refreshLocalCopy(MESSAGE_DATA_COPY_KIND);
  }, [messagesSeeded]);

  // Shared per-account local copies (services/localCopy.ts): refresh every
  // registered kind on each signed-in start, including an in-place account
  // switch. Each kind shows its saved copy first and keeps it if the read fails.
  useEffect(() => {
    if (!authUserId) return;
    void refreshLocalCopies();
  }, [authUserId, authSessionVersion]);

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

      // Send love notes queued while offline (services/noteQueue.ts).
      if (useAppStore.getState().userId) void drainQueuedNotes();

      // Refresh every local copy the offline spell left stale, without a reload.
      if (useAppStore.getState().userId) void refreshLocalCopies();
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
  }, [syncPendingMoods, drainQueuedNotes, updateSyncStatus]);

  // Hybrid Sync Solution: Periodic background sync + immediate sync on mount
  useEffect(() => {
    // Part 1: Immediate sync on app mount (if online and authenticated)
    if (isOnline && session) {
      logger.debug('[App] Initial sync on mount - checking for pending moods');
      syncPendingMoods().catch((error) => {
        console.error('[App] Initial sync on mount failed:', error);
      });
      void drainQueuedNotes();
    }

    // Part 2: Periodic sync every 5 minutes while app is open
    const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
    const syncInterval = setInterval(() => {
      if (isOnline && session) {
        logger.debug('[App] Periodic sync triggered (5-minute interval)');
        syncPendingMoods().catch((error) => {
          console.error('[App] Periodic sync failed:', error);
        });
        void drainQueuedNotes();
      }
    }, SYNC_INTERVAL_MS);

    // Cleanup interval on unmount
    return () => {
      clearInterval(syncInterval);
      logger.debug('[App] Periodic sync interval cleared');
    };
  }, [syncPendingMoods, drainQueuedNotes, isOnline, session]);

  // Story 3 (dynamic events): load the couple's countdown events on first
  // Home render and on every later return to Home while signed in — covers
  // both "first load" and "B's next load of Home" (CAP-1). No live
  // subscription: the load shows the saved `events` copy first, then the
  // server's page; the local-copy refresher skips Home, so this is its load.
  //
  // Store ownership changes synchronously at sign-out/account transitions;
  // same-session token refreshes leave it stable and do not reload events.
  const firstEventsLoadSettled =
    eventsSettlement !== null &&
    eventsSettlement.userId === authUserId &&
    eventsSettlement.authSessionVersion === authSessionVersion;
  const eventsLoadFailed = firstEventsLoadSettled && eventsSettlement.failed;

  useEffect(() => {
    if (!authUserId || currentView !== 'home') return;

    let cancelled = false;
    void loadEvents().then((result) => {
      if (cancelled || result.status === 'stale') return;
      // A promise can finish after auth changes but before effect cleanup.
      const state = useAppStore.getState();
      if (state.userId !== authUserId || state.authSessionVersion !== authSessionVersion) return;
      setEventsSettlement({
        userId: authUserId,
        authSessionVersion,
        failed: result.status === 'failure',
      });
    });

    return () => {
      cancelled = true;
    };
    // isOnline is a dep for exactly one reason: coming back online re-fires
    // the load, so the offline error card clears without leaving Home. The
    // offline-direction re-fire keeps the list on screen (saved copy or this
    // session's server answer) without an error, or fails into the error card
    // when nothing was ever saved; a failed refresh never blanks the last-good
    // list (eventsSlice).
  }, [authUserId, authSessionVersion, currentView, isOnline, loadEvents]);

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
          <Heart
            className="mx-auto mb-4 h-14 w-14 animate-pulse fill-current text-accent"
            strokeWidth={0}
            aria-hidden="true"
          />
          <p className="text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  // Story 6.7: Show login screen if not authenticated
  if (!session) {
    return (
      <ErrorBoundary>
        <LoginScreen
          callbackOutcome={callbackOutcome}
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
            // No session refresh: the name is in `public.users` now, not in the
            // JWT's user_metadata, so there is nothing in the session to
            // re-read. Retire any in-flight profile read that was raised before
            // the name was saved — it would come back `unset` and re-open this.
            displayNameReadRef.current += 1;
            setNeedsDisplayName(false);
            // Home's own birthday card is labelled with this name.
            void refreshLocalCopy(PROFILE_COPY_KIND);
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
          <Heart
            className="mx-auto mb-4 h-14 w-14 animate-pulse fill-current text-accent"
            strokeWidth={0}
            aria-hidden="true"
          />
          <p className="text-muted">Loading your data...</p>
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

  // Love Notes is a screen, not a page: its list scrolls, the page never does.
  // The shell is pinned to the visible screen (`fixed inset-0`, the same frame
  // the dock is pinned to) and the view fills what the chrome leaves. Sizing
  // it from `100dvh` instead left the installed iOS app about 60pt taller than
  // the screen, so the page scrolled and the composer drifted off the dock.
  const isScreenView = currentView === 'notes';

  // Story 1.4 & 4.1/4.2 & 6.2 & 6.4: Render home, photos, mood, or partner view based on navigation
  return (
    <ErrorBoundary>
      <div
        className={isScreenView ? 'fixed inset-0 flex flex-col overflow-hidden' : 'min-h-screen'}
        data-testid="app-container"
      >
        {/* App chrome: a sticky top bar in normal flow above <main>, so no view
            needs a compensating top pad, and a fixed bottom dock, which layout
            cannot see -- hence <main>'s `--dock-clearance` bottom pad, or on
            Love Notes `--dock-top`, which ends the view at the dock itself. */}
        <AppNavigation currentView={currentView} onViewChange={setView} />

        {/* Story 1.5: Network Status Indicator - Shows banner when offline/connecting (AC-1.5.1) */}
        <NetworkStatusIndicator showOnlyWhenOffline />

        {/* Story 1.5: Sync Completion Toast - Shows feedback after reconnection sync (AC-1.5.4) */}
        <SyncToast syncResult={syncResult} onDismiss={() => setSyncResult(null)} />

        {/* Story 6.5: Poke/Kiss Interaction Interface - Moved to PartnerMoodView */}

        <main
          id="main-content"
          className={isScreenView ? 'flex min-h-0 flex-1 flex-col pb-(--dock-top)' : 'pb-(--dock-clearance)'}
        >
          {/* Home view - inline, not lazy-loaded, always works offline */}
          {currentView === 'home' && (
            <div className="mx-auto max-w-4xl space-y-4 px-4 pt-3 pb-4">
              {/* Time Together - replaces Day 37 Together header */}
              <TimeTogether />

              {/* Birthdays and the wedding date, from the server-held values */}
              <BirthdayWeddingCards />

              {/* Upcoming: always shown, even while the slot below is still
                  hidden. Add goes to Settings, where events are created;
                  opening the editor directly would need new cross-view state. */}
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-semibold tracking-[.08em] text-muted uppercase">
                  Upcoming
                </h2>
                <button
                  type="button"
                  onClick={() => setView('settings')}
                  className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-tint px-3.5 text-[13px] font-semibold text-accent"
                  aria-label="Add event"
                  data-testid="home-add-event"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add
                </button>
              </div>

              {/* Events slot: the two placeholders below speak for the whole
                  slot, so they span the full width; real cards flow two-up like
                  the birthday pair above. */}
              {eventsSlotView === 'hidden' ? null : eventsSlotView === 'error' ? (
                <div
                  className="rounded-[20px] border border-line bg-card p-3.5 text-center shadow-card"
                  data-testid="events-load-error"
                  role="status"
                  aria-live="polite"
                >
                  <p className="text-sm text-muted">
                    Unable to load events — check your connection, then come back to Home.
                  </p>
                </div>
              ) : eventsSlotView === 'empty' ? (
                <div
                  className="rounded-[20px] border border-line bg-card p-3.5 text-center shadow-card"
                  data-testid="events-empty-placeholder"
                  role="status"
                  aria-live="polite"
                >
                  <p className="text-sm text-muted">No upcoming events yet.</p>
                </div>
              ) : (
                // Already filtered and capped by getUpcomingEventCards, which
                // hands the slot decision above the UNCAPPED count — so hiding
                // the tail can never turn a real list into the empty
                // placeholder. A card that retires returns null, which occupies
                // no grid cell, so the survivors reflow with no gap.
                <div className="grid grid-cols-2 gap-3">
                  {visibleEvents.map((event) => (
                    <EventCountdown
                      key={event.id}
                      label={event.label}
                      icon={event.icon}
                      date={event.date}
                      description={event.description ?? undefined}
                      onRetire={handleEventRetired}
                    />
                  ))}
                </div>
              )}

              {/* Daily Message */}
              <DailyMessage onShowWelcome={showWelcomeManually} />
            </div>
          )}

          {/* Lazy-loaded views wrapped in ViewErrorBoundary to keep navigation visible on errors */}
          {currentView !== 'home' && (
            <ViewErrorBoundary viewName={currentView} onNavigateHome={() => setView('home')}>
              <Suspense fallback={<LoadingSpinner />}>
                {currentView === 'photos' && (
                  <PhotoGallery
                    onUploadClick={() => setIsPhotoUploadOpen(true)}
                    uploadButtonRef={photoUploadButtonRef}
                  />
                )}

                {currentView === 'mood' && <MoodTracker />}

                {currentView === 'partner' && <PartnerMoodView />}

                {currentView === 'notes' && <LoveNotes />}

                {/* Story 4 (dynamic events): Settings, home of the only sign-out */}
                {currentView === 'settings' && <Settings onShowWelcome={showWelcomeManually} />}
              </Suspense>
            </ViewErrorBoundary>
          )}
        </main>

        {/* Photo upload modal - Story 4.1 (lazy loaded) */}
        <Suspense fallback={null}>
          <PhotoUpload
            isOpen={isPhotoUploadOpen}
            onClose={() => setIsPhotoUploadOpen(false)}
            fallbackFocusRef={photoUploadButtonRef}
          />
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}

export default App;
