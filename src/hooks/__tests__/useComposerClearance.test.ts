/**
 * useComposerClearance: publishes the Love Notes composer's distance from the
 * screen bottom as `--composer-clearance` on <html>, for the update toast.
 * happy-dom lays nothing out, so the composer's rect and the ResizeObserver
 * are stubbed.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMPOSER_CLEARANCE_PROPERTY, useComposerClearance } from '../useComposerClearance';

let resizeCallbacks: Array<() => void> = [];
const observe = vi.fn();
const disconnect = vi.fn();

class StubResizeObserver {
  constructor(callback: () => void) {
    resizeCallbacks.push(callback);
  }
  observe = observe;
  unobserve = vi.fn();
  disconnect = disconnect;
}

function composerAt(top: number) {
  const element = document.createElement('div');
  element.getBoundingClientRect = vi.fn(() => ({ top }) as DOMRect);
  return element;
}

const clearance = () => document.documentElement.style.getPropertyValue(COMPOSER_CLEARANCE_PROPERTY);

beforeEach(() => {
  resizeCallbacks = [];
  observe.mockClear();
  disconnect.mockClear();
  vi.stubGlobal('ResizeObserver', StubResizeObserver);
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.style.removeProperty(COMPOSER_CLEARANCE_PROPERTY);
});

describe('useComposerClearance', () => {
  it('publishes the composer top edge above the screen bottom, in px', () => {
    const element = composerAt(680);

    renderHook(() => useComposerClearance({ current: element }));

    expect(clearance()).toBe('120px');
    expect(observe).toHaveBeenCalledWith(element);
  });

  it('follows the composer as it grows', () => {
    const element = composerAt(680);
    renderHook(() => useComposerClearance({ current: element }));

    element.getBoundingClientRect = vi.fn(() => ({ top: 600 }) as DOMRect);
    act(() => resizeCallbacks.forEach((callback) => callback()));

    expect(clearance()).toBe('200px');
  });

  it('follows a window resize', () => {
    const element = composerAt(680);
    renderHook(() => useComposerClearance({ current: element }));

    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(900);
    element.getBoundingClientRect = vi.fn(() => ({ top: 760 }) as DOMRect);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(clearance()).toBe('140px');
  });

  it('follows a visual viewport resize', () => {
    const viewport = new EventTarget();
    // happy-dom has no visualViewport; vi.unstubAllGlobals removes it again.
    vi.stubGlobal('visualViewport', viewport);
    const element = composerAt(680);
    renderHook(() => useComposerClearance({ current: element }));

    element.getBoundingClientRect = vi.fn(() => ({ top: 400 }) as DOMRect);
    act(() => {
      viewport.dispatchEvent(new Event('resize'));
    });

    expect(clearance()).toBe('400px');
  });

  it('removes the property and stops observing on unmount', () => {
    const element = composerAt(680);
    const { unmount } = renderHook(() => useComposerClearance({ current: element }));

    unmount();

    expect(clearance()).toBe('');
    expect(disconnect).toHaveBeenCalledTimes(1);
    element.getBoundingClientRect = vi.fn(() => ({ top: 100 }) as DOMRect);
    window.dispatchEvent(new Event('resize'));
    expect(clearance()).toBe('');
  });

  it('publishes nothing without a composer', () => {
    renderHook(() => useComposerClearance({ current: null }));

    expect(clearance()).toBe('');
  });
});
