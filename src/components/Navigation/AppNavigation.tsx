/**
 * AppNavigation
 *
 * App chrome: a slim sticky top bar carrying the "My Love" wordmark and a
 * Settings gear, plus a floating frosted-glass dock at the bottom holding the
 * five everyday destinations. Replaces the hamburger tray, which hid every
 * destination behind a tap; the dock has no disclosure, so there is no
 * backdrop and no focus trap to maintain.
 *
 * The top bar stays sticky and in normal flow, exactly 4rem plus `.safe-top`,
 * for the reason the tray's header was: every existing `4rem`/`5rem` top offset
 * (MoodTracker's sticky tabs, SyncToast, PartnerMoodView, PokeKiss,
 * InteractionHistory) keeps meaning "below the chrome" without an edit.
 *
 * The dock is `fixed`, so it is invisible to layout. The space it needs lives
 * in one place, `--dock-clearance` in index.css; <main>, LoveNotes' height and
 * the floating buttons all read it rather than hardcoding the dock's size.
 *
 * Colours are a notch deeper than the design artboard's in both themes. The
 * chrome is translucent, and in dark mode what shows through it is the pink
 * page background, so the artboard's pink-300 wordmark and pink-400 pill label
 * measure under 4.5:1 there; pink-700 (light) and pink-200 / pink-300 (dark)
 * hold it over white, pink and gray-900 alike.
 */
import { Camera, Heart, MessageCircle, Settings as SettingsIcon, Smile, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ViewType } from '../../stores/slices/navigationSlice';

interface Destination {
  view: ViewType;
  /** Doubles as the accessible name; the tray's labels are kept verbatim. */
  label: string;
  Icon: LucideIcon;
  /**
   * Fill the icon while active. Only the heart reads well solid -- Smile,
   * MessageCircle, Camera and Users lose their inner strokes to the fill.
   */
  fillWhenActive?: boolean;
}

/** Settings is not here: it is the gear in the top bar. */
const DESTINATIONS: readonly Destination[] = [
  { view: 'home', label: 'Home', Icon: Heart, fillWhenActive: true },
  { view: 'mood', label: 'Mood', Icon: Smile },
  { view: 'notes', label: 'Love Notes', Icon: MessageCircle },
  { view: 'photos', label: 'Photos', Icon: Camera },
  { view: 'partner', label: 'Partner', Icon: Users },
];

/** Shared by the bar and the dock so the two surfaces never drift apart. */
const GLASS = 'bg-white/70 backdrop-blur-lg backdrop-saturate-150 dark:bg-gray-900/70';

export interface AppNavigationProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  /**
   * Unseen counts per dock destination. Missing, zero or negative entries
   * render no badge, and `settings` is ignored: the gear carries no badge slot.
   */
  badgeCounts?: Partial<Record<ViewType, number>>;
}

function pluralisedBadgeLabel(count: number): string {
  return `${count} new item${count === 1 ? '' : 's'}`;
}

export function AppNavigation({ currentView, onViewChange, badgeCounts }: AppNavigationProps) {
  const isSettings = currentView === 'settings';

  return (
    <>
      <header className={`safe-top sticky top-0 z-40 ${GLASS}`} data-testid="app-header">
        <div className="flex h-16 items-center gap-2 px-3">
          {/* Balances the gear so the wordmark stays optically centred. */}
          <span aria-hidden="true" className="min-h-[44px] min-w-[44px]" />

          {/* The app name rather than the active destination, and a span rather
              than a heading: Mood, Notes, Partner and Settings each render
              their own level-1 heading naming themselves, so a chrome heading
              would duplicate that title on screen and make a level-1-heading
              query ambiguous -- which is exactly what broke
              notes/love-notes.spec.ts:27 when this was an h1. */}
          <span className="flex-1 truncate text-center font-cursive text-[28px] font-bold text-pink-700 dark:text-pink-200">
            My Love
          </span>

          <button
            type="button"
            onClick={() => onViewChange('settings')}
            className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors ${
              isSettings
                ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300'
                : 'text-gray-500 hover:bg-gray-100/70 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-gray-800/70 dark:hover:text-gray-100'
            }`}
            data-testid="nav-settings"
            aria-label="Settings"
            aria-current={isSettings ? 'page' : undefined}
          >
            <SettingsIcon className="h-[21px] w-[21px]" />
          </button>
        </div>
      </header>

      <nav
        className={`fixed inset-x-4 mx-auto max-w-md bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex h-[60px] items-center justify-between gap-1 rounded-full px-2 shadow-[0_8px_24px_rgba(190,24,93,0.12)] ring-1 ring-pink-600/15 dark:shadow-[0_8px_24px_rgba(0,0,0,0.45)] dark:ring-white/10 ${GLASS}`}
        aria-label="Primary"
        data-testid="nav-dock"
      >
        {DESTINATIONS.map(({ view, label, Icon, fillWhenActive }) => {
          const isActive = currentView === view;
          const count = badgeCounts?.[view] ?? 0;

          return (
            <button
              key={view}
              type="button"
              onClick={() => onViewChange(view)}
              className={`relative flex h-11 items-center justify-center rounded-full transition-colors ${
                isActive
                  ? 'min-w-0 shrink gap-1.5 bg-pink-100 px-3.5 text-sm font-semibold text-pink-700 dark:bg-pink-900/50 dark:text-pink-300'
                  : 'w-11 shrink-0 text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100'
              }`}
              data-testid={`nav-${view}`}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                className={`shrink-0 ${isActive ? 'h-5 w-5' : 'h-[22px] w-[22px]'} ${
                  isActive && fillWhenActive ? 'fill-current' : ''
                }`}
              />
              {isActive && <span className="truncate whitespace-nowrap">{label}</span>}
              {/* No click handler of its own: the badge sits inside the button,
                  so a tap on it bubbles to the button and selects the view. */}
              {count > 0 && (
                <span
                  className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-purple-600 px-1 text-xs font-bold text-white shadow-md"
                  data-testid={`nav-${view}-badge`}
                  aria-label={pluralisedBadgeLabel(count)}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
