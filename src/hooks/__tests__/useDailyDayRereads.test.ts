/**
 * useDailyDayRereads — while signed in, `loadDailyDay` runs on every return to
 * the front and on nothing else: the 20:00:05 evening re-read went with the
 * nudge slots (story 11.1). The listener is removed on unmount and on a session
 * change.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
  userId: 'USER-A' as string | null,
  authSessionVersion: 0,
  loadDailyDay: vi.fn(async () => {}),
};

vi.mock('../../stores/useAppStore', () => ({
  useAppStore: (selector: (s: typeof state) => unknown) => selector(state),
}));

import { useDailyDayRereads } from '../useDailyDayRereads';

/** A local-time instant: 2026-11-05 at `hour:minute:second`. */
const at = (hour: number, minute = 0, second = 0) => new Date(2026, 10, 5, hour, minute, second);

function setVisibility(value: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value, configurable: true });
}

describe('useDailyDayRereads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(state, { userId: 'USER-A', authSessionVersion: 0 });
    setVisibility('visible');
    // Only the clock and the timer: nothing here drives user-event.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(at(19, 59));
  });

  afterEach(() => {
    vi.useRealTimers();
    setVisibility('visible');
  });

  it('does not re-read at 20:00:05 or at any other hour: there is no evening timer', () => {
    renderHook(() => useDailyDayRereads());

    act(() => vi.advanceTimersByTime(48 * 60 * 60 * 1000));

    expect(state.loadDailyDay).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('re-reads on each visibilitychange to visible, and not to hidden', () => {
    renderHook(() => useDailyDayRereads());

    setVisibility('hidden');
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(state.loadDailyDay).not.toHaveBeenCalled();

    setVisibility('visible');
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(state.loadDailyDay).toHaveBeenCalledTimes(2);
  });

  it('removes the listener on unmount', () => {
    const { unmount } = renderHook(() => useDailyDayRereads());

    unmount();
    act(() => void document.dispatchEvent(new Event('visibilitychange')));

    expect(state.loadDailyDay).not.toHaveBeenCalled();
  });

  it('does nothing while signed out', () => {
    state.userId = null;
    renderHook(() => useDailyDayRereads());

    act(() => void document.dispatchEvent(new Event('visibilitychange')));

    expect(state.loadDailyDay).not.toHaveBeenCalled();
  });

  it('listens once for a new session and drops the old listener', () => {
    const { rerender } = renderHook(() => useDailyDayRereads());

    state.authSessionVersion = 1;
    rerender();
    act(() => void document.dispatchEvent(new Event('visibilitychange')));

    expect(state.loadDailyDay).toHaveBeenCalledTimes(1);
  });
});
