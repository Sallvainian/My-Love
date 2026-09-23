/**
 * AppNavigation — behaviour
 *
 * Replaces the tray's two suites, deleted with it. There is no disclosure any
 * more, so no focus test: the dock and the gear are always on screen and hold
 * no trap. These pin the contract — what the chrome does, not how it is styled
 * — so the markup can change without rewriting them.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ViewType } from '../../../stores/slices/navigationSlice';
import { AppNavigation } from '../AppNavigation';

const DOCK_DESTINATIONS: ViewType[] = ['home', 'mood', 'notes', 'photos', 'partner'];
const ALL_DESTINATIONS: ViewType[] = [...DOCK_DESTINATIONS, 'settings'];

function renderNavigation(
  overrides: {
    currentView?: ViewType;
    badgeCounts?: Partial<Record<ViewType, number>>;
  } = {}
) {
  const onViewChange = vi.fn();
  const utils = render(
    <AppNavigation
      currentView={overrides.currentView ?? 'home'}
      onViewChange={onViewChange}
      badgeCounts={overrides.badgeCounts}
    />
  );
  return { ...utils, onViewChange };
}

describe('AppNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Chrome', () => {
    it('shows only the wordmark and the gear in the top bar', () => {
      renderNavigation();

      const header = screen.getByTestId('app-header');
      expect(header).toHaveTextContent(/^My Love$/);
      expect(within(header).getAllByRole('button')).toEqual([
        screen.getByTestId('nav-settings'),
      ]);
    });

    it('puts the five destinations in a Primary nav landmark and Settings outside it', () => {
      renderNavigation();

      const dock = screen.getByTestId('nav-dock');
      expect(dock.tagName).toBe('NAV');
      expect(dock).toHaveAttribute('aria-label', 'Primary');
      expect(within(dock).getAllByRole('button')).toHaveLength(5);
      for (const view of DOCK_DESTINATIONS) {
        expect(within(dock).getByTestId(`nav-${view}`)).toBeInTheDocument();
      }
      expect(within(dock).queryByTestId('nav-settings')).not.toBeInTheDocument();
      expect(screen.queryByTestId('nav-scripture')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Scripture')).not.toBeInTheDocument();
    });

    it('renders no hamburger, tray or backdrop', () => {
      renderNavigation();

      expect(screen.queryByTestId('nav-menu-toggle')).not.toBeInTheDocument();
      expect(screen.queryByTestId('nav-tray')).not.toBeInTheDocument();
      expect(screen.queryByTestId('nav-tray-backdrop')).not.toBeInTheDocument();
    });

    it('carries no logout control — Settings holds the only sign-out', () => {
      renderNavigation();

      // 'Logout' was the retired control's exact accessible name.
      expect(screen.queryByLabelText('Logout')).not.toBeInTheDocument();
      expect(screen.queryByText(/sign out/i)).not.toBeInTheDocument();
    });
  });

  describe('Destinations', () => {
    it('keeps the tray accessible names', () => {
      renderNavigation();

      expect(screen.getByTestId('nav-home')).toHaveAttribute('aria-label', 'Home');
      expect(screen.getByTestId('nav-mood')).toHaveAttribute('aria-label', 'Mood');
      expect(screen.getByTestId('nav-notes')).toHaveAttribute('aria-label', 'Love Notes');
      expect(screen.getByTestId('nav-photos')).toHaveAttribute('aria-label', 'Photos');
      expect(screen.getByTestId('nav-partner')).toHaveAttribute('aria-label', 'Partner');
      expect(screen.getByTestId('nav-settings')).toHaveAttribute('aria-label', 'Settings');
    });

    it('makes every destination a real button', () => {
      renderNavigation();

      for (const view of ALL_DESTINATIONS) {
        const item = screen.getByTestId(`nav-${view}`);
        expect(item.tagName).toBe('BUTTON');
        expect(item).toHaveAttribute('type', 'button');
      }
    });

    it.each(ALL_DESTINATIONS)('reports %s when its control is clicked', (view) => {
      const { onViewChange } = renderNavigation({
        currentView: view === 'home' ? 'mood' : 'home',
      });

      fireEvent.click(screen.getByTestId(`nav-${view}`));

      expect(onViewChange).toHaveBeenCalledTimes(1);
      expect(onViewChange).toHaveBeenCalledWith(view);
    });

    it.each(ALL_DESTINATIONS)('gives aria-current="page" to %s alone when active', (view) => {
      renderNavigation({ currentView: view });

      expect(screen.getByTestId(`nav-${view}`)).toHaveAttribute('aria-current', 'page');
      for (const other of ALL_DESTINATIONS.filter((v) => v !== view)) {
        expect(screen.getByTestId(`nav-${other}`)).not.toHaveAttribute('aria-current');
      }
    });

    it('shows the label of the active dock item only', () => {
      renderNavigation({ currentView: 'notes' });

      expect(screen.getByTestId('nav-notes')).toHaveTextContent('Love Notes');
      for (const view of DOCK_DESTINATIONS.filter((v) => v !== 'notes')) {
        expect(screen.getByTestId(`nav-${view}`).textContent).toBe('');
      }
    });
  });

  describe('Badges', () => {
    it('renders no badge when no counts are supplied', () => {
      renderNavigation();

      for (const view of ALL_DESTINATIONS) {
        expect(screen.queryByTestId(`nav-${view}-badge`)).not.toBeInTheDocument();
      }
    });

    it('renders no badge for a zero or negative count', () => {
      renderNavigation({ badgeCounts: { notes: 0, photos: -2 } });

      expect(screen.queryByTestId('nav-notes-badge')).not.toBeInTheDocument();
      expect(screen.queryByTestId('nav-photos-badge')).not.toBeInTheDocument();
    });

    it('announces a pluralised count in its dock item\'s name', () => {
      renderNavigation({ badgeCounts: { notes: 1, photos: 3 } });

      // The button's aria-label replaces its content as the accessible name,
      // so the count has to be in that label; the badge itself is hidden.
      const single = screen.getByTestId('nav-notes-badge');
      expect(single).toHaveTextContent('1');
      expect(single).toHaveAttribute('aria-hidden', 'true');
      expect(single).not.toHaveAttribute('aria-label');
      expect(screen.getByRole('button', { name: 'Love Notes, 1 new item' })).toContainElement(single);

      const plural = screen.getByTestId('nav-photos-badge');
      expect(plural).toHaveTextContent('3');
      expect(plural).toHaveAttribute('aria-hidden', 'true');
      expect(screen.getByRole('button', { name: 'Photos, 3 new items' })).toContainElement(plural);

      // A dock item with no count keeps its bare label.
      expect(screen.getByRole('button', { name: 'Mood' })).toBeInTheDocument();
    });

    it('ignores a settings count', () => {
      renderNavigation({ badgeCounts: { settings: 4 } });

      expect(screen.queryByTestId('nav-settings-badge')).not.toBeInTheDocument();
      expect(screen.getByTestId('nav-settings').textContent).toBe('');
    });

    it('selects its view when the badge itself is tapped', () => {
      const { onViewChange } = renderNavigation({ badgeCounts: { notes: 2 } });

      fireEvent.click(screen.getByTestId('nav-notes-badge'));

      expect(onViewChange).toHaveBeenCalledTimes(1);
      expect(onViewChange).toHaveBeenCalledWith('notes');
    });
  });
});
