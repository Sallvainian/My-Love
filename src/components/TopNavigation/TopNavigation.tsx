import { Home, Camera } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export function TopNavigation() {
  const currentView = useAppStore((state) => state.currentView);
  const photoCount = useAppStore((state) => state.photos.length);
  const setView = useAppStore((state) => state.setView);

  return (
    <nav
      className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-40"
      data-testid="top-navigation"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-center h-16 max-w-2xl mx-auto px-4">
        {/* Home Tab */}
        <button
          onClick={() => setView('home')}
          className={`flex flex-col sm:flex-row items-center justify-center flex-1 h-full transition-colors ${
            currentView === 'home'
              ? 'text-blue-600 font-semibold'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          data-testid="nav-home-tab"
          aria-label="Navigate to Home"
          aria-current={currentView === 'home' ? 'page' : undefined}
        >
          <Home
            className={`w-6 h-6 sm:mr-2 ${
              currentView === 'home' ? 'sm:w-7 sm:h-7' : ''
            }`}
          />
          <span className="text-xs sm:text-sm mt-1 sm:mt-0">Home</span>
        </button>

        {/* Photos Tab */}
        <button
          onClick={() => setView('photos')}
          className={`flex flex-col sm:flex-row items-center justify-center flex-1 h-full transition-colors relative ${
            currentView === 'photos'
              ? 'text-blue-600 font-semibold'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          data-testid="nav-photos-tab"
          aria-label={`Navigate to Photos${photoCount > 0 ? ` (${photoCount} photos)` : ''}`}
          aria-current={currentView === 'photos' ? 'page' : undefined}
        >
          <div className="relative">
            <Camera
              className={`w-6 h-6 sm:mr-2 ${
                currentView === 'photos' ? 'sm:w-7 sm:h-7' : ''
              }`}
            />
            {/* Photo count badge - AC-4.5.4 (optional) */}
            {photoCount > 0 && (
              <span
                className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
                data-testid="photo-count-badge"
                aria-label={`${photoCount} photos uploaded`}
              >
                {photoCount > 99 ? '99+' : photoCount}
              </span>
            )}
          </div>
          <span className="text-xs sm:text-sm mt-1 sm:mt-0">Photos</span>
        </button>
      </div>
    </nav>
  );
}
