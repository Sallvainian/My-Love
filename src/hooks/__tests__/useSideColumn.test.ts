/**
 * useSideColumn — the column rule and its three re-read signals
 *
 * happy-dom has no `env()`, so `getComputedStyle` is stubbed to answer the
 * probe's side paddings from `insets`. `tests/setup.ts` mocks ResizeObserver
 * with no callbacks, and happy-dom's `visualViewport` and `screen.orientation`
 * fire nothing on their own, so each is replaced with one the test can fire.
 * A signal is fired with `requestAnimationFrame` stubbed to run nothing, so the
 * re-read under test is the signal's own, not the frame after it.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sideColumnFromInsets, useSideColumn } from '../useSideColumn';

let insets = { left: 0, right: 0 };
let observers: ControllableResizeObserver[] = [];
let viewport: EventTarget | undefined;
let orientation: EventTarget | undefined;
let frames: FrameRequestCallback[] = [];

class ControllableResizeObserver {
  observed: Element[] = [];
  disconnected = false;
  constructor(private readonly callback: ResizeObserverCallback) {
    observers.push(this);
  }
  observe(target: Element) {
    this.observed.push(target);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
  fire() {
    this.callback([], this as unknown as ResizeObserver);
  }
}

const realGetComputedStyle = window.getComputedStyle.bind(window);

function probe(): HTMLElement | null {
  return document.querySelector('[data-testid="side-column-probe"]');
}

function stubSignals({
  withViewport = true,
  withOrientation = true,
  withResizeObserver = true,
}: { withViewport?: boolean; withOrientation?: boolean; withResizeObserver?: boolean } = {}) {
  viewport = withViewport ? new EventTarget() : undefined;
  orientation = withOrientation ? new EventTarget() : undefined;
  vi.stubGlobal('visualViewport', viewport);
  Object.defineProperty(window.screen, 'orientation', {
    configurable: true,
    get: () => orientation,
  });
  vi.stubGlobal('ResizeObserver', withResizeObserver ? ControllableResizeObserver : undefined);
}

function setInsets(left: number, right: number) {
  insets = { left, right };
}

/** Fires a signal and runs nothing queued for the next frame. */
function fire(signal: 'viewport' | 'orientation' | 'resize') {
  act(() => {
    if (signal === 'viewport') viewport?.dispatchEvent(new Event('resize'));
    if (signal === 'orientation') orientation?.dispatchEvent(new Event('change'));
    if (signal === 'resize') for (const observer of observers) observer.fire();
  });
}

function runFrames() {
  act(() => {
    const queued = frames;
    frames = [];
    for (const callback of queued) callback(0);
  });
}

describe('sideColumnFromInsets', () => {
  it.each([
    [0, 84, 'right'],
    [84, 0, 'left'],
    [0, 0, null],
    [62, 62, null],
  ] as const)('insets %d/%d give %s', (left, right, expected) => {
    expect(sideColumnFromInsets(left, right)).toBe(expected);
  });
});

describe('useSideColumn', () => {
  beforeEach(() => {
    insets = { left: 0, right: 0 };
    observers = [];
    frames = [];
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
      const style = realGetComputedStyle(element, pseudo);
      if (element !== probe()) return style;
      return {
        ...style,
        paddingLeft: `${insets.left}px`,
        paddingRight: `${insets.right}px`,
      } as CSSStyleDeclaration;
    });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    stubSignals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window.screen, 'orientation');
  });

  it.each([
    [0, 84, 'right'],
    [84, 0, 'left'],
    [0, 0, null],
    [62, 62, null],
  ] as const)('reads %d/%d as %s on mount', (left, right, expected) => {
    setInsets(left, right);
    const { result } = renderHook(() => useSideColumn());
    expect(result.current).toBe(expected);
  });

  it('pads a hidden fixed probe with the side insets', () => {
    renderHook(() => useSideColumn());

    const element = probe();
    expect(element).not.toBeNull();
    expect(element).toHaveAttribute('aria-hidden', 'true');
    expect(element?.style.position).toBe('fixed');
    expect(element?.style.visibility).toBe('hidden');
    expect(element?.getAttribute('style')).toContain('env(safe-area-inset-left)');
    expect(element?.getAttribute('style')).toContain('env(safe-area-inset-right)');
    // The probe for the pane swap, and one child per side for the side flip.
    const sides = ['left', 'right'].map((side) => element?.querySelector(`[data-side="${side}"]`));
    expect(sides[0]?.getAttribute('style')).toContain('width:env(safe-area-inset-left)');
    expect(sides[1]?.getAttribute('style')).toContain('width:env(safe-area-inset-right)');
    expect(observers[0]?.observed).toEqual([element, ...sides]);
  });

  it('moves the column to the left on a screen.orientation change alone (side flip)', () => {
    setInsets(0, 84);
    const { result } = renderHook(() => useSideColumn());
    expect(result.current).toBe('right');

    setInsets(84, 0);
    fire('orientation');

    expect(result.current).toBe('left');
  });

  it('moves the column on a ResizeObserver callback alone when the flip lands late', () => {
    setInsets(0, 84);
    const { result } = renderHook(() => useSideColumn());

    // The orientation change and its next frame both read the old insets...
    fire('orientation');
    runFrames();
    expect(result.current).toBe('right');

    // ...and the side children's resize reports the flip once layout applies it.
    setInsets(84, 0);
    fire('resize');

    expect(result.current).toBe('left');
  });

  it('finds a column on a ResizeObserver callback alone (pane swap)', () => {
    const { result } = renderHook(() => useSideColumn());
    expect(result.current).toBeNull();

    setInsets(0, 84);
    fire('resize');

    expect(result.current).toBe('right');
  });

  it('drops the column on a visualViewport resize alone (unfold)', () => {
    setInsets(0, 84);
    const { result } = renderHook(() => useSideColumn());

    setInsets(0, 0);
    fire('viewport');

    expect(result.current).toBeNull();
  });

  it('re-reads on the next frame when the insets land after the signal', () => {
    setInsets(0, 84);
    const { result } = renderHook(() => useSideColumn());

    // The orientation change fires before layout applies the new env() values.
    fire('orientation');
    expect(result.current).toBe('right');

    setInsets(84, 0);
    runFrames();

    expect(result.current).toBe('left');
  });

  it('ignores an inset change no signal reports', () => {
    const { result } = renderHook(() => useSideColumn());

    setInsets(0, 84);

    expect(result.current).toBeNull();
  });

  it.each([
    ['visualViewport', { withViewport: false }, ['orientation', 'resize']],
    ['screen.orientation', { withOrientation: false }, ['viewport', 'resize']],
    ['ResizeObserver', { withResizeObserver: false }, ['viewport', 'orientation']],
  ] as const)('still re-reads on the other signals without %s', (_name, missing, remaining) => {
    stubSignals(missing);
    const { result, unmount } = renderHook(() => useSideColumn());
    expect(result.current).toBeNull();

    setInsets(0, 84);
    fire(remaining[0]);
    expect(result.current).toBe('right');

    setInsets(84, 0);
    fire(remaining[1]);
    expect(result.current).toBe('left');

    expect(() => unmount()).not.toThrow();
  });

  it('removes its listeners, observer, frame and probe on unmount', () => {
    setInsets(0, 84);
    const viewportRemove = vi.spyOn(viewport as EventTarget, 'removeEventListener');
    const orientationRemove = vi.spyOn(orientation as EventTarget, 'removeEventListener');
    const { unmount } = renderHook(() => useSideColumn());
    fire('orientation');
    const pendingFrame = frames.length; // the stub's id for the queued re-read
    vi.mocked(cancelAnimationFrame).mockClear();

    unmount();

    expect(probe()).toBeNull();
    expect(observers.every((observer) => observer.disconnected)).toBe(true);
    expect(viewportRemove).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(orientationRemove).toHaveBeenCalledWith('change', expect.any(Function));
    expect(cancelAnimationFrame).toHaveBeenCalledWith(pendingFrame);

    // A signal after unmount reads nothing: no listener survived.
    vi.mocked(window.getComputedStyle).mockClear();
    fire('viewport');
    fire('orientation');
    expect(window.getComputedStyle).not.toHaveBeenCalled();
  });

  it('re-reads on a signal without requestAnimationFrame, and unmounts cleanly', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    vi.stubGlobal('cancelAnimationFrame', undefined);
    const { result, unmount } = renderHook(() => useSideColumn());
    expect(result.current).toBeNull();

    setInsets(0, 84);
    fire('orientation');

    expect(result.current).toBe('right');
    expect(() => unmount()).not.toThrow();
  });
});
