/**
 * NavigationTray — focus behaviour
 *
 * The house standard is a dedicated focus test per dialog
 * (MoodDetailModal.focus.test.tsx, PhotoViewer.focus.test.tsx). The tray is the
 * first useFocusTrap consumer whose opener stays on screen behind it, so the
 * return-to-opener half is checkable here in a way it was not for the five
 * dialogs that hide their trigger.
 *
 * The Escape handler's identity stability is what these really guard:
 * useFocusTrap.ts:80 lists onEscape in its deps and :48-53 re-focuses
 * initialFocusRef on every run, so an unstable handler would drag focus back to
 * the first destination on every render of the app around it.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { HTMLAttributes, ReactNode, Ref } from 'react';
import { describe, expect, it, vi } from 'vitest';
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

/**
 * Focus is captured from document.activeElement when the trap arms, and
 * fireEvent.click does not focus the way a real pointer does — so the opener is
 * focused explicitly first, exactly as MoodDetailModal.focus.test.tsx does.
 */
function openTray() {
  const toggle = screen.getByTestId('nav-menu-toggle');
  toggle.focus();
  fireEvent.click(toggle);
  return toggle;
}

describe('NavigationTray focus', () => {
  it('moves focus into the panel when the tray opens', async () => {
    render(<NavigationTray currentView="home" onViewChange={vi.fn()} />);

    openTray();

    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('nav-home')));
    expect(screen.getByTestId('nav-tray')).toContainElement(
      document.activeElement as HTMLElement | null
    );
  });

  it('returns focus to the hamburger when the tray closes', async () => {
    render(<NavigationTray currentView="home" onViewChange={vi.fn()} />);

    const toggle = openTray();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('nav-home')));

    fireEvent.click(screen.getByTestId('nav-tray-close'));

    expect(screen.queryByTestId('nav-tray')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(toggle);
  });

  it('closes on Escape and hands focus back to the hamburger', async () => {
    render(<NavigationTray currentView="home" onViewChange={vi.fn()} />);

    const toggle = openTray();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('nav-home')));

    fireEvent.keyDown(screen.getByTestId('nav-home'), { key: 'Escape' });

    expect(screen.queryByTestId('nav-tray')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(toggle);
  });

  it('returns focus to the hamburger after a destination is selected', async () => {
    render(<NavigationTray currentView="home" onViewChange={vi.fn()} />);

    const toggle = openTray();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('nav-home')));

    fireEvent.click(screen.getByTestId('nav-photos'));

    expect(screen.queryByTestId('nav-tray')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(toggle);
  });

  it('returns focus to the hamburger when the backdrop is clicked', async () => {
    render(<NavigationTray currentView="home" onViewChange={vi.fn()} />);

    const toggle = openTray();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('nav-home')));

    fireEvent.click(screen.getByTestId('nav-tray-backdrop'));

    expect(screen.queryByTestId('nav-tray')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(toggle);
  });

  it('wraps Tab from the last focusable back to the first, never leaving the panel', async () => {
    render(<NavigationTray currentView="home" onViewChange={vi.fn()} />);

    openTray();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('nav-home')));

    // Settings is the last destination, so it is the panel's last focusable.
    const last = screen.getByTestId('nav-settings');
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });

    expect(document.activeElement).toBe(screen.getByTestId('nav-tray-close'));
    expect(screen.getByTestId('nav-tray')).toContainElement(
      document.activeElement as HTMLElement | null
    );
  });

  it('wraps Shift+Tab from the first focusable back to the last', async () => {
    render(<NavigationTray currentView="home" onViewChange={vi.fn()} />);

    openTray();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('nav-home')));

    const first = screen.getByTestId('nav-tray-close');
    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(screen.getByTestId('nav-settings'));
  });
});
