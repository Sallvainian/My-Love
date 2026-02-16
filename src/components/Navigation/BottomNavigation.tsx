import { Heart, Camera, Smile, Users, LogOut, MessageCircle, BookOpen } from 'lucide-react';
import type { ViewType } from '../../stores/slices/navigationSlice';

interface BottomNavigationProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  onSignOut: () => void;
  signOutDisabled?: boolean;
}

export function BottomNavigation({
  currentView,
  onViewChange,
  onSignOut,
  signOutDisabled = false,
}: BottomNavigationProps) {
  return (
    <nav
      className="safe-area-bottom fixed right-0 bottom-0 left-0 z-40 border-t border-gray-200 bg-white"
      data-testid="bottom-navigation"
    >
      <div className="mx-auto flex h-16 max-w-2xl items-center justify-around px-4">
        {/* Home Tab */}
        <button
          onClick={() => onViewChange('home')}
          className={`flex h-full flex-1 flex-col items-center justify-center transition-colors ${
            currentView === 'home' ? 'text-pink-500' : 'text-gray-500 hover:text-gray-600'
          }`}
          data-testid="nav-home"
          aria-label="Home"
        >
          <Heart className={`mb-1 h-6 w-6 ${currentView === 'home' ? 'fill-current' : ''}`} />
          <span className="text-xs font-medium">Home</span>
        </button>

        {/* Mood Tab */}
        <button
          onClick={() => onViewChange('mood')}
          className={`flex h-full flex-1 flex-col items-center justify-center transition-colors ${
            currentView === 'mood' ? 'text-pink-500' : 'text-gray-500 hover:text-gray-600'
          }`}
          data-testid="nav-mood"
          aria-label="Mood"
        >
          <Smile className={`mb-1 h-6 w-6 ${currentView === 'mood' ? 'fill-current' : ''}`} />
          <span className="text-xs font-medium">Mood</span>
        </button>

        {/* Notes Tab - Story 2.1: Love Notes Chat */}
        <button
          onClick={() => onViewChange('notes')}
          className={`flex h-full flex-1 flex-col items-center justify-center transition-colors ${
            currentView === 'notes' ? 'text-pink-500' : 'text-gray-500 hover:text-gray-600'
          }`}
          data-testid="nav-notes"
          aria-label="Love Notes"
        >
          <MessageCircle
            className={`mb-1 h-6 w-6 ${currentView === 'notes' ? 'fill-current' : ''}`}
          />
          <span className="text-xs font-medium">Notes</span>
        </button>

        {/* Partner Tab - Story 6.4: Task 5 */}
        <button
          onClick={() => onViewChange('partner')}
          className={`flex h-full flex-1 flex-col items-center justify-center transition-colors ${
            currentView === 'partner' ? 'text-pink-500' : 'text-gray-500 hover:text-gray-600'
          }`}
          data-testid="nav-partner"
          aria-label="Partner"
        >
          <Users className={`mb-1 h-6 w-6 ${currentView === 'partner' ? 'fill-current' : ''}`} />
          <span className="text-xs font-medium">Partner</span>
        </button>

        {/* Photos Tab */}
        <button
          onClick={() => onViewChange('photos')}
          className={`flex h-full flex-1 flex-col items-center justify-center transition-colors ${
            currentView === 'photos' ? 'text-pink-500' : 'text-gray-500 hover:text-gray-600'
          }`}
          data-testid="nav-photos"
          aria-label="Photos"
        >
          <Camera className="mb-1 h-6 w-6" />
          <span className="text-xs font-medium">Photos</span>
        </button>

        {/* Scripture Tab - Story 1.1: Navigation Entry Point */}
        <button
          onClick={() => onViewChange('scripture')}
          className={`flex h-full min-h-[48px] min-w-[48px] flex-1 flex-col items-center justify-center transition-colors ${
            currentView === 'scripture' ? 'text-purple-500' : 'text-gray-500 hover:text-gray-600'
          }`}
          data-testid="nav-scripture"
          aria-label="Scripture"
        >
          <BookOpen
            className={`mb-1 h-6 w-6 ${currentView === 'scripture' ? 'fill-current' : ''}`}
          />
          <span className="text-xs font-medium">Scripture</span>
        </button>

        {/* Logout Button */}
        <button
          onClick={onSignOut}
          disabled={signOutDisabled}
          className="flex h-full flex-1 flex-col items-center justify-center text-gray-500 transition-colors hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="nav-logout"
          aria-label="Logout"
        >
          <LogOut className="mb-1 h-6 w-6" />
          <span className="text-xs font-medium">Logout</span>
        </button>
      </div>
    </nav>
  );
}
