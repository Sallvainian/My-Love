/**
 * NavigationTray — behaviour
 *
 * Replaces the retired bottom bar's own suite, deleted with it. The seventh
 * destination is why the bar went: `settings` had nowhere to live on a row that
 * was already carrying six tabs and a logout button.
 *
 * These pin the contract from the story's I/O matrix — what the tray does, not
 * how it is styled — so the panel's markup can change without rewriting them.
 * Focus behaviour lives in the sibling NavigationTray.focus.test.tsx, following
 * the house standard of a dedicated focus test per dialog.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { HTMLAttributes, ReactNode, Ref } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ViewType } from '../../../stores/slices/navigationSlice';
import { NavigationTray } from '../NavigationTray';

type DivProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
};

vi.mock('framer-motion', () => ({
  m: {
    div: ({ children, ...props }: DivProps) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

const ALL_DESTINATIONS: ViewType[] = [
  'home',
  'mood',
  'notes',
  'partner',
  'photos',
  'scripture',
  'settings',
];

function renderTray(
  overrides: {
    currentView?: ViewType;
    badgeCounts?: Partial<Record<ViewType, number>>;
  } = {}
) {
  const onViewChange = vi.fn();
  const utils = render(
    <NavigationTray
      currentView={overrides.currentView ?? 'home'}
      onViewChange={onViewChange}
      badgeCounts={overrides.badgeCounts}
    />
  );
  return { ...utils, onViewChange };
}

function openTray() {
  fireEvent.click(screen.getByTestId('nav-menu-toggle'));
}

describe('NavigationTray', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Disclosure', () => {
    it('renders the hamburger with the panel closed', () => {
      renderTray();

      const toggle = screen.getByTestId('nav-menu-toggle');
      expect(toggle).toBeInTheDocument();
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('nav-tray')).not.toBeInTheDocument();
    });

    it('points aria-controls at the panel it opens', () => {
      renderTray();
      const controlledId = screen.getByTestId('nav-menu-toggle').getAttribute('aria-controls');
      expect(controlledId).toBeTruthy();

      openTray();

      expect(screen.getByTestId('nav-tray')).toHaveAttribute('id', controlledId);
    });

    it('tracks aria-expanded as the tray opens and closes', () => {
      renderTray();
      const toggle = screen.getByTestId('nav-menu-toggle');

      openTray();
      expect(toggle).toHaveAttribute('aria-expanded', 'true');

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('nav-tray')).not.toBeInTheDocument();
    });

    it('marks the panel as a modal dialog', () => {
      renderTray();
      openTray();

      const panel = screen.getByTestId('nav-tray');
      expect(panel).toHaveAttribute('role', 'dialog');
      expect(panel).toHaveAttribute('aria-modal', 'true');
    });
  });

  describe('Destinations', () => {
    it('renders all seven destinations, including settings', () => {
      renderTray();
      openTray();

      for (const view of ALL_DESTINATIONS) {
        expect(screen.getByTestId(`nav-${view}`)).toBeInTheDocument();
      }
    });

    it('keeps the retired bar accessible names', () => {
      renderTray();
      openTray();

      expect(screen.getByTestId('nav-home')).toHaveAttribute('aria-label', 'Home');
      expect(screen.getByTestId('nav-mood')).toHaveAttribute('aria-label', 'Mood');
      expect(screen.getByTestId('nav-notes')).toHaveAttribute('aria-label', 'Love Notes');
      expect(screen.getByTestId('nav-partner')).toHaveAttribute('aria-label', 'Partner');
      expect(screen.getByTestId('nav-photos')).toHaveAttribute('aria-label', 'Photos');
      expect(screen.getByTestId('nav-scripture')).toHaveAttribute('aria-label', 'Scripture');
      expect(screen.getByTestId('nav-settings')).toHaveAttribute('aria-label', 'Settings');
    });

    it('reports the view and closes the tray when a destination is selected', () => {
      const { onViewChange } = renderTray();
      openTray();

      fireEvent.click(screen.getByTestId('nav-scripture'));

      expect(onViewChange).toHaveBeenCalledTimes(1);
      expect(onViewChange).toHaveBeenCalledWith('scripture');
      expect(screen.queryByTestId('nav-tray')).not.toBeInTheDocument();
      expect(screen.getByTestId('nav-menu-toggle')).toHaveAttribute('aria-expanded', 'false');
    });

    it('closes the tray when the backdrop is clicked', () => {
      const { onViewChange } = renderTray();
      openTray();

      fireEvent.click(screen.getByTestId('nav-tray-backdrop'));

      expect(screen.queryByTestId('nav-tray')).not.toBeInTheDocument();
      expect(onViewChange).not.toHaveBeenCalled();
    });

    it('gives aria-current="page" to the active destination alone', () => {
      renderTray({ currentView: 'photos' });
      openTray();

      expect(screen.getByTestId('nav-photos')).toHaveAttribute('aria-current', 'page');
      for (const view of ALL_DESTINATIONS.filter((v) => v !== 'photos')) {
        expect(screen.getByTestId(`nav-${view}`)).not.toHaveAttribute('aria-current');
      }
    });

    it('gives every destination the 48px touch target the h-16 row used to supply', () => {
      renderTray();
      openTray();

      for (const view of ALL_DESTINATIONS) {
        expect(screen.getByTestId(`nav-${view}`)).toHaveClass('min-h-[48px]');
      }
    });
  });

  describe('Badge slots', () => {
    it('renders no badge and no aggregate indicator when no counts are supplied', () => {
      renderTray();

      expect(screen.queryByTestId('nav-menu-badge')).not.toBeInTheDocument();

      openTray();
      for (const view of ALL_DESTINATIONS) {
        expect(screen.queryByTestId(`nav-${view}-badge`)).not.toBeInTheDocument();
      }
    });

    it('renders no badge for a zero count', () => {
      renderTray({ badgeCounts: { notes: 0, photos: 0 } });

      expect(screen.queryByTestId('nav-menu-badge')).not.toBeInTheDocument();

      openTray();
      expect(screen.queryByTestId('nav-notes-badge')).not.toBeInTheDocument();
      expect(screen.queryByTestId('nav-photos-badge')).not.toBeInTheDocument();
    });

    it('renders a per-destination badge with a pluralised label when a count is supplied', () => {
      renderTray({ badgeCounts: { notes: 1, photos: 3 } });
      openTray();

      const single = screen.getByTestId('nav-notes-badge');
      expect(single).toHaveTextContent('1');
      expect(single).toHaveAttribute('aria-label', '1 new item');

      const plural = screen.getByTestId('nav-photos-badge');
      expect(plural).toHaveTextContent('3');
      expect(plural).toHaveAttribute('aria-label', '3 new items');
    });

    it('sums the counts into an aggregate indicator on the closed hamburger', () => {
      renderTray({ badgeCounts: { notes: 1, photos: 3 } });

      const aggregate = screen.getByTestId('nav-menu-badge');
      expect(aggregate).toHaveTextContent('4');
      expect(aggregate).toHaveAttribute('aria-label', '4 new items');
    });

    it('navigates rather than swallowing the click when a badge itself is tapped', () => {
      const { onViewChange } = renderTray({ badgeCounts: { notes: 2 } });
      openTray();

      fireEvent.click(screen.getByTestId('nav-notes-badge'));

      expect(onViewChange).toHaveBeenCalledTimes(1);
      expect(onViewChange).toHaveBeenCalledWith('notes');
    });
  });

  describe('Sign-out consolidation', () => {
    it('carries no logout control — Settings holds the only sign-out', () => {
      renderTray();
      openTray();

      // 'Logout' was the retired control's exact accessible name.
      expect(screen.queryByLabelText('Logout')).not.toBeInTheDocument();
      expect(screen.queryByText(/sign out/i)).not.toBeInTheDocument();
    });
  });
});
