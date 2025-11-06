import { useEffect, useRef, useState } from 'react';
import { useAppStore } from './stores/useAppStore';
import { DailyMessage } from './components/DailyMessage/DailyMessage';
import { WelcomeSplash } from './components/WelcomeSplash/WelcomeSplash';
import { AdminPanel } from './components/AdminPanel/AdminPanel';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import { applyTheme } from './utils/themes';
import { logStorageQuota } from './utils/storageMonitor';
import { migrateCustomMessagesFromLocalStorage } from './services/migrationService';

// Timer configuration
const WELCOME_DISPLAY_INTERVAL = 3600000; // 60 minutes in milliseconds
const LAST_WELCOME_VIEW_KEY = 'lastWelcomeView';

function App() {
  const { settings, initializeApp, isLoading } = useAppStore();
  const hasInitialized = useRef(false);

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

  // Check URL for admin route on mount
  useEffect(() => {
    if (window.location.pathname.includes('/admin')) {
      setShowAdmin(true);
    }
  }, []);

  useEffect(() => {
    // Initialize the app on mount (useRef ensures single init even in StrictMode)
    if (!hasInitialized.current) {
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
  }, []); // Empty dependency array intentional - only runs once on mount

  // Apply theme when settings change
  useEffect(() => {
    if (settings) {
      applyTheme(settings.themeName);
    }
  }, [settings]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">💕</div>
          <p className="text-gray-600">Loading...</p>
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

  // Story 1.4: Always render DailyMessage (onboarding removed for single-user deployment)
  // Settings are pre-configured via hardcoded constants
  return (
    <ErrorBoundary>
      <div className="min-h-screen">
        <DailyMessage onShowWelcome={showWelcomeManually} />
      </div>
    </ErrorBoundary>
  );
}

export default App;
