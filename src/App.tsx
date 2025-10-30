import { useEffect } from 'react';
import { useAppStore } from './stores/useAppStore';
import { Onboarding } from './components/Onboarding/Onboarding';
import { DailyMessage } from './components/DailyMessage/DailyMessage';
import { applyTheme } from './utils/themes';

function App() {
  const { isOnboarded, settings, initializeApp, isLoading } = useAppStore();

  useEffect(() => {
    // Initialize the app on mount
    initializeApp();
  }, [initializeApp]);

  useEffect(() => {
    // Apply theme when settings change
    if (settings) {
      applyTheme(settings.themeName);
    }
  }, [settings?.themeName]);

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

  return (
    <div className="min-h-screen">
      {!isOnboarded ? <Onboarding /> : <DailyMessage />}
    </div>
  );
}

export default App;
