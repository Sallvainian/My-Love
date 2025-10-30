import { useEffect, useRef } from 'react';
import { useAppStore } from './stores/useAppStore';
import { DailyMessage } from './components/DailyMessage/DailyMessage';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import { applyTheme } from './utils/themes';

function App() {
  const { settings, initializeApp, isLoading } = useAppStore();
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Initialize the app on mount (useRef ensures single init even in StrictMode)
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      initializeApp();
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

  // Story 1.4: Always render DailyMessage (onboarding removed for single-user deployment)
  // Settings are pre-configured via environment variables at build time
  return (
    <ErrorBoundary>
      <div className="min-h-screen">
        <DailyMessage />
      </div>
    </ErrorBoundary>
  );
}

export default App;
