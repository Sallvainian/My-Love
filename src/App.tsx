import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { useAppStore } from './stores/useAppStore';
import { DailyMessage } from './components/DailyMessage/DailyMessage';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import { ViewErrorBoundary } from './components/ViewErrorBoundary';
import { BottomNavigation } from './components/Navigation/BottomNavigation';
import { TimeTogether, BirthdayCountdown, EventCountdown } from './components/RelationshipTimers';
import { RELATIONSHIP_DATES } from './config/relationshipDates';
// PokeKissInterface moved to PartnerMoodView
import { LoginScreen } from './components/LoginScreen';
import { DisplayNameSetup } from './components/DisplayNameSetup';
import { applyTheme } from './utils/themes';
import { logStorageQuota } from './utils/storageMonitor';
import { migrateCustomMessagesFromLocalStorage } from './services/migrationService';
import { authService } from './api/authService';
import type { Session } from '@supabase/supabase-js';
import { isServiceWorkerSupported } from './utils/backgroundSync';
import { NetworkStatusIndicator, SyncToast, type SyncResult } from './components/shared';

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
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
  </div>
);

// Timer configuration
const WELCOME_DISPLAY_INTERVAL = 3600000; // 60 minutes in milliseconds
const LAST_WELCOME_VIEW_KEY = 'lastWelcomeView';

function App() {
  const {
    settings,
    initializeApp,
    isLoading,
    currentView,
    setView,
    syncPendingMoods,
    updateSyncStatus,
    syncStatus,
  } = useAppStore();
  const hasInitialized = useRef(false);

  // Story 6.7: Authentication state
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [needsDisplayName, setNeedsDisplayName] = useState(false);

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
  const [showAdmin, setShowAdmin] = useState(false);
  const [isPhotoUploadOpen, setIsPhotoUploadOpen] = useState(false);

  // Story 1.5: Sync completion feedback state (AC-1.5.4)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

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
    // Check admin route
    if (window.location.pathname.includes('/admin')) {
      setShowAdmin(true);
      return; // Don't set up navigation listeners for admin panel
    }

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
                  : 'home';
      setView(view, true); // Skip history update to prevent loop
      console.log(`[App] Popstate: navigated to ${view}`);
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
        const currentSession = await authService.getSession();
        if (isMounted) {
          setSession(currentSession);
          setAuthLoading(false);

          if (import.meta.env.DEV) {
            console.log(
              '[App] Auth check:',
              currentSession ? 'authenticated' : 'not authenticated'
            );
          }
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
    const unsubscribe = authService.onAuthStateChange((newSession) => {
      if (isMounted) {
        setSession(newSession);

        // Check if user needs to set display name (for new OAuth signups)
        if (newSession?.user) {
          const hasDisplayName = newSession.user.user_metadata?.display_name;
          setNeedsDisplayName(!hasDisplayName);

          if (import.meta.env.DEV) {
            console.log('[App] Auth state changed:', {
              authenticated: true,
              hasDisplayName,
              needsSetup: !hasDisplayName,
            });
          }
        } else {
          setNeedsDisplayName(false);
          if (import.meta.env.DEV) {
            console.log('[App] Auth state changed: signed out');
          }
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
            console.log('[App] Migration completed:', {
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
      if (import.meta.env.DEV) {
        console.log('[App] Network: ONLINE - triggering sync');
      }

      // Update sync status to reflect online state
      updateSyncStatus();

      // Trigger background sync when coming back online
      syncPendingMoods().catch((error) => {
        console.error('[App] Auto-sync on reconnect failed:', error);
      });
    };

    const handleOffline = () => {
      if (import.meta.env.DEV) {
        console.log('[App] Network: OFFLINE');
      }

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
    if (syncStatus.isOnline && session) {
      if (import.meta.env.DEV) {
        console.log('[App] Initial sync on mount - checking for pending moods');
      }
      syncPendingMoods().catch((error) => {
        console.error('[App] Initial sync on mount failed:', error);
      });
    }

    // Part 2: Periodic sync every 5 minutes while app is open
    const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
    const syncInterval = setInterval(() => {
      if (syncStatus.isOnline && session) {
        if (import.meta.env.DEV) {
          console.log('[App] Periodic sync triggered (5-minute interval)');
        }
        syncPendingMoods().catch((error) => {
          console.error('[App] Periodic sync failed:', error);
        });
      }
    }, SYNC_INTERVAL_MS);

    // Cleanup interval on unmount
    return () => {
      clearInterval(syncInterval);
      if (import.meta.env.DEV) {
        console.log('[App] Periodic sync interval cleared');
      }
    };
  }, [syncPendingMoods, syncStatus.isOnline, session]);

  // Part 3: Service Worker Background Sync listener
  // Story 1.5: Enhanced to show sync completion feedback (AC-1.5.4)
  useEffect(() => {
    // Guard: Skip setup if service workers are not supported
    // (e.g., Safari private mode, older browsers, test environment)
    if (!isServiceWorkerSupported() || !navigator.serviceWorker) {
      if (import.meta.env.DEV) {
        console.log('[App] Service Worker not supported, skipping background sync listener');
      }
      return; // No cleanup needed
    }

    // Direct message listener to capture sync counts for toast notification
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'BACKGROUND_SYNC_COMPLETED') {
        const { successCount, failCount } = event.data;

        if (import.meta.env.DEV) {
          console.log('[App] Service Worker completed background sync:', {
            successCount,
            failCount,
          });
        }

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">💕</div>
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
            if (import.meta.env.DEV) {
              console.log('[App] Login successful');
            }
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
            authService.getSession().then((refreshedSession) => {
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">💕</div>
          <p className="text-gray-600">Loading your data...</p>
        </div>
      </div>
    );
  }

  // Handle splash screen continuation (automatic display)
  const handleContinue = () => {
    // Save current timestamp to localStorage (resets the 60-minute timer)
    localStorage.setItem(LAST_WELCOME_VIEW_KEY, Date.now().toString());
    setShowSplash(false);
  };

  // Handle manual trigger from button (does NOT reset timer)
  const showWelcomeManually = () => {
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

  // Story 1.4 & 4.1/4.2 & 6.2 & 6.4: Render home, photos, mood, or partner view based on navigation
  return (
    <div className="min-h-screen pb-16" data-testid="app-container">
      {/* Story 1.5: Network Status Indicator - Shows banner when offline/connecting (AC-1.5.1) */}
      <NetworkStatusIndicator showOnlyWhenOffline />

      {/* Story 1.5: Sync Completion Toast - Shows feedback after reconnection sync (AC-1.5.4) */}
      <SyncToast syncResult={syncResult} onDismiss={() => setSyncResult(null)} />

      {/* Story 6.5: Poke/Kiss Interaction Interface - Moved to PartnerMoodView */}

      <main id="main-content">
        {/* Home view - inline, not lazy-loaded, always works offline */}
        {currentView === 'home' && (
          <div className="max-w-4xl mx-auto px-4 py-4 space-y-6">
            {/* Time Together - replaces Day 37 Together header */}
            <TimeTogether />

            {/* Countdown timers grid: Birthdays (left) | Wedding+Visits (right) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left column - Birthdays */}
              <div className="space-y-4">
                <BirthdayCountdown birthday={RELATIONSHIP_DATES.birthdays.frank} />
                <BirthdayCountdown birthday={RELATIONSHIP_DATES.birthdays.gracie} />
              </div>

              {/* Right column - Wedding & Visits */}
              <div className="space-y-4">
                <EventCountdown
                  label="Wedding"
                  icon="ring"
                  date={RELATIONSHIP_DATES.wedding}
                  placeholderText="Date TBD"
                />
                {RELATIONSHIP_DATES.visits.map((visit) => (
                  <EventCountdown
                    key={visit.id}
                    label={visit.label}
                    icon="plane"
                    date={visit.date}
                    description={visit.description}
                  />
                ))}
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
            </Suspense>
          </ViewErrorBoundary>
        )}
      </main>

      {/* Bottom navigation - always visible, outside error boundary */}
      <BottomNavigation currentView={currentView} onViewChange={setView} />

      {/* Photo upload modal - Story 4.1 (lazy loaded) */}
      <Suspense fallback={null}>
        <PhotoUpload isOpen={isPhotoUploadOpen} onClose={() => setIsPhotoUploadOpen(false)} />
      </Suspense>

      {/* Photo carousel - Story 4.3: AC-4.3.1 - Render when photo selected (lazy loaded) */}
      <Suspense fallback={null}>
        <PhotoCarousel />
      </Suspense>

    </div>
  );
}

export default App;
