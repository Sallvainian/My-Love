/**
 * UpdateToast: the native shell's download progress, then the Refresh prompt.
 * The status comes from a stub of nativeUpdates' store, driven per test.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, forwardRef, type ComponentType, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UpdateStatus } from '../../../services/nativeUpdates';

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
    applyUpdate: vi.fn(() => Promise.resolve()),
  };
});

vi.mock('../../../services/nativeUpdates', () => ({
  getUpdateStatus: store.get,
  subscribeUpdateStatus: store.subscribe,
  applyUpdate: store.applyUpdate,
}));

const MOTION_PROPS = new Set(['initial', 'animate', 'exit', 'transition']);

// Every `m.<tag>` renders the plain tag without Motion's props, so the toast
// appears and leaves at once instead of waiting on an animation.
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
  };
});

import { UpdateToast } from '../UpdateToast';

beforeEach(() => {
  store.set({ state: 'idle' });
  store.applyUpdate.mockClear();
});

afterEach(cleanup);

describe('UpdateToast', () => {
  it('renders nothing while no update is under way', () => {
    render(<UpdateToast />);

    expect(screen.queryByTestId('update-toast')).not.toBeInTheDocument();
  });

  it('shows an indeterminate bar until the first percent arrives', () => {
    store.set({ state: 'downloading', percent: null });
    render(<UpdateToast />);

    expect(screen.getByTestId('update-toast')).toBeVisible();
    expect(screen.getByText('Downloading update…')).toBeVisible();
    expect(screen.getByRole('progressbar', { name: 'Update download' })).not.toHaveAttribute(
      'aria-valuenow'
    );
    expect(screen.queryByTestId('update-toast-percent')).not.toBeInTheDocument();
  });

  it('follows the download percent', () => {
    store.set({ state: 'downloading', percent: 12.4 });
    render(<UpdateToast />);
    const bar = screen.getByRole('progressbar', { name: 'Update download' });

    expect(bar).toHaveAttribute('aria-valuenow', '12');
    expect(screen.getByTestId('update-toast-percent')).toHaveTextContent('12%');

    act(() => store.set({ state: 'downloading', percent: 87 }));

    expect(bar).toHaveAttribute('aria-valuenow', '87');
    expect(screen.getByTestId('update-toast-percent')).toHaveTextContent('87%');
  });

  it('turns into the Refresh prompt once the build is ready', () => {
    store.set({ state: 'downloading', percent: 99 });
    render(<UpdateToast />);

    act(() => store.set({ state: 'ready' }));

    expect(screen.getByText('Refresh app for update?')).toBeVisible();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeVisible();
  });

  it('applies the update when Refresh is tapped', async () => {
    store.set({ state: 'ready' });
    render(<UpdateToast />);

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(store.applyUpdate).toHaveBeenCalledTimes(1);
  });

  it('hides the prompt on dismiss without applying the update', async () => {
    store.set({ state: 'ready' });
    render(<UpdateToast />);

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss update' }));

    expect(screen.queryByTestId('update-toast')).not.toBeInTheDocument();
    expect(store.applyUpdate).not.toHaveBeenCalled();
  });

  it('hides the progress on dismiss and still shows the prompt once ready', async () => {
    store.set({ state: 'downloading', percent: 30 });
    render(<UpdateToast />);

    await userEvent.click(screen.getByRole('button', { name: 'Hide download progress' }));

    expect(screen.queryByTestId('update-toast')).not.toBeInTheDocument();

    act(() => store.set({ state: 'downloading', percent: 60 }));
    expect(screen.queryByTestId('update-toast')).not.toBeInTheDocument();

    act(() => store.set({ state: 'ready' }));
    expect(screen.getByText('Refresh app for update?')).toBeVisible();
  });

  it('sits at the top, below the status bar, and clear of the side column', () => {
    store.set({ state: 'ready' });
    render(<UpdateToast />);

    expect(screen.getByTestId('update-toast')).toHaveClass(
      'fixed',
      'top-[calc(env(safe-area-inset-top)+0.5rem)]',
      'left-[calc(var(--dock-left)+1rem)]',
      'right-[calc(var(--dock-right)+1rem)]'
    );
  });
});
