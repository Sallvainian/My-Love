/**
 * useDailyDayRereads — while signed in, `loadDailyDay` runs at the next local
 * 20:00:05 (and each day after) and on every return to the front; both are
 * cleaned up on unmount and on a session change.
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

  it('re-reads at 20:00:05 local, not before', () => {
    renderHook(() => useDailyDayRereads());

    act(() => vi.advanceTimersByTime(65_000 - 1));
    expect(state.loadDailyDay).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(state.loadDailyDay).toHaveBeenCalledTimes(1);
  });

  it('re-arms for the next day after it fires, and does not fire again the same day', () => {
    renderHook(() => useDailyDayRereads());

    act(() => vi.advanceTimersByTime(65_000));
    expect(state.loadDailyDay).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(23 * 60 * 60 * 1000));
    expect(state.loadDailyDay).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(60 * 60 * 1000));
    expect(state.loadDailyDay).toHaveBeenCalledTimes(2);
  });

  it("arms tomorrow's 20:00 when mounted after today's", () => {
    vi.setSystemTime(at(21));
    renderHook(() => useDailyDayRereads());

    act(() => vi.advanceTimersByTime(23 * 60 * 60 * 1000 + 4_000));
    expect(state.loadDailyDay).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1_000 + 5_000));
    expect(state.loadDailyDay).toHaveBeenCalledTimes(1);
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

  it('cleans up the timer and the listener on unmount', () => {
    const { unmount } = renderHook(() => useDailyDayRereads());

    unmount();
    act(() => vi.advanceTimersByTime(24 * 60 * 60 * 1000));
    act(() => void document.dispatchEvent(new Event('visibilitychange')));

    expect(state.loadDailyDay).not.toHaveBeenCalled();
  });

  it('does nothing while signed out', () => {
    state.userId = null;
    renderHook(() => useDailyDayRereads());

    act(() => vi.advanceTimersByTime(24 * 60 * 60 * 1000));
    act(() => void document.dispatchEvent(new Event('visibilitychange')));

    expect(state.loadDailyDay).not.toHaveBeenCalled();
  });

  it('re-arms for a new session and drops the old one', () => {
    const { rerender } = renderHook(() => useDailyDayRereads());

    act(() => vi.advanceTimersByTime(30_000));
    state.authSessionVersion = 1;
    rerender();
    // The old timer (due at +35 s) is gone; the new one is a fresh 35 s from now.
    act(() => vi.advanceTimersByTime(34_999));
    expect(state.loadDailyDay).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(state.loadDailyDay).toHaveBeenCalledTimes(1);
  });
});
