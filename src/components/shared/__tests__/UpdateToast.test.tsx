/**
 * UpdateToast: the native shell's download progress, then the ready toast,
 * at the bottom of the screen. The status and the confirm store come from a
 * stub of nativeUpdates, driven per test. setTimeout is faked for the ready
 * toast's 6 s, so user-event advances the faked clock (AGENTS.md).
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, forwardRef, type ComponentType, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UpdateStatus } from '../../../services/nativeUpdates';

const store = vi.hoisted(() => {
  let status: UpdateStatus = { state: 'idle' };
  const listeners = new Set<() => void>();
  let confirmOpen = false;
  const confirmListeners = new Set<() => void>();
  const setConfirm = (next: boolean) => {
    confirmOpen = next;
    confirmListeners.forEach((listener) => listener());
  };
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
    getConfirm: () => confirmOpen,
    setConfirm,
    subscribeConfirm(listener: () => void) {
      confirmListeners.add(listener);
      return () => confirmListeners.delete(listener);
    },
    openUpdateConfirm: vi.fn(() => setConfirm(true)),
    reduceMotion: false,
  };
});

vi.mock('../../../services/nativeUpdates', () => ({
  getUpdateStatus: store.get,
  subscribeUpdateStatus: store.subscribe,
  getUpdateConfirmOpen: store.getConfirm,
  subscribeUpdateConfirm: store.subscribeConfirm,
  openUpdateConfirm: store.openUpdateConfirm,
}));

const MOTION_PROPS = new Set(['initial', 'animate', 'exit', 'transition']);

/** The motion props the toast was last rendered with, by test id. */
const motionPropsByTestId = vi.hoisted(() => new Map<string, Record<string, unknown>>());

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
        const testId = props['data-testid'];
        if (typeof testId === 'string') {
          motionPropsByTestId.set(
            testId,
            Object.fromEntries(Object.entries(props).filter(([key]) => MOTION_PROPS.has(key)))
          );
        }
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
    useReducedMotion: () => store.reduceMotion,
  };
});

import { READY_TOAST_MS, UpdateToast } from '../UpdateToast';

/** setTimeout is faked here, so user-event's own pauses must advance it. */
function setupUser() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

beforeEach(() => {
  store.set({ state: 'idle' });
  store.setConfirm(false);
  store.reduceMotion = false;
  store.openUpdateConfirm.mockClear();
  motionPropsByTestId.clear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  // Testing Library recognises only Jest's fake timers: without a `jest` global
  // it ends every user-event action waiting on a setTimeout(0) that the faked
  // clock never fires.
  vi.stubGlobal('jest', { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

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

  it('has no close button and no tap target while downloading', () => {
    store.set({ state: 'downloading', percent: 30 });
    render(<UpdateToast />);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('leaves when a download fails and the status returns to idle', () => {
    store.set({ state: 'downloading', percent: 30 });
    render(<UpdateToast />);

    act(() => store.set({ state: 'idle' }));

    expect(screen.queryByTestId('update-toast')).not.toBeInTheDocument();
  });

  it('turns into the ready toast in the same place once the build is ready', () => {
    store.set({ state: 'downloading', percent: 99 });
    render(<UpdateToast />);
    const toast = screen.getByTestId('update-toast');

    act(() => store.set({ state: 'ready' }));

    expect(screen.getByTestId('update-toast')).toBe(toast);
    expect(toast).toHaveAttribute('data-state', 'ready');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update ready — tap to restart' })).toBeVisible();
  });

  it('makes the ready toast one 44px tap target with no close button', () => {
    store.set({ state: 'ready' });
    render(<UpdateToast />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName('Update ready — tap to restart');
    expect(buttons[0]).toHaveClass('min-h-11', 'w-full');
    expect(screen.queryByRole('button', { name: /dismiss|close|hide/i })).not.toBeInTheDocument();
  });

  it('hides the ready toast after 6 seconds and keeps it hidden for the launch', () => {
    expect(READY_TOAST_MS).toBe(6000);
    store.set({ state: 'ready' });
    render(<UpdateToast />);

    act(() => vi.advanceTimersByTime(READY_TOAST_MS - 1));
    expect(screen.getByTestId('update-toast')).toBeVisible();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByTestId('update-toast')).not.toBeInTheDocument();

    // The status stays ready, and nothing brings the toast back.
    act(() => store.set({ state: 'ready' }));
    act(() => vi.advanceTimersByTime(READY_TOAST_MS));
    expect(screen.queryByTestId('update-toast')).not.toBeInTheDocument();
  });

  it('hides on a tap, opens the confirm dialog, and stays hidden after it closes', async () => {
    const user = setupUser();
    store.set({ state: 'ready' });
    render(<UpdateToast />);

    await user.click(screen.getByRole('button', { name: 'Update ready — tap to restart' }));

    expect(store.openUpdateConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('update-toast')).not.toBeInTheDocument();

    // No closes the dialog; the toast does not come back this launch.
    act(() => store.setConfirm(false));
    expect(screen.queryByTestId('update-toast')).not.toBeInTheDocument();
  });

  it('hides when the bell entry opens the confirm dialog', () => {
    store.set({ state: 'ready' });
    render(<UpdateToast />);

    act(() => store.setConfirm(true));
    expect(screen.queryByTestId('update-toast')).not.toBeInTheDocument();

    act(() => store.setConfirm(false));
    expect(screen.queryByTestId('update-toast')).not.toBeInTheDocument();
  });

  it('sits above the dock, or the composer, and clear of the side column', () => {
    store.set({ state: 'ready' });
    render(<UpdateToast />);

    const toast = screen.getByTestId('update-toast');
    expect(toast).toHaveClass(
      'fixed',
      'z-100',
      'max-w-sm',
      'bottom-[calc(var(--composer-clearance,var(--dock-top))+12px)]',
      'left-[calc(var(--dock-left)+1rem)]',
      'right-[calc(var(--dock-right)+1rem)]'
    );
    expect(toast.className).not.toMatch(/\btop-/);
  });

  it('springs up from below, and only fades under Reduce Motion', () => {
    store.set({ state: 'downloading', percent: 10 });
    const { unmount } = render(<UpdateToast />);

    expect(motionPropsByTestId.get('update-toast')).toMatchObject({
      initial: { opacity: 0, y: 40 },
      animate: { opacity: 1, y: 0 },
    });
    unmount();

    store.reduceMotion = true;
    render(<UpdateToast />);
    expect(motionPropsByTestId.get('update-toast')).toEqual(
      expect.objectContaining({
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      })
    );
  });
});
