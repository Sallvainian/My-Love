/**
 * AppNavigation — behaviour
 *
 * Replaces the tray's two suites, deleted with it. There is no disclosure any
 * more, so no focus test: the dock and the gear are always on screen and hold
 * no trap. These pin the contract — what the chrome does, not how it is styled
 * — so the markup can change without rewriting them.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SideColumn } from '../../../hooks/useSideColumn';
import type { ViewType } from '../../../stores/slices/navigationSlice';
import { AppNavigation } from '../AppNavigation';

// The form follows the side insets, which happy-dom cannot report; the hook's
// own suite covers reading them, so here it is driven directly.
const sideColumn = vi.hoisted(() => ({ current: null as SideColumn | null }));
vi.mock('../../../hooks/useSideColumn', () => ({
  useSideColumn: () => sideColumn.current,
}));

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
    sideColumn.current = null;
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-dock');
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

    it.each(ALL_DESTINATIONS)('reports %s when its control is clicked', async (view) => {
      const user = userEvent.setup();
      const { onViewChange } = renderNavigation({
        currentView: view === 'home' ? 'mood' : 'home',
      });

      await user.click(screen.getByTestId(`nav-${view}`));

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

    it('selects its view when the badge itself is tapped', async () => {
      const user = userEvent.setup();
      const { onViewChange } = renderNavigation({ badgeCounts: { notes: 2 } });

      await user.click(screen.getByTestId('nav-notes-badge'));

      expect(onViewChange).toHaveBeenCalledTimes(1);
      expect(onViewChange).toHaveBeenCalledWith('notes');
    });
  });

  describe('Forms', () => {
    const LABELS: Partial<Record<ViewType, string>> = {
      home: 'Home',
      mood: 'Mood',
      notes: 'Love Notes',
      photos: 'Photos',
      partner: 'Partner',
      settings: 'Settings',
    };

    it('is the bottom dock with no data-dock when there is no side column', () => {
      renderNavigation();

      expect(screen.getByTestId('nav-dock')).toHaveAttribute('data-form', 'bottom');
      expect(document.documentElement).not.toHaveAttribute('data-dock');
    });

    it.each(['left', 'right'] as const)(
      'is a column capsule publishing data-dock="column-%s" in a %s column',
      (side) => {
        sideColumn.current = side;
        renderNavigation();

        const dock = screen.getByTestId('nav-dock');
        expect(dock).toHaveAttribute('data-form', 'column');
        expect(document.documentElement).toHaveAttribute('data-dock', `column-${side}`);
      }
    );

    function expectOnePrimaryNav(views: ViewType[]) {
      const navs = screen.getAllByRole('navigation');
      expect(navs).toHaveLength(1);
      expect(navs[0]).toBe(screen.getByTestId('nav-dock'));
      expect(navs[0]).toHaveAttribute('aria-label', 'Primary');
      const buttons = within(navs[0]).getAllByRole('button');
      expect(buttons.map((b) => b.getAttribute('data-testid'))).toEqual(
        views.map((view) => `nav-${view}`)
      );
      expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(
        views.map((view) => LABELS[view])
      );
    }

    it('keeps one Primary nav of five labelled buttons and the header gear with no column', () => {
      renderNavigation();

      expectOnePrimaryNav(DOCK_DESTINATIONS);
      const header = screen.getByTestId('app-header');
      expect(within(header).getAllByRole('button')).toEqual([screen.getByTestId('nav-settings')]);
      expect(screen.getAllByTestId('nav-settings')).toHaveLength(1);
    });

    it.each(['left', 'right'] as const)(
      'keeps one Primary nav of six labelled buttons, Settings last, and no header button (column %s)',
      (side) => {
        sideColumn.current = side;
        renderNavigation();

        expectOnePrimaryNav(ALL_DESTINATIONS);
        expect(screen.getAllByTestId('nav-settings')).toHaveLength(1);
        const header = screen.getByTestId('app-header');
        expect(within(header).queryAllByRole('button')).toEqual([]);
        // Two gear-sized spacers flank the wordmark, so it stays centred.
        const row = header.firstElementChild as HTMLElement;
        const spacers = [row.firstElementChild, row.lastElementChild];
        for (const spacer of spacers) {
          expect(spacer?.tagName).toBe('SPAN');
          expect(spacer).toHaveAttribute('aria-hidden', 'true');
          expect(spacer).toHaveClass('min-h-11', 'min-w-11');
          expect(spacer).toBeEmptyDOMElement();
        }
        expect(row.children[1]).toBe(screen.getByTestId('app-wordmark'));
        expect(row.children).toHaveLength(3);
      }
    );

    it.each(['notes', 'settings'] as const)(
      'shows icons only in the column, the active one (%s) highlighted',
      (current) => {
        sideColumn.current = 'right';
        renderNavigation({ currentView: current });

        for (const view of ALL_DESTINATIONS) {
          expect(screen.getByTestId(`nav-${view}`).textContent).toBe('');
        }
        const active = screen.getByTestId(`nav-${current}`);
        expect(active).toHaveAttribute('aria-current', 'page');
        expect(active).toHaveClass('bg-tint', 'text-accent', 'h-11', 'w-11');
        for (const view of ALL_DESTINATIONS.filter((v) => v !== current)) {
          expect(screen.getByTestId(`nav-${view}`)).not.toHaveClass('bg-tint');
          expect(screen.getByTestId(`nav-${view}`)).toHaveClass('h-11', 'w-11', 'text-muted');
          expect(screen.getByTestId(`nav-${view}`)).not.toHaveAttribute('aria-current');
        }
      }
    );

    it('makes the column Settings a real button reporting settings', async () => {
      sideColumn.current = 'right';
      const user = userEvent.setup();
      const { onViewChange } = renderNavigation();

      const settings = within(screen.getByTestId('nav-dock')).getByTestId('nav-settings');
      expect(settings.tagName).toBe('BUTTON');
      expect(settings).toHaveAttribute('type', 'button');
      await user.click(settings);

      expect(onViewChange).toHaveBeenCalledTimes(1);
      expect(onViewChange).toHaveBeenCalledWith('settings');
    });

    it('ignores a settings count in the column', () => {
      sideColumn.current = 'left';
      renderNavigation({ badgeCounts: { settings: 4, notes: 2 } });

      expect(screen.queryByTestId('nav-settings-badge')).not.toBeInTheDocument();
      expect(screen.getByTestId('nav-settings').textContent).toBe('');
      expect(screen.getByTestId('nav-settings')).toHaveAttribute('aria-label', 'Settings');
      // Other column badges still render.
      expect(screen.getByTestId('nav-notes-badge')).toHaveTextContent('2');
    });

    it('reports a column tap through the same onViewChange', async () => {
      sideColumn.current = 'left';
      const user = userEvent.setup();
      const { onViewChange } = renderNavigation();

      await user.click(screen.getByTestId('nav-photos'));

      expect(onViewChange).toHaveBeenCalledTimes(1);
      expect(onViewChange).toHaveBeenCalledWith('photos');
    });

    it('switches form on a re-render, keeping the current view and moving data-dock', () => {
      const onViewChange = vi.fn();
      const { rerender } = render(
        <AppNavigation currentView="mood" onViewChange={onViewChange} />
      );
      expect(screen.getByTestId('nav-dock')).toHaveAttribute('data-form', 'bottom');

      for (const [side, dock] of [
        ['right', 'column-right'],
        ['left', 'column-left'],
        [null, null],
      ] as const) {
        sideColumn.current = side;
        rerender(<AppNavigation currentView="mood" onViewChange={onViewChange} />);

        expect(screen.getByTestId('nav-dock')).toHaveAttribute(
          'data-form',
          side ? 'column' : 'bottom'
        );
        if (dock) expect(document.documentElement).toHaveAttribute('data-dock', dock);
        else expect(document.documentElement).not.toHaveAttribute('data-dock');
        expect(screen.getByTestId('nav-mood')).toHaveAttribute('aria-current', 'page');
      }
      expect(onViewChange).not.toHaveBeenCalled();
    });

    it('moves Settings between the gear and the column on a form switch, aria-current following', () => {
      const onViewChange = vi.fn();
      const { rerender } = render(
        <AppNavigation currentView="settings" onViewChange={onViewChange} />
      );
      const header = screen.getByTestId('app-header');
      const dock = screen.getByTestId('nav-dock');

      for (const side of [null, 'right', null] as const) {
        sideColumn.current = side;
        rerender(<AppNavigation currentView="settings" onViewChange={onViewChange} />);

        const settings = screen.getByTestId('nav-settings');
        expect(screen.getAllByTestId('nav-settings')).toHaveLength(1);
        expect(side ? dock : header).toContainElement(settings);
        expect(side ? header : dock).not.toContainElement(settings);
        expect(settings).toHaveAttribute('aria-current', 'page');
        expect(settings).toHaveClass('bg-tint', 'text-accent');
        for (const view of DOCK_DESTINATIONS) {
          expect(screen.getByTestId(`nav-${view}`)).not.toHaveAttribute('aria-current');
        }
      }
      expect(onViewChange).not.toHaveBeenCalled();
    });

    it('clears data-dock on unmount', () => {
      sideColumn.current = 'right';
      const { unmount } = renderNavigation();
      expect(document.documentElement).toHaveAttribute('data-dock', 'column-right');

      unmount();

      expect(document.documentElement).not.toHaveAttribute('data-dock');
    });

    // The reload case: a fresh mount already in the column form marks the view
    // the URL restored.
    it.each(ALL_DESTINATIONS)('marks %s on a fresh mount in the column form', (view) => {
      sideColumn.current = 'right';
      renderNavigation({ currentView: view });

      expect(screen.getByTestId(`nav-${view}`)).toHaveAttribute('aria-current', 'page');
      for (const other of ALL_DESTINATIONS.filter((v) => v !== view)) {
        expect(screen.getByTestId(`nav-${other}`)).not.toHaveAttribute('aria-current');
      }
    });
  });
});
