import { Heart, Camera, Smile, Users } from 'lucide-react';
import type { ViewType } from '../../stores/slices/navigationSlice';

interface BottomNavigationProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export function BottomNavigation({ currentView, onViewChange }: BottomNavigationProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-bottom z-40"
      data-testid="bottom-navigation"
    >
      <div className="flex items-center justify-around h-16 max-w-2xl mx-auto px-4">
        {/* Home Tab */}
        <button
          onClick={() => onViewChange('home')}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
            currentView === 'home' ? 'text-pink-500' : 'text-gray-400 hover:text-gray-600'
          }`}
          data-testid="nav-home"
          aria-label="Home"
        >
          <Heart className={`w-6 h-6 mb-1 ${currentView === 'home' ? 'fill-current' : ''}`} />
          <span className="text-xs font-medium">Home</span>
        </button>

        {/* Mood Tab */}
        <button
          onClick={() => onViewChange('mood')}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
            currentView === 'mood' ? 'text-pink-500' : 'text-gray-400 hover:text-gray-600'
          }`}
          data-testid="nav-mood"
          aria-label="Mood"
        >
          <Smile className={`w-6 h-6 mb-1 ${currentView === 'mood' ? 'fill-current' : ''}`} />
          <span className="text-xs font-medium">Mood</span>
        </button>

        {/* Partner Tab - Story 6.4: Task 5 */}
        <button
          onClick={() => onViewChange('partner')}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
            currentView === 'partner' ? 'text-pink-500' : 'text-gray-400 hover:text-gray-600'
          }`}
          data-testid="nav-partner"
          aria-label="Partner"
        >
          <Users className={`w-6 h-6 mb-1 ${currentView === 'partner' ? 'fill-current' : ''}`} />
          <span className="text-xs font-medium">Partner</span>
        </button>

        {/* Photos Tab */}
        <button
          onClick={() => onViewChange('photos')}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
            currentView === 'photos' ? 'text-pink-500' : 'text-gray-400 hover:text-gray-600'
          }`}
          data-testid="nav-photos"
          aria-label="Photos"
        >
          <Camera className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium">Photos</span>
        </button>
      </div>
    </nav>
  );
}
