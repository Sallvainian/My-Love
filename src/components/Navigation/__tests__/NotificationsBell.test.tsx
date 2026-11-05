/**
 * NotificationsBell: the native shell's header bell, its dot while an update
 * is ready, and the Notifications drop-down with the "Update now" entry. The
 * status comes from a stub of nativeUpdates' store, driven per test.
 */
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, forwardRef, type ComponentType, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UpdateStatus } from '../../../services/nativeUpdates';
import type { ViewType } from '../../../stores/slices/navigationSlice';

const store = vi.hoisted(() => {
  let status: UpdateStatus = { state: 'idle' };
  const listeners = new Set<() => void>();
  return {
    get: () => status,
    set(next: UpdateStatus) {
      status = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    openUpdateConfirm: vi.fn(),
  };
});

vi.mock('../../../services/nativeUpdates', () => ({
  getUpdateStatus: store.get,
  subscribeUpdateStatus: store.subscribe,
  openUpdateConfirm: store.openUpdateConfirm,
}));

const MOTION_PROPS = new Set(['initial', 'animate', 'exit', 'transition']);

// Every `m.<tag>` renders the plain tag without Motion's props, so the list
// opens and closes at once instead of waiting on an animation.
vi.mock('motion/react', () => {
  const byTag = new Map<string, ComponentType>();
  const motionFor = (tag: string) => {
    let component = byTag.get(tag);
    if (!component) {
      component = forwardRef<HTMLElement, Record<string, unknown>>(function Motion(
        { children, ...props },
        ref
      ) {
        const rest = Object.fromEntries(
          Object.entries(props).filter(([key]) => !MOTION_PROPS.has(key))
        );
        return createElement(tag, { ...rest, ref }, children as ReactNode);
      }) as unknown as ComponentType;
      byTag.set(tag, component);
    }
    return component;
  };
  return {
    m: new Proxy({}, { get: (_target, tag: string) => motionFor(tag) }),
    AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
    useReducedMotion: () => false,
  };
});

import { NotificationsBell } from '../NotificationsBell';

const bell = () => screen.getByRole('button', { name: 'Notifications' });
const list = () => screen.queryByTestId('notifications-list');

function renderBell(currentView: ViewType = 'home') {
  // A control under where the drop-down's catcher spreads, to prove an outside
  // tap presses nothing.
  const underneath = vi.fn();
  const utils = render(
    <>
      <NotificationsBell currentView={currentView} />
      <button type="button" onClick={underneath}>
        Underneath
      </button>
    </>
  );
  return { ...utils, underneath };
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  store.set({ state: 'idle' });
  store.openUpdateConfirm.mockClear();
});

afterEach(() => {
  cleanup();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});

describe('NotificationsBell', () => {
  it('is a 44px round button like the gear, closed and muted at first', () => {
    renderBell();

    expect(bell()).toHaveAttribute('type', 'button');
    expect(bell()).toHaveAttribute('aria-expanded', 'false');
    expect(bell()).toHaveClass('min-h-11', 'min-w-11', 'rounded-full', 'text-muted');
    expect(list()).not.toBeInTheDocument();
  });

  it('shows the dot only while an update is ready', () => {
    renderBell();
    expect(screen.queryByTestId('nav-notifications-dot')).not.toBeInTheDocument();

    act(() => store.set({ state: 'downloading', percent: 50 }));
    expect(screen.queryByTestId('nav-notifications-dot')).not.toBeInTheDocument();

    act(() => store.set({ state: 'ready' }));
    const dot = screen.getByTestId('nav-notifications-dot');
    expect(bell()).toContainElement(dot);
    expect(dot).toHaveClass('bg-fill', 'ring-glass');
  });

  it('opens "No notifications" when nothing is waiting', async () => {
    renderBell();

    await userEvent.click(bell());

    const dropDown = screen.getByRole('group', { name: 'Notifications' });
    expect(dropDown).toBeVisible();
    expect(within(dropDown).getByText('No notifications')).toBeVisible();
    expect(within(dropDown).queryByRole('button')).not.toBeInTheDocument();
    expect(bell()).toHaveAttribute('aria-expanded', 'true');
    expect(bell()).toHaveClass('text-ink');
  });

  it('lists the "Update now" entry while an update is ready, and keeps the dot', async () => {
    store.set({ state: 'ready' });
    renderBell();

    await userEvent.click(bell());

    const dropDown = screen.getByRole('group', { name: 'Notifications' });
    const entry = within(dropDown).getByRole('button', { name: /Update now/ });
    expect(entry).toHaveTextContent('Update nowA new version of My Love is ready.');
    expect(entry).toHaveClass('min-h-11');
    expect(within(dropDown).queryByText('No notifications')).not.toBeInTheDocument();
    expect(screen.getByTestId('nav-notifications-dot')).toBeInTheDocument();
  });

  it('closes and opens the confirm dialog when the entry is tapped, and keeps the dot', async () => {
    store.set({ state: 'ready' });
    renderBell();
    await userEvent.click(bell());

    await userEvent.click(screen.getByRole('button', { name: /Update now/ }));

    expect(list()).not.toBeInTheDocument();
    expect(store.openUpdateConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('nav-notifications-dot')).toBeInTheDocument();
  });

  it('closes on a second tap of the bell', async () => {
    renderBell();

    await userEvent.click(bell());
    await userEvent.click(bell());

    expect(list()).not.toBeInTheDocument();
    expect(bell()).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on a tap outside, which presses nothing underneath', async () => {
    const { underneath } = renderBell();
    await userEvent.click(bell());

    const catcher = screen.getByTestId('notifications-catcher');
    expect(catcher).toHaveClass('fixed', 'inset-0', 'z-105');
    await userEvent.click(catcher);

    expect(list()).not.toBeInTheDocument();
    expect(screen.queryByTestId('notifications-catcher')).not.toBeInTheDocument();
    expect(underneath).not.toHaveBeenCalled();
  });

  it('hangs from <body> above the catcher, outside the header', async () => {
    renderBell();
    await userEvent.click(bell());

    expect(list()?.parentElement).toBe(document.body);
    expect(list()).toHaveClass('fixed', 'left-3', 'z-110', 'overflow-y-auto');
  });

  it('closes when the view changes', async () => {
    const { rerender } = renderBell('home');
    await userEvent.click(bell());

    rerender(<NotificationsBell currentView="mood" />);

    expect(list()).not.toBeInTheDocument();
  });

  it('closes when the app goes to the background, not when it comes back', async () => {
    renderBell();
    await userEvent.click(bell());

    act(() => setVisibility('visible'));
    expect(list()).toBeInTheDocument();

    act(() => setVisibility('hidden'));
    expect(list()).not.toBeInTheDocument();
  });

  it('opens and closes without touching the address or the history', async () => {
    const pushState = vi.spyOn(window.history, 'pushState');
    const replaceState = vi.spyOn(window.history, 'replaceState');
    const href = window.location.href;
    const length = window.history.length;
    store.set({ state: 'ready' });
    renderBell();

    await userEvent.click(bell());
    await userEvent.click(bell());
    await userEvent.click(bell());
    await userEvent.click(screen.getByTestId('notifications-catcher'));

    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
    expect(window.location.href).toBe(href);
    expect(window.history.length).toBe(length);
    pushState.mockRestore();
    replaceState.mockRestore();
  });
});
