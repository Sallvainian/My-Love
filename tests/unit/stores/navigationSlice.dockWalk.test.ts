/**
 * navigationSlice: the dock walk always ends (DW-441).
 *
 * A dock pick above the first history entry walks back with `history.go(-depth)`
 * and lands on the `popstate` that causes. These pin the walk's three exits when
 * that popstate does not come: a stored depth past the start of the history is
 * clamped, a safety-net timer lands the pick in place, and a `pageshow` from the
 * back/forward cache clears a walk the frozen page can no longer finish.
 *
 * The walk's state is module-level, so each test loads a fresh store.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

vi.mock('../../../src/utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn() },
}));

type AppStore = typeof import('../../../src/stores/useAppStore').useAppStore;
type NavigationModule = typeof import('../../../src/stores/slices/navigationSlice');

let useAppStore: AppStore;
let WALK_TIMEOUT_MS: NavigationModule['WALK_TIMEOUT_MS'];
let warn: MockInstance<typeof console.warn>;

/** A `pageshow` the way a back/forward cache restore delivers it. */
function pageshow(persisted: boolean): Event {
  const event = new Event('pageshow');
  Object.defineProperty(event, 'persisted', { value: persisted });
  return event;
}

/**
 * Spy on `history.go` the way a browser behaves: the walk runs, but its
 * `popstate` arrives on a later task, not inside the call (happy-dom's is
 * synchronous, which would land a pick before the next tap could come).
 */
function spyOnGoAsync() {
  const realGo = window.history.go.bind(window.history);
  return vi.spyOn(window.history, 'go').mockImplementation((delta) => {
    setTimeout(() => realGo(delta), 0);
  });
}

describe('navigationSlice dock walk', () => {
  beforeEach(async () => {
    window.history.replaceState(null, '', '/');
    vi.resetModules();
    ({ useAppStore } = await import('../../../src/stores/useAppStore'));
    ({ WALK_TIMEOUT_MS } = await import('../../../src/stores/slices/navigationSlice'));
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // A test can end mid-walk, and a reset module leaves its listeners on the
    // shared window: end the walk so the next test's popstate is its own.
    window.dispatchEvent(pageshow(true));
    vi.restoreAllMocks();
    vi.useRealTimers();
    window.history.replaceState(null, '', '/');
  });

  it('walks to the first entry and lands the last pick, however many taps came mid-walk', async () => {
    useAppStore.getState().setView('mood');
    await vi.waitFor(() => expect(window.location.pathname).toBe('/mood'));
    const go = spyOnGoAsync();

    useAppStore.getState().setView('notes');
    useAppStore.getState().setView('photos');

    expect(go).toHaveBeenCalledTimes(1);
    expect(go).toHaveBeenCalledWith(-1);
    await vi.waitFor(() => expect(window.location.pathname).toBe('/photos'));
    expect(window.history.state).toEqual({ view: 'photos', inApp: true, depth: 1 });
    expect(useAppStore.getState().currentView).toBe('photos');

    window.history.back();
    await vi.waitFor(() => expect(window.location.pathname).toBe('/'));
  });

  it('clamps a stored depth past the start of the history and lands both taps', async () => {
    useAppStore.getState().setView('mood');
    await vi.waitFor(() => expect(window.location.pathname).toBe('/mood'));
    window.history.replaceState({ ...window.history.state, depth: 50 }, '');
    const go = vi.spyOn(window.history, 'go');
    const entriesBelow = window.history.length - 1;

    useAppStore.getState().setView('notes');

    expect(go).toHaveBeenCalledTimes(1);
    expect(go).toHaveBeenCalledWith(-entriesBelow);
    await vi.waitFor(() => expect(window.location.pathname).toBe('/notes'));

    useAppStore.getState().setView('photos');
    await vi.waitFor(() => expect(window.location.pathname).toBe('/photos'));
    expect(window.history.state).toEqual({ view: 'photos', inApp: true, depth: 1 });
  });

  it('lands the last pick in place when no popstate ever comes, then walks again on the next tap', async () => {
    useAppStore.getState().setView('mood');
    await vi.waitFor(() => expect(window.location.pathname).toBe('/mood'));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const go = vi.spyOn(window.history, 'go').mockImplementation(() => {});

    useAppStore.getState().setView('notes');
    useAppStore.getState().setView('photos');

    expect(go).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe('/mood');

    vi.advanceTimersByTime(WALK_TIMEOUT_MS);

    expect(window.location.pathname).toBe('/photos');
    expect(window.history.state).toEqual({ view: 'photos', inApp: true, depth: 1 });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("'photos'"));
    expect(vi.getTimerCount()).toBe(0);

    // The entry under /photos is Home now, and the next tap walks again.
    useAppStore.getState().setView('notes');
    expect(go).toHaveBeenCalledTimes(2);
  });

  it('does not land anything when the walk ended before the timer', async () => {
    useAppStore.getState().setView('mood');
    await vi.waitFor(() => expect(window.location.pathname).toBe('/mood'));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    // happy-dom delivers the walk's popstate inside `go`, so the walk is over
    // before the timer's turn.
    useAppStore.getState().setView('notes');

    expect(window.location.pathname).toBe('/notes');
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(WALK_TIMEOUT_MS);
    expect(warn).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/notes');
  });

  it('clears a walk on a persisted pageshow, so the next tap starts a fresh one', async () => {
    useAppStore.getState().setView('mood');
    await vi.waitFor(() => expect(window.location.pathname).toBe('/mood'));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const go = vi.spyOn(window.history, 'go').mockImplementation(() => {});

    useAppStore.getState().setView('notes');
    expect(vi.getTimerCount()).toBe(1);

    window.dispatchEvent(pageshow(true));

    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(WALK_TIMEOUT_MS);
    expect(warn).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/mood');

    useAppStore.getState().setView('photos');
    expect(go).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('keeps a walk under way through a pageshow that is not from the cache', async () => {
    useAppStore.getState().setView('mood');
    await vi.waitFor(() => expect(window.location.pathname).toBe('/mood'));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const go = vi.spyOn(window.history, 'go').mockImplementation(() => {});

    useAppStore.getState().setView('notes');
    window.dispatchEvent(pageshow(false));
    useAppStore.getState().setView('photos');

    expect(go).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
  });
});
