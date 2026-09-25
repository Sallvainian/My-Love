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
 * in one place, `--dock-clearance` (and `--dock-top`, the dock's top edge) in
 * index.css; <main> and the floating buttons read them rather than hardcoding
 * the dock's size. Change the dock's inset or height and update both.
 *
 * Every colour is a style-kit token from index.css (`bg-glass`, `text-ink`,
 * `text-muted`, `bg-tint`/`text-accent`, `bg-fill`, `ring-line`,
 * `shadow-float`), matching the approved style kit. Each token switches with the
 * OS theme on its own, so nothing here carries a `dark:` variant; the kit's
 * light accent and muted are already deepened to hold 4.5:1 on its own tinted
 * fills and on the page ground seen through the glass.
 */
import {
  Camera,
  Heart,
  MessageCircle,
  Settings as SettingsIcon,
  FaceSlightlySmiling,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ViewType } from '../../stores/slices/navigationSlice';

interface Destination {
  view: ViewType;
  /** Doubles as the accessible name; the tray's labels are kept verbatim. */
  label: string;
  Icon: LucideIcon;
  /**
   * Fill the icon while active. Only the heart reads well solid -- FaceSlightlySmiling,
   * MessageCircle, Camera and Users lose their inner strokes to the fill.
   */
  fillWhenActive?: boolean;
}

/** Settings is not here: it is the gear in the top bar. */
const DESTINATIONS: readonly Destination[] = [
  { view: 'home', label: 'Home', Icon: Heart, fillWhenActive: true },
  { view: 'mood', label: 'Mood', Icon: FaceSlightlySmiling },
  { view: 'notes', label: 'Love Notes', Icon: MessageCircle },
  { view: 'photos', label: 'Photos', Icon: Camera },
  { view: 'partner', label: 'Partner', Icon: Users },
];

/**
 * Shared by the bar and the dock. The dock alone adds `backdrop-saturate-[1.4]`
 * on top of it, on purpose, as the approved style kit's dock does.
 */
const GLASS = 'bg-glass backdrop-blur-lg';

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
          <span aria-hidden="true" className="min-h-11 min-w-11" />

          {/* The app name rather than the active destination, and a span rather
              than a heading: Mood, Notes, Partner and Settings each render
              their own level-1 heading naming themselves, so a chrome heading
              would duplicate that title on screen and make a level-1-heading
              query ambiguous -- which is exactly what broke
              notes/love-notes.spec.ts:27 when this was an h1. */}
          <span
            className="flex min-w-0 flex-1 items-center justify-center gap-1.5"
            data-testid="app-wordmark"
          >
            <Heart className="h-3.5 w-3.5 shrink-0 fill-current text-accent" strokeWidth={0} />
            <span className="truncate font-lora text-[19px] font-semibold text-ink italic">
              My Love
            </span>
          </span>

          <button
            type="button"
            onClick={() => onViewChange('settings')}
            className={`flex min-h-11 min-w-11 items-center justify-center rounded-full transition-colors ${
              isSettings ? 'bg-tint text-accent' : 'text-muted hover:text-ink'
            }`}
            data-testid="nav-settings"
            aria-label="Settings"
            aria-current={isSettings ? 'page' : undefined}
          >
            <SettingsIcon className="h-5 w-5" />
          </button>
        </div>
      </header>

      <nav
        className={`fixed inset-x-4 mx-auto max-w-md bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex h-15 items-center justify-between gap-1 rounded-full px-2 shadow-float ring-1 ring-line backdrop-saturate-[1.4] ${GLASS}`}
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
                  ? 'min-w-0 shrink gap-1.5 bg-tint px-3.5 text-sm font-semibold text-accent'
                  : 'w-11 shrink-0 text-muted hover:text-ink'
              }`}
              data-testid={`nav-${view}`}
              // The label replaces the button's content as its accessible name,
              // so the badge count has to be folded in here to be announced.
              aria-label={count > 0 ? `${label}, ${pluralisedBadgeLabel(count)}` : label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                className={`shrink-0 ${isActive ? 'h-5 w-5' : 'h-5.5 w-5.5'} ${
                  isActive && fillWhenActive ? 'fill-current' : ''
                }`}
              />
              {isActive && <span className="truncate whitespace-nowrap">{label}</span>}
              {/* No click handler of its own: the badge sits inside the button,
                  so a tap on it bubbles to the button and selects the view. */}
              {count > 0 && (
                <span
                  className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-fill px-1 text-[11px] leading-none font-bold text-white"
                  data-testid={`nav-${view}-badge`}
                  aria-hidden="true"
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
