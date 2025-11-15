import { useEffect, useRef, useState } from 'react';
import { useAppStore } from './stores/useAppStore';
import { DailyMessage } from './components/DailyMessage/DailyMessage';
import { WelcomeSplash } from './components/WelcomeSplash/WelcomeSplash';
import { AdminPanel } from './components/AdminPanel/AdminPanel';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import { BottomNavigation } from './components/Navigation/BottomNavigation';
import { PhotoUpload } from './components/PhotoUpload/PhotoUpload';
import { PhotoGallery } from './components/PhotoGallery/PhotoGallery';
import { PhotoCarousel } from './components/PhotoCarousel/PhotoCarousel';
import { MoodTracker } from './components/MoodTracker/MoodTracker';
import { PokeKissInterface } from './components/PokeKissInterface';
import { PartnerMoodView } from './components/PartnerMoodView';
import { LoginScreen } from './components/LoginScreen';
import { DisplayNameSetup } from './components/DisplayNameSetup';
import { applyTheme } from './utils/themes';
import { logStorageQuota } from './utils/storageMonitor';
import { migrateCustomMessagesFromLocalStorage } from './services/migrationService';
import { authService } from './api/authService';
import type { Session } from '@supabase/supabase-js';

// Timer configuration
const WELCOME_DISPLAY_INTERVAL = 3600000; // 60 minutes in milliseconds
const LAST_WELCOME_VIEW_KEY = 'lastWelcomeView';

function App() {
  const { settings, initializeApp, isLoading, currentView, setView, syncPendingMoods, updateSyncStatus } = useAppStore();
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

  // Story 4.5: Initial route detection and popstate listener (AC-4.5.5, AC-4.5.6)
  useEffect(() => {
    // Check admin route
    if (window.location.pathname.includes('/admin')) {
      setShowAdmin(true);
      return; // Don't set up navigation listeners for admin panel
    }

    // AC-4.5.5: Initial route detection - set view based on URL
    const initialPath = window.location.pathname;
    const initialView =
      initialPath === '/photos'
        ? 'photos'
        : initialPath === '/mood'
          ? 'mood'
          : initialPath === '/partner'
            ? 'partner'
            : 'home';
    setView(initialView, true); // Skip history update on initial load

    // AC-4.5.6: Browser back/forward button support
    const handlePopState = () => {
      const pathname = window.location.pathname;
      const view =
        pathname === '/photos'
          ? 'photos'
          : pathname === '/mood'
            ? 'mood'
            : pathname === '/partner'
              ? 'partner'
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
            console.log('[App] Auth check:', currentSession ? 'authenticated' : 'not authenticated');
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

      // Story 3.5: Migrate custom messages from LocalStorage to IndexedDB before app initialization
      (async () => {
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

        // Initialize app after migration completes
        initializeApp();

        // Monitor LocalStorage quota in development mode (Epic 2 technical debt)
        logStorageQuota();
      })();
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
        <WelcomeSplash onContinue={handleContinue} />
      </ErrorBoundary>
    );
  }

  // Story 3.4: Show AdminPanel if admin route is active
  if (showAdmin) {
    return (
      <ErrorBoundary>
        <AdminPanel onExit={handleAdminExit} />
      </ErrorBoundary>
    );
  }

  // Story 1.4 & 4.1/4.2 & 6.2 & 6.4: Render home, photos, mood, or partner view based on navigation
  return (
    <ErrorBoundary>
      <div className="min-h-screen pb-16">
        {/* Story 6.5: Poke/Kiss Interaction Interface - Fixed top-right position (AC#1) */}
        <div className="fixed top-4 right-4 z-50">
          <PokeKissInterface />
        </div>

        {/* Conditional view rendering */}
        {currentView === 'home' && <DailyMessage onShowWelcome={showWelcomeManually} />}

        {currentView === 'photos' && (
          <PhotoGallery onUploadClick={() => setIsPhotoUploadOpen(true)} />
        )}

        {currentView === 'mood' && <MoodTracker />}

        {currentView === 'partner' && <PartnerMoodView />}

        {/* Bottom navigation */}
        <BottomNavigation currentView={currentView} onViewChange={setView} />

        {/* Photo upload modal - Story 4.1 */}
        <PhotoUpload isOpen={isPhotoUploadOpen} onClose={() => setIsPhotoUploadOpen(false)} />

        {/* Photo carousel - Story 4.3: AC-4.3.1 - Render when photo selected */}
        <PhotoCarousel />
      </div>
    </ErrorBoundary>
  );
}

export default App;
